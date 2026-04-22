create or replace function fetch_doctor_id(
  p_doctor_id uuid,
  p_email text
)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  -- Kiểm tra tham số
  if p_doctor_id is null or p_email is null then
    return jsonb_build_object('error', 'Both doctor_id and email are required');
  end if;

  -- Kiểm tra doctor_id và email khớp nhau
  if not exists (
    select 1 from staff_members
    where staff_id = p_doctor_id and working_email = p_email
  ) then
    return jsonb_build_object('error', 'Doctor ID and email do not match');
  end if;

  -- Lấy dữ liệu và trả JSON
  select jsonb_build_object(
    'doctor_id', d.doctor_id,
    'department', d.department,
    'speciality', d.speciality,
    'bio', d.bio,
    'slogan', d.slogan,
    'educations', d.educations,
    'certifications', d.certifications,
    'about_me', d.about_me,
    'license_no', d.license_no,
    'staff_members', jsonb_build_object(
      'full_name', s.full_name,
      'gender', s.gender,
      'image_link', s.image_link,
      'working_email', s.working_email,
      'years_experience', s.years_experience,
      'languages', s.languages
    ),
    'blogs', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'blog_id', b.blog_id,
        'title', b.blog_title,
        'excerpt', b.excerpt,
        'image_link', b.image_link,
        'created_at', b.created_at,
        'updated_at', b.updated_at,
        'doctor_id', b.doctor_id
      )), '[]'::jsonb)
      from blog_posts b
      where b.doctor_id = d.doctor_id and b.blog_status = 'published'
    )
  ) into result
  from doctor_details d
  join staff_members s on s.staff_id = d.doctor_id
  where d.doctor_id = p_doctor_id;

  if result is null then
    return jsonb_build_object('error', 'Doctor not found');
  end if;

  return result;
end;
$$;

create or replace function fetch_service()
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.service_id,
    'name', s.service_name,
    'excerpt', s.excerpt,
    'price', s.service_cost,
    'image_link', s.image_link,
    'service_categories', jsonb_build_object(
      'category_id', c.category_id,
      'category_name', c.category_name
    )
  )), '[]'::jsonb)
  into result
  from medical_services s
  left join service_categories c
    on c.category_id = s.category_id;

  return result;
end;
$$;

create or replace function fetch_service_id(p_service_id uuid)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  with service_info as (
    select 
      s.service_id,
      s.service_name,
      s.service_description,
      s.service_cost,
      s.image_link,
      jsonb_build_object(
        'category_id', c.category_id,
        'category_name', c.category_name
      ) as service_categories
    from medical_services s
    left join service_categories c on s.category_id = c.category_id
    where s.service_id = p_service_id
  ),
  linked_doctors as (
    select sm.staff_id, sm.full_name, sm.gender, sm.image_link
    from doctor_services ds
    join staff_members sm on ds.doctor_id = sm.staff_id
    where ds.service_id = p_service_id
  )
  select jsonb_build_object(
    'service_id', si.service_id,
    'service_name', si.service_name,
    'description', si.service_description,
    'price', si.service_cost,
    'image_link', si.image_link,
    'service_categories', si.service_categories,
    'doctors', coalesce(jsonb_agg(jsonb_build_object(
      'id', d.staff_id,
      'fullname', d.full_name,
      'gender', d.gender,
      'img', d.image_link
    )) filter (where d.staff_id is not null), '[]'::jsonb)
  )
  into result
  from service_info si
  left join linked_doctors d on true;

  if result is null then
    raise exception 'Service not found';
  end if;

  return result;
end;
$$;

create or replace function fetch_slot_by_doctor_id(p_doctor_id uuid)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  with filtered_slots as (
    select 
      dsa.doctor_slot_id,
      dsa.appointments_count,
      dsa.max_appointments,
      s.slot_id,
      s.slot_date,
      s.slot_time,
      s.is_active
    from doctor_slot_assignments dsa
    join slots s on dsa.slot_id = s.slot_id
    where dsa.doctor_id = p_doctor_id
      and s.slot_date >= current_date
      and s.slot_date <= current_date + interval '7 days'
      and s.is_active = true
  )
  select jsonb_build_object(
    'doctor_id', p_doctor_id,
    'slots', coalesce(jsonb_agg(jsonb_build_object(
      'doctor_slot_id', fs.doctor_slot_id,
      'appointments_count', fs.appointments_count,
      'max_appointments', fs.max_appointments,
      'slot_id', fs.slot_id,
      'slot_date', fs.slot_date,
      'slot_time', fs.slot_time,
      'is_active', fs.is_active
    )), '[]'::jsonb)
  )
  into result
  from filtered_slots fs;

  return result;
end;
$$;


create or replace function fetch_slot()
returns table (
  doctor_slot_id uuid,
  doctor_id uuid,
  slot_date date,
  slot_time time
)
language sql
as $$
  select
    dsa.doctor_slot_id,
    dsa.doctor_id,
    s.slot_date,
    s.slot_time
  from doctor_slot_assignments dsa
  join slots s on dsa.slot_id = s.slot_id
  where s.is_active = true
    and s.slot_date between current_date and current_date + interval '7 days'
  order by s.slot_date, s.slot_time;
$$;

create or replace function fetch_service_by_doctor_id(p_doctor_id uuid)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'doctor_id', sm.staff_id,
    'full_name', sm.full_name,
    'gender', sm.gender,
    'image_link', sm.image_link,
    'specialization', dd.speciality,
    'services', coalesce(jsonb_agg(
      jsonb_build_object(
        'service_id', ds.service_id,
        'service_name', ms.service_name
      )
    ) filter (where ms.is_active is true), '[]'::jsonb)
  )
  into result
  from staff_members sm
  left join doctor_details dd on sm.staff_id = dd.doctor_id
  left join doctor_services ds on sm.staff_id = ds.doctor_id
  left join medical_services ms on ds.service_id = ms.service_id
  where sm.staff_id = p_doctor_id
  group by sm.staff_id, sm.full_name, sm.gender, sm.image_link, dd.speciality;

  if result is null then
    raise exception 'Doctor not found';
  end if;

  return result;
end;
$$;


create or replace function fetch_serviceBooking()
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  select jsonb_agg(
    jsonb_build_object(
      'service_id', service_id,
      'service_name', service_name,
      'description', excerpt
    )
  )
  into result
  from medical_services
  where is_active = true;

  return coalesce(result, '[]'::jsonb);
end;
$$;

create or replace function fetch_doctorBooking()
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  select jsonb_agg(profile)
  into result
  from (
    select
      dd.doctor_id,
      sm.full_name,
      sm.image_link,
      sm.gender,
      dd.speciality as specialization,
      (
        select array_agg(ds.service_id)
        from doctor_services ds
        join medical_services ms on ms.service_id = ds.service_id
        where ds.doctor_id = dd.doctor_id
          and ms.is_active = true
      ) as services
    from doctor_details dd
    join staff_members sm on dd.doctor_id = sm.staff_id
  ) as profile;

  return coalesce(result, '[]'::jsonb);
end;
$$;

create or replace function fetch_blogs()
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin

  select jsonb_build_object(
    'blog_id', b.blog_id,
    'blog_title', b.blog_title,
    'blog_content', b.blog_content,
    'excerpt', b.excerpt,
    'image_link', b.image_link,
    'blog_tags', b.blog_tags,
    'blog_status', b.blog_status,
    'created_at', b.created_at,
    'updated_at', b.updated_at,
    'doctor_details', jsonb_build_object(
      'id', s.staff_id,
      'fullname', s.full_name,
      'gender', s.gender,
      'img', 'https://ldmcdielxskywugyohrq.supabase.co/storage/v1/object/public/blog-uploads/' || s.image_link
    )
  )
  into result
  from blog_posts b
  left join staff_members s on b.doctor_id = s.staff_id;

  if result is null then
    raise exception 'Blogs not found';
  end if;
  return result;
end;
$$;