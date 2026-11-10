/* The one connection to Supabase for every page. Loaded right after supabase-js and before the page's
   own scripts, which simply use `supabaseClient`. The publishable key is meant to be public: what it may
   do is decided by the login (pin-lock.js) and the database rules. */
const PW_SUPABASE = Object.freeze({
  url: "https://lrzgcqoqcwicpuuuhaoj.supabase.co",
  key: "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK"
});

const supabaseClient = supabase.createClient(PW_SUPABASE.url, PW_SUPABASE.key);
