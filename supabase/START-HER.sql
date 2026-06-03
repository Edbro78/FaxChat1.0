-- ═══════════════════════════════════════════════════════════
-- LIM INN ALT → RUN → FERDIG
-- Oppretter databasen OG brukeren Edvard01 med passord 123
-- ═══════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  name text not null,
  station_id text not null unique,
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

alter table public.profiles enable row level security;
alter table public.faxes enable row level security;

drop policy if exists "profiles_read_authenticated" on public.profiles;
create policy "profiles_read_authenticated" on public.profiles for select to authenticated using (true);

drop policy if exists "faxes_select_incoming" on public.faxes;
create policy "faxes_select_incoming" on public.faxes for select to authenticated
  using (recipient_station_id = (select station_id from public.profiles where id = auth.uid()));

drop policy if exists "faxes_insert_send" on public.faxes;
create policy "faxes_insert_send" on public.faxes for insert to authenticated
  with check (sender_user_id = auth.uid());

drop policy if exists "faxes_delete_incoming" on public.faxes;
create policy "faxes_delete_incoming" on public.faxes for delete to authenticated
  using (recipient_station_id = (select station_id from public.profiles where id = auth.uid()));

drop policy if exists "faxes_update_incoming" on public.faxes;
create policy "faxes_update_incoming" on public.faxes for update to authenticated
  using (recipient_station_id = (select station_id from public.profiles where id = auth.uid()));

create or replace function public.create_faxchat_user(p_username text, p_password text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_station text;
  v_label text;
begin
  v_station := substring(p_username from '(\d{2})$');
  v_name := initcap(substring(p_username from '^([A-Za-z][A-Za-z0-9]*)'));
  v_label := v_name || v_station;
  insert into public.profiles (username, password_hash, name, station_id, fax_label)
  values (v_label, crypt(p_password, gen_salt('bf')), v_name, v_station, v_label);
end;
$$;

create or replace function public.verify_faxchat_login(p_username text, p_password text)
returns table (id uuid, username text, name text, station_id text, fax_label text, description text)
language sql security definer set search_path = public as $$
  select p.id, p.username, p.name, p.station_id, p.fax_label, p.description
  from public.profiles p
  where p.username = initcap(substring(p_username from '^([A-Za-z][A-Za-z0-9]*)')) || substring(p_username from '(\d{2})$')
  and p.password_hash = crypt(p_password, p.password_hash);
$$;

grant execute on function public.verify_faxchat_login(text, text) to anon;
grant execute on function public.verify_faxchat_login(text, text) to authenticated;

-- Opprett brukeren:
select public.create_faxchat_user('Edvard01', '123');

-- Logg inn i FaxChat med: Edvard01 / 123
