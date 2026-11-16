/* Fetches our shared Spotify playlist ("Hau raus🎧") into playlist.json, which the song quiz and
   Playlist-Wrapped read. Runs daily on GitHub (.github/workflows/playlist.yml) and by hand:

     node tools/update-playlist.mjs

   Without keys it reads Spotify's public player, which only shows the first 100 songs.
   With a Spotify developer app (repository secrets SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET) it reads
   every song through the official Web API, including who added it and when.
   Per song it also reads the public song player once (30-second preview, cover, release date); songs
   already in playlist.json keep what was fetched before, so a daily run only asks for new songs. */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const PLAYLIST_ID = "0Gg0v83SQDmGt36cVHcyk5";
const OUT = fileURLToPath(new URL("../playlist.json", import.meta.url));
/* Spotify account → person; any other single account is the other one of us */
const PEOPLE = { "ben.kzyk": "Benji" };
const OTHER_PERSON = "Isi";
const UA = "Mozilla/5.0 (projekt-wir playlist sync)";

const wait = ms => new Promise(r => setTimeout(r, ms));

async function get(url, options = {}) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { ...options, headers: { "User-Agent": UA, ...(options.headers || {}) } });
    if (res.ok) return res;
    if (attempt >= 3 || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status} for ${url}`);
    await wait(1500 * attempt);
  }
}

/* the JSON the public player pages carry for their first render */
async function embedEntity(kind, id) {
  const html = await (await get(`https://open.spotify.com/embed/${kind}/${id}`)).text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error(`no data in the ${kind} player for ${id}`);
  return JSON.parse(match[1]).props.pageProps.state.data.entity;
}

const idOf = uri => String(uri || "").split(":").pop();
const day = iso => (/^\d{4}(-\d{2}){0,2}/.exec(String(iso || "")) || [""])[0];
const largest = images => (images || []).slice().sort((a, b) => (b.maxWidth || b.width || 0) - (a.maxWidth || a.width || 0))[0];
const middle = images => {
  const list = (images || []).filter(i => i && i.url);
  return (list.find(i => (i.maxWidth || i.width) === 300) || largest(list) || {}).url || "";
};

/* the song count Spotify shows on the playlist page, to tell how much the public player leaves out */
async function songCount() {
  try {
    const html = await (await get(`https://open.spotify.com/playlist/${PLAYLIST_ID}`)).text();
    const count = html.match(/music:song_count" content="(\d+)"/);
    const description = html.match(/<meta name="description" content="([^"]*)"/);
    return { total: count ? Number(count[1]) : null, description: description ? decodeEntities(description[1]) : "" };
  } catch (error) {
    console.warn("song count not available:", error.message);
    return { total: null, description: "" };
  }
}

function decodeEntities(text) {
  return text.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

async function fromPublicPlayer() {
  const entity = await embedEntity("playlist", PLAYLIST_ID);
  return {
    name: entity.name,
    owner: entity.subtitle || "",
    cover: middle(entity.coverArt && entity.coverArt.sources),
    tracks: (entity.trackList || []).map(t => ({
      id: idOf(t.uri),
      title: t.title,
      artists: String(t.subtitle || "").split(",").map(a => a.replace(/ /g, " ").trim()).filter(Boolean),
      durationMs: t.duration || 0,
      preview: (t.audioPreview && t.audioPreview.url) || ""
    }))
  };
}

async function fromWebApi(clientId, clientSecret) {
  const tokenRes = await get("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
    },
    body: "grant_type=client_credentials"
  });
  const { access_token: token } = await tokenRes.json();
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const meta = await (await get(`https://api.spotify.com/v1/playlists/${PLAYLIST_ID}?fields=name,owner(id),images`, auth)).json();

  const tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/tracks?limit=100&fields=next,items(added_at,added_by(id),track(id,name,duration_ms,artists(name),album(release_date,images)))`;
  while (url) {
    const page = await (await get(url, auth)).json();
    for (const item of page.items || []) {
      const t = item.track;
      if (!t || !t.id) continue;
      tracks.push({
        id: t.id,
        title: t.name,
        artists: (t.artists || []).map(a => a.name).filter(Boolean),
        durationMs: t.duration_ms || 0,
        released: day(t.album && t.album.release_date),
        cover: middle(t.album && t.album.images),
        addedAt: item.added_at || "",
        addedById: (item.added_by && item.added_by.id) || ""
      });
    }
    url = page.next;
  }

  /* account ids → our names */
  const unknown = [...new Set(tracks.map(t => t.addedById).filter(id => id && !PEOPLE[id]))];
  const nameOf = id => PEOPLE[id] || (unknown.length === 1 && id === unknown[0] ? OTHER_PERSON : "");
  for (const t of tracks) {
    t.addedBy = nameOf(t.addedById);
    delete t.addedById;
  }
  return { name: meta.name, owner: (meta.owner && meta.owner.id) || "", cover: middle(meta.images), tracks };
}

async function previousFile() {
  try {
    return JSON.parse(await readFile(OUT, "utf8"));
  } catch {
    return { tracks: [] };
  }
}

const keys = (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) ? [process.env.SPOTIFY_CLIENT_ID, process.env.SPOTIFY_CLIENT_SECRET] : null;
let list;
let source;
if (keys) {
  try {
    list = await fromWebApi(...keys);
    source = "api";
  } catch (error) {
    console.warn("Web API failed, falling back to the public player:", error.message);
  }
}
if (!list) {
  list = await fromPublicPlayer();
  source = "player";
}

const before = await previousFile();
const known = new Map((before.tracks || []).map(t => [t.id, t]));
const { total, description } = await songCount();

const tracks = [];
let fetched = 0;
for (const t of list.tracks) {
  const old = known.get(t.id) || {};
  const merged = { ...old, ...Object.fromEntries(Object.entries(t).filter(([, v]) => v !== "" && v !== undefined)) };
  if (!merged.preview || !merged.cover || !merged.released) {
    try {
      const e = await embedEntity("track", t.id);
      merged.preview = merged.preview || (e.audioPreview && e.audioPreview.url) || "";
      merged.cover = merged.cover || middle(e.visualIdentity && e.visualIdentity.image);
      merged.released = merged.released || day(e.releaseDate && e.releaseDate.isoString);
      if (Array.isArray(e.artists) && e.artists.length) merged.artists = e.artists.map(a => a.name);
      fetched++;
      await wait(250);
    } catch (error) {
      console.warn(`details for ${t.title} not available:`, error.message);
    }
  }
  tracks.push({
    id: merged.id,
    title: merged.title,
    artists: merged.artists || [],
    durationMs: merged.durationMs || 0,
    released: merged.released || "",
    preview: merged.preview || "",
    cover: merged.cover || "",
    ...(merged.addedAt ? { addedAt: merged.addedAt } : {}),
    ...(merged.addedBy ? { addedBy: merged.addedBy } : {})
  });
}

const out = {
  id: PLAYLIST_ID,
  name: list.name,
  owner: list.owner,
  description,
  url: `https://open.spotify.com/playlist/${PLAYLIST_ID}`,
  cover: list.cover,
  source,
  total: total || tracks.length,
  tracks
};

/* only rewrite (and so only commit) when something really changed */
const strip = data => JSON.stringify({ ...data, updatedAt: undefined });
if (strip(out) === strip(before)) {
  console.log(`playlist.json unchanged (${tracks.length} songs)`);
} else {
  out.updatedAt = new Date().toISOString();
  await writeFile(OUT, JSON.stringify({ updatedAt: out.updatedAt, ...out }, null, 1) + "\n");
  console.log(`playlist.json: ${tracks.length} of ${out.total} songs from the ${source === "api" ? "Web API" : "public player"}, ${fetched} song details fetched`);
}
