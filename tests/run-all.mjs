import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFakeBackend } from "./support/fake-backend.mjs";
import { startStaticServer } from "./support/static-server.mjs";

/* Runs every engine test, then every two-device browser test against the local servers.
   Usage: npm test                  (all)
          npm test -- nimmt         (only files whose name contains "nimmt")
          npm test -- cabo briefe   (several areas at once)
          npm test -- spiele        (a group, see GROUPS – the table in tests/README.md lists every area) */

const HERE = path.dirname(fileURLToPath(import.meta.url));
/* names that stand for several file names, or a friendlier name for one */
const GROUPS = {
  spiele: ["cabo", "nimmt", "qwixx", "flip7", "gipfel", "murphy", "geo", "bots", "game-reactions", "bot-names"],
  phase10: ["gipfel"],
  murphys: ["murphy"],
  quest: ["ziele"],
  todos: ["ziele"],
  kuschelakku: ["akku"],
  fragen: ["questions"],
  login: ["password-gate"],
  app: ["all-pages-smoke", "app-shell", "navigation", "service-worker", "connection", "password-gate"]
};
const filters = process.argv.slice(2).flatMap(arg => GROUPS[arg.toLowerCase()] || [arg.toLowerCase()]);
const wanted = name => filters.length === 0 || filters.some(f => name.toLowerCase().includes(f));
/* browser tests wait on real timers; one retry absorbs a slow CI machine and is reported as such */
const E2E_ATTEMPTS = 2;

async function testFiles(folder) {
  const names = (await readdir(path.join(HERE, folder))).filter(n => n.endsWith(".test.mjs") && wanted(n)).sort();
  return names.map(n => path.join(folder, n));
}

function run(file) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(HERE, file)], { cwd: HERE, env: process.env });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { output += chunk; });
    child.on("close", code => resolve({ code, output }));
  });
}

const summaryLine = output => (output.trim().split("\n").reverse().find(line => /assertions passed|invariants held/.test(line)) || "").trim();

const results = [];
const backend = await startFakeBackend(8991);
const site = await startStaticServer(9091);

for (const file of [...await testFiles("engine"), ...await testFiles("e2e")]) {
  const attempts = file.startsWith("e2e") ? E2E_ATTEMPTS : 1;
  let result;
  let attempt = 0;
  while (attempt < attempts) {
    attempt++;
    result = await run(file);
    if (result.code === 0) break;
  }
  const passed = result.code === 0;
  const note = passed && attempt > 1 ? " (passed on retry)" : "";
  console.log(`${passed ? "✔" : "✘"} ${file}${note}  ${passed ? summaryLine(result.output) : ""}`);
  if (!passed) console.log(result.output.split("\n").filter(l => !l.startsWith("PASS:")).slice(-25).join("\n"));
  results.push({ file, passed });
}

backend.close();
site.close();

const failed = results.filter(r => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} test files passed`);
process.exit(failed.length ? 1 : 0);
