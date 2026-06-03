-- FaxChat database — kjør i Supabase SQL Editor
-- Brukere opprettes i Authentication → Users (e-post + passord)
-- Legg User Metadata: {"name":"Edvard","station_id":"01","fax_label":"Edvard01"}

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
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

create index if not exists faxes_recipient_idx on public.faxes (recipient_station_id, stack_order desc, created_at desc);

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

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, station_id, fax_label)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'station_id', '99'),
    coalesce(new.raw_user_meta_data->>'fax_label', split_part(new.email, '@', 1) || '99')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Oppretter profil ved innlogging hvis bruker ble laget før triggeren
create or replace function public.ensure_profile()
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  u auth.users%rowtype;
  p public.profiles%rowtype;
begin
  select * into u from auth.users where id = auth.uid();
  if not found then raise exception 'Not authenticated'; end if;

  select * into p from public.profiles where id = u.id;
  if found then return p; end if;

  insert into public.profiles (id, name, station_id, fax_label)
  values (
    u.id,
    coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    coalesce(u.raw_user_meta_data->>'station_id', '99'),
    coalesce(u.raw_user_meta_data->>'fax_label', split_part(u.email, '@', 1))
  )
  returning * into p;

  return p;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;

-- Engangs-fix: profiler for brukere som allerede finnes i Authentication
insert into public.profiles (id, name, station_id, fax_label)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  coalesce(u.raw_user_meta_data->>'station_id', lpad(row_number() over (order by u.created_at)::text, 2, '0')),
  coalesce(u.raw_user_meta_data->>'fax_label', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;
