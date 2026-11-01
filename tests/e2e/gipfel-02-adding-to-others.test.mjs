import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const G = require("../../gipfel-engine.js");

/* Adding to another player's Phase: refused with a hint while your own Phase is not out,
   allowed as soon as it is */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991/t/gipfel_games";
const wait = ms => new Promise(r => setTimeout(r, ms));
const latest = async () => (await fetch(`${API}/latest`)).json();

function table(isiLaid) {
  const s = G.createInitialState(["Isi", "Udiou"]);
  return Object.assign(s, {
    turnPerson: "Isi",
    step: "act",
    laid: { Isi: isiLaid, Udiou: true },
    hands: { Isi: ["r5-0", "v9-0", "g2-0"], Udiou: ["m1-0", "m3-0"] },
    groups: [
      { id: 1, owner: "Udiou", kind: "set", cards: ["r5-1", "v5-1"], value: 5 },
      ...(isiLaid ? [{ id: 2, owner: "Isi", kind: "set", cards: ["g9-0", "g9-1"], value: 9 }] : [])
    ]
  });
}

async function seed(state) {
  await fetch(`${API}/seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows: [{ id: 1, status: "active", host_person: "Isi", state, version: 1, created_at: new Date().toISOString() }] })
  });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
page.on("pageerror", e => errors.push(e.message));

/* own Phase not out yet: the tap explains why it does not work */
await seed(table(false));
await page.goto("http://localhost:9091/gipfel.html");
await page.waitForSelector('#gsOwn .gs-hand [data-card="r5-0"]');
await page.click('#gsOwn .gs-hand [data-card="r5-0"]');
ok(await page.locator("#gsOpps .gs-group.target").count() === 1, "with a card chosen, Udiou's group can be tapped");
await page.locator("#gsOpps .gs-group").first().click();
await wait(800);
ok((await latest()).state.hands.Isi.length === 3, "without an own Phase nothing is added");
ok(await page.locator(".toast").filter({ hasText: "erst, wenn deine eigene Phase ausliegt" }).count() === 1, "Isi is told she needs her own Phase first");

/* own Phase out: the 5 goes onto Udiou's 5er */
await seed(table(true));
await page.reload();
await page.waitForSelector('#gsOwn .gs-hand [data-card="r5-0"]');
await page.click('#gsOwn .gs-hand [data-card="r5-0"]');
await page.locator("#gsOpps .gs-group").first().click();
await wait(1000);
const after = (await latest()).state;
ok(after.hands.Isi.join() === "v9-0,g2-0" && after.groups.find(g => g.id === 1).cards.length === 3, "with her own Phase out, Isi adds her 5 to Udiou's group");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (gipfel: adding to others)`);
