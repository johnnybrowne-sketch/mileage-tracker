-- Local migration draft for Regine's mileage workflow.
-- Review in Supabase before applying to production.

alter table public.mileage_entries
  add column if not exists vehicle_key text,
  add column if not exists mileage_bucket text default 'general_business',
  add column if not exists business_category text,
  add column if not exists business_note text,
  add column if not exists odometer_expected_start numeric,
  add column if not exists odometer_start_confirmed boolean default false,
  add column if not exists odometer_override_reason text,
  add column if not exists unattributed_miles numeric not null default 0;

alter table public.mileage_entries
  drop constraint if exists mileage_entries_mileage_bucket_check;

alter table public.mileage_entries
  add constraint mileage_entries_mileage_bucket_check
  check (mileage_bucket in ('jobber_job', 'general_business', 'personal_excluded'));

create table if not exists public.mileage_admin_reason_options (
  value text primary key,
  label text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.mileage_admin_reason_options (value, label, sort_order)
values
  ('office_admin', 'Office / Admin', 10),
  ('supply_run', 'Supply Run', 20),
  ('bank_deposit', 'Bank Deposit', 30),
  ('maintenance_materials', 'Maintenance / Materials', 40),
  ('showing_inspection', 'Showing / Inspection', 50),
  ('lockbox_keys', 'Lockbox / Keys', 60),
  ('sign_marketing', 'Sign / Marketing', 70),
  ('meeting_training', 'Meeting / Training', 80),
  ('fuel_vehicle_service', 'Fuel / Vehicle Service', 90),
  ('other_business', 'Other Business', 100)
on conflict (value) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_active = true;

create table if not exists public.vehicle_odometer_states (
  id uuid primary key default gen_random_uuid(),
  vehicle_key text not null unique,
  vehicle_id text,
  current_odometer numeric not null default 0,
  last_mileage_entry_id text,
  last_worker_id text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicle_odometer_states_vehicle_id_idx
  on public.vehicle_odometer_states (vehicle_id);

create table if not exists public.vehicle_open_trips (
  id uuid primary key default gen_random_uuid(),
  vehicle_key text not null,
  vehicle_id text,
  worker_id text,
  worker_name text,
  mileage_entry_id text,
  started_at timestamptz not null default now(),
  start_odometer numeric not null,
  expected_start_odometer numeric,
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vehicle_open_trips_one_open_per_vehicle_idx
  on public.vehicle_open_trips (vehicle_key)
  where status = 'open';

create index if not exists vehicle_open_trips_worker_status_idx
  on public.vehicle_open_trips (worker_id, status);

create table if not exists public.odometer_override_audits (
  id uuid primary key default gen_random_uuid(),
  mileage_entry_id text,
  vehicle_key text not null,
  vehicle_id text,
  worker_id text,
  expected_start_odometer numeric,
  entered_start_odometer numeric not null,
  override_reason text,
  unattributed_miles numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists odometer_override_audits_vehicle_created_idx
  on public.odometer_override_audits (vehicle_key, created_at desc);
