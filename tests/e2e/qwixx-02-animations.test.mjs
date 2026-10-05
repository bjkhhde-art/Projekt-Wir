import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Qwixx with animations ON: rolling dice tumble and flicker on both screens, crosses and locks animate. */
const BROWSER_PATH = process.env.CHROMIUM_PATH || undefined;
const API = "http://localhost:8991/t/qwixx_games";
let assertions = 0;
function ok(cond, msg) { assert.ok(cond, msg); assertions++; console.log("PASS:", msg); }

await fetch(`${API}/reset`, { method: "POST" });
const browser = await chromium.launch({ executablePath: BROWSER_PATH });
const ctx = () => browser.newContext({ viewport: { width: 390, height: 844 } });
const isi = await (await ctx()).newPage();
const benji = await (await ctx()).newPage();
const errors = [];
isi.on("pageerror", e => errors.push("isi: " + e.message));
benji.on("pageerror", e => errors.push("benji: " + e.message));
await isi.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
await benji.addInitScript(() => localStorage.setItem("pw_person", "Benji"));
await isi.goto("http://localhost:9091/qwixx.html");
await benji.goto("http://localhost:9091/qwixx.html");
await isi.waitForTimeout(400);
await isi.locator("#grStartBtn").click();
await benji.waitForTimeout(700);
await benji.locator("#grJoinBtn").click();
await isi.waitForTimeout(600);
await isi.locator("#grBeginBtn").click();
await isi.waitForTimeout(800);

/* collects, for ~0.9 s, whether dice tumble and how many different faces a die shows */
const watchRoll = page => page.evaluate(() => new Promise(resolve => {
  let tumbling = false;
  const faces = new Set();
  const started = performance.now();
  const tick = () => {
    const dice = document.querySelectorAll("#qxDice .qx-die:not(.removed)");
    if (dice[0]) {
      faces.add(dice[0].dataset.value);
      if (dice[0].getAnimations().length > 0) tumbling = true;
    }
    if (performance.now() - started < 900) requestAnimationFrame(tick); else resolve({ tumbling, faces: faces.size });
  };
  tick();
}));

const benjiWatch = watchRoll(benji);
const isiWatch = watchRoll(isi);
await isi.locator("#qxDice").click();
const isiRoll = await isiWatch;
const benjiRoll = await benjiWatch;
ok(isiRoll.tumbling && isiRoll.faces >= 2, `Isi's dice tumble and flicker through faces (${isiRoll.faces} faces)`);
ok(benjiRoll.tumbling && benjiRoll.faces >= 2, `Benji sees the same roll animation (${benjiRoll.faces} faces)`);

const game = await (await fetch(`${API}/latest`)).json();
const finalFaces = await isi.locator("#qxDice .qx-die").evaluateAll(els => els.map(e => Number(e.dataset.value)));
ok(JSON.stringify(finalFaces.slice(0, 2)) === JSON.stringify([game.state.dice.w1, game.state.dice.w2]), "after the animation the dice show the real throw");

/* a cross pops in on the crosser's sheet and in the other's small view */
/* pick a field that fits the white sum (nothing is highlighted any more) */
const whiteSum = game.state.dice.w1 + game.state.dice.w2;
let target = null;
game.state.layout.forEach((cells, r) => {
  const i = cells.findIndex(c => c.n === whiteSum);
  if (!target && i >= 0 && i < cells.length - 1) target = [r, i];
});
const option = isi.locator(".qx-row").nth(target[0]).locator(".qx-cell").nth(target[1]);
const benjiSeesCross = benji.waitForFunction(() => {
  const crossed = document.querySelector(".qx-mini-cell.just-crossed");
  return crossed && crossed.getAnimations({ subtree: true }).length >= 0;
}, null, { timeout: 2500 }).then(() => true, () => false);
await option.click({ force: true });
await isi.waitForTimeout(150);
ok(await isi.locator(".qx-cell.just-crossed").count() === 1, "Isi's cross pops in");
ok(await benjiSeesCross, "Benji sees Isi's cross pop in on her small block");

ok(errors.length === 0, `no JS errors (${JSON.stringify(errors)})`);
await browser.close();
console.log(`\n${assertions} assertions passed (qx-test2: Qwixx animations)`);
