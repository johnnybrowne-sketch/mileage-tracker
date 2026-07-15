alter table public.worker_profiles
  add column if not exists default_vehicle_name text,
  add column if not exists default_vehicle_id text;

comment on column public.worker_profiles.default_vehicle_name is
  'Admin-selected default vehicle display name for Mileage Tracker entry forms.';

comment on column public.worker_profiles.default_vehicle_id is
  'Optional vehicle id or base vehicle id for the admin-selected default vehicle.';
