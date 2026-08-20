(function () {
  const PIN_HASH = "74e06e9fbf9e88254ac47ed99bad31b06eb331c2dead308f74236d88f3041c0f";
  const PIN_HINT = "Jahrestag (dmyy)";
  const STORAGE_KEY = "pw_unlocked";

  if (localStorage.getItem(STORAGE_KEY) === "true") {
    return;
  }

  document.documentElement.style.visibility = "hidden";

  async function hashPin(value) {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function buildGate() {
    const overlay = document.createElement("div");
    overlay.id = "pin-gate";
    overlay.innerHTML = `
      <div class="pin-gate-box">
        <div class="pin-gate-heart">💗</div>
        <h1 class="pin-gate-title">I + B</h1>
        <p class="pin-gate-subtitle">Gib die PIN ein, um reinzukommen</p>
        <input id="pinGateInput" class="pin-gate-input" type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" placeholder="••••">
        <p class="pin-gate-hint">Hinweis: ${PIN_HINT}</p>
        <p id="pinGateError" class="pin-gate-error hidden">Falsche PIN, versuch's nochmal 💭</p>
        <button id="pinGateSubmit" class="btn btn-block">Entsperren</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const box = overlay.querySelector(".pin-gate-box");
    const input = overlay.querySelector("#pinGateInput");
    const errorEl = overlay.querySelector("#pinGateError");
    const submitBtn = overlay.querySelector("#pinGateSubmit");

    async function tryUnlock() {
      const value = input.value.trim();
      if (!value) return;

      const hash = await hashPin(value);

      if (hash === PIN_HASH) {
        localStorage.setItem(STORAGE_KEY, "true");
        document.documentElement.style.visibility = "visible";
        overlay.remove();
      } else {
        errorEl.classList.remove("hidden");
        box.classList.remove("shake");
        void box.offsetWidth;
        box.classList.add("shake");
        input.value = "";
        input.focus();
      }
    }

    submitBtn.addEventListener("click", tryUnlock);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") tryUnlock();
    });

    input.focus();
  }

  document.addEventListener("DOMContentLoaded", buildGate);
})();
