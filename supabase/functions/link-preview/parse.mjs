/* Finds the preview picture and title of a web page (Open Graph / Twitter cards, like the
   previews in WhatsApp). Pure functions, used by the edge function and the node tests. */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " };

export function decodeEntities(text) {
  return String(text || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z#0-9]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

function attributes(tag) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match;
  while ((match = re.exec(tag))) {
    attrs[match[1].toLowerCase()] = decodeEntities(match[3] ?? match[4] ?? match[5] ?? "");
  }
  return attrs;
}

/* only public web addresses: no local network, no other schemes or odd ports */
export function isPublicHttpUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.port && url.port !== "80" && url.port !== "443") return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224) return false;
  }
  if (host.includes(":")) return false; /* raw IPv6 addresses are not needed for previews */
  return true;
}

function resolve(candidate, pageUrl) {
  if (!candidate) return null;
  try {
    const url = new URL(candidate.trim(), pageUrl);
    return isPublicHttpUrl(url.href) ? url.href : null;
  } catch {
    return null;
  }
}

export function extractPreview(html, pageUrl) {
  const head = String(html || "").slice(0, 600000);
  const meta = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = attributes(tag);
    const key = (attrs.property || attrs.name || attrs.itemprop || "").toLowerCase();
    if (key && attrs.content && !(key in meta)) meta[key] = attrs.content;
  }
  let imageSrc = null;
  for (const tag of head.match(/<link\b[^>]*>/gi) || []) {
    const attrs = attributes(tag);
    if ((attrs.rel || "").toLowerCase() === "image_src" && attrs.href) {
      imageSrc = attrs.href;
      break;
    }
  }
  let poster = null;
  const video = head.match(/<video\b[^>]*>/i);
  if (video) poster = attributes(video[0]).poster || null;

  const imageCandidates = [
    meta["og:image:secure_url"], meta["og:image"], meta["og:image:url"], meta["twitter:image"],
    meta["twitter:image:src"], meta["thumbnailurl"], meta["image"], imageSrc, poster
  ];
  let image = null;
  for (const candidate of imageCandidates) {
    image = resolve(candidate, pageUrl);
    if (image) break;
  }

  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (meta["og:title"] || meta["twitter:title"] || (titleTag ? decodeEntities(titleTag[1]) : "") || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || null;

  return { image, title };
}
