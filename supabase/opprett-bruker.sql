-- Opprette ny FaxChat-bruker (f.eks. Edvard01)
--
-- BRUKEREN LOGGER INN MED: Edvard01 + passord
-- IKKE e-post — kun kortnavn + 2-sifret faksnummer.
--
-- Edvard01  →  navn: Edvard, faksnummer: 01, vises i kartotek som Edvard01
--
-- ═══════════════════════════════════════════════════════════════
-- STEG 1: Supabase → Authentication → Users → Add user
-- ═══════════════════════════════════════════════════════════════
--
--   User Email:  edvard01@faxchat.no     ← intern ID (ikke ekte e-post)
--                (mønster: {Kortnavn}{Nummer}@faxchat.no, små bokstaver)
--
--   Password:    (passord du velger for brukeren)
--   Auto Confirm User: ON
--
-- ═══════════════════════════════════════════════════════════════
-- STEG 2: SQL Editor — lim inn UUID fra brukerlisten
-- ═══════════════════════════════════════════════════════════════

/*
insert into public.profiles (id, name, station_id, fax_label, description)
values (
  'PASTE-AUTH-USER-UUID-HER',
  'Edvard',
  '01',
  'Edvard01',
  ''
);
*/

-- Flere eksempler:
-- Bernt33   → email: bernt33@faxchat.no   → name Bernt,   station_id 33, fax_label Bernt33
-- Sarah22   → email: sarah22@faxchat.no   → name Sarah,   station_id 22, fax_label Sarah22
-- Admin99   → email: admin99@faxchat.no   → name Admin,   station_id 99, fax_label Admin99
