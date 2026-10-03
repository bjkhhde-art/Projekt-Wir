import http from "node:http";

/* Test-only in-memory stand-in for the game tables (replaces Supabase in the browser tests). Legacy routes (/latest, /games/:id, ...) address cabo_games;
   /t/<table>/... addresses any table. PATCH honours ?version=N like `.eq("version", N)`. */
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
    const row = {
      id: t.nextId++,
      status: body.status || "waiting",
      host_person: body.host_person,
      guest_person: body.guest_person || null,
      state: body.state || {},
      version: body.version ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    t.rows.push(row);
    send(res, 200, row);
    return true;
  }

  const idMatch = path.match(/^\/games\/(\d+)$/);
  if (req.method === "PATCH" && idMatch) {
    const body = await readBody(req);
    const row = t.rows.find(g => g.id === Number(idMatch[1]));
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
    t.rows = t.rows.filter(g => g.id !== Number(idMatch[1]));
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

    const tableMatch = url.pathname.match(/^\/t\/([a-z_]+)(\/.*)$/);
    const handled = tableMatch
      ? await handle(req, res, tableMatch[1], tableMatch[2], url)
      : await handle(req, res, "cabo_games", url.pathname, url);

    if (!handled) send(res, 404, { error: "unknown route " + req.method + " " + url.pathname });
  });

  return new Promise(resolve => server.listen(port, () => resolve(server)));
}
