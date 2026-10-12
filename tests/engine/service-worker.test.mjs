import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

/* sw.js must only ever open pages of the app itself when a notification is tapped */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };

const listeners = {};
const opened = [];
const shown = [];
const self = {
  registration: {
    scope: "https://example.github.io/Projekt-Wir/",
    showNotification: (title, options) => { shown.push({ title, options }); return Promise.resolve(); }
  },
  location: { origin: "https://example.github.io" },
  clients: { matchAll: async () => [], openWindow: async url => { opened.push(url); } },
  addEventListener: (name, fn) => { listeners[name] = fn; }
};
/* a tiny Cache Storage and network for the offline part */
const store = new Map();
const cacheApi = {
  async put(request, response) { store.set(typeof request === "string" ? request : request.url, response); },
  async match(request) { return store.get(typeof request === "string" ? request : request.url); },
  async addAll(urls) { urls.forEach(url => store.set(url, { body: "cached " + url, ok: true, clone() { return this; } })); }
};
let online = true;
const fetched = [];
const caches = {
  open: async () => cacheApi,
  keys: async () => ["pw-pages-v0", "pw-pages-v1", "other-app"],
  deleted: [],
  delete: async key => { caches.deleted.push(key); }
};
const fetch = async request => {
  fetched.push(request.url);
  if (!online) throw new TypeError("offline");
  return { body: "fresh " + request.url, ok: true, type: "basic", clone() { return this; } };
};
self.skipWaiting = async () => {};
self.clients.claim = async () => {};
vm.runInNewContext(readFileSync(new URL("../../sw.js", import.meta.url), "utf8"), { self, URL, String, caches, fetch, Promise });

async function tap(url) {
  let done;
  listeners.notificationclick({ notification: { close() {}, data: { url } }, waitUntil: p => { done = p; } });
  await done;
  return opened.at(-1);
}

const scope = self.registration.scope;
ok(await tap("cabo.html") === scope + "cabo.html", "an app page opens");
ok(await tap("wir.html?tab=briefe") === scope + "wir.html?tab=briefe", "an app page with a tab opens");
for (const evil of ["https://evil.example/login", "//evil.example/", "javascript:alert(1)", "data:text/html,hi", "/other-site/page.html", "../x.html"]) {
  ok(await tap(evil) === scope + "index.html", `"${evil}" falls back to the start page`);
}

let pending;
listeners.push({ data: { json: () => ({ title: "x".repeat(500), body: "y".repeat(2000), url: "https://evil.example" }) }, waitUntil: p => { pending = p; } });
await pending;
const last = shown.at(-1);
ok(last.title.length <= 80 && last.options.body.length <= 240, "overlong title and text are cut");
ok(last.options.data.url === scope + "index.html", "a foreign link in a push is replaced before it is stored");

/* ---------- installable app: network first, the last copy or the offline page without network ---------- */
const run = async (name, event) => {
  let done;
  listeners[name]({ ...event, waitUntil: p => { done = p; } });
  await done;
};
await run("install", {});
ok(store.has(scope + "offline.html") && store.has(scope + "icons/icon-192.png"), "installing keeps the offline page and the icon");
await run("activate", {});
ok(caches.deleted.join() === "pw-pages-v0", "an old cache of ours is removed, other caches stay");

async function request(url, mode = "no-cors", method = "GET") {
  let response = null;
  let handled = false;
  listeners.fetch({ request: { url, mode, method }, respondWith: p => { handled = true; response = p; } });
  return handled ? response : "network";
}
ok(await request("https://lrzgcqoqcwicpuuuhaoj.supabase.co/rest/v1/trips") === "network", "Supabase requests are not touched");
ok(await request("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2") === "network", "CDN files are not touched");
ok(await request(scope + "index.html", "navigate", "POST") === "network", "only GET requests are handled");
ok(await request("https://example.github.io/other-site/index.html", "navigate") === "network", "other sites on the same host are not touched");

const fresh = await request(scope + "reise.html?tab=erinnerungen", "navigate");
ok(fresh.body === "fresh " + scope + "reise.html?tab=erinnerungen", "online: pages always come fresh from the network");
ok(store.get(scope + "reise.html?tab=erinnerungen").body.startsWith("fresh"), "… and a copy is kept");
online = false;
const copy = await request(scope + "reise.html?tab=erinnerungen", "navigate");
ok(copy.body.startsWith("fresh"), "offline: the last copy of a page opens");
const unknown = await request(scope + "kpis.html", "navigate");
ok(unknown.body === "cached " + scope + "offline.html", "offline and never opened: the friendly offline page");
let failed = false;
try { await request(scope + "missing.js"); } catch (error) { failed = true; }
ok(failed, "a missing script offline fails like without the app");

console.log(`\n${n} assertions passed (service worker: notification links, offline)`);
