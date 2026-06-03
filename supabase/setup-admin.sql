-- Admin-bruker for FaxChat
-- Brukernavn i appen: admin  →  e-post i Supabase: admin@faxchat.no
-- Passord (sett i Dashboard): 123
--
-- 1) Authentication → Users → Add user
--    Email: admin@faxchat.no
--    Password: 123
--    Auto Confirm User: ON
--
-- 2) Kopier brukerens UUID fra listen, erstatt nedenfor, kjør i SQL Editor:

/*
insert into public.profiles (id, name, station_id, fax_label, description)
values (
  'PASTE-AUTH-USER-UUID-HER',
  'Admin',
  '99',
  'Admin99',
  'Command Center'
);
*/
