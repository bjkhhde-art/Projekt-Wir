const DEFAULT_URL = "index.html";
const MAX_TITLE = 80;
const MAX_BODY = 240;

/* a notification may only ever open a page of this app – anything else (other sites,
   javascript: links, protocol-relative URLs) falls back to the start page */
function safeAppUrl(raw) {
  const scope = new URL(self.registration.scope);
  try {
    const url = new URL(String(raw || DEFAULT_URL), scope);
    if (url.origin === scope.origin && url.pathname.startsWith(scope.pathname)) return url.href;
  } catch (error) {
    /* unparsable → default below */
  }
  return new URL(DEFAULT_URL, scope).href;
}

function clip(text, max) {
  const value = String(text || "");
  return value.length > max ? value.slice(0, max - 1) + "…" : value;
}

self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = clip(data.title, MAX_TITLE) || "Projekt Wir 💗";
  const options = {
    body: clip(data.body, MAX_BODY) || "Es gibt etwas Neues.",
    icon: "icons/icon-192.png",
    badge: "favicon.svg",
    data: { url: safeAppUrl(data.url) }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const targetUrl = safeAppUrl(event.notification.data && event.notification.data.url);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      const existing = clientList.find(client => client.url === targetUrl);
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});
