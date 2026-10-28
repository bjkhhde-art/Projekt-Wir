import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFakeBackend } from "./support/fake-backend.mjs";
import { startStaticServer } from "./support/static-server.mjs";

/* Runs every engine test and every two-device browser test against local servers.
   Usage: npm test            (all)
          npm test -- nimmt    (only files whose name contains "nimmt")
   The files run in parallel: each worker has its own fake backend and site server (own ports,
   own data), so tests never see each other's rounds. TEST_WORKERS=1 runs them one after the other. */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] || "";
/* browser tests wait on real timers; one retry absorbs a slow CI machine and is reported as such
   (TEST_RETRIES=0 shows every flaky failure) */
const E2E_ATTEMPTS = 1 + Math.max(0, Number(process.env.TEST_RETRIES ?? 1));
const WORKERS = Math.max(1, Number(process.env.TEST_WORKERS) || Math.min(4, os.availableParallelism ? os.availableParallelism() : os.cpus().length));
/* worker 0 uses the default ports, so a single test file can still be started by hand */
const portsOf = worker => ({ api: 8991 + worker * 10, site: 9091 + worker * 10 });

async function testFiles(folder) {
  const names = (await readdir(path.join(HERE, folder))).filter(n => n.endsWith(".test.mjs") && n.includes(filter)).sort();
  return names.map(n => path.join(folder, n));
}

function run(file, env) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(HERE, file)], { cwd: HERE, env: { ...process.env, ...env } });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { output += chunk; });
    child.on("close", code => resolve({ code, output }));
  });
}

const summaryLine = output => (output.trim().split("\n").reverse().find(line => /assertions passed|invariants held/.test(line)) || "").trim();

const results = [];
const files = [...await testFiles("engine"), ...await testFiles("e2e")];
/* the long browser tests first (bigger file ≈ longer test), so no worker is left with a long one at the end */
const sizes = new Map(await Promise.all(files.map(async f => [f, (await stat(path.join(HERE, f))).size])));
const queue = files.slice().sort((a, b) => (b.startsWith("e2e") - a.startsWith("e2e")) || sizes.get(b) - sizes.get(a));
const servers = [];
const totalStarted = Date.now();

async function worker(index) {
  const ports = portsOf(index);
  const api = `http://localhost:${ports.api}`;
  servers.push(await startFakeBackend(ports.api), await startStaticServer(ports.site, api));
  const env = { PW_API_BASE: api, PW_SITE: `http://localhost:${ports.site}` };
  for (let file = queue.shift(); file; file = queue.shift()) {
    const attempts = file.startsWith("e2e") ? E2E_ATTEMPTS : 1;
    let result;
    let attempt = 0;
    const started = Date.now();
    while (attempt < attempts) {
      attempt++;
      /* every attempt starts from an empty backend, like the first test of a fresh run */
      await fetch(`${api}/__reset-all`, { method: "POST" });
      result = await run(file, env);
      if (result.code === 0) break;
    }
    const passed = result.code === 0;
    const note = passed && attempt > 1 ? " (passed on retry)" : "";
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`${passed ? "✔" : "✘"} ${file}${note}  ${passed ? summaryLine(result.output) : ""}  [${seconds}s]`);
    if (!passed) console.log(result.output.split("\n").filter(l => !l.startsWith("PASS:")).slice(-25).join("\n"));
    results.push({ file, passed });
  }
}

await Promise.all(Array.from({ length: Math.min(WORKERS, files.length) }, (_, i) => worker(i)));
servers.forEach(server => server.close());

const failed = results.filter(r => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} test files passed in ${((Date.now() - totalStarted) / 1000).toFixed(0)}s (${Math.min(WORKERS, files.length)} parallel)`);
if (failed.length) console.log(`failed: ${failed.map(r => r.file).join(", ")}`);
process.exit(failed.length ? 1 : 0);
