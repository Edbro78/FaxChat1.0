-- Kjør hvis du allerede har gammel profiles-tabell uten username/auth_email

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists auth_email text;

-- Eksisterende brukere må fylles manuelt eller opprettes på nytt via admin.html
