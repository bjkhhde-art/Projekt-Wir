/* Shared plumbing for the live two-player games: who am I, lobby and invites,
   version-guarded moves, live sync and leaving. Each game only renders its board. */

const GameRoom = (() => {
  const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";
  const LEAVE_CONFIRM_MS = 4000;
  const MAX_WRITE_ATTEMPTS = 4;

  /* config: { table, title, icon, url, lobbyEl, boardEl, leaveBtn,
       createState(host, guest, option), renderBoard(game), isFinished(state),
       startOptions?: [{ value, label, hint }] } */
  function create(config) {
    const { table, title, icon, url, lobbyEl, boardEl, leaveBtn } = config;
    const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const personModal = document.getElementById("personModal");

    let person = localStorage.getItem("pw_person");
    let currentGame = null;
    let lastRenderedJson = null;
    let syncGeneration = 0;
    let actionInFlight = false;
    let leaveArmedTimer = null;
    let chosenOption = config.startOptions ? config.startOptions[0].value : null;

    function requirePerson() {
      if (person) return true;
      personModal.classList.remove("hidden");
      return false;
    }

    document.querySelectorAll(".person-choice-btn").forEach(button => {
      button.addEventListener("click", () => {
        person = button.dataset.person;
        localStorage.setItem("pw_person", person);
        personModal.classList.add("hidden");
        lastRenderedJson = null;
        sync();
      });
    });
    if (!person) personModal.classList.remove("hidden");

    /* ---------- data ---------- */

    async function fetchCurrentGame() {
      const { data, error } = await client
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("Fehler beim Laden des Spiels:", error);
        return null;
      }
      return data;
    }

    async function createGame() {
      if (!requirePerson()) return;
      const { error } = await client
        .from(table)
        .insert({ status: "waiting", host_person: person, guest_person: null, state: { option: chosenOption }, version: 0 });
      if (error) {
        console.error("Fehler beim Erstellen:", error);
        showToast("Runde konnte nicht erstellt werden.", "error");
        return;
      }
      sendAppNotification(client, {
        title: `${title}-Einladung ${icon}`,
        body: `${person} lädt dich zu einer Runde ${title} ein.`,
        excludePerson: normalizePerson(person),
        category: "games",
        url
      });
      await sync();
    }

    async function cancelWaitingGame(gameId) {
      const { error } = await client.from(table).delete().eq("id", gameId);
      if (error) {
        console.error("Fehler beim Abbrechen:", error);
        showToast("Konnte nicht abgebrochen werden.", "error");
      }
      await sync();
    }

    async function joinGame(game) {
      if (!requirePerson()) return;
      const state = config.createState(game.host_person, person, game.state && game.state.option);
      const { error } = await client
        .from(table)
        .update({ guest_person: person, status: "active", state, version: (game.version || 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", game.id);
      if (error) {
        console.error("Fehler beim Beitreten:", error);
        showToast("Beitreten hat nicht geklappt.", "error");
        return;
      }
      await sync();
    }

    /* Both players may act at the same time, so every write is guarded by the row's version:
       if the other device saved in between, the move is recomputed on the fresh state. */
    async function dispatch(actionFn, ...args) {
      if (!requirePerson() || actionInFlight) return;
      actionInFlight = true;
      try {
        for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
          const fresh = await fetchCurrentGame();
          if (!fresh || fresh.status !== "active") {
            await sync();
            return;
          }

          let nextState;
          try {
            nextState = actionFn(fresh.state, person, ...args);
          } catch (error) {
            showToast(error.message, "error");
            return;
          }

          const { data, error } = await client
            .from(table)
            .update({ state: nextState, version: fresh.version + 1, updated_at: new Date().toISOString() })
            .eq("id", fresh.id)
            .eq("version", fresh.version)
            .select();
          if (error) {
            console.error("Fehler beim Speichern des Spielzugs:", error);
            showToast("Zug konnte nicht gespeichert werden.", "error");
            return;
          }
          if (data && data.length > 0) {
            await sync();
            return;
          }
        }
        showToast("Gleichzeitiger Zug – bitte nochmal tippen.", "error");
        await sync();
      } finally {
        actionInFlight = false;
      }
    }

    async function leaveGame() {
      if (!requirePerson()) return;
      const fresh = await fetchCurrentGame();
      if (!fresh || fresh.status !== "active") {
        await sync();
        return;
      }
      const { error } = await client
        .from(table)
        .update({ status: "closed", state: { ...fresh.state, closedBy: person }, version: fresh.version + 1, updated_at: new Date().toISOString() })
        .eq("id", fresh.id);
      if (error) {
        console.error("Fehler beim Beenden:", error);
        showToast("Spiel konnte nicht beendet werden.", "error");
        return;
      }
      await sync();
    }

    /* ---------- leave button (tap twice while a game is running) ---------- */

    function disarmLeave() {
      clearTimeout(leaveArmedTimer);
      leaveArmedTimer = null;
      leaveBtn.classList.remove("armed");
    }

    function renderLeave(state) {
      const done = config.isFinished(state);
      if (leaveArmedTimer && !done) return;
      disarmLeave();
      leaveBtn.textContent = done ? "Zurück zur Übersicht" : "Spiel beenden";
    }

    leaveBtn.addEventListener("click", () => {
      const done = currentGame && currentGame.state && config.isFinished(currentGame.state);
      if (done || leaveArmedTimer) {
        disarmLeave();
        leaveGame();
        return;
      }
      leaveBtn.classList.add("armed");
      leaveBtn.textContent = "Wirklich beenden? Nochmal tippen";
      leaveArmedTimer = setTimeout(() => {
        disarmLeave();
        leaveBtn.textContent = "Spiel beenden";
      }, LEAVE_CONFIRM_MS);
    });

    /* ---------- lobby ---------- */

    function showLobby(html) {
      disarmLeave();
      if (window.GameAnim) GameAnim.revealAll();
      boardEl.classList.add("hidden");
      lobbyEl.classList.remove("hidden");
      lobbyEl.innerHTML = `<div class="gr-lobby-card card"><div class="gr-lobby-icon">${icon}</div>${html}</div>`;
    }

    function optionsHtml() {
      if (!config.startOptions) return "";
      return `<div class="gr-options" role="radiogroup">${config.startOptions.map(o => `
        <button type="button" class="gr-option${o.value === chosenOption ? " selected" : ""}" data-option="${o.value}" role="radio" aria-checked="${o.value === chosenOption}">
          <span class="gr-option-label">${escapeHtml(o.label)}</span>
          <span class="gr-option-hint">${escapeHtml(o.hint)}</span>
        </button>`).join("")}</div>`;
    }

    function renderLobbyNoGame(note) {
      showLobby(`
        ${note ? `<p class="gr-lobby-note">${escapeHtml(note)}</p>` : ""}
        <h2>Noch keine Runde</h2>
        <p>Startet eine Runde ${escapeHtml(title)} &ndash; der andere kann direkt beitreten.</p>
        ${optionsHtml()}
        <button id="grStartBtn" class="btn btn-block">Neue Runde starten</button>
      `);
      lobbyEl.querySelectorAll(".gr-option").forEach(button => {
        button.addEventListener("click", () => {
          chosenOption = button.dataset.option;
          lobbyEl.querySelectorAll(".gr-option").forEach(b => {
            const selected = b === button;
            b.classList.toggle("selected", selected);
            b.setAttribute("aria-checked", String(selected));
          });
        });
      });
      document.getElementById("grStartBtn").addEventListener("click", createGame);
    }

    function optionLabel(game) {
      if (!config.startOptions || !game.state) return "";
      const option = config.startOptions.find(o => o.value === game.state.option);
      return option ? option.label : "";
    }

    function renderLobbyWaitingAsHost(game) {
      const label = optionLabel(game);
      showLobby(`
        <h2>Warte auf Mitspieler:in</h2>
        ${label ? `<p>${escapeHtml(label)}</p>` : ""}
        <div class="gr-lobby-waiting"><span class="gr-spinner"></span> Einladung ist raus...</div>
        <button id="grCancelBtn" class="btn btn-secondary btn-block">Abbrechen</button>
      `);
      document.getElementById("grCancelBtn").addEventListener("click", () => cancelWaitingGame(game.id));
    }

    function renderLobbyWaitingAsGuest(game) {
      const label = optionLabel(game);
      showLobby(`
        <h2>${escapeHtml(game.host_person)} lädt dich ein!</h2>
        <p>Bereit für eine Runde ${escapeHtml(title)}${label ? ` (${escapeHtml(label)})` : ""}?</p>
        <button id="grJoinBtn" class="btn btn-block">Beitreten</button>
      `);
      document.getElementById("grJoinBtn").addEventListener("click", () => joinGame(game));
    }

    /* ---------- sync ---------- */

    async function sync() {
      const generation = ++syncGeneration;
      const game = await fetchCurrentGame();
      if (generation !== syncGeneration) return;

      /* re-rendering an unchanged game would restart running card animations */
      const json = JSON.stringify(game);
      if (json === lastRenderedJson) return;
      lastRenderedJson = json;
      currentGame = game;

      if (!game) {
        renderLobbyNoGame("");
        return;
      }
      if (game.status === "closed") {
        const closedBy = game.state && game.state.closedBy;
        const endedEarly = !(game.state && config.isFinished(game.state));
        renderLobbyNoGame(closedBy && closedBy !== person && endedEarly ? `${closedBy} hat das letzte Spiel beendet.` : "");
        return;
      }
      if (game.status === "waiting") {
        if (game.host_person === person) {
          renderLobbyWaitingAsHost(game);
        } else {
          renderLobbyWaitingAsGuest(game);
        }
        return;
      }

      lobbyEl.classList.add("hidden");
      boardEl.classList.remove("hidden");
      config.renderBoard(game);
      renderLeave(game.state);
    }

    function start() {
      client
        .channel(`${table}_changes`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => sync())
        .subscribe();
      sync();
    }

    return {
      get person() { return person; },
      get game() { return currentGame; },
      opponentOf(game) {
        return game.host_person === person ? game.guest_person : game.host_person;
      },
      dispatch,
      start
    };
  }

  return { create };
})();
