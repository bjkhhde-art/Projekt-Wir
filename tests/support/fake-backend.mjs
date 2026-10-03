import http from "node:http";

/* Test-only in-memory stand-in for Supabase in the browser tests. Legacy routes (/latest, /games/:id, ...) address cabo_games;
   /t/<table>/... addresses any table. PATCH honours ?version=N like `.eq("version", N)`.
   /rt/presence/<channel> and /rt/broadcast/<channel> emulate realtime presence and broadcast. */
const tables = {};
function table(name) {
  if (!tables[name]) tables[name] = { rows: [], nextId: 1 };
  return tables[name];
}

function send(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise(resolve => {
    let data = "";
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => resolve(data ? JSON.parse(data) : {}));
  });
}

const newest = rows => rows.slice().sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);

async function handle(req, res, name, path, url) {
  const t = table(name);

  if (req.method === "GET" && path === "/latest") {
    send(res, 200, newest(t.rows)[0] || null);
    return true;
  }
  if (req.method === "GET" && path === "/latest-nonfinished") {
    send(res, 200, newest(t.rows.filter(g => g.status !== "finished"))[0] || null);
    return true;
  }
  if (req.method === "GET" && path === "/dump") {
    send(res, 200, t.rows);
    return true;
  }
  if (req.method === "POST" && path === "/games") {
    const body = await readBody(req);
    const now = new Date().toISOString();
    const gameDefaults = name.endsWith("_games") ? { status: "waiting", guest_person: null, state: {}, version: 0 } : {};
    const row = { ...gameDefaults, ...body, id: body.id ?? t.nextId++, created_at: body.created_at || now, updated_at: body.updated_at || now };
    t.rows.push(row);
    send(res, 200, row);
    return true;
  }
  if (req.method === "POST" && path === "/seed") {
    const body = await readBody(req);
    tables[name] = { rows: body.rows || [], nextId: (body.rows || []).length + 1 };
    send(res, 200, { ok: true });
    return true;
  }

  const idMatch = path.match(/^\/games\/([^/]+)$/);
  const sameId = row => String(row.id) === decodeURIComponent(idMatch[1]);
  if (req.method === "PATCH" && idMatch) {
    const body = await readBody(req);
    const row = t.rows.find(sameId);
    const version = url.searchParams.get("version");
    if (!row || (version !== null && row.version !== Number(version))) {
      send(res, 200, []);
      return true;
    }
    Object.assign(row, body);
    send(res, 200, [row]);
    return true;
  }
  if (req.method === "DELETE" && idMatch) {
    t.rows = t.rows.filter(g => !sameId(g));
    send(res, 200, { ok: true });
    return true;
  }
  if (req.method === "POST" && path === "/reset") {
    tables[name] = { rows: [], nextId: 1 };
    send(res, 200, { ok: true });
    return true;
  }
  return false;
}


/* presence: a key counts as online while it sent a heartbeat within the last 1.5 s */
const presence = {};
const broadcasts = {};
let nextBroadcastId = 1;

async function handleRealtime(req, res, kind, channel, url) {
  if (kind === "presence") {
    const members = presence[channel] = presence[channel] || {};
    if (req.method === "POST") {
      const body = await readBody(req);
      members[body.key] = { meta: body.meta, at: Date.now() };
      send(res, 200, { ok: true });
      return;
    }
    const state = {};
    Object.entries(members).forEach(([key, value]) => {
      if (Date.now() - value.at < 1500) state[key] = [value.meta];
    });
    send(res, 200, state);
    return;
  }
  const list = broadcasts[channel] = broadcasts[channel] || [];
  if (req.method === "POST") {
    const body = await readBody(req);
    list.push({ id: nextBroadcastId++, ...body });
    send(res, 200, { ok: true });
    return;
  }
  const after = Number(url.searchParams.get("after") || 0);
  send(res, 200, list.filter(m => m.id > after));
}

export function startFakeBackend(port = 8991) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      res.end();
      return;
    }

    const realtimeMatch = url.pathname.match(/^\/rt\/(presence|broadcast)\/([\w-]+)$/);
    if (realtimeMatch) {
      await handleRealtime(req, res, realtimeMatch[1], realtimeMatch[2], url);
      return;
    }

    const tableMatch = url.pathname.match(/^\/t\/([a-z_]+)(\/.*)$/);
    const handled = tableMatch
      ? await handle(req, res, tableMatch[1], tableMatch[2], url)
      : await handle(req, res, "cabo_games", url.pathname, url);

    if (!handled) send(res, 404, { error: "unknown route " + req.method + " " + url.pathname });
  });

  return new Promise(resolve => server.listen(port, () => resolve(server)));
}
