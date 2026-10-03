import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails(
  "mailto:push@projekt-wir.local",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const CATEGORY_COLUMNS: Record<string, string> = {
  letters: "letters_enabled",
  quest: "quest_enabled",
  battery: "battery_enabled",
  mochi: "mochi_enabled",
  games: "games_enabled",
  reflexion_daily: "daily_reflection_enabled",
  reflexion_weekly: "weekly_reflection_enabled"
};

const PERSONS = new Set(["Isi", "Benji"]);
const MAX_TITLE = 80;
const MAX_BODY = 240;
/* only pages of the app itself, e.g. "cabo.html" or "wir.html?tab=briefe" – never other sites */
const APP_URL = /^[a-z0-9-]+\.html(\?[a-z0-9=&_-]*)?(#[a-z0-9_-]*)?$/i;

function clip(value: unknown, max: number, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return fallback;
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function appUrl(value: unknown) {
  return typeof value === "string" && APP_URL.test(value) ? value : "index.html";
}

function person(value: unknown) {
  return typeof value === "string" && PERSONS.has(value) ? value : null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const input = await request.json();
    const excludePerson = person(input.excludePerson);
    const onlyPerson = person(input.onlyPerson);
    const category = typeof input.category === "string" ? input.category : null;

    let query = supabase.from("push_subscriptions").select("*");

    if (excludePerson) {
      query = query.neq("person", excludePerson);
    }

    if (onlyPerson) {
      query = query.eq("person", onlyPerson);
    }

    const { data: subscriptions, error } = await query;

    if (error) throw error;

    let recipients = subscriptions || [];

    const settingsColumn = category ? CATEGORY_COLUMNS[category] : null;

    if (settingsColumn && recipients.length > 0) {
      const { data: settingsRows, error: settingsError } = await supabase
        .from("notification_settings")
        .select("person, " + settingsColumn);

      if (settingsError) throw settingsError;

      const disabledPersons = new Set(
        (settingsRows || [])
          .filter((row: Record<string, unknown>) => row[settingsColumn] === false)
          .map((row: Record<string, unknown>) => row.person)
      );

      recipients = recipients.filter(sub => !disabledPersons.has(sub.person));
    }

    const payload = JSON.stringify({
      title: clip(input.title, MAX_TITLE, "Projekt Wir 💗"),
      body: clip(input.body, MAX_BODY, "Es gibt etwas Neues."),
      url: appUrl(input.url)
    });

    const results = await Promise.allSettled(
      recipients.map(sub =>
        webpush
          .sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            },
            payload
          )
          .catch(async pushError => {
            if (pushError.statusCode === 404 || pushError.statusCode === 410) {
              await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
            }
            throw pushError;
          })
      )
    );

    const succeeded = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    return json({ sent: results.length, succeeded, failed });
  } catch (error) {
    console.error(error);
    return json({ error: "Benachrichtigung konnte nicht gesendet werden." }, 500);
  }
});
