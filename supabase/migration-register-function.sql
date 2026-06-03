-- Kjør hvis schema.sql allerede er kjørt uten register_faxchat_profile

create or replace function public.register_faxchat_profile(p_username text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_email text;
  v_user_id uuid;
  v_name text;
  v_station text;
  v_label text;
  v_profile public.profiles;
begin
  if p_username !~ '^[A-Za-z][A-Za-z0-9]*\d{2}$' then
    raise exception 'Ugyldig brukernavn. Bruk format Edvard01 (navn + 2 siffer).';
  end if;

  v_station := substring(p_username from '(\d{2})$');
  v_name := initcap(substring(p_username from '^([A-Za-z][A-Za-z0-9]*)'));
  v_label := v_name || v_station;
  v_auth_email := lower(v_label) || '@fax.internal';

  select id into v_user_id from auth.users where lower(email) = v_auth_email;
  if v_user_id is null then
    raise exception 'Fant ingen bruker i Authentication. Opprett først med User ID: %', v_auth_email;
  end if;

  insert into public.profiles (id, username, auth_email, name, station_id, fax_label)
  values (v_user_id, v_label, v_auth_email, v_name, v_station, v_label)
  on conflict (id) do update set
    username = excluded.username,
    auth_email = excluded.auth_email,
    name = excluded.name,
    station_id = excluded.station_id,
    fax_label = excluded.fax_label
  returning * into v_profile;

  return v_profile;
end;
$$;
