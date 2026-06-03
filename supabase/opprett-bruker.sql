-- ═══════════════════════════════════════════════════════════════
-- OPPRETT BRUKER — KUN SQL, INGEN E-POST, INGEN Authentication-meny
-- ═══════════════════════════════════════════════════════════════

-- Kjør schema.sql først (eller migration-no-email-auth.sql hvis du har gammel DB)

select public.create_faxchat_user('Edvard01', 'ditt-passord-her');

-- Flere brukere:
-- select public.create_faxchat_user('Bernt33', 'passord');
-- select public.create_faxchat_user('Admin99', '123');

-- Brukeren logger inn i FaxChat med:
--   Brukernavn: Edvard01
--   Passord:    det du satte over

-- Endre passord:
-- update public.profiles
-- set password_hash = crypt('nytt-passord', gen_salt('bf'))
-- where username = 'Edvard01';
