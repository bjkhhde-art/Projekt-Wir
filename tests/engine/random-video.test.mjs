import assert from "node:assert/strict";
import { cleanQuery, searchUrl, randomPage, randomOrder, isEpornerUrl, sameVideoKey, pickVideo, MAX_PAGES, ORDERS } from "../../supabase/functions/random-video/eporner.mjs";

let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}

ok(cleanQuery("  #Massage  &  Öl!! ") === "Massage Öl", "search words keep letters and umlauts, symbols go");
ok(cleanQuery("x".repeat(100)).length === 60, "search words are capped");
const url = new URL(searchUrl("", 3));
ok(url.origin + url.pathname === "https://www.eporner.com/api/v2/video/search/", "the public Eporner search API is used");
ok(url.searchParams.get("query") === "all" && url.searchParams.get("page") === "3" && url.searchParams.get("format") === "json", "no search word means 'all'");
ok(url.searchParams.get("order") === "most-popular" && url.searchParams.get("lq") === "0" && url.searchParams.get("thumbsize") === "big", "popular, no low quality, big pictures");
ok(new URL(searchUrl("", 1, "top-weekly")).searchParams.get("order") === "top-weekly" && new URL(searchUrl("", 1, "evil")).searchParams.get("order") === "most-popular", "a chosen list is used, unknown ones fall back");
ok(!ORDERS.includes("top-rated") && randomOrder(() => 0) === ORDERS[0] && randomOrder(() => 0.99) === ORDERS[ORDERS.length - 1], "the list is picked at random – never 'top-rated' (barely watched 5-star clips)");
ok(new URL(searchUrl("pov <script>", 0)).searchParams.get("query") === "pov script" && new URL(searchUrl("a", 0)).searchParams.get("page") === "1", "search words are cleaned and the page is at least 1");

ok(randomPage(1000, () => 0.999) === MAX_PAGES, "only the first pages of a list");
ok(randomPage(3, () => 0.999) === 3 && randomPage(3, () => 0) === 1, "a random page among the ones that exist");
ok(randomPage(undefined, () => 0.5) === 1 && randomPage(0, () => 0.5) === 1, "missing page counts mean page 1");

ok(isEpornerUrl("https://www.eporner.com/video-abc/title/") && isEpornerUrl("https://static-ca-cdn.eporner.com/thumbs/1.jpg"), "eporner and its picture servers are accepted");
ok(!isEpornerUrl("http://www.eporner.com/x") && !isEpornerUrl("https://eporner.com.evil.net/x") && !isEpornerUrl("https://evil.net/eporner.com") && !isEpornerUrl("javascript:alert(1)"), "nothing else – no http, no look-alike hosts");
ok(sameVideoKey("https://www.eporner.com/video-ABC/t/?ref=1") === sameVideoKey("https://eporner.com/video-abc/t"), "the same video is recognised with or without www, slash or parameters");

const video = (id, extra = {}) => ({
  id, title: `Video ${id} &amp; mehr`, url: `https://www.eporner.com/video-${id}/titel/`, rate: "4.56", views: 12345,
  length_min: "12:34", keywords: "a, b,c,d,e,f,g", default_thumb: { src: `https://static-cdn.eporner.com/thumbs/${id}.jpg` }, ...extra
});
const data = { total_pages: 7, videos: [video("a"), video("b"), video("c")] };
const picked = pickVideo(data, [], () => 0.5);
ok(picked.url === "https://www.eporner.com/video-b/titel/" && picked.title === "Video b & mehr", "a random video from the page, title decoded");
ok(picked.rating === 4.6 && picked.views === 12345 && picked.length === "12:34", "rating, views and length come along");
ok(picked.keywords.length === 6 && picked.keywords[2] === "c", "a few keywords are kept");
ok(picked.thumb === "https://static-cdn.eporner.com/thumbs/b.jpg", "the picture address comes along");
ok(pickVideo(data, ["https://eporner.com/video-a/titel", "https://www.eporner.com/video-b/titel/"], () => 0.9).url.includes("video-c"), "videos already in our list are skipped");
ok(pickVideo(data, data.videos.map(v => v.url)) === null, "nothing new → nothing picked");
ok(pickVideo({ videos: [video("x", { url: "https://evil.net/x" }), video("y", { title: "" })] }) === null, "videos with a foreign address or no title are dropped");
const odd = pickVideo({ videos: [video("z", { default_thumb: { src: "https://evil.net/t.jpg" }, rate: "n/a", views: -1, length_min: "<b>" })] });
ok(odd.thumb === null && odd.rating === null && odd.views === null && odd.length === null, "odd values are dropped instead of shown");
ok(pickVideo(null) === null && pickVideo({ videos: "x" }) === null, "a broken answer gives nothing");

console.log(`\n${assertions} assertions passed (random video)`);
