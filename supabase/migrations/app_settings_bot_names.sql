-- the names Isi and Benji gave the computer players, shared by both phones: { "Udiou": "…", "Klausi": "…" }
alter table public.app_settings add column if not exists bot_names jsonb not null default '{}'::jsonb;
