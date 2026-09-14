/* Projekt Wir – shared UI helpers: toasts, celebration hearts, nav highlighting. */

window.MILESTONES = {
  firstMeeting: { date: "2025-11-27", place: "Prof's Night (Park Theater Kempten)" },
  firstDate: { date: "2025-12-01", place: "Weihnachtsmarkt Kempten" },
  anniversary: { date: "2026-01-05", place: "Botanischer Garten Hamburg Nienstedten" }
};

window.formatDate = function (dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("de-DE");
};

window.escapeHtml = function (text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : text;
  return div.innerHTML;
};

window.daysBetween = function (startDate, endDate) {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return Math.floor((end - start) / (1000 * 60 * 60 * 24));
};

window.timeAgo = function (dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min.`;

  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;

  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `vor ${diffD} Tag${diffD === 1 ? "" : "en"}`;

  return formatDate(dateString);
};

/* ---------- push notifications ---------- */

window.VAPID_PUBLIC_KEY = "BK5VB6dUwUk95sMOfJ2lz7j29h_piCc8UuvP13_8jMhDaVH_X3qrCtICq6WrYtOhiJnjUK-s-mvYhaWLL71M5j4";

window.normalizePerson = function (name) {
  return (name || "").startsWith("Isi") ? "Isi" : "Benji";
};

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

window.subscribeToPush = async function (supabaseClient, person) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push wird von diesem Browser nicht unterstützt.");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Berechtigung nicht erteilt.");
  }

  const registration = await navigator.serviceWorker.register("sw.js");
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY)
    });
  }

  const keys = subscription.toJSON().keys;

  const { error } = await supabaseClient
    .from("push_subscriptions")
    .upsert(
      {
        person,
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth
      },
      { onConflict: "endpoint" }
    );

  if (error) throw error;

  localStorage.setItem("pw_push_enabled", "true");
  localStorage.setItem("pw_person", person);
};

window.sendAppNotification = async function (supabaseClient, { title, body, excludePerson, onlyPerson, category, url }) {
  try {
    const { error } = await supabaseClient.functions.invoke("notify-new-letter", {
      body: { title, body, excludePerson, onlyPerson, category, url }
    });

    if (error) {
      console.error("Push-Benachrichtigung fehlgeschlagen:", error);
    }
  } catch (error) {
    console.error("Push-Benachrichtigung fehlgeschlagen:", error);
  }
};

(function () {
  function ensureLayer(id, className) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      if (className) el.className = className;
      document.body.appendChild(el);
    }
    return el;
  }

  window.showToast = function (message, type) {
    const stack = ensureLayer("toast-stack");
    const toast = document.createElement("div");
    toast.className = "toast" + (type ? " toast-" + type : "");
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  window.celebrate = function (count) {
    const layer = ensureLayer("celebrate-layer");
    const hearts = ["💗", "💖", "💕", "✨", "🎉"];
    const n = count || 12;

    for (let i = 0; i < n; i++) {
      const heart = document.createElement("span");
      heart.className = "celebrate-heart";
      heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
      heart.style.left = Math.random() * 100 + "vw";
      heart.style.animationDelay = Math.random() * 0.4 + "s";
      heart.style.fontSize = 18 + Math.random() * 20 + "px";
      layer.appendChild(heart);
      setTimeout(() => heart.remove(), 2200);
    }
  };

  window.confirmDialog = function (message, confirmLabel) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal";
      overlay.innerHTML = `
        <div class="modal-box confirm-box">
          <h2>Bist du sicher?</h2>
          <p class="confirm-message">${message}</p>
          <div class="modal-buttons">
            <button class="btn btn-danger confirm-yes">${confirmLabel || "Löschen"}</button>
            <button class="btn btn-secondary confirm-no">Abbrechen</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      function close(result) {
        overlay.remove();
        resolve(result);
      }

      overlay.querySelector(".confirm-yes").addEventListener("click", () => close(true));
      overlay.querySelector(".confirm-no").addEventListener("click", () => close(false));
      overlay.addEventListener("click", event => {
        if (event.target === overlay) close(false);
      });
    });
  };

  function highlightNav() {
    const current = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-item").forEach(link => {
      const href = link.getAttribute("href");
      if (href === current) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", highlightNav);
})();
