-- FaxChat: kjør i Supabase SQL Editor
-- Auth: slå AV "Enable sign ups" under Authentication → Providers → Email
-- Brukere opprettes KUN via admin (admin.html eller /api/admin/create-user) — aldri e-post

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

-- auth_email er intern teknisk ID — aldri synlig for brukere eller admin
