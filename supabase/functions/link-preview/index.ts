/* Fetches the preview picture of a shared link once, stores it in our own storage bucket and
   saves its address on the link. Phones then show the picture from our storage – scrolling the
   list never contacts the linked site. Called with { linkId } after a link was shared. */
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractPreview, isPublicHttpUrl } from "./parse.mjs";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const BUCKET = "link-previews";
const PAGE_LIMIT = 1_500_000;
const IMAGE_LIMIT = 5_000_000;
const TIMEOUT_MS = 9000;
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

/* looks like a normal browser of an adult who already confirmed the age question */
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
  "Cookie": "age_verified=1; accessAgeDisclaimerPH=1; accessAgeDisclaimerUK=1; agecheck=1; disclaimer=1"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

/* follows redirects by hand so every hop is checked against the local-network block */
async function safeFetch(url: string, accept: string): Promise<Response> {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    if (!isPublicHttpUrl(current)) throw new Error("blocked address");
    const response = await fetch(current, {
      headers: { ...BROWSER_HEADERS, Accept: accept },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      current = new URL(response.headers.get("location")!, current).href;
      continue;
    }
    return response;
  }
  throw new Error("too many redirects");
}

async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(Math.min(size, limit));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk.subarray(0, out.length - offset), offset);
    offset += chunk.length;
    if (offset >= out.length) break;
  }
  return out;
}

async function setStatus(linkId: number, fields: Record<string, unknown>) {
  await supabase.from("private_links").update(fields).eq("id", linkId);
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let linkId: number;
  try {
    linkId = Number((await request.json()).linkId);
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  if (!Number.isInteger(linkId) || linkId <= 0) return json({ error: "Bad request" }, 400);

  const { data: link, error } = await supabase.from("private_links").select("id, url").eq("id", linkId).maybeSingle();
  if (error || !link) return json({ error: "Not found" }, 404);

  try {
    const page = await safeFetch(link.url, "text/html,application/xhtml+xml");
    if (!page.ok) throw new Error(`page ${page.status}`);
    const html = new TextDecoder().decode(await readLimited(page, PAGE_LIMIT));
    const preview = extractPreview(html, page.url || link.url);

    if (!preview.image) {
      await setStatus(linkId, { preview_status: "none", preview_title: preview.title });
      return json({ status: "none" });
    }

    const picture = await safeFetch(preview.image, "image/avif,image/webp,image/*");
    const type = (picture.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!picture.ok || !IMAGE_TYPES[type]) throw new Error(`image ${picture.status} ${type}`);
    const bytes = await readLimited(picture, IMAGE_LIMIT);
    if (bytes.length >= IMAGE_LIMIT) throw new Error("image too large");

    const path = `${linkId}-${Date.now()}.${IMAGE_TYPES[type]}`;
    const upload = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: type, cacheControl: "31536000", upsert: true });
    if (upload.error) throw upload.error;
    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path);

    await setStatus(linkId, { preview_status: "ok", preview_image: publicUrl.publicUrl, preview_title: preview.title });
    return json({ status: "ok" });
  } catch (failure) {
    console.error("preview failed", linkId, String(failure));
    await setStatus(linkId, { preview_status: "error" });
    return json({ status: "error" });
  }
});
