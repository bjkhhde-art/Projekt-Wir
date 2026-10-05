(function () {
  /* Only a salted PBKDF2 hash of the password lives here (the repository is public).
     Devices that were unlocked before stay unlocked – the stored flag is unchanged. */
  const PASSWORD_SALT = "b4fa1c0c5a8911d827e5c419caaf47fd";
  const PASSWORD_HASH = "237bb0842f268f7529b127a11c53fafec419368a9f76bb5bed872647045783b7";
  const PBKDF2_ROUNDS = 210000;
  const STORAGE_KEY = "pw_unlocked";
  const GAME_PAGES = ["cabo.html", "nimmt.html", "qwixx.html"];

  if (localStorage.getItem(STORAGE_KEY) === "true") {
    return;
  }

  /* Invited friends open a game page with ?invite=…: they get only that game (no navigation,
     no other pages) and are never unlocked – game-room.js checks the invite against the round. */
  const page = location.pathname.split("/").pop() || "index.html";
  const invite = new URLSearchParams(location.search).get("invite");
  if (GAME_PAGES.includes(page) && invite && /^[A-Za-z0-9]{6,32}$/.test(invite)) {
    window.PW_GUEST_INVITE = invite;
    document.documentElement.classList.add("guest-mode");
    return;
  }

  document.documentElement.style.visibility = "hidden";

  function hex(bytes) {
    return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  async function hashPassword(value) {
    const salt = new Uint8Array(PASSWORD_SALT.match(/../g).map(pair => parseInt(pair, 16)));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(value), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PBKDF2_ROUNDS, hash: "SHA-256" }, key, 256);
    return hex(bits);
  }

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
        <p id="pinGateError" class="pin-gate-error hidden">Falsches Passwort, versuch's nochmal 💭</p>
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
      if (!value) return;
      submitBtn.disabled = true;
      const hash = await hashPassword(value);
      submitBtn.disabled = false;

      if (hash === PASSWORD_HASH) {
        localStorage.setItem(STORAGE_KEY, "true");
        document.documentElement.style.visibility = "visible";
        overlay.remove();
      } else {
        errorEl.classList.remove("hidden");
        box.classList.remove("shake");
        void box.offsetWidth;
        box.classList.add("shake");
        input.select();
        input.focus();
      }
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
