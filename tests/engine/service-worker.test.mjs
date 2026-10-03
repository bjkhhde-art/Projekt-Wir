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
vm.runInNewContext(readFileSync(new URL("../../sw.js", import.meta.url), "utf8"), { self, URL, String });

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

console.log(`\n${n} assertions passed (service worker notification links)`);
