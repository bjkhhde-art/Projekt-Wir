import assert from "node:assert/strict";
import { extractPreview, isPublicHttpUrl, decodeEntities } from "../../supabase/functions/link-preview/parse.mjs";

let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}

const page = "https://www.example.com/videos/cute-clip-123";

let p = extractPreview(`<html><head>
  <title>Fallback title</title>
  <meta property="og:title" content="Ein &amp; zwei – Clip">
  <meta property="og:image" content="https://cdn.example.com/thumbs/123.jpg">
</head></html>`, page);
ok(p.image === "https://cdn.example.com/thumbs/123.jpg" && p.title === "Ein & zwei – Clip", "Open Graph image and title are found, entities decoded");

p = extractPreview(`<meta content="/img/thumb.webp" name="twitter:image"><title>  Nur
  der Titel </title>`, page);
ok(p.image === "https://www.example.com/img/thumb.webp" && p.title === "Nur der Titel", "Twitter image with a relative path, <title> as fallback, attribute order does not matter");

p = extractPreview(`<meta property='og:image:secure_url' content='https://s.example.com/a.jpg'><meta property="og:image" content="http://s.example.com/a.jpg">`, page);
ok(p.image === "https://s.example.com/a.jpg", "the https variant wins, single quotes work");

p = extractPreview(`<link rel="image_src" href="//img.example.net/x.png"><video poster="/p.jpg"></video>`, page);
ok(p.image === "https://img.example.net/x.png", "link rel=image_src as fallback (protocol-relative)");

p = extractPreview(`<video controls poster="/poster/9.jpg"></video>`, page);
ok(p.image === "https://www.example.com/poster/9.jpg", "a video poster as last resort");

p = extractPreview(`<meta property="og:image" content="javascript:alert(1)"><meta name="twitter:image" content="http://192.168.0.1/x.jpg">`, page);
ok(p.image === null, "unsafe or local image addresses are ignored");

p = extractPreview(`<html><body>no preview here</body></html>`, page);
ok(p.image === null && p.title === null, "pages without preview give nothing");
ok(extractPreview(`<title>${"x".repeat(300)}</title>`, page).title.length === 120, "titles are capped");

ok(isPublicHttpUrl("https://www.pornhub.com/view_video.php?viewkey=abc"), "normal sites are allowed");
ok(!isPublicHttpUrl("http://localhost/admin") && !isPublicHttpUrl("http://127.0.0.1/") && !isPublicHttpUrl("http://10.0.0.5/"), "local network addresses are refused");
ok(!isPublicHttpUrl("http://169.254.169.254/latest/meta-data") && !isPublicHttpUrl("http://[::1]/"), "cloud metadata and IPv6 loopback are refused");
ok(!isPublicHttpUrl("https://example.com:8443/") && !isPublicHttpUrl("ftp://example.com/") && !isPublicHttpUrl("https://user:pw@example.com/"), "odd ports, schemes and credentials are refused");
ok(decodeEntities("&#252;ber &#x2764; &quot;x&quot;") === 'über ❤ "x"', "numeric and named entities are decoded");

console.log(`\n${assertions} assertions passed (link preview parser)`);
