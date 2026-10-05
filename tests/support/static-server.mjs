import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Serves the real site from the repository root. In every page the Supabase client is swapped
   for tests/support/supabase-mock.js and the PIN gate is pre-unlocked, so tests run offline. */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SUPABASE_CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json"
};

function prepareHtml(html) {
  return html
    /* a test can set sessionStorage.__pw_locked to see the real lock (password and invite tests) */
    .replace("<head>", '<head>\n  <script>if (!sessionStorage.getItem("__pw_locked")) localStorage.setItem("pw_unlocked", "true");</script>')
    .replace(SUPABASE_CDN, '<script src="/tests/support/supabase-mock.js"></script>');
}

export function startStaticServer(port = 9091) {
  const server = http.createServer(async (req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const filePath = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }

    try {
      const ext = path.extname(filePath);
      let body = await readFile(filePath);
      if (ext === ".html") body = prepareHtml(body.toString());
      res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  return new Promise(resolve => server.listen(port, () => resolve(server)));
}
