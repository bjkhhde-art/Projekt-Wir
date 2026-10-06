/* Shared plumbing for the live games: who am I, lobby for up to four with invite links for
   friends, version-guarded moves, live sync and leaving. Each game only renders its board.

   Isi and Benji are members (unlocked phones). Friends open the game page with ?invite=<code>
   (pin-lock.js lets exactly that through), pick a name and only ever see this one game. */

const GameRoom = (() => {
  const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";
  const LEAVE_CONFIRM_MS = 4000;
  const MAX_WRITE_ATTEMPTS = 4;
  const MEMBERS = ["Isi", "Benji"];
  const NAME_MAX = 20;
  const REACTIONS = ["😂", "😭", "😍", "😡", "😱", "🤯", "🔥", "👏", "🙈", "😏"];
  const REACTION_GAP_MS = 700;
  const REACTION_SHOW_MS = 2600;

  const isMember = name => MEMBERS.includes(name);
  /* older Cabo rounds were saved as "finished" once over – they still count as the table in use */
  const isRunning = status => status === "active" || status === "finished";

  function newInviteCode() {
    const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
  }

  /* a friend's name: short, plain text, never "Isi"/"Benji" and not taken in this round */
  function cleanGuestName(raw) {
    return String(raw || "")
      .normalize("NFC")
      .replace(/[^\p{L}\p{N} .'-]+/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, NAME_MAX);
  }

  /* Wraps a "next round" step: each player marks themselves ready (tapping again takes it back);
     the step only runs once everybody at the table is ready. */
  function readyFor(nextFn) {
    return (state, who, ...args) => {
      const players = state.players || [];
      const ready = new Set(state.readyNext || []);
      if (ready.has(who)) ready.delete(who);
      else ready.add(who);
      const list = players.filter(p => ready.has(p));
      if (players.length > 0 && list.length === players.length) return nextFn(state, who, ...args);
      return { ...state, readyNext: list };
    };
  }

  function guestNameProblem(name, taken) {
    if (!name) return "Bitte gib einen Namen ein.";
    const lower = name.toLowerCase();
    if (MEMBERS.some(m => m.toLowerCase() === lower)) return `„${name}“ ist schon vergeben – nimm einen anderen Namen.`;
    if (taken.some(t => t.toLowerCase() === lower)) return `„${name}“ spielt schon mit – nimm einen anderen Namen.`;
    return null;
  }

  /* config: { table, title, icon, url, lobbyEl, boardEl, leaveBtn,
       createState(players, option), renderBoard(game), isFinished(state),
       startOptions?: [{ value, label, hint }], hideOptions? (the option comes from outside, no picker),
       url may also be a function of the chosen option, onSync?(game) runs after every render,
       maxPlayers? (default 4), invites? (default true) } */
  function create(config) {
    const { table, title, icon, url, lobbyEl, boardEl, leaveBtn } = config;
    const maxPlayers = config.maxPlayers || 4;
    const invites = config.invites !== false;
    const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const personModal = document.getElementById("personModal");

    const guestInvite = invites && window.PW_GUEST_INVITE ? window.PW_GUEST_INVITE : null;
    const isGuest = Boolean(guestInvite);
    const guestKey = guestInvite ? `pw_guest:${table}:${guestInvite}` : null;

    let person = isGuest ? readGuestName() : localStorage.getItem("pw_person");
    let currentGame = null;
    let lastRenderedJson = null;
    let syncGeneration = 0;
    let actionInFlight = false;
    let leaveArmedTimer = null;
    const optionValues = (config.startOptions || []).map(o => o.value);
    let chosenOption = config.startOptions
      ? (optionValues.includes(config.initialOption) ? config.initialOption : optionValues[0])
      : null;
    let reactionChannel = null;
    let reactionGameId = null;
    let lastReactionAt = 0;
    const reactionUi = buildReactionUi();

    function readGuestName() {
      try {
        return localStorage.getItem(guestKey) || null;
      } catch (error) {
        return null;
      }
    }

    function storeGuestName(name) {
      try {
        localStorage.setItem(guestKey, name);
      } catch (error) {
        /* the name then only lives as long as this page */
      }
    }

    function requirePerson() {
      if (person) return true;
      if (!isGuest) personModal.classList.remove("hidden");
      return false;
    }

    if (isGuest) {
      leaveBtn.classList.add("hidden");
    } else {
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
    }

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

    /* Several people may act at the same time, so every write is guarded by the row's version:
       if another device saved in between, the change is recomputed on the fresh row.
       change(fresh) returns the columns to write, or null to give up quietly; throwing shows the message. */
    async function mutate(change) {
      for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
        const fresh = await fetchCurrentGame();
        if (!fresh) return false;

        let patch;
        try {
          patch = change(fresh);
        } catch (error) {
          showToast(error.message, "error");
          return false;
        }
        if (!patch) return false;

        const version = fresh.version || 0;
        if (patch.state && fresh.status === "finished") patch.status = "active";
        const { data, error } = await client
          .from(table)
          .update({ ...patch, version: version + 1, updated_at: new Date().toISOString() })
          .eq("id", fresh.id)
          .eq("version", version)
          .select();
        if (error) {
          console.error("Fehler beim Speichern:", error);
          showToast("Konnte nicht gespeichert werden.", "error");
          return false;
        }
        if (data && data.length > 0) return true;
      }
      showToast("Gleichzeitig getippt – bitte nochmal.", "error");
      return false;
    }

    async function createGame() {
      if (!requirePerson()) return;
      const row = { status: "waiting", host_person: person, guest_person: null, state: { option: chosenOption, lobby: [person] }, version: 0 };
      if (invites) row.invite_code = newInviteCode();
      const { error } = await client.from(table).insert(row);
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
        url: typeof url === "function" ? url(chosenOption) : url
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

    function lobbyOf(game) {
      const lobby = game && game.state && Array.isArray(game.state.lobby) ? game.state.lobby : null;
      if (lobby) return lobby;
      return game ? [game.host_person, game.guest_person].filter(Boolean) : [];
    }

    function startPatch(fresh, lobby) {
      return {
        status: "active",
        guest_person: lobby[1] || null,
        state: config.createState(lobby.slice(), fresh.state && fresh.state.option)
      };
    }

    async function joinLobby(name) {
      if (!name) return;
      await mutate(fresh => {
        if (fresh.status !== "waiting" || (isGuest && fresh.invite_code !== guestInvite)) return null;
        const lobby = lobbyOf(fresh);
        if (lobby.includes(name)) return null;
        if (lobby.length >= maxPlayers) throw new Error("Die Runde ist schon voll.");
        const next = [...lobby, name];
        /* a two-person game (Versus) starts as soon as the second one is in */
        if (maxPlayers === 2 && next.length === 2) return startPatch(fresh, next);
        return { state: { ...fresh.state, lobby: next } };
      });
      await sync();
    }

    async function leaveLobby() {
      await mutate(fresh => {
        if (fresh.status !== "waiting") return null;
        return { state: { ...fresh.state, lobby: lobbyOf(fresh).filter(p => p !== person) } };
      });
      await sync();
    }

    /* Isi or Benji starts once everybody who wants to play is in */
    async function beginGame() {
      if (!requirePerson() || !isMember(person)) return;
      await mutate(fresh => {
        if (fresh.status !== "waiting") return null;
        const lobby = lobbyOf(fresh);
        if (!lobby.includes(person)) return null;
        if (lobby.length < 2) throw new Error("Es braucht mindestens zwei Personen.");
        return startPatch(fresh, lobby);
      });
      await sync();
    }

    async function dispatch(actionFn, ...args) {
      if (!requirePerson() || actionInFlight) return;
      actionInFlight = true;
      try {
        await mutate(fresh => {
          if (!isRunning(fresh.status) || !fresh.state.players || !fresh.state.players.includes(person)) return null;
          return { state: actionFn(fresh.state, person, ...args) };
        });
        await sync();
      } finally {
        actionInFlight = false;
      }
    }

    async function leaveGame() {
      if (!requirePerson() || isGuest) return;
      const fresh = await fetchCurrentGame();
      if (!fresh || !isRunning(fresh.status)) {
        await sync();
        return;
      }
      const { error } = await client
        .from(table)
        .update({ status: "closed", state: { ...fresh.state, closedBy: person }, version: (fresh.version || 0) + 1, updated_at: new Date().toISOString() })
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

    /* ---------- emoji reactions: short, live, never stored ---------- */

    function buildReactionUi() {
      const wrap = document.createElement("div");
      wrap.className = "gr-react hidden";
      wrap.innerHTML = `
        <div class="gr-react-tray hidden" id="grReactTray" role="group" aria-label="Emoji schicken">
          ${REACTIONS.map(e => `<button type="button" class="gr-react-emoji" data-emoji="${e}" aria-label="${e} schicken">${e}</button>`).join("")}
        </div>
        <button type="button" class="gr-react-toggle" id="grReactBtn" aria-label="Emoji schicken" aria-expanded="false">😊</button>
      `;
      const layer = document.createElement("div");
      layer.className = "gr-react-layer";
      layer.setAttribute("aria-live", "polite");
      document.body.append(wrap, layer);
      const tray = wrap.querySelector(".gr-react-tray");
      const toggle = wrap.querySelector(".gr-react-toggle");
      const setOpen = open => {
        tray.classList.toggle("hidden", !open);
        toggle.setAttribute("aria-expanded", String(open));
      };
      toggle.addEventListener("click", () => setOpen(tray.classList.contains("hidden")));
      tray.querySelectorAll(".gr-react-emoji").forEach(button => {
        button.addEventListener("click", () => {
          sendReaction(button.dataset.emoji);
          setOpen(false);
        });
      });
      return { wrap, layer, setOpen };
    }

    function joinReactions(game) {
      if (!person || reactionGameId === game.id) return;
      if (reactionChannel) client.removeChannel(reactionChannel);
      reactionGameId = game.id;
      reactionChannel = client
        .channel(`${table}-reactions-${game.id}`, { config: { presence: { key: person }, broadcast: { self: false } } })
        .on("broadcast", { event: "reaction" }, ({ payload }) => showReaction(payload))
        .subscribe();
    }

    function sendReaction(emoji) {
      if (!REACTIONS.includes(emoji) || !reactionChannel) return;
      const now = Date.now();
      if (now - lastReactionAt < REACTION_GAP_MS) return;
      lastReactionAt = now;
      showReaction({ from: person, emoji });
      reactionChannel.send({ type: "broadcast", event: "reaction", payload: { from: person, emoji } });
    }

    /* only known emojis and a short name from the others are shown – everything else is ignored */
    function showReaction(payload) {
      if (!payload || !REACTIONS.includes(payload.emoji) || typeof payload.from !== "string") return;
      const from = payload.from.slice(0, NAME_MAX);
      const bubble = document.createElement("div");
      bubble.className = "gr-reaction";
      bubble.style.left = `${12 + Math.random() * 64}%`;
      bubble.innerHTML = `<span class="gr-reaction-emoji">${payload.emoji}</span><span class="gr-reaction-name">${escapeHtml(from === person ? "Du" : from)}</span>`;
      reactionUi.layer.appendChild(bubble);
      if (from !== person && navigator.vibrate) navigator.vibrate(12);
      setTimeout(() => bubble.remove(), REACTION_SHOW_MS);
    }

    /* the next-round button: everybody taps "ready", the round starts when all are */
    function renderReady(container, state, { label, nextFn }) {
      const players = state.players || [];
      const ready = state.readyNext || [];
      const mine = ready.includes(person);
      const waiting = players.filter(p => p !== person && !ready.includes(p));
      const wrap = document.createElement("div");
      wrap.className = "gr-ready";
      const button = document.createElement("button");
      button.type = "button";
      button.className = `btn btn-block gr-ready-btn${mine ? " btn-secondary is-ready" : ""}`;
      button.textContent = mine ? `✓ Bereit – warte auf ${listNames(waiting)}` : label;
      button.setAttribute("aria-pressed", String(mine));
      button.addEventListener("click", () => dispatch(readyFor(nextFn)));
      const list = document.createElement("div");
      list.className = "gr-ready-list";
      list.innerHTML = players.map(p => {
        const isReady = ready.includes(p);
        return `<span class="gr-ready-chip${isReady ? " ready" : ""}">${isReady ? "✓" : "…"} ${escapeHtml(p === person ? "Du" : p)}</span>`;
      }).join("");
      const hint = document.createElement("p");
      hint.className = "gr-ready-hint";
      hint.textContent = mine ? "Nochmal tippen, um doch noch zu warten." : "Weiter geht's, sobald alle bereit sind.";
      wrap.append(button, list, hint);
      container.appendChild(wrap);
      return button;
    }

    function showLobby(html) {
      reactionUi.wrap.classList.add("hidden");
      reactionUi.setOpen(false);
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

    function optionLabel(game) {
      if (!config.startOptions || !game.state) return "";
      const option = config.startOptions.find(o => o.value === game.state.option);
      return option ? option.label : "";
    }

    function playersHtml(names, host) {
      const slots = names.map(name => `
        <li class="gr-player${name === person ? " me" : ""}">
          <span class="gr-player-name">${escapeHtml(name)}</span>
          ${name === host ? `<span class="gr-player-tag">lädt ein</span>` : ""}
          ${!isMember(name) ? `<span class="gr-player-tag guest">Gast</span>` : ""}
          ${name === person ? `<span class="gr-player-tag me">du</span>` : ""}
        </li>`).join("");
      const free = Math.max(0, maxPlayers - names.length);
      const empty = Array.from({ length: free }, () => `<li class="gr-player empty">frei</li>`).join("");
      return `<ul class="gr-players" aria-label="Mitspieler">${slots}${empty}</ul>`;
    }

    function inviteLink(game) {
      return `${location.origin}${location.pathname}?invite=${encodeURIComponent(game.invite_code)}`;
    }

    function inviteHtml(game) {
      if (!invites || !game.invite_code) return "";
      return `
        <div class="gr-invite">
          <p class="gr-invite-title">Freunde einladen</p>
          <p class="gr-invite-text">Wer den Link hat, kann mit Namen beitreten und sieht nur dieses Spiel.</p>
          <div class="gr-invite-row">
            <input id="grInviteLink" class="gr-invite-link" type="text" readonly value="${escapeHtml(inviteLink(game))}" aria-label="Einladungslink">
            <button id="grCopyInvite" type="button" class="btn btn-sm">📋 Kopieren</button>
          </div>
          ${navigator.share ? `<button id="grShareInvite" type="button" class="btn btn-secondary btn-sm btn-block">Link teilen …</button>` : ""}
        </div>`;
    }

    function wireInvite(game) {
      const copy = document.getElementById("grCopyInvite");
      if (!copy) return;
      const link = inviteLink(game);
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(link);
          showToast("Einladungslink kopiert 💌", "success");
        } catch (error) {
          const input = document.getElementById("grInviteLink");
          input.select();
          window.prompt("Einladungslink kopieren:", link);
        }
      });
      const share = document.getElementById("grShareInvite");
      if (share) {
        share.addEventListener("click", () => {
          navigator.share({ title: `${title} mit uns`, text: `Spiel eine Runde ${title} mit uns!`, url: link }).catch(() => {});
        });
      }
    }

    function renderLobbyNoGame(note) {
      if (config.hideOptions) {
        const option = (config.startOptions || []).find(o => o.value === chosenOption);
        showLobby(`
          ${note ? `<p class="gr-lobby-note">${escapeHtml(note)}</p>` : ""}
          <h2>${option ? escapeHtml(option.label) : "Noch keine Runde"}</h2>
          <p>Startet eine Runde &ndash; der andere kann direkt beitreten.</p>
          <button id="grStartBtn" class="btn btn-block">Neue Runde starten</button>
        `);
        document.getElementById("grStartBtn").addEventListener("click", createGame);
        return;
      }
      showLobby(`
        ${note ? `<p class="gr-lobby-note">${escapeHtml(note)}</p>` : ""}
        <h2>Noch keine Runde</h2>
        <p>Startet eine Runde ${escapeHtml(title)} &ndash; ${maxPlayers > 2 ? `bis zu ${maxPlayers} können mitspielen, Freunde per Link.` : "der andere kann direkt beitreten."}</p>
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

    /* a member who is in the lobby: players, invite link, start */
    function renderLobbyRoom(game) {
      const lobby = lobbyOf(game);
      const label = optionLabel(game);
      const host = game.host_person === person;
      const canBegin = lobby.length >= 2;
      showLobby(`
        <h2>${maxPlayers > 2 ? "Wer spielt mit?" : "Warte auf Mitspieler:in"}</h2>
        ${label ? `<p>${escapeHtml(label)}</p>` : ""}
        ${maxPlayers > 2 ? playersHtml(lobby, game.host_person) : `<div class="gr-lobby-waiting"><span class="gr-spinner"></span> Einladung ist raus...</div>`}
        ${inviteHtml(game)}
        ${maxPlayers > 2 ? `<button id="grBeginBtn" class="btn btn-block"${canBegin ? "" : " disabled"}>${canBegin ? `Runde starten (${lobby.length} Personen)` : "Warte auf Mitspieler …"}</button>` : ""}
        <button id="${host ? "grCancelBtn" : "grLeaveLobbyBtn"}" class="btn btn-secondary btn-block">${host ? "Abbrechen" : "Doch nicht mitspielen"}</button>
      `);
      wireInvite(game);
      const begin = document.getElementById("grBeginBtn");
      if (begin) begin.addEventListener("click", beginGame);
      if (host) document.getElementById("grCancelBtn").addEventListener("click", () => cancelWaitingGame(game.id));
      else document.getElementById("grLeaveLobbyBtn").addEventListener("click", leaveLobby);
    }

    /* a member who is not in the lobby yet */
    function renderLobbyInvited(game) {
      const lobby = lobbyOf(game);
      const label = optionLabel(game);
      const full = lobby.length >= maxPlayers;
      showLobby(`
        <h2>${escapeHtml(game.host_person)} lädt dich ein!</h2>
        <p>Bereit für eine Runde ${escapeHtml(title)}${label ? ` (${escapeHtml(label)})` : ""}?</p>
        ${maxPlayers > 2 ? playersHtml(lobby, game.host_person) : ""}
        ${full ? `<p class="gr-lobby-note">Die Runde ist schon voll.</p>` : `<button id="grJoinBtn" class="btn btn-block">Beitreten</button>`}
      `);
      const join = document.getElementById("grJoinBtn");
      if (join) join.addEventListener("click", () => {
        if (requirePerson()) joinLobby(person);
      });
    }

    /* a member while others play without them */
    function renderLobbyBusy(game) {
      const players = (game.state && game.state.players) || [];
      showLobby(`
        <h2>Gerade läuft eine Runde</h2>
        <p>${escapeHtml(players.join(", "))} ${players.length === 1 ? "spielt" : "spielen"} ${escapeHtml(title)} &ndash; du bist diesmal nicht dabei.</p>
        <button id="grEndOthersBtn" class="btn btn-secondary btn-block">Runde beenden</button>
      `);
      const end = document.getElementById("grEndOthersBtn");
      end.addEventListener("click", async () => {
        if (await confirmDialog("Die laufende Runde wird für alle beendet.")) leaveGame();
      });
    }

    /* ---------- lobby for invited friends ---------- */

    function renderGuestMessage(heading, text) {
      showLobby(`<h2>${escapeHtml(heading)}</h2><p>${escapeHtml(text)}</p>`);
    }

    function renderGuestJoin(game, problem) {
      const lobby = lobbyOf(game);
      if (lobby.length >= maxPlayers) {
        renderGuestMessage("Die Runde ist schon voll", "Vielleicht beim nächsten Mal 💛");
        return;
      }
      showLobby(`
        <h2>${escapeHtml(game.host_person)} lädt dich zu ${escapeHtml(title)} ein!</h2>
        <p>Wie sollen dich die anderen nennen?</p>
        ${playersHtml(lobby, game.host_person)}
        <form id="grGuestForm" class="gr-guest-form">
          <input id="grGuestName" type="text" maxlength="${NAME_MAX}" autocomplete="nickname" placeholder="Dein Name" aria-label="Dein Name">
          ${problem ? `<p class="gr-lobby-note" role="alert">${escapeHtml(problem)}</p>` : ""}
          <button id="grGuestJoinBtn" type="submit" class="btn btn-block">Mitspielen</button>
        </form>
      `);
      const input = document.getElementById("grGuestName");
      document.getElementById("grGuestForm").addEventListener("submit", async event => {
        event.preventDefault();
        const name = cleanGuestName(input.value);
        const fresh = await fetchCurrentGame();
        const issue = guestNameProblem(name, fresh ? lobbyOf(fresh) : []);
        if (issue) {
          lastRenderedJson = null;
          renderGuestJoin(fresh || game, issue);
          return;
        }
        person = name;
        storeGuestName(name);
        await joinLobby(name);
        lastRenderedJson = null;
        await sync();
      });
    }

    function renderGuestWaiting(game) {
      const lobby = lobbyOf(game);
      showLobby(`
        <h2>Du bist dabei, ${escapeHtml(person)}!</h2>
        <div class="gr-lobby-waiting"><span class="gr-spinner"></span> Warte, bis Isi oder Benji die Runde startet …</div>
        ${playersHtml(lobby, game.host_person)}
        <button id="grLeaveLobbyBtn" class="btn btn-secondary btn-block">Doch nicht mitspielen</button>
      `);
      document.getElementById("grLeaveLobbyBtn").addEventListener("click", leaveLobby);
    }

    function renderGuest(game) {
      if (!game || game.invite_code !== guestInvite) {
        renderGuestMessage("Diese Einladung gilt nicht mehr", "Frag nach einem neuen Link 💌");
        return;
      }
      if (game.status === "closed") {
        renderGuestMessage("Die Runde ist vorbei", "Danke fürs Mitspielen! 💛");
        return;
      }
      if (game.status === "waiting") {
        if (person && lobbyOf(game).includes(person)) renderGuestWaiting(game);
        else renderGuestJoin(game);
        return;
      }
      const players = (game.state && game.state.players) || [];
      if (!person || !players.includes(person)) {
        renderGuestMessage("Die Runde läuft schon", "Sie hat ohne dich angefangen – frag nach der nächsten 💌");
        return;
      }
      showBoard(game);
    }

    /* ---------- sync ---------- */

    function showBoard(game) {
      lobbyEl.classList.add("hidden");
      boardEl.classList.remove("hidden");
      joinReactions(game);
      reactionUi.wrap.classList.toggle("hidden", !reactionChannel);
      config.renderBoard(game);
      if (!isGuest) renderLeave(game.state);
    }

    async function sync() {
      await render();
      if (config.onSync) config.onSync(currentGame);
    }

    async function render() {
      const generation = ++syncGeneration;
      const game = await fetchCurrentGame();
      if (generation !== syncGeneration) return;

      /* re-rendering an unchanged game would restart running card animations */
      const json = JSON.stringify(game);
      if (json === lastRenderedJson) return;
      lastRenderedJson = json;
      currentGame = game;

      if (isGuest) {
        renderGuest(game);
        return;
      }
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
        if (person && lobbyOf(game).includes(person)) renderLobbyRoom(game);
        else renderLobbyInvited(game);
        return;
      }
      const players = (game.state && game.state.players) || [];
      if (person && !players.includes(person)) {
        renderLobbyBusy(game);
        return;
      }
      showBoard(game);
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
      get isGuest() { return isGuest; },
      /* everybody at the table except me, in turn order starting after me */
      others(state) {
        const players = (state && state.players) || [];
        const index = players.indexOf(person);
        if (index === -1) return players.slice();
        return [...players.slice(index + 1), ...players.slice(0, index)];
      },
      opponentOf(game) {
        const players = (game.state && game.state.players) || [game.host_person, game.guest_person];
        return players.find(p => p !== person);
      },
      isMember,
      /* pick a start option from outside the lobby, e.g. a "start the question of the day" button */
      chooseOption(value) {
        if (!optionValues.includes(value)) return;
        chosenOption = value;
        lastRenderedJson = null;
        sync();
      },
      startWith(value) {
        if (!optionValues.includes(value)) return;
        chosenOption = value;
        if (!currentGame || currentGame.status === "closed") createGame();
      },
      /* step into the waiting round */
      join() {
        if (requirePerson()) joinLobby(person);
      },
      /* still alone in my own lobby: switch what we are going to play */
      async switchOption(value) {
        if (!optionValues.includes(value)) return;
        chosenOption = value;
        await mutate(fresh => {
          if (fresh.status !== "waiting" || fresh.host_person !== person) return null;
          if (lobbyOf(fresh).some(p => p !== person) || (fresh.state && fresh.state.option === value)) return null;
          return { state: { ...fresh.state, option: value } };
        });
        await sync();
      },
      dispatch,
      renderReady,
      sendReaction,
      start
    };
  }

  return { create, cleanGuestName, guestNameProblem, readyFor, REACTIONS };
})();
