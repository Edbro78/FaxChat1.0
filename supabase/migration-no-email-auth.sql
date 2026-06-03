-- Migrer fra gammel e-post-basert auth til kun brukernavn + passord
-- ADVARSEL: Slett eksisterende profiler uten passord og opprett på nytt med create_faxchat_user

create extension if not exists pgcrypto;

drop function if exists public.register_faxchat_profile(text);

alter table public.profiles drop constraint if exists profiles_id_fkey;

alter table public.profiles add column if not exists password_hash text;
alter table public.profiles drop column if exists auth_email;

alter table public.profiles alter column id set default gen_random_uuid();

-- Kjør deretter innholdet fra schema.sql (create_faxchat_user + verify_faxchat_login)
