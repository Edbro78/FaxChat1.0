-- FaxChat database — kjør i Supabase SQL Editor
-- Brukere opprettes kun i Authentication → Users (e-post + passord)
-- Navn = det før @ (per@test.no → "per")
-- Faxnummer = rekkefølge (1., 2., 3. bruker → 1, 2, 3 … opp til 99)

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  station_id text not null unique,
  fax_label text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.faxes (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.profiles (id) on delete cascade,
  recipient_station_id text not null references public.profiles (station_id),
  content text not null,
  image_url text null,
  stack_order bigint not null default 0,
  created_at timestamptz not null default now()
);

-- Eksisterende installasjon: alter table public.faxes add column if not exists image_url text null;

create index if not exists faxes_recipient_idx on public.faxes (recipient_station_id, stack_order desc, created_at desc);

-- Web Push (PWA fra hjemskjerm)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.profiles enable row level security;
alter table public.faxes enable row level security;

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select to authenticated using (true);

drop policy if exists "faxes_incoming" on public.faxes;
create policy "faxes_incoming" on public.faxes for select to authenticated
  using (recipient_station_id = (select station_id from public.profiles where id = auth.uid()));

drop policy if exists "faxes_send" on public.faxes;
create policy "faxes_send" on public.faxes for insert to authenticated
  with check (sender_user_id = auth.uid());

drop policy if exists "faxes_delete" on public.faxes;
create policy "faxes_delete" on public.faxes for delete to authenticated
  using (recipient_station_id = (select station_id from public.profiles where id = auth.uid()));

drop policy if exists "faxes_update" on public.faxes;
create policy "faxes_update" on public.faxes for update to authenticated
  using (recipient_station_id = (select station_id from public.profiles where id = auth.uid()));

create or replace function public.email_local_name(email text)
returns text language sql immutable as $$
  select lower(split_part(email, '@', 1));
$$;

create or replace function public.next_fax_number()
returns text language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select coalesce(max(station_id::int), 0) + 1 into n
  from public.profiles
  where station_id ~ '^\d+$';
  if n > 99 then
    raise exception 'Maks 99 brukere';
  end if;
  return n::text;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  local_name text := public.email_local_name(new.email);
begin
  insert into public.profiles (id, name, station_id, fax_label)
  values (new.id, local_name, public.next_fax_number(), local_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.ensure_profile()
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  u auth.users%rowtype;
  p public.profiles%rowtype;
  local_name text;
begin
  select * into u from auth.users where id = auth.uid();
  if not found then raise exception 'Not authenticated'; end if;

  select * into p from public.profiles where id = u.id;
  if found then return p; end if;

  local_name := public.email_local_name(u.email);
  insert into public.profiles (id, name, station_id, fax_label)
  values (u.id, local_name, public.next_fax_number(), local_name)
  returning * into p;

  return p;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;

-- Profiler for brukere som finnes i Authentication uten profil-rad
with missing as (
  select u.id, u.email, row_number() over (order by u.created_at) as seq
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id)
),
base as (
  select coalesce(max(station_id::int), 0) as mx
  from public.profiles
  where station_id ~ '^\d+$'
)
insert into public.profiles (id, name, station_id, fax_label)
select
  m.id,
  public.email_local_name(m.email),
  (base.mx + m.seq)::text,
  public.email_local_name(m.email)
from missing m
cross join base
on conflict do nothing;

-- Synk navn fra e-post på eksisterende profiler
update public.profiles p
set name = public.email_local_name(u.email),
    fax_label = public.email_local_name(u.email)
from auth.users u
where u.id = p.id;

-- Storage: opprett bucket "fax-attachments" (Public) i Dashboard, deretter kjør:
-- insert into storage.buckets (id, name, public) values ('fax-attachments', 'fax-attachments', true) on conflict do nothing;
--
-- drop policy if exists "fax_attachments_read" on storage.objects;
-- create policy "fax_attachments_read" on storage.objects for select to public
--   using (bucket_id = 'fax-attachments');
--
-- drop policy if exists "fax_attachments_upload" on storage.objects;
-- create policy "fax_attachments_upload" on storage.objects for insert to authenticated
--   with check (bucket_id = 'fax-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
