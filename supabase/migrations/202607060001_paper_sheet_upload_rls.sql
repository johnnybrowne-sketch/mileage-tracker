-- Paper sheet upload access for workers and admins.
-- Workers can manage their own paper sheet uploads.
-- Admins can upload, review, scan, and delete paper sheets for any worker.

create or replace function public.mileage_app_current_worker_profile_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select wp.id::text
  from public.worker_profiles wp
  where wp.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.mileage_app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.worker_profiles wp
    where wp.auth_user_id = auth.uid()
      and lower(coalesce(wp.role, '')) = 'admin'
  )
$$;

grant execute on function public.mileage_app_current_worker_profile_id() to authenticated;
grant execute on function public.mileage_app_is_admin() to authenticated;

alter table public.paper_sheet_uploads enable row level security;
alter table public.paper_sheet_draft_entries enable row level security;

drop policy if exists "paper_sheet_uploads_worker_or_admin_all" on public.paper_sheet_uploads;
create policy "paper_sheet_uploads_worker_or_admin_all"
on public.paper_sheet_uploads
for all
to authenticated
using (
  public.mileage_app_is_admin()
  or worker_id::text = public.mileage_app_current_worker_profile_id()
)
with check (
  public.mileage_app_is_admin()
  or worker_id::text = public.mileage_app_current_worker_profile_id()
);

drop policy if exists "paper_sheet_draft_entries_worker_or_admin_all" on public.paper_sheet_draft_entries;
create policy "paper_sheet_draft_entries_worker_or_admin_all"
on public.paper_sheet_draft_entries
for all
to authenticated
using (
  public.mileage_app_is_admin()
  or worker_id::text = public.mileage_app_current_worker_profile_id()
)
with check (
  public.mileage_app_is_admin()
  or worker_id::text = public.mileage_app_current_worker_profile_id()
);

drop policy if exists "paper_sheets_storage_worker_or_admin_select" on storage.objects;
create policy "paper_sheets_storage_worker_or_admin_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'paper-sheets'
  and (
    public.mileage_app_is_admin()
    or (storage.foldername(name))[1] = public.mileage_app_current_worker_profile_id()
  )
);

drop policy if exists "paper_sheets_storage_worker_or_admin_insert" on storage.objects;
create policy "paper_sheets_storage_worker_or_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'paper-sheets'
  and (
    public.mileage_app_is_admin()
    or (storage.foldername(name))[1] = public.mileage_app_current_worker_profile_id()
  )
);

drop policy if exists "paper_sheets_storage_worker_or_admin_update" on storage.objects;
create policy "paper_sheets_storage_worker_or_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'paper-sheets'
  and (
    public.mileage_app_is_admin()
    or (storage.foldername(name))[1] = public.mileage_app_current_worker_profile_id()
  )
)
with check (
  bucket_id = 'paper-sheets'
  and (
    public.mileage_app_is_admin()
    or (storage.foldername(name))[1] = public.mileage_app_current_worker_profile_id()
  )
);

drop policy if exists "paper_sheets_storage_worker_or_admin_delete" on storage.objects;
create policy "paper_sheets_storage_worker_or_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'paper-sheets'
  and (
    public.mileage_app_is_admin()
    or (storage.foldername(name))[1] = public.mileage_app_current_worker_profile_id()
  )
);
