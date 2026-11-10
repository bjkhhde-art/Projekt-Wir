-- Game invitations (Cabo, 6 nimmt!, Qwixx) can be switched off in the settings like every other category.
alter table public.notification_settings add column if not exists games_enabled boolean not null default true;
