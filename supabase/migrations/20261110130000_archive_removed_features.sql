-- Aufräumen nach entfernten Features (Vision, Monopoly, Vergleich, Frage des Tages / Duo, „Nur für uns“).
--
-- Die Tabellen haben noch ein paar alte Einträge. Statt sie zu löschen, wandern sie in das Schema
-- "archive": Das ist über die API nicht erreichbar (weder für Gäste noch für Mitglieder), die Daten
-- bleiben aber erhalten. Endgültig löschen später mit: drop schema archive cascade;
--
-- Außerdem: Der Zeitplan-Job für die Reflexions-Erinnerungen läuft noch alle 15 Minuten, obwohl es die
-- Reflexion (Tabellen und Seite) nicht mehr gibt.

create schema if not exists archive;
revoke all on schema archive from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['monopoly_games', 'visions', 'versus_games', 'daily_answers', 'duo_games', 'private_link_comments', 'private_links'] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
    execute format('alter table public.%I set schema archive', t);
  end loop;
end $$;

do $$
begin
  if to_regclass('cron.job') is not null then
    execute 'select cron.unschedule(jobid) from cron.job where jobname = $1' using 'reflection-reminder-check';
  end if;
end $$;
