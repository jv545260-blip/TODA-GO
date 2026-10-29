-- TODA GO pilot database schema for Supabase.
-- Run in Supabase Dashboard > SQL Editor using a fresh project.
-- RLS is enabled. Test using two separate accounts (one passenger, one driver).

create extension if not exists pgcrypto;

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  toda_name text not null default 'Cantilan TODA',
  plate_number text,
  is_online boolean not null default false,
  lat double precision,
  lng double precision,
  updated_at timestamptz not null default now(),
  constraint valid_lat check (lat is null or lat between -90 and 90),
  constraint valid_lng check (lng is null or lng between -180 and 180)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references auth.users(id) on delete cascade,
  driver_id uuid references auth.users(id) on delete set null,
  pickup_text text not null,
  destination_text text not null,
  fare_estimate numeric(10,2),
  status text not null default 'requested'
    check (status in ('requested','accepted','rejected','arriving','in_progress','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drivers_online_idx on public.drivers (is_online);
create index if not exists bookings_passenger_idx on public.bookings (passenger_id, created_at desc);
create index if not exists bookings_driver_idx on public.bookings (driver_id, created_at desc);
create index if not exists bookings_status_idx on public.bookings (status, created_at desc);

alter table public.drivers enable row level security;
alter table public.bookings enable row level security;

-- Signed-in users can view online drivers; each driver can also view/update their own profile.
drop policy if exists "online drivers visible to authenticated users" on public.drivers;
create policy "online drivers visible to authenticated users"
  on public.drivers for select to authenticated
  using (is_online = true or auth.uid() = user_id);

drop policy if exists "drivers insert own profile" on public.drivers;
create policy "drivers insert own profile"
  on public.drivers for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "drivers update own profile" on public.drivers;
create policy "drivers update own profile"
  on public.drivers for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "passengers create own booking" on public.bookings;
create policy "passengers create own booking"
  on public.bookings for insert to authenticated
  with check (auth.uid() = passenger_id and status = 'requested' and driver_id is null);

drop policy if exists "participants view booking" on public.bookings;
create policy "participants view booking"
  on public.bookings for select to authenticated
  using (auth.uid() = passenger_id or auth.uid() = driver_id or status = 'requested');

-- Minimal pilot policy. For public launch, replace with a secure server-side claim function
-- so a driver can only claim a booking once and only if currently eligible/online.
drop policy if exists "driver responds to requested booking" on public.bookings;
create policy "driver responds to requested booking"
  on public.bookings for update to authenticated
  using (status = 'requested')
  with check (auth.uid() = driver_id and status in ('accepted','rejected'));

-- Enable realtime updates for the two tables.
do $$ begin
  alter publication supabase_realtime add table public.drivers;
exception when duplicate_object then null;
when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.bookings;
exception when duplicate_object then null;
when others then null;
end $$;
