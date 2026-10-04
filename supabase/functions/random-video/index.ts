/* "Etwas Neues" in Nur für uns: suggests one random, popular video from the public Eporner
   API. The preview picture is fetched here and sent along, so phones only contact the site
   when "Öffnen" is tapped. Called with { query?, exclude? } (exclude = links we already have). */
import { isEpornerUrl, pickVideo, randomOrder, randomPage, searchUrl } from "./eporner.mjs";

const TIMEOUT_MS = 8000;
const THUMB_LIMIT = 1_500_000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function search(query: string, page: number, order: string) {
  const response = await fetch(searchUrl(query, page, order), {
    headers: { Accept: "application/json", "User-Agent": "ProjektWir/1.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`search ${response.status}`);
  return await response.json();
}

/* the thumbnail as a data: address – only from eporner, only pictures, not too big */
async function thumbAsDataUrl(src: string | null): Promise<string | null> {
  if (!src || !isEpornerUrl(src)) return null;
  try {
    const response = await fetch(src, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!response.ok || !IMAGE_TYPES.has(type)) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > THUMB_LIMIT) return null;
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let query = "";
  let exclude: string[] = [];
  try {
    const body = await request.json();
    query = typeof body.query === "string" ? body.query : "";
    exclude = Array.isArray(body.exclude) ? body.exclude.filter((u: unknown) => typeof u === "string").slice(0, 500) : [];
  } catch {
    /* an empty body just means "anything" */
  }

  try {
    const order = randomOrder();
    const first = await search(query, 1, order);
    const page = randomPage(first.total_pages);
    const data = page === 1 ? first : await search(query, page, order);
    const video = pickVideo(data, exclude) || pickVideo(first, exclude);
    if (!video) return json({ status: "none" });
    const { thumb, ...rest } = video;
    return json({ status: "ok", video: { ...rest, thumb: await thumbAsDataUrl(thumb) } });
  } catch (failure) {
    console.error("random video failed", String(failure));
    return json({ status: "error" });
  }
});
