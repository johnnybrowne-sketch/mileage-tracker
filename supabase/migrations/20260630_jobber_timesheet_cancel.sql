-- Adds a soft-cancel flag for Jobber timesheets removed from Mileage Tracker review.
-- Run this in Supabase so removed timesheets stay hidden after future Jobber syncs.

alter table public.jobber_timesheets
  add column if not exists is_cancelled boolean not null default false,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text,
  add column if not exists cancelled_by_role text,
  add column if not exists cancel_reason text;

create index if not exists jobber_timesheets_cancelled_status_idx
  on public.jobber_timesheets (is_cancelled, mileage_status);
