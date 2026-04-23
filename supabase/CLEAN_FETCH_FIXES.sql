-- FIX FOR fetch_service_id (Added missing aggregation logic and subqueries)
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
    'doctors', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', ld.staff_id,
        'fullname', ld.full_name,
        'gender', ld.gender,
        'img', ld.image_link
      )), '[]'::jsonb)
      from linked_doctors ld
    )
  )
  into result
  from service_info si;

  if result is null then
    return jsonb_build_object('error', 'Service not found');
  end if;

  return result;
end;
$$;

-- FIX FOR fetch_blogs (Added missing jsonb_agg to return ALL blogs instead of just the first one)
create or replace function fetch_blogs()
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
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
      'img', s.image_link
    )
  )), '[]'::jsonb)
  into result
  from blog_posts b
  left join staff_members s on b.doctor_id = s.staff_id
  where b.blog_status = 'published';

  return result;
end;
$$;

-- FIX FOR fetch_blog_id (Ensuring it handles images correctly)
create or replace function fetch_blog_id(p_blog_id uuid)
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
      'staff_id', s.staff_id,
      'full_name', s.full_name,
      'gender', s.gender,
      'image_link', s.image_link
    )
  )
  into result
  from blog_posts b
  left join staff_members s on b.doctor_id = s.staff_id
  where b.blog_id = p_blog_id;

  if result is null then
    return jsonb_build_object('error', 'Blog not found');
  end if;

  return result;
end;
$$;

-- FIX FOR fetch_doctor_id (Removed strict email requirement to allow frontend to fetch by ID alone)
create or replace function fetch_doctor_id(
  p_doctor_id uuid,
  p_email text default ''
)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  -- If p_email is provided and not empty, check it. Otherwise, just use p_doctor_id.
  if p_email is not null and p_email <> '' then
    if not exists (
      select 1 from staff_members
      where staff_id = p_doctor_id and working_email = p_email
    ) then
      return jsonb_build_object('error', 'Doctor ID and email do not match');
    end if;
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
    return jsonb_build_object('error', 'Doctor details not found for this ID');
  end if;

  return result;
end;
$$;
