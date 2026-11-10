(function () {
  /* The lock is a real login: the password signs this phone in to the shared Supabase account, and the
     database only answers signed-in members (see supabase/migrations/20261110_members_only_access.sql).
     Neither the password nor a hash of it lives in this public repository. */
  const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";
  /* the shared account (Supabase → Authentication → Users); example.com never receives mail */
  const LOGIN_EMAIL = "projekt-wir@example.com";
  /* where supabase-js keeps the session – present means this phone is signed in */
  const SESSION_KEY = "sb-lrzgcqoqcwicpuuuhaoj-auth-token";
  const GAME_PAGES = ["cabo.html", "nimmt.html", "qwixx.html", "flip7.html", "gipfel.html"];

  function hasSession() {
    try {
      return Boolean(localStorage.getItem(SESSION_KEY));
    } catch (error) {
      return false;
    }
  }

  if (hasSession()) {
    return;
  }

  /* Invited friends open a game page with ?invite=…: they get only that game (no navigation,
     no other pages) and are never signed in – the database lets them see exactly the round with this code. */
  const page = location.pathname.split("/").pop() || "index.html";
  const invite = new URLSearchParams(location.search).get("invite");
  if (GAME_PAGES.includes(page) && invite && /^[A-Za-z0-9]{6,32}$/.test(invite)) {
    window.PW_GUEST_INVITE = invite;
    document.documentElement.classList.add("guest-mode");
    return;
  }

  document.documentElement.style.visibility = "hidden";

  async function signIn(password) {
    if (!window.supabase) return "offline";
    try {
      const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      const { error } = await client.auth.signInWithPassword({ email: LOGIN_EMAIL, password });
      if (!error) return "ok";
      if (error.code === "invalid_credentials" || error.status === 400) return "wrong";
      if (!error.status || error.name === "AuthRetryableFetchError") return "offline";
      console.error("Anmeldung fehlgeschlagen:", error);
      return "failed";
    } catch (error) {
      console.error("Anmeldung fehlgeschlagen:", error);
      return "offline";
    }
  }

  const MESSAGES = {
    wrong: "Falsches Passwort, versuch's nochmal 💭",
    offline: "Keine Verbindung – bitte prüf dein Internet 📶",
    failed: "Anmelden hat nicht geklappt – versuch's gleich nochmal."
  };

  function buildGate() {
    const overlay = document.createElement("div");
    overlay.id = "pin-gate";
    overlay.innerHTML = `
      <div class="pin-gate-box">
        <div class="pin-gate-heart">💗</div>
        <h1 class="pin-gate-title">I + B</h1>
        <p class="pin-gate-subtitle">Gib das Passwort ein, um reinzukommen</p>
        <div class="pin-gate-field">
          <input id="pinGateInput" class="pin-gate-input" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Passwort">
          <button id="pinGateShow" class="pin-gate-show" type="button" aria-label="Passwort anzeigen">👁</button>
        </div>
        <p id="pinGateError" class="pin-gate-error hidden" role="alert"></p>
        <button id="pinGateSubmit" class="btn btn-block">Entsperren</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const box = overlay.querySelector(".pin-gate-box");
    const input = overlay.querySelector("#pinGateInput");
    const errorEl = overlay.querySelector("#pinGateError");
    const submitBtn = overlay.querySelector("#pinGateSubmit");
    const showBtn = overlay.querySelector("#pinGateShow");

    async function tryUnlock() {
      const value = input.value;
      if (!value || submitBtn.disabled) return;
      submitBtn.disabled = true;
      const result = await signIn(value);

      if (result === "ok") {
        /* the flag of the old, purely local lock is no longer needed */
        try { localStorage.removeItem("pw_unlocked"); } catch (error) { /* nothing to clean */ }
        /* the page loaded its data before the login – load it again, now as a member */
        location.reload();
        return;
      }

      submitBtn.disabled = false;
      errorEl.textContent = MESSAGES[result];
      errorEl.classList.remove("hidden");
      box.classList.remove("shake");
      void box.offsetWidth;
      box.classList.add("shake");
      input.select();
      input.focus();
    }

    showBtn.addEventListener("click", () => {
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      showBtn.setAttribute("aria-label", showing ? "Passwort anzeigen" : "Passwort verbergen");
      input.focus();
    });
    submitBtn.addEventListener("click", tryUnlock);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") tryUnlock();
    });

    input.focus();
  }

  document.addEventListener("DOMContentLoaded", buildGate);
})();
