/* Talking to the public Eporner API (https://www.eporner.com/api/v2/): building the search
   address, picking one random video from a result page and cleaning what comes back.
   Pure functions, used by the edge function and the node tests. */

export const API = "https://www.eporner.com/api/v2/video/search/";
export const PER_PAGE = 30;
/* the first pages only – deeper pages get noticeably worse */
export const MAX_PAGES = 25;
/* "top-rated" is mostly barely watched clips with a perfect 5 – these lists have real ratings */
export const ORDERS = ["most-popular", "top-monthly", "top-weekly"];

export function randomOrder(random = Math.random) {
  return ORDERS[Math.floor(random() * ORDERS.length)];
}

/* what may be searched for: letters, digits, spaces and dashes, short */
export function cleanQuery(raw) {
  return String(raw || "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function searchUrl(query, page, order = ORDERS[0]) {
  const params = new URLSearchParams({
    query: cleanQuery(query) || "all",
    per_page: String(PER_PAGE),
    page: String(Math.max(1, Math.floor(page) || 1)),
    thumbsize: "big",
    order: ORDERS.includes(order) ? order : ORDERS[0],
    gay: "0",
    lq: "0",
    format: "json"
  });
  return `${API}?${params}`;
}

export function randomPage(totalPages, random = Math.random) {
  const pages = Math.max(1, Math.min(MAX_PAGES, Math.floor(Number(totalPages)) || 1));
  return 1 + Math.floor(random() * pages);
}

/* only https addresses on eporner.com itself or its subdomains (thumbnails live on a CDN subdomain) */
export function isEpornerUrl(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.port && !url.username && (host === "eporner.com" || host.endsWith(".eporner.com"));
  } catch {
    return false;
  }
}

/* the same video with or without "www", a trailing slash or tracking parameters */
export function sameVideoKey(raw) {
  try {
    const url = new URL(raw);
    return url.hostname.toLowerCase().replace(/^www\./, "") + url.pathname.replace(/\/+$/, "").toLowerCase();
  } catch {
    return String(raw || "");
  }
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };
function decode(text) {
  return String(text || "")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z#0-9]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

function cleanVideo(video) {
  if (!video || typeof video !== "object") return null;
  const url = String(video.url || "");
  const title = decode(video.title).replace(/\s+/g, " ").trim().slice(0, 120);
  if (!isEpornerUrl(url) || !title) return null;
  const thumb = video.default_thumb && isEpornerUrl(video.default_thumb.src) ? video.default_thumb.src : null;
  const rating = Number.parseFloat(video.rate);
  const views = Number(video.views);
  return {
    url,
    title,
    length: /^\d{1,3}:\d{2}(:\d{2})?$/.test(String(video.length_min || "")) ? String(video.length_min) : null,
    rating: Number.isFinite(rating) ? Math.round(rating * 10) / 10 : null,
    views: Number.isFinite(views) && views >= 0 ? Math.floor(views) : null,
    thumb,
    keywords: String(video.keywords || "").split(",").map(k => k.trim()).filter(Boolean).slice(0, 6)
  };
}

/* one random video from a result page that is not in our list (or was just suggested) */
export function pickVideo(data, exclude = [], random = Math.random) {
  const skip = new Set(exclude.map(sameVideoKey));
  const videos = (data && Array.isArray(data.videos) ? data.videos : [])
    .map(cleanVideo)
    .filter(video => video && !skip.has(sameVideoKey(video.url)));
  if (!videos.length) return null;
  return videos[Math.floor(random() * videos.length)];
}
