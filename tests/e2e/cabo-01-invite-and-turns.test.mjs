import { chromium } from "playwright";
import assert from "node:assert/strict";

const BROWSER_PATH = process.env.CHROMIUM_PATH || undefined;
let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}

await fetch("http://localhost:8991/reset", { method: "POST" });

const browser = await chromium.launch({ executablePath: BROWSER_PATH });

// two fully independent browser contexts = two separate "devices"
const isiCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const benjiCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

const isi = await isiCtx.newPage();
const benji = await benjiCtx.newPage();

const isiErrors = [];
const benjiErrors = [];
isi.on("pageerror", e => isiErrors.push(e.message));
benji.on("pageerror", e => benjiErrors.push(e.message));

await isi.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
await benji.addInitScript(() => localStorage.setItem("pw_person", "Benji"));

await isi.goto("http://localhost:9091/cabo.html");
await benji.goto("http://localhost:9091/cabo.html");
await isi.waitForTimeout(400);
await benji.waitForTimeout(400);

ok(isiErrors.length === 0, `Isi's page has no JS errors at load (got ${JSON.stringify(isiErrors)})`);
ok(benjiErrors.length === 0, `Benji's page has no JS errors at load (got ${JSON.stringify(benjiErrors)})`);

/* --- Isi starts a game, Benji should see the invite appear via polling "realtime" --- */
const startBtn = isi.locator("#grStartBtn");
ok(await startBtn.count() === 1, "Isi sees 'start new round' button in empty lobby");
await startBtn.click();
await isi.waitForTimeout(400);

ok(await isi.locator("#grCancelBtn").count() === 1, "Isi now sees the lobby with a cancel button");
ok(await isi.locator("#grBeginBtn").isDisabled(), "a round cannot start with Isi alone");
ok((await isi.locator("#grInviteLink").inputValue()).includes("cabo.html?invite="), "the lobby offers an invite link for friends");

await benji.waitForTimeout(600); // let polling pick up the new game
const joinBtn = benji.locator("#grJoinBtn");
ok(await joinBtn.count() === 1, "Benji sees Isi's invite and a join button, without reloading the page");

const joinHeading = await benji.locator(".gr-lobby-card h2").textContent();
ok(joinHeading.includes("Isi"), `Benji's invite mentions Isi by name (got "${joinHeading}")`);

/* --- Benji joins, Isi starts the round --- */
await joinBtn.click();
await benji.waitForTimeout(500);
await isi.waitForTimeout(500);
ok((await isi.locator(".gr-player-name").allTextContents()).join() === "Isi,Benji", "Isi sees Benji join the lobby live");
ok(await benji.locator("#grBeginBtn").isEnabled(), "Benji could start the round too");
await isi.locator("#grBeginBtn").click();
await isi.waitForTimeout(500);
await benji.waitForTimeout(600);

ok(await benji.locator("#caboBoard").isVisible(), "Benji's board is now visible after joining");
ok(await isi.locator("#caboBoard").isVisible(), "Isi's board also switched to active (picked up via polling)");

/* --- initial peek phase: both must look at their 2 starting cards (left two, flipped in place) --- */
const isiFlippedCount = await isi.locator("#ownHand .cabo-card-slot.flipped").count();
ok(isiFlippedCount === 2, `Isi's initial peek shows exactly 2 flipped cards (got ${isiFlippedCount})`);

await isi.locator("#ownHand .cabo-card-slot").nth(1).click();
await isi.waitForTimeout(300);
ok((await isi.locator("#caboStatus").textContent()).includes("Warte"), "Isi now waits for Benji to finish peeking too");

await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
await benji.waitForTimeout(300);
await isi.waitForTimeout(600);

/* --- turn order: host (Isi) goes first --- */
const isiStatus1 = await isi.locator("#caboStatus").textContent();
const benjiStatus1 = await benji.locator("#caboStatus").textContent();
ok(isiStatus1.includes("dran"), `Isi's status shows it's her turn (got "${isiStatus1}")`);
ok(benjiStatus1.includes("ist am Zug"), `Benji's status shows he's waiting (got "${benjiStatus1}")`);

/* --- Isi draws from deck, decides, this must sync to Benji's screen live --- */
const deckCountBefore = await isi.locator("#drawPileCount").textContent();
await isi.locator("#drawPile").click();
await isi.waitForTimeout(300);

const drawnPreviewVisible = await isi.locator(".cabo-actions img").count();
ok(drawnPreviewVisible === 1, "Isi sees a preview of the card she just drew");

// swap it into her own slot 0
await isi.locator("#ownHand .cabo-card-slot").nth(0).click();
await isi.locator(".cabo-drawn-preview").click();
await isi.waitForTimeout(400);
await benji.waitForTimeout(600);

const isiAnyFlippedAfterSwap = await isi.locator("#ownHand .cabo-card-slot.flipped").count();
ok(isiAnyFlippedAfterSwap === 0, `after swapping, the new card is face-down too, all 4 hidden (got ${isiAnyFlippedAfterSwap} flipped)`);

const deckCountAfter = await benji.locator("#drawPileCount").textContent();
ok(Number(deckCountAfter) === Number(deckCountBefore) - 1, `deck count decreased by 1 and synced to Benji's screen (before=${deckCountBefore}, after=${deckCountAfter})`);

const benjiStatus2 = await benji.locator("#caboStatus").textContent();
ok(benjiStatus2.includes("dran"), `turn passed to Benji, reflected live on his screen (got "${benjiStatus2}")`);

/* --- verify opponent cards stay face-down on Isi's screen even though Benji can see his own known card --- */
const isiOpponentFirstImgSrc = await isi.locator("#opponentHand .cabo-card-slot img").nth(0).getAttribute("src");
ok(isiOpponentFirstImgSrc.includes("Cover"), "Isi cannot see Benji's face-down cards (shows card back)");

/* --- Benji draws, this time takes from discard (forced swap, no power) --- */
const discardTopBefore = await benji.locator("#discardPile img").getAttribute("src");
await benji.locator("#discardPile").click();
await benji.waitForTimeout(300);
const benjiPhaseStatus = await benji.locator("#caboStatus").textContent();
ok(benjiPhaseStatus.includes("getauscht"), `after drawing from discard, Benji must swap (got "${benjiPhaseStatus}")`);

// drawing from discard should NOT show a discard button (forced swap only)
const discardBtnCount = await benji.locator(".cabo-actions button", { hasText: "Ablegen" }).count();
ok(discardBtnCount === 0, "no 'Ablegen' button offered when the drawn card came from the discard pile");

await benji.locator("#ownHand .cabo-card-slot").nth(1).click();
await benji.locator(".cabo-drawn-preview").click();
await benji.waitForTimeout(400);
await isi.waitForTimeout(600);

const isiStatus3 = await isi.locator("#caboStatus").textContent();
ok(isiStatus3.includes("dran"), "turn correctly passed back to Isi after Benji's forced swap");

console.log(`\n${assertions} assertions passed so far (mp-test part 1)`);

await browser.close();
