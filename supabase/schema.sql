-- FaxChat — INGEN E-POST. Kun brukernavn + passord i SQL Editor.
-- Slå AV "Enable sign ups" under Authentication → Providers → Email (valgfritt).

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
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

drop policy if exists "profiles_read_authenticated" on public.profiles;
create policy "profiles_read_authenticated"
  on public.profiles for select to authenticated using (true);

drop policy if exists "faxes_select_incoming" on public.faxes;
create policy "faxes_select_incoming"
  on public.faxes for select to authenticated
  using (
    recipient_station_id = (select station_id from public.profiles where id = auth.uid())
  );

drop policy if exists "faxes_insert_send" on public.faxes;
create policy "faxes_insert_send"
  on public.faxes for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and recipient_station_id <> (select station_id from public.profiles where id = auth.uid())
    and exists (select 1 from public.profiles p where p.station_id = recipient_station_id)
  );

drop policy if exists "faxes_delete_incoming" on public.faxes;
create policy "faxes_delete_incoming"
  on public.faxes for delete to authenticated
  using (
    recipient_station_id = (select station_id from public.profiles where id = auth.uid())
  );

drop policy if exists "faxes_update_incoming" on public.faxes;
create policy "faxes_update_incoming"
  on public.faxes for update to authenticated
  using (
    recipient_station_id = (select station_id from public.profiles where id = auth.uid())
  );

-- Admin: opprett bruker (kjør i SQL Editor)
create or replace function public.create_faxchat_user(
  p_username text,
  p_password text,
  p_description text default ''
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_station text;
  v_label text;
  v_profile public.profiles;
begin
  if p_username !~ '^[A-Za-z][A-Za-z0-9]*\d{2}$' then
    raise exception 'Ugyldig brukernavn. Format: Edvard01';
  end if;
  if length(p_password) < 3 then
    raise exception 'Passord må være minst 3 tegn';
  end if;

  v_station := substring(p_username from '(\d{2})$');
  v_name := initcap(substring(p_username from '^([A-Za-z][A-Za-z0-9]*)'));
  v_label := v_name || v_station;

  insert into public.profiles (username, password_hash, name, station_id, fax_label, description)
  values (v_label, crypt(p_password, gen_salt('bf')), v_name, v_station, v_label, p_description)
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.create_faxchat_user(text, text, text) from public;
revoke all on function public.create_faxchat_user(text, text, text) from anon;
revoke all on function public.create_faxchat_user(text, text, text) from authenticated;

-- Innlogging (kalles fra API)
create or replace function public.verify_faxchat_login(p_username text, p_password text)
returns table (
  id uuid,
  username text,
  name text,
  station_id text,
  fax_label text,
  description text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.username, p.name, p.station_id, p.fax_label, p.description
  from public.profiles p
  where p.username = (
    case
      when p_username ~ '^[A-Za-z][A-Za-z0-9]*\d{2}$' then
        initcap(substring(p_username from '^([A-Za-z][A-Za-z0-9]*)'))
        || substring(p_username from '(\d{2})$')
      else null
    end
  )
  and p.password_hash = crypt(p_password, p.password_hash);
$$;

grant execute on function public.verify_faxchat_login(text, text) to anon;
grant execute on function public.verify_faxchat_login(text, text) to authenticated;
