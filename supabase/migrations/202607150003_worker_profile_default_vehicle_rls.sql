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

grant execute on function public.mileage_app_is_admin() to authenticated;
grant select on public.worker_profiles to authenticated;
grant update (default_vehicle_name, default_vehicle_id) on public.worker_profiles to authenticated;

drop policy if exists "worker_profiles_admin_default_vehicle_update" on public.worker_profiles;
create policy "worker_profiles_admin_default_vehicle_update"
on public.worker_profiles
for update
to authenticated
using (public.mileage_app_is_admin())
with check (public.mileage_app_is_admin());
