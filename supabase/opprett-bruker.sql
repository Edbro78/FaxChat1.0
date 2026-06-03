-- ═══════════════════════════════════════════════════════════════
-- OPPRETTE BRUKER I SUPABASE (admin)
-- Brukeren logger inn med: Edvard01 + passord (ingen e-post)
-- ═══════════════════════════════════════════════════════════════

-- STEG 1: Supabase → Authentication → Users → Add user
--
--   User ID (Supabase sitt obligatoriske felt — IKKE ekte e-post):
--     edvard01@fax.internal
--     (mønster: {brukernavn med små bokstaver}@fax.internal)
--
--   Password:  passordet brukeren skal logge inn med
--   Auto Confirm User: ON
--
-- Eksempel for brukernavn Edvard01:
--   User ID:  edvard01@fax.internal
--   Password: ditt-valgte-passord

-- STEG 2: SQL Editor — koble bruker til FaxChat-profil
-- (kjør register_faxchat_profile etter schema.sql er kjørt)

select public.register_faxchat_profile('Edvard01');

-- Flere eksempler:
-- select public.register_faxchat_profile('Bernt33');
-- select public.register_faxchat_profile('Admin99');

-- Resultat for Edvard01:
--   username / fax_label: Edvard01
--   name: Edvard
--   station_id (faksnummer): 01

-- ═══════════════════════════════════════════════════════════════
-- SLETT BRUKER
-- ═══════════════════════════════════════════════════════════════
-- Slett under Authentication → Users (profiles slettes automatisk via cascade)
