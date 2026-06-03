-- FaxChat: kjør i Supabase SQL Editor
-- Auth: slå AV "Enable sign ups" under Authentication → Providers → Email
-- Admin oppretter brukere i Supabase (Authentication + SQL) — se opprett-bruker.sql

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  auth_email text not null unique,
  name text not null,
  station_id text not null unique check (station_id ~ '^\d{2}$'),
  fax_label text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.faxes (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.profiles (id) on delete cascade,
  recipient_station_id text not null references public.profiles (station_id),
  content text not null,
  stack_order bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists faxes_recipient_idx on public.faxes (recipient_station_id, stack_order desc, created_at desc);

alter table public.profiles enable row level security;
alter table public.faxes enable row level security;

create policy "profiles_read_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "faxes_select_incoming"
  on public.faxes for select
  to authenticated
  using (
    recipient_station_id = (
      select station_id from public.profiles where id = auth.uid()
    )
  );

create policy "faxes_insert_send"
  on public.faxes for insert
  to authenticated
  with check (
    sender_user_id = auth.uid()
    and recipient_station_id <> (
      select station_id from public.profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.profiles p where p.station_id = recipient_station_id
    )
  );

create policy "faxes_delete_incoming"
  on public.faxes for delete
  to authenticated
  using (
    recipient_station_id = (
      select station_id from public.profiles where id = auth.uid()
    )
  );

create policy "faxes_update_incoming"
  on public.faxes for update
  to authenticated
  using (
    recipient_station_id = (
      select station_id from public.profiles where id = auth.uid()
    )
  );

-- auth_email = intern Supabase Auth-ID (Edvard01@fax.internal), ikke ekte e-post
-- Admin oppretter brukere i Supabase Dashboard + kjører register_faxchat_profile()

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
