/* Where a browser test finds its servers. run-all.mjs starts one fake backend and one site server per
   parallel worker and passes their addresses in; a test started on its own uses the default ports. */
export const API_BASE = process.env.PW_API_BASE || "http://localhost:8991";
export const SITE = process.env.PW_SITE || "http://localhost:9091";
