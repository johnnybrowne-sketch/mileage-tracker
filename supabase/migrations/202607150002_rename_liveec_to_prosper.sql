update public.properties
set property_code = 'PROSPER'
where upper(property_code) = 'LIVEEC'
  and not exists (
    select 1
    from public.properties existing_property
    where upper(existing_property.property_code) = 'PROSPER'
  );

update public.mileage_entries
set
  property_code = 'PROSPER',
  property_display = regexp_replace(
    coalesce(property_display, property_code, 'PROSPER'),
    '\mLIVEEC\M',
    'PROSPER',
    'gi'
  )
where upper(coalesce(property_code, '')) = 'LIVEEC'
   or property_display ~* '\mLIVEEC\M';
