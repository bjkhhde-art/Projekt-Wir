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

/* ---------- installable app: fresh from the network, the last copy (or a friendly page) offline ----------
   Only our own files are touched; Supabase, CDNs and everything else go straight to the network. */
const CACHE = "pw-pages-v1";
const OFFLINE_PAGE = "offline.html";
const PRECACHE = [OFFLINE_PAGE, "icons/icon-192.png", "favicon.svg", "manifest.webmanifest"];

const appUrl = path => new URL(path, self.registration.scope).href;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE.map(appUrl)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("pw-") && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isOwnFile(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  return url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
}

/* on a weak connection a stalled request must not block the page – after this long the last copy wins */
const NETWORK_TIMEOUT_MS = 4000;

function fetchWithTimeout(request, cachedFallback) {
  return new Promise((resolve, reject) => {
    const timer = cachedFallback && setTimeout(() => cachedFallback.then(hit => hit && resolve(hit)), NETWORK_TIMEOUT_MS);
    /* "no-cache": always ask the server (cheap 304 when unchanged), so an update shows up at once
       instead of the browser's own copy being reused for up to 10 minutes */
    fetch(request, { cache: "no-cache" }).then(
      response => { clearTimeout(timer); resolve(response); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetchWithTimeout(request, cache.match(request));
    if (response && response.ok && response.type === "basic") cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const offline = await cache.match(appUrl(OFFLINE_PAGE));
      if (offline) return offline;
    }
    throw error;
  }
}

self.addEventListener("fetch", event => {
  if (!isOwnFile(event.request)) return;
  event.respondWith(networkFirst(event.request));
});

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
