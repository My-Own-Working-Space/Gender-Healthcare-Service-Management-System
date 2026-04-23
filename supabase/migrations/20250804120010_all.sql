

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "wrappers" WITH SCHEMA "extensions";






DO $$ BEGIN
    CREATE TYPE "public"."blog_status" AS ENUM (
        'draft',
        'published',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TYPE "public"."blog_status" OWNER TO "postgres";


DO $$ BEGIN
    CREATE TYPE "public"."department_enum" AS ENUM (
        'reproductive_health',
        'gynecology',
        'urology',
        'transgender_care',
        'sexual_health'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TYPE "public"."department_enum" OWNER TO "postgres";


DO $$ BEGIN
    CREATE TYPE "public"."gender_enum" AS ENUM (
        'male',
        'female',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TYPE "public"."gender_enum" OWNER TO "postgres";


DO $$ BEGIN
    CREATE TYPE "public"."notification_type_enum" AS ENUM (
        'appointment_reminder',
        'new_appointment',
        'appointment_update',
        'general'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TYPE "public"."notification_type_enum" OWNER TO "postgres";


DO $$ BEGIN
    CREATE TYPE "public"."patient_status" AS ENUM (
        'active',
        'inactive',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TYPE "public"."patient_status" OWNER TO "postgres";


DO $$ BEGIN
    CREATE TYPE "public"."process_status" AS ENUM (
        'pending',
        'in_progress',
        'completed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TYPE "public"."process_status" OWNER TO "postgres";


DO $$ BEGIN
    CREATE TYPE "public"."receipt_status" AS ENUM (
        'pending',
        'paid',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TYPE "public"."receipt_status" OWNER TO "postgres";


DO $$ BEGIN
    CREATE TYPE "public"."record_status" AS ENUM (
        'draft',
        'active',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TYPE "public"."record_status" OWNER TO "postgres";


DO $$ BEGIN
    CREATE TYPE "public"."report_status" AS ENUM (
        'pending',
        'reviewed',
        'resolved'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TYPE "public"."report_status" OWNER TO "postgres";


DO $$ BEGIN
    CREATE TYPE "public"."schedule_enum" AS ENUM (
        'Morning',
        'Afternoon',
        'Evening'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TYPE "public"."schedule_enum" OWNER TO "postgres";


DO $$ BEGIN
    CREATE TYPE "public"."speciality_enum" AS ENUM (
        'gynecologist',
        'urologist',
        'endocrinologist',
        'reproductive_specialist',
        'sexual_health_specialist'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TYPE "public"."speciality_enum" OWNER TO "postgres";


DO $$ BEGIN
    CREATE TYPE "public"."staff_role_enum" AS ENUM (
        'doctor',
        'consultant',
        'receptionist',
        'administrator'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TYPE "public"."staff_role_enum" OWNER TO "postgres";


DO $$ BEGIN
    CREATE TYPE "public"."staff_status" AS ENUM (
        'active',
        'inactive',
        'on_leave',
        'terminated'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TYPE "public"."staff_status" OWNER TO "postgres";


DO $$ BEGIN
    CREATE TYPE "public"."ticket_schedule_enum" AS ENUM (
        'Anytime',
        'Office hours (8:00 AM - 17:00 PM)',
        'Outside office hours (17:00 PM - 22:00 PM)'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TYPE "public"."ticket_schedule_enum" OWNER TO "postgres";


DO $$ BEGIN
    CREATE TYPE "public"."vaccination_status_enum" AS ENUM (
        'not_vaccinated',
        'partially_vaccinated',
        'fully_vaccinated'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TYPE "public"."vaccination_status_enum" OWNER TO "postgres";


DO $$ BEGIN
    CREATE TYPE "public"."visit_type_enum" AS ENUM (
        'consultation',
        'follow-up',
        'emergency',
        'routine'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TYPE "public"."visit_type_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_doctors_to_slots"("start_date" "date", "end_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.doctor_slot_assignments (slot_id, doctor_id)
  SELECT s.slot_id, d.doctor_id
  FROM public.slots s
  JOIN public.doctor_details d ON TRUE
  WHERE s.slot_date BETWEEN start_date AND end_date
  ON CONFLICT ON CONSTRAINT doctor_slot_assignments_unique DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."assign_doctors_to_slots"("start_date" "date", "end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE PROCEDURE "public"."auto_insert_slots_for_next_month"()
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  max_slot_date DATE;
  last_day_of_current_month DATE;
BEGIN
  -- Lấy ngày cuối cùng của tháng hiện tại
  last_day_of_current_month := (date_trunc('month', current_date + INTERVAL '1 month') - INTERVAL '1 day')::DATE;

  -- Kiểm tra nếu hôm nay là ngày cuối cùng của tháng
  IF current_date = last_day_of_current_month THEN
    -- Tìm ngày lớn nhất hiện có trong bảng slots
    SELECT MAX(slot_date) INTO max_slot_date FROM public.slots;

    -- Lấy ngày tiếp theo (ngày đầu tiên của tháng sau) và ngày cuối cùng của tháng tiếp theo
    start_date := last_day_of_current_month + INTERVAL '1 day'; -- Ngày đầu tiên của tháng sau
    end_date := (date_trunc('month', start_date + INTERVAL '1 month') - INTERVAL '1 day')::DATE; -- Ngày cuối cùng của tháng sau

    -- Kiểm tra nếu tháng tiếp theo chưa có slot
    IF max_slot_date IS NULL OR max_slot_date < start_date THEN
      -- Gọi hàm create_slots để chèn slot
      PERFORM public.insert_slots_range(start_date, end_date);
      RAISE NOTICE 'Inserted slots for period from % to %', start_date, end_date;
    ELSE
      RAISE NOTICE 'Slots for the next month already exist. Max slot date: %', max_slot_date;
    END IF;
  ELSE
    RAISE NOTICE 'Today (%), is not the last day of the month. No slots inserted.', current_date;
  END IF;
END;
$$;


ALTER PROCEDURE "public"."auto_insert_slots_for_next_month"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_link_doctor_by_speciality"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO doctor_services (id, doctor_id, service_id, created_at)
  SELECT
    gen_random_uuid(),
    NEW.doctor_id,
    ms.service_id,
    NOW()
  FROM medical_services ms
  JOIN service_categories sc ON ms.category_id = sc.category_id
  WHERE ms.is_active = TRUE
    AND (
      (NEW.speciality = 'gynecologist' AND sc.category_name = 'Gynecology') OR
      (NEW.speciality = 'urologist' AND sc.category_name = 'Urology') OR
      (NEW.speciality = 'endocrinologist' AND sc.category_name = 'Lab Test') OR
      (NEW.speciality = 'reproductive_specialist' AND sc.category_name = 'Reproductive Health') OR
      (NEW.speciality = 'sexual_health_specialist' AND sc.category_name IN ('Sexual Health', 'Gender Support', 'Transgender Care'))
    );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_link_doctor_by_speciality"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."book_appointment_slot"("p_slot_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_slot_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM doctor_slot_assignments dsa
    WHERE dsa.doctor_slot_id = p_slot_id
      AND dsa.appointments_count < dsa.max_appointments
  ) INTO v_slot_exists;

  IF v_slot_exists THEN
    UPDATE doctor_slot_assignments
    SET appointments_count = appointments_count + 1
    WHERE doctor_slot_id = p_slot_id;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;


ALTER FUNCTION "public"."book_appointment_slot"("p_slot_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_daily_revenue"("target_date" "date") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total
  FROM receipts
  WHERE created_at::date = target_date;

  RETURN total;
END;
$$;


ALTER FUNCTION "public"."calculate_daily_revenue"("target_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_appointment"("p_appointment_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_slot_id uuid;
BEGIN
    UPDATE appointments
    SET appointment_status = 'cancelled'::process_status,
        updated_at = CURRENT_TIMESTAMP
    WHERE appointment_id = p_appointment_id
    RETURNING appointment_id INTO v_slot_id;

    IF NOT FOUND THEN
        RAISE NOTICE 'Appointment with ID % does not exist.', p_appointment_id;
        RETURN FALSE;
    END IF;

    UPDATE doctor_slot_assignments
    SET appointments_count = appointments_count - 1
    WHERE slot_id = v_slot_id;

    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."cancel_appointment"("p_appointment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_status_appointment"("appointment_id_input" "uuid", "new_status_input" "public"."process_status", "updated_at_input" timestamp with time zone DEFAULT CURRENT_TIMESTAMP) RETURNS TABLE("message" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE public.appointments
    SET 
        appointment_status = new_status_input,
        updated_at = updated_at_input
    WHERE appointment_id = appointment_id_input;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 
        'Error: Appointment not found';
    END IF;

    RETURN QUERY SELECT 
        'Appointment status updated successfully';
EXCEPTION
  WHEN others THEN
    RETURN QUERY SELECT 
      'Error: ' || SQLERRM;
END;
$$;


ALTER FUNCTION "public"."change_status_appointment"("appointment_id_input" "uuid", "new_status_input" "public"."process_status", "updated_at_input" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_appointments_by_day"("target_date" "date") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  appt_count INT;
BEGIN
  SELECT COUNT(*) INTO appt_count
  FROM appointments
  WHERE created_at::date = target_date;

  RETURN appt_count;
END;
$$;


ALTER FUNCTION "public"."count_appointments_by_day"("target_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_appointments_by_status"("target_status" "public"."process_status") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  appt_count INT;
BEGIN
  SELECT COUNT(*) INTO appt_count
  FROM appointments
  WHERE appointment_status = target_status;

  RETURN appt_count;
END;
$$;


ALTER FUNCTION "public"."count_appointments_by_status"("target_status" "public"."process_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_patients_by_month"("target_year" integer, "target_month" integer) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  patient_count INT;
BEGIN
  SELECT COUNT(*) INTO patient_count
  FROM patients
  WHERE EXTRACT(YEAR FROM created_at) = target_year
    AND EXTRACT(MONTH FROM created_at) = target_month;

  RETURN patient_count;
END;
$$;


ALTER FUNCTION "public"."count_patients_by_month"("target_year" integer, "target_month" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_appointment"("patient_id_input" "uuid", "visit_type_input" "public"."visit_type_enum", "appointment_status_input" "public"."process_status" DEFAULT 'pending'::"public"."process_status", "created_at_input" timestamp with time zone DEFAULT CURRENT_TIMESTAMP, "updated_at_input" timestamp with time zone DEFAULT CURRENT_TIMESTAMP) RETURNS TABLE("appointment_id" "uuid", "message" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_appointment_id UUID;
BEGIN
    INSERT INTO public.appointments (
        appointment_id,
        patient_id,
        visit_type,
        appointment_status,
        created_at,
        updated_at
    ) VALUES (
        uuid_generate_v4(),
        patient_id_input,
        visit_type_input,
        appointment_status_input,
        created_at_input,
        updated_at_input
    )
    RETURNING appointment_id INTO v_appointment_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 
        NULL, 
        'Error: Appointment not created';
    END IF;

    RETURN QUERY SELECT 
        v_appointment_id, 
        'Appointment created successfully';
EXCEPTION
  WHEN others THEN
    RETURN QUERY SELECT 
      NULL, 
      'Error: ' || SQLERRM;
END;
$$;


ALTER FUNCTION "public"."create_appointment"("patient_id_input" "uuid", "visit_type_input" "public"."visit_type_enum", "appointment_status_input" "public"."process_status", "created_at_input" timestamp with time zone, "updated_at_input" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_blog_post"("p_doctor_id" "uuid", "p_blog_title" "text", "p_blog_content" "text", "p_excerpt" "text" DEFAULT NULL::"text", "p_image_link" "text" DEFAULT NULL::"text", "p_blog_tags" json DEFAULT NULL::json, "p_published_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_blog_status" "public"."blog_status" DEFAULT 'draft'::"public"."blog_status") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO blog_posts (
    doctor_id,
    blog_title,
    blog_content,
    excerpt,
    image_link,
    blog_tags,
    published_at,
    blog_status,
    view_count,
    created_at,
    updated_at
  ) VALUES (
    p_doctor_id,
    p_blog_title,
    p_blog_content,
    p_excerpt,
    p_image_link,
    p_blog_tags,
    p_published_at,
    p_blog_status,
    0,
    NOW(),
    NOW()
  );
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."create_blog_post"("p_doctor_id" "uuid", "p_blog_title" "text", "p_blog_content" "text", "p_excerpt" "text", "p_image_link" "text", "p_blog_tags" json, "p_published_at" timestamp with time zone, "p_blog_status" "public"."blog_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_doctor_detail"("p_doctor_id" "uuid", "p_department" "public"."department_enum", "p_speciality" "public"."speciality_enum", "p_about_me" json, "p_license_no" character varying, "p_bio" "text", "p_slogan" "text", "p_educations" json, "p_certifications" json) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    INSERT INTO doctor_details (
        doctor_id,
        department,
        speciality,
        about_me,
        license_no,
        bio,
        slogan,
        educations,
        certifications
    )
    VALUES (
        p_doctor_id,
        p_department,
        p_speciality,
        p_about_me,
        p_license_no,
        p_bio,
        p_slogan,
        p_educations,
        p_certifications
    );
END;
$$;


ALTER FUNCTION "public"."create_doctor_detail"("p_doctor_id" "uuid", "p_department" "public"."department_enum", "p_speciality" "public"."speciality_enum", "p_about_me" json, "p_license_no" character varying, "p_bio" "text", "p_slogan" "text", "p_educations" json, "p_certifications" json) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_medical_service"("p_category_id" "uuid", "p_service_name" "text", "p_service_description" "text" DEFAULT NULL::"text", "p_service_cost" numeric DEFAULT NULL::numeric, "p_duration_minutes" integer DEFAULT NULL::integer, "p_image_link" "text" DEFAULT NULL::"text", "p_description" json DEFAULT NULL::json, "p_overall" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO medical_services (
    category_id,
    service_name,
    service_description,
    service_cost,
    duration_minutes,
    image_link,
    description,
    overall,
    is_active
  ) VALUES (
    p_category_id,
    p_service_name,
    p_service_description,
    p_service_cost,
    p_duration_minutes,
    p_image_link,
    p_description,
    p_overall,
    TRUE
  );

  RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error inserting medical service: %', SQLERRM;
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."create_medical_service"("p_category_id" "uuid", "p_service_name" "text", "p_service_description" "text", "p_service_cost" numeric, "p_duration_minutes" integer, "p_image_link" "text", "p_description" json, "p_overall" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_patient"("p_id" "uuid", "p_full_name" "text", "p_phone" "text", "p_email" character varying, "p_date_of_birth" "date", "p_gender" "public"."gender_enum", "p_allergies" json, "p_chronic_conditions" json, "p_past_surgeries" json, "p_image_link" "text", "p_bio" "text", "p_vaccination_status" "public"."vaccination_status_enum", "p_patient_status" "public"."patient_status" DEFAULT 'active'::"public"."patient_status") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$

BEGIN
  INSERT INTO patients (
    id,full_name, phone, email, date_of_birth, gender,
    allergies, chronic_conditions, past_surgeries,
    vaccination_status, patient_status, created_at, updated_at,image_link,bio
  )
  VALUES (
    p_id,p_full_name, p_phone, p_email, p_date_of_birth, p_gender,
    p_allergies, p_chronic_conditions, p_past_surgeries,
    p_vaccination_status, p_patient_status,  now(), now(),p_image_link,p_bio
  );
  RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
   RAISE EXCEPTION 'Error inserting patient: %', SQLERRM;
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."create_patient"("p_id" "uuid", "p_full_name" "text", "p_phone" "text", "p_email" character varying, "p_date_of_birth" "date", "p_gender" "public"."gender_enum", "p_allergies" json, "p_chronic_conditions" json, "p_past_surgeries" json, "p_image_link" "text", "p_bio" "text", "p_vaccination_status" "public"."vaccination_status_enum", "p_patient_status" "public"."patient_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_period_entry"("p_patient_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cycle_length" integer DEFAULT NULL::integer, "p_flow_intensity" "text" DEFAULT NULL::"text", "p_symptoms" json DEFAULT NULL::json, "p_period_description" "text" DEFAULT NULL::"text", "p_predictions" json DEFAULT NULL::json, "p_period_length" numeric DEFAULT NULL::numeric) RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
declare
  new_period_id uuid;
begin
  insert into public.period_tracking (
    patient_id,
    start_date,
    end_date,
    cycle_length,
    flow_intensity,
    symptoms,
    period_description,
    predictions,
    period_length
  )
  values (
    p_patient_id,
    p_start_date,
    p_end_date,
    p_cycle_length,
    p_flow_intensity,
    p_symptoms,
    p_period_description,
    p_predictions,
    p_period_length
  )
  returning period_id into new_period_id;

  return new_period_id;
end;
$$;


ALTER FUNCTION "public"."create_period_entry"("p_patient_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_cycle_length" integer, "p_flow_intensity" "text", "p_symptoms" json, "p_period_description" "text", "p_predictions" json, "p_period_length" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_period_tracking"("p_patient_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_cycle_length" integer, "p_flow_intensity" "text", "p_symptoms" "jsonb", "p_period_description" "text", "p_predictions" "jsonb", "p_period_length" integer) RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
declare
  new_period_id uuid;
  existing_period_id uuid;
begin
  -- Check overlap: ép kiểu timestamp -> date
  select period_id into existing_period_id
  from public.period_tracking
  where patient_id = p_patient_id
    and daterange(start_date::date, end_date::date, '[]') && daterange(p_start_date::date, p_end_date::date, '[]')
  limit 1;

  if existing_period_id is not null then
    -- Update nếu overlap
    update public.period_tracking
    set 
      start_date = p_start_date,
      end_date = p_end_date,
      cycle_length = p_cycle_length,
      flow_intensity = p_flow_intensity,
      symptoms = p_symptoms,
      period_description = p_period_description,
      predictions = p_predictions,
      period_length = p_period_length,
      updated_at = now()
    where period_id = existing_period_id;

    return existing_period_id;
  else
    -- Insert nếu không overlap
    insert into public.period_tracking (
      patient_id,
      start_date,
      end_date,
      cycle_length,
      flow_intensity,
      symptoms,
      period_description,
      predictions,
      period_length
    )
    values (
      p_patient_id,
      p_start_date,
      p_end_date,
      p_cycle_length,
      p_flow_intensity,
      p_symptoms,
      p_period_description,
      p_predictions,
      p_period_length
    )
    returning period_id into new_period_id;

    return new_period_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."create_period_tracking"("p_patient_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_cycle_length" integer, "p_flow_intensity" "text", "p_symptoms" "jsonb", "p_period_description" "text", "p_predictions" "jsonb", "p_period_length" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_staff_member"("user_id_input" "uuid", "full_name_input" "text", "role_name_input" "public"."staff_role_enum", "working_email_input" character varying, "department_input" "public"."department_enum" DEFAULT NULL::"public"."department_enum", "hire_date_input" "date" DEFAULT CURRENT_DATE, "specialty_input" "public"."speciality_enum" DEFAULT NULL::"public"."speciality_enum", "license_no_input" character varying DEFAULT NULL::character varying, "years_experience_input" integer DEFAULT NULL::integer, "created_at_input" timestamp with time zone DEFAULT "now"(), "updated_at_input" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("staff_id" "uuid", "doctor_id" "uuid", "message" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN 
  -- Insert staff
  INSERT INTO public.staff_members (
    staff_id,
    full_name,
    working_email,
    hire_date,
    role,
    years_experience,
    staff_status,
    is_available,
    created_at,
    updated_at
  ) VALUES (
    user_id_input,
    full_name_input,
    working_email_input,
    hire_date_input,
    role_name_input,
    years_experience_input,
    'active',
    TRUE,
    created_at_input,
    updated_at_input
  );

  IF role_name_input = 'doctor' THEN
    INSERT INTO doctor_details (
      doctor_id,
      department,
      speciality,
      license_no
    ) VALUES (
      user_id_input,
      department_input,
      specialty_input,
      license_no_input
    );
    RETURN QUERY SELECT 
      user_id_input,
      user_id_input,
      'Staff member (doctor) created successfully';
  ELSE
    RETURN QUERY SELECT 
      user_id_input,
      NULL,
      'Staff member created successfully';
  END IF;

EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 
      NULL, NULL, 'Error: User with this email already exists';
  WHEN others THEN
    RETURN QUERY SELECT 
      NULL, NULL, 'Error: ' || SQLERRM;
END;
$$;


ALTER FUNCTION "public"."create_staff_member"("user_id_input" "uuid", "full_name_input" "text", "role_name_input" "public"."staff_role_enum", "working_email_input" character varying, "department_input" "public"."department_enum", "hire_date_input" "date", "specialty_input" "public"."speciality_enum", "license_no_input" character varying, "years_experience_input" integer, "created_at_input" timestamp with time zone, "updated_at_input" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_ticket"("p_message" "text", "p_patient_id" "uuid" DEFAULT NULL::"uuid", "p_schedule" "public"."ticket_schedule_enum" DEFAULT NULL::"public"."ticket_schedule_enum") RETURNS TABLE("ticket_id" "uuid", "staff_emails" "text"[])
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_ticket_id UUID;
BEGIN

  -- Insert into tickets table
  INSERT INTO public.tickets (
    message,
    patient_id,
    ticket_status,
    schedule,
    created_at,
    updated_at
  )
  VALUES (
    p_message,
    p_patient_id,
    'pending'::process_status,
    p_schedule,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  RETURNING ticket_id INTO v_ticket_id;

  -- Return ticket_id and staff emails
  RETURN QUERY
  SELECT 
    v_ticket_id,
    ARRAY_AGG(sm.working_email)::TEXT[]
  FROM public.staff_members sm
  WHERE sm.is_available = TRUE 
    AND sm.staff_status = 'active'::staff_status;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating ticket: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."create_ticket"("p_message" "text", "p_patient_id" "uuid", "p_schedule" "public"."ticket_schedule_enum") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_appointment"("appointment_id_input" "uuid") RETURNS TABLE("message" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    DELETE FROM public.appointments
    WHERE appointment_id = appointment_id_input;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 
        'Error: Appointment not found';
    END IF;

    RETURN QUERY SELECT 
        'Appointment deleted successfully';
EXCEPTION
  WHEN others THEN
    RETURN QUERY SELECT 
      'Error: ' || SQLERRM;
END;
$$;


ALTER FUNCTION "public"."delete_appointment"("appointment_id_input" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_period_entry"("p_period_id" bigint, "p_patient_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_deleted_rows INTEGER;
BEGIN
    -- Validate input
    IF p_period_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Period ID is required'
        );
    END IF;
    
    IF p_patient_id IS NULL OR p_patient_id = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Patient ID is required'
        );
    END IF;
    
    -- Delete the period entry
    DELETE FROM period_tracking
    WHERE id = p_period_id 
      AND patient_id = p_patient_id;
    
    GET DIAGNOSTICS v_deleted_rows = ROW_COUNT;
    
    IF v_deleted_rows = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Period entry not found or access denied'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Period entry deleted successfully',
        'period_id', p_period_id::TEXT,
        'deleted_rows', v_deleted_rows
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Error deleting period entry: ' || SQLERRM
        );
END;
$$;


ALTER FUNCTION "public"."delete_period_entry"("p_period_id" bigint, "p_patient_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_period_entry"("p_period_id" "uuid", "p_patient_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_deleted_rows INTEGER;
BEGIN
    -- Validate input
    IF p_period_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Period ID is required'
        );
    END IF;
    
    IF p_patient_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Patient ID is required'
        );
    END IF;
    
    -- Delete the period entry
    DELETE FROM period_tracking
    WHERE period_id = p_period_id 
      AND patient_id = p_patient_id;
    
    GET DIAGNOSTICS v_deleted_rows = ROW_COUNT;
    
    IF v_deleted_rows = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Period entry not found or access denied'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Period entry deleted successfully',
        'period_id', p_period_id::TEXT,
        'deleted_rows', v_deleted_rows
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Error deleting period entry: ' || SQLERRM
        );
END;
$$;


ALTER FUNCTION "public"."delete_period_entry"("p_period_id" "uuid", "p_patient_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_staff_by_id"("staff_id_input" "uuid") RETURNS TABLE("staff_id" "uuid", "message" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE staff_members
  SET staff_status = 'inactive',
      updated_at = NOW()
  WHERE staff_id = staff_id_input;

  RETURN QUERY SELECT 
    staff_id_input, 
    'Staff member deleted successfully';

EXCEPTION
  WHEN others THEN
    RETURN QUERY SELECT 
      NULL, 
      'Error: ' || SQLERRM;
END;
$$;


ALTER FUNCTION "public"."delete_staff_by_id"("staff_id_input" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_blog_id"("p_blog_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  result jsonb;
begin
  -- Tăng view count
  update blog_posts
  set view_count = coalesce(view_count, 0) + 1
  where blog_id = p_blog_id;

  -- Lấy thông tin blog + bác sĩ
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
      'img', s.image_link
    )
  )
  into result
  from blog_posts b
  left join staff_members s on b.doctor_id = s.staff_id
  where b.blog_id = p_blog_id;

  if result is null then
    raise exception 'Blog not found';
  end if;

  return result;
end;
$$;


ALTER FUNCTION "public"."fetch_blog_id"("input_blog_id" "uuid") OWNER TO "postgres";


DROP FUNCTION IF EXISTS "public"."fetch_doctor_id"("p_doctor_id" "uuid", "p_email" "text") CASCADE;
CREATE OR REPLACE FUNCTION "public"."fetch_doctor_id"("p_doctor_id" "uuid", "p_email" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."fetch_doctor_id"("p_doctor_id" "uuid", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_doctorbooking"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."fetch_doctorbooking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_service"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."fetch_service"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_service_by_doctor_id"("p_doctor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."fetch_service_by_doctor_id"("p_doctor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_service_id"("p_service_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."fetch_service_id"("p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_servicebooking"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."fetch_servicebooking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_slot"() RETURNS TABLE("doctor_slot_id" "uuid", "doctor_id" "uuid", "slot_date" "date", "slot_time" time without time zone)
    LANGUAGE "sql"
    AS $$
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


ALTER FUNCTION "public"."fetch_slot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_slot_by_doctor_id"("p_doctor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."fetch_slot_by_doctor_id"("p_doctor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."filter_appointments_by_patient_day_status_type"("p_patient_id" "uuid" DEFAULT NULL::"uuid", "p_target_date" "date" DEFAULT NULL::"date", "p_status" "public"."process_status" DEFAULT NULL::"public"."process_status", "p_visit_type" "public"."visit_type_enum" DEFAULT NULL::"public"."visit_type_enum") RETURNS TABLE("appointment_id" "uuid", "patient_id" "uuid", "phone" "text", "email" character varying, "visit_type" "public"."visit_type_enum", "appointment_status" "public"."process_status", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$BEGIN
  RETURN QUERY
  SELECT a.*
  FROM appointments a
  WHERE
    (p_patient_id IS NULL OR a.patient_id = p_patient_id) AND
    (p_target_date IS NULL OR a.created_at::date = p_target_date) AND
    (p_status IS NULL OR a.appointment_status = p_status) AND
    (p_visit_type IS NULL OR a.visit_type = p_visit_type);
END;
$$;


ALTER FUNCTION "public"."filter_appointments_by_patient_day_status_type"("p_patient_id" "uuid", "p_target_date" "date", "p_status" "public"."process_status", "p_visit_type" "public"."visit_type_enum") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."filter_services"("p_category_id" "uuid") RETURNS TABLE("service_id" "uuid", "category_id" "uuid", "category_name" "text", "service_name" "text", "service_cost" numeric, "duration_minutes" integer, "image_link" "text", "service_description" json, "excerpt" "text")
    LANGUAGE "plpgsql"
    AS $$BEGIN
    RETURN QUERY
    SELECT 
        ms.service_id,
        ms.category_id,
        sc.category_name,
        ms.service_name,
        ms.service_cost,
        ms.duration_minutes,
        ms.image_link,
        ms.service_description,
        ms.excerpt
    FROM 
        medical_services ms
    JOIN 
        service_categories sc ON ms.category_id = sc.category_id
    WHERE
        ms.is_active = TRUE
        AND ms.category_id = p_category_id;
END;
$$;


ALTER FUNCTION "public"."filter_services"("p_category_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_doctor_slots"("p_doctor_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_morning_start" time without time zone DEFAULT '08:00:00'::time without time zone, "p_morning_end" time without time zone DEFAULT '12:00:00'::time without time zone, "p_afternoon_start" time without time zone DEFAULT '13:00:00'::time without time zone, "p_afternoon_end" time without time zone DEFAULT '17:00:00'::time without time zone, "p_evening_start" time without time zone DEFAULT '18:00:00'::time without time zone, "p_evening_end" time without time zone DEFAULT '22:00:00'::time without time zone, "p_slot_duration" interval DEFAULT '00:30:00'::interval, "p_max_appointments" integer DEFAULT 2) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_current_date DATE;
    v_current_time TIME;  -- Renamed variable to avoid reserved keyword
BEGIN
    -- Loop through each day
    v_current_date := p_start_date;
    WHILE v_current_date <= p_end_date LOOP
        -- Create morning slots (8:00-12:00)
        v_current_time := p_morning_start;
        WHILE v_current_time < p_morning_end LOOP
            INSERT INTO doctor_slots (doctor_id, slot_date, slot_time, max_appointments)
            VALUES (p_doctor_id, v_current_date, v_current_time, p_max_appointments)
            ON CONFLICT (doctor_id, slot_date, slot_time) DO NOTHING;
            
            v_current_time := v_current_time + p_slot_duration;
        END LOOP;
        
        -- Create afternoon slots (13:00-17:00)
        v_current_time := p_afternoon_start;
        WHILE v_current_time < p_afternoon_end LOOP
            INSERT INTO doctor_slots (doctor_id, slot_date, slot_time, max_appointments)
            VALUES (p_doctor_id, v_current_date, v_current_time, p_max_appointments)
            ON CONFLICT (doctor_id, slot_date, slot_time) DO NOTHING;
            
            v_current_time := v_current_time + p_slot_duration;
        END LOOP;
        
        -- Create evening slots (18:00-22:00) - only for afternoon/full-time doctors
        v_current_time := p_evening_start;
        WHILE v_current_time < p_evening_end LOOP
            INSERT INTO doctor_slots (doctor_id, slot_date, slot_time, max_appointments)
            VALUES (p_doctor_id, v_current_date, v_current_time, p_max_appointments)
            ON CONFLICT (doctor_id, slot_date, slot_time) DO NOTHING;
            
            v_current_time := v_current_time + p_slot_duration;
        END LOOP;
        
        v_current_date := v_current_date + 1;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."generate_doctor_slots"("p_doctor_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_morning_start" time without time zone, "p_morning_end" time without time zone, "p_afternoon_start" time without time zone, "p_afternoon_end" time without time zone, "p_evening_start" time without time zone, "p_evening_end" time without time zone, "p_slot_duration" interval, "p_max_appointments" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_slots"("p_doctor_id" "uuid", "p_slot_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_slot_id" "uuid") RETURNS TABLE("slot_id" "uuid", "doctor_slot_id" "uuid", "slot_date" "date", "slot_time" time without time zone, "doctor_id" "uuid", "appointments_count" integer, "max_appointments" integer)
    LANGUAGE "plpgsql"
    AS $$BEGIN
  RETURN QUERY
  SELECT 
    ds.slot_id,
    dsa.doctor_slot_id,
    ds.slot_date,
    ds.slot_time,
    dsa.doctor_id,
    dsa.appointments_count,
    dsa.max_appointments
  FROM public.slots ds
  JOIN public.doctor_slot_assignments dsa ON ds.slot_id = dsa.slot_id
  WHERE dsa.doctor_id = p_doctor_id
     AND ds.slot_date = p_slot_date
    -- AND ds.slot_time >= p_start_time
    -- AND ds.slot_time <= p_end_time
    AND ds.is_active = TRUE
    AND dsa.appointments_count < dsa.max_appointments
     AND (p_slot_id IS NULL OR dsa.slot_id = p_slot_id)
  ORDER BY ds.slot_time ASC;
END;
$$;


ALTER FUNCTION "public"."get_available_slots"("p_doctor_id" "uuid", "p_slot_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_slot_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_blogs_by_doctor_id"("p_doctor_id" "uuid") RETURNS TABLE("blog_id" "uuid", "doctor_id" "uuid", "blog_title" "text", "blog_content" "text", "excerpt" "text", "featured_image_url" "text", "blog_tags" json, "published_at" timestamp with time zone, "blog_status" "public"."blog_status", "view_count" integer, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.blog_id,
    b.doctor_id,
    b.blog_title,
    b.blog_content,
    b.excerpt,
    b.featured_image_url,
    b.blog_tags,
    b.published_at,
    b.blog_status,
    b.view_count,
    b.created_at,
    b.updated_at
  FROM blog_posts b
  WHERE b.doctor_id = p_doctor_id AND b.blog_status = 'published'
  ORDER BY b.published_at DESC NULLS LAST, b.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_blogs_by_doctor_id"("p_doctor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_period_history"("p_patient_id" "text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" bigint, "patient_id" "text", "start_date" "date", "end_date" "date", "cycle_length" integer, "flow_intensity" "text", "symptoms" "text"[], "period_description" "text", "predictions" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Return period history for the patient
    RETURN QUERY
    SELECT 
        pt.id,
        pt.patient_id,
        pt.start_date,
        pt.end_date,
        pt.cycle_length,
        pt.flow_intensity,
        pt.symptoms,
        pt.period_description,
        pt.predictions,
        pt.created_at,
        pt.updated_at
    FROM period_tracking pt
    WHERE pt.patient_id = p_patient_id
    ORDER BY pt.start_date DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_period_history"("p_patient_id" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_period_stats"("p_patient_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_stats JSONB;
    v_total_cycles INTEGER;
    v_avg_cycle_length NUMERIC;
    v_avg_period_length NUMERIC;
    v_last_period_start DATE;
    v_current_cycle_day INTEGER;
    v_next_period_date DATE;
    v_days_until_next_period INTEGER;
    v_most_common_symptoms TEXT[];
BEGIN
    
    -- Get total number of tracked cycles
    SELECT COUNT(*) INTO v_total_cycles
    FROM period_tracking
    WHERE patient_id = p_patient_id;
    
    IF v_total_cycles = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'No period data found',
            'total_cycles_tracked', 0
        );
    END IF;
    
    -- Get the most recent period start date
    SELECT start_date INTO v_last_period_start
    FROM period_tracking
    WHERE patient_id = p_patient_id
    ORDER BY start_date DESC
    LIMIT 1;
    
    -- Calculate current cycle day
    v_current_cycle_day := CURRENT_DATE - v_last_period_start + 1;
    
    -- Calculate average cycle length (from cycles that have a calculated length)
    SELECT ROUND(AVG(cycle_length), 0) INTO v_avg_cycle_length
    FROM period_tracking
    WHERE patient_id = p_patient_id 
      AND cycle_length IS NOT NULL 
      AND cycle_length BETWEEN 21 AND 45; -- Reasonable cycle length range
    
    -- If no cycle length available, use default 28
    v_avg_cycle_length := COALESCE(v_avg_cycle_length, 28);
    
    -- Calculate average period length (for entries with end_date)
    SELECT ROUND(AVG(end_date - start_date + 1), 0) INTO v_avg_period_length
    FROM period_tracking
    WHERE patient_id = p_patient_id 
      AND end_date IS NOT NULL;
    
    -- If no period length available, use default 5
    v_avg_period_length := COALESCE(v_avg_period_length, 5);
    
    -- Calculate next expected period date
    v_next_period_date := v_last_period_start + v_avg_cycle_length::INTEGER;
    
    -- Calculate days until next period
    v_days_until_next_period := GREATEST(0, v_next_period_date - CURRENT_DATE);
    
    -- Get most common symptoms
    SELECT ARRAY_AGG(DISTINCT symptom ORDER BY symptom_count DESC) INTO v_most_common_symptoms
    FROM (
        SELECT 
            UNNEST(symptoms) as symptom,
            COUNT(*) as symptom_count
        FROM period_tracking
        WHERE patient_id = p_patient_id 
          AND symptoms IS NOT NULL
        GROUP BY UNNEST(symptoms)
        ORDER BY symptom_count DESC
        LIMIT 5
    ) symptom_stats;
    
    -- Build the stats JSON
    v_stats := jsonb_build_object(
        'success', true,
        'total_cycles_tracked', v_total_cycles,
        'average_cycle_length', v_avg_cycle_length,
        'average_period_length', v_avg_period_length,
        'last_period_start', v_last_period_start,
        'current_cycle_day', v_current_cycle_day,
        'next_period_date', v_next_period_date,
        'days_until_next_period', v_days_until_next_period,
        'most_common_symptoms', COALESCE(v_most_common_symptoms, '{}'),
        'calculated_at', NOW()
    );
    
    -- Add fertility predictions if we have enough data
    IF v_total_cycles >= 1 THEN
        DECLARE
            v_ovulation_date DATE;
            v_fertile_start DATE;
            v_fertile_end DATE;
        BEGIN
            v_ovulation_date := v_last_period_start + v_avg_cycle_length::INTEGER - 14;
            v_fertile_start := v_ovulation_date - 5;
            v_fertile_end := v_ovulation_date;
            
            v_stats := v_stats || jsonb_build_object(
                'ovulation_date', v_ovulation_date,
                'fertile_window_start', v_fertile_start,
                'fertile_window_end', v_fertile_end
            );
        END;
    END IF;
    
    RETURN v_stats;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Error calculating period stats: ' || SQLERRM
        );
END;
$$;


ALTER FUNCTION "public"."get_period_stats"("p_patient_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_staff_by_id"("staff_id_input" "uuid" DEFAULT NULL::"uuid", "full_name_input" "text" DEFAULT NULL::"text", "department_input" "public"."department_enum" DEFAULT NULL::"public"."department_enum", "specialty_input" "public"."speciality_enum" DEFAULT NULL::"public"."speciality_enum", "working_email_input" character varying DEFAULT NULL::character varying, "years_experience_input" integer DEFAULT NULL::integer, "role" "public"."staff_role_enum" DEFAULT NULL::"public"."staff_role_enum") RETURNS TABLE("staff_id" "uuid", "full_name" "text", "role_input" "public"."staff_role_enum", "working_email" character varying, "department" "public"."department_enum", "years_experience" integer, "speciality" "public"."speciality_enum", "updated_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.staff_id,
        s.full_name,
        s.role,
        s.working_email,
        s.years_experience,
        d.speciality,
        d.department,
        s.updated_at,
        s.created_at
    FROM staff_members s
    LEFT JOIN doctor_details d ON s.staff_id = d.doctor_id
    WHERE s.staff_status = 'active'
      AND (staff_id_input IS NULL OR s.staff_id = staff_id_input)
      AND (full_name_input IS NULL OR s.full_name ILIKE '%' || full_name_input || '%')
      AND (working_email_input IS NULL OR s.working_email = working_email_input)
      AND (department_input IS NULL OR d.department = department_input)
      AND (years_experience_input IS NULL OR s.years_experience = years_experience_input)
      AND (specialty_input IS NULL OR d.speciality = specialty_input)
      AND (department_input IS NULL OR d.department = department_input)
      AND (role_input IS NULL OR s.role = role_input);
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            NULL::UUID,
            NULL::TEXT,
            NULL::role_enum,
            NULL::VARCHAR(100),
            NULL::department_enum,
            NULL::INTEGER,
            NULL::speciality_enum,
            NULL::TIMESTAMP WITH TIME ZONE,
            NULL::TIMESTAMP WITH TIME ZONE
        WHERE FALSE;
    END IF;
END;
$$;


ALTER FUNCTION "public"."get_staff_by_id"("staff_id_input" "uuid", "full_name_input" "text", "department_input" "public"."department_enum", "specialty_input" "public"."speciality_enum", "working_email_input" character varying, "years_experience_input" integer, "role" "public"."staff_role_enum") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.patients (id, full_name, email, gender)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email, 'other');
  
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_view_and_fetch_blog"("input_blog_id" "uuid") RETURNS TABLE("blog_id" "uuid", "blog_title" "text", "blog_content" "text", "excerpt" "text", "image_link" "text", "blog_tags" json, "blog_status" "public"."blog_status", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "doctor_details" json)
    LANGUAGE "plpgsql"
    AS $$
begin
  update blog_posts
  set view_count = view_count + 1,
      updated_at = now()
  where blog_posts.blog_id = input_blog_id;

  return query
    select
      b.blog_id,
      b.blog_title,
      b.blog_content,
      b.excerpt,
      b.image_link,
      b.blog_tags,
      b.blog_status,
      b.created_at,
      b.updated_at,
      json_build_object(
        'staff_id', s.staff_id,
        'full_name', s.full_name,
        'image_link', s.image_link
      ) as doctor_details
    from blog_posts b
    join staff_members s on s.staff_id = b.doctor_id
    where b.blog_id = input_blog_id;
end;
$$;


ALTER FUNCTION "public"."increment_view_and_fetch_blog"("input_blog_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_slots_range"("start_date" "date", "end_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  d date;
begin
  d := start_date;

  while d <= end_date loop
    insert into public.slots (slot_date, slot_time)
    values
      (d, '08:00:00'),
      (d, '13:00:00'),
      (d, '18:00:00')
    on conflict (slot_date, slot_time) do nothing;

    d := d + interval '1 day';
  end loop;
end;
$$;


ALTER FUNCTION "public"."insert_slots_range"("start_date" "date", "end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_patients_by_fields"("p_full_name" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_email" character varying DEFAULT NULL::character varying) RETURNS TABLE("id" "uuid", "full_name" "text", "phone" "text", "email" character varying, "date_of_birth" "date", "gender" "public"."gender_enum", "allergies" json, "chronic_conditions" json, "past_surgeries" json, "vaccination_status" "public"."vaccination_status_enum", "patient_status" "public"."patient_status", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "image_link" "text", "bio" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, p.full_name, p.phone, p.email,
    p.date_of_birth, p.gender, p.allergies,
    p.chronic_conditions,
    p.past_surgeries,
    p.vaccination_status, p.patient_status, p.created_at,p.updated_at,p.image_link,p.bio
  FROM 
    patients p
  WHERE 
    (p_full_name IS NULL OR p.full_name ILIKE '%' || p_full_name || '%') AND
    (p_phone IS NULL OR p.phone ILIKE '%' || p_phone || '%') AND
    (p_email IS NULL OR p.email ILIKE '%' || p_email || '%');
END;
$$;


ALTER FUNCTION "public"."search_patients_by_fields"("p_full_name" "text", "p_phone" "text", "p_email" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_patients_by_keyword"("p_keyword" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "full_name" "text", "phone" "text", "email" character varying, "date_of_birth" "date", "gender" "public"."gender_enum", "allergies" json, "chronic_conditions" json, "past_surgeries" json, "vaccination_status" "public"."vaccination_status_enum", "patient_status" "public"."patient_status", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "image_link" "text", "bio" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, p.full_name, p.phone, p.email,
    p.date_of_birth, p.gender, p.allergies,
    p.chronic_conditions, p.past_surgeries,
    p.vaccination_status, p.patient_status,
    p.created_at, p.updated_at,
    p.image_link, p.bio
  FROM 
    patients p
  WHERE 
    p_keyword IS NULL
    OR p.full_name ILIKE '%' || p_keyword || '%'
    OR p.phone ILIKE '%' || p_keyword || '%'
    OR p.email ILIKE '%' || p_keyword || '%';
END;
$$;


ALTER FUNCTION "public"."search_patients_by_keyword"("p_keyword" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_confirm_appointment"("p_appointment_id" "uuid") RETURNS "record"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_apt RECORD;
    v_slot_id uuid;
BEGIN
    -- VALIDATION PART
    SELECT *
    INTO v_apt
    FROM appointments
    WHERE appointment_id = p_appointment_id
      AND appointment_status != 'confirmed'::process_status;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appointment does not exist or is confirmed.';
    END IF;

    SELECT slot_id
    INTO v_slot_id
    FROM doctor_slot_assignments
    WHERE slot_id = v_apt.slot_id
      AND appointments_count < max_appointments;
    -- Slot with appointments_count = 1 will be considered as full

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Slot does not exist or is full.';
    END IF;

    -- UPDATE PART
    UPDATE appointments
    SET appointment_status = 'confirmed'::process_status,
        updated_at = CURRENT_TIMESTAMP
    WHERE appointment_id = p_appointment_id;

    UPDATE doctor_slot_assignments
    SET appointments_count = appointments_count + 1
    WHERE slot_id = v_slot_id
      AND doctor_id = v_apt.doctor_id;
      
    RETURN v_appointment_id;
END;
$$;


ALTER FUNCTION "public"."test_confirm_appointment"("p_appointment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_medical_services_status"("p_service_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_status BOOLEAN;
BEGIN
  SELECT is_active INTO current_status
  FROM medical_services
  WHERE service_id = p_service_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;


  UPDATE medical_services
  SET is_active = NOT current_status
  WHERE service_id = p_service_id;

    RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error toggling service status: %', SQLERRM;
    RETURN FALSE;

END;
$$;


ALTER FUNCTION "public"."toggle_medical_services_status"("p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_period_and_fertility"("p_patient_id" "text", "p_start_date" "date", "p_end_date" "date" DEFAULT NULL::"date", "p_symptoms" "text"[] DEFAULT '{}'::"text"[], "p_flow_intensity" "text" DEFAULT 'medium'::"text", "p_period_description" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_period_id BIGINT;
    v_cycle_length INTEGER;
    v_previous_start_date DATE;
    v_predictions JSONB;
    v_ovulation_date DATE;
    v_fertile_start DATE;
    v_fertile_end DATE;
    v_next_period_date DATE;
BEGIN
    
    IF p_flow_intensity NOT IN ('light', 'medium', 'heavy') THEN
        p_flow_intensity := 'medium';
    END IF;
    
    -- Get the most recent period for this patient (before the current one)
    SELECT start_date INTO v_previous_start_date
    FROM period_tracking
    WHERE patient_id = p_patient_id 
      AND start_date < p_start_date
    ORDER BY start_date DESC
    LIMIT 1;
    
    -- Calculate cycle length if we have a previous period
    IF v_previous_start_date IS NOT NULL THEN
        v_cycle_length := p_start_date - v_previous_start_date;
    ELSE
        v_cycle_length := NULL; -- First period entry
    END IF;
    
    -- Calculate predictions based on cycle length or default 28 days
    DECLARE
        cycle_for_prediction INTEGER := COALESCE(v_cycle_length, 28);
    BEGIN
        -- Calculate ovulation date (typically 14 days before next period)
        v_ovulation_date := p_start_date + cycle_for_prediction - 14;
        
        -- Calculate fertile window (5 days before ovulation + ovulation day)
        v_fertile_start := v_ovulation_date - 5;
        v_fertile_end := v_ovulation_date;
        
        -- Calculate next expected period date
        v_next_period_date := p_start_date + cycle_for_prediction;
        
        -- Build predictions JSON
        v_predictions := jsonb_build_object(
            'cycle_length', cycle_for_prediction,
            'ovulation_date', v_ovulation_date,
            'fertile_window_start', v_fertile_start,
            'fertile_window_end', v_fertile_end,
            'next_period_date', v_next_period_date,
            'calculated_at', NOW()
        );
    END;
    
    -- Insert or update the period entry
    INSERT INTO period_tracking (
        patient_id,
        start_date,
        end_date,
        cycle_length,
        flow_intensity,
        symptoms,
        period_description,
        predictions,
        created_at,
        updated_at
    ) VALUES (
        p_patient_id,
        p_start_date,
        p_end_date,
        v_cycle_length,
        p_flow_intensity,
        p_symptoms,
        p_period_description,
        v_predictions,
        NOW(),
        NOW()
    )
    ON CONFLICT (patient_id, start_date) 
    DO UPDATE SET
        end_date = EXCLUDED.end_date,
        flow_intensity = EXCLUDED.flow_intensity,
        symptoms = EXCLUDED.symptoms,
        period_description = EXCLUDED.period_description,
        predictions = EXCLUDED.predictions,
        updated_at = NOW()
    RETURNING id INTO v_period_id;
    
    -- Return success response
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Period data tracked successfully',
        'period_id', v_period_id::TEXT,
        'predictions', v_predictions
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Error tracking period: ' || SQLERRM
        );
END;$$;


ALTER FUNCTION "public"."track_period_and_fertility"("p_patient_id" "text", "p_start_date" "date", "p_end_date" "date", "p_symptoms" "text"[], "p_flow_intensity" "text", "p_period_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_blog_post"("p_blog_id" "uuid", "p_blog_title" "text" DEFAULT NULL::"text", "p_blog_content" "text" DEFAULT NULL::"text", "p_excerpt" "text" DEFAULT NULL::"text", "p_image_link" "text" DEFAULT NULL::"text", "p_blog_tags" json DEFAULT NULL::json, "p_published_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_blog_status" "public"."blog_status" DEFAULT NULL::"public"."blog_status") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE blog_posts
  SET
    blog_title = COALESCE(p_blog_title, blog_title),
    blog_content = COALESCE(p_blog_content, blog_content),
    excerpt = COALESCE(p_excerpt, excerpt),
    image_link = COALESCE(p_image_link, image_link),
    blog_tags = COALESCE(p_blog_tags, blog_tags),
    published_at = COALESCE(p_published_at, published_at),
    blog_status = COALESCE(p_blog_status, blog_status),
    updated_at = NOW()
  WHERE blog_id = p_blog_id AND blog_status = 'draft';

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."update_blog_post"("p_blog_id" "uuid", "p_blog_title" "text", "p_blog_content" "text", "p_excerpt" "text", "p_image_link" "text", "p_blog_tags" json, "p_published_at" timestamp with time zone, "p_blog_status" "public"."blog_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_medical_service"("p_service_id" "uuid", "p_category_id" "uuid" DEFAULT NULL::"uuid", "p_service_name" "text" DEFAULT NULL::"text", "p_service_description" "text" DEFAULT NULL::"text", "p_service_cost" numeric DEFAULT NULL::numeric, "p_duration_minutes" integer DEFAULT NULL::integer, "p_image_link" "text" DEFAULT NULL::"text", "p_description" json DEFAULT NULL::json, "p_overall" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$

BEGIN
  UPDATE medical_services
  SET
    category_id = COALESCE(p_category_id, category_id),
    service_name = COALESCE(p_service_name, service_name),
    service_description = COALESCE(p_service_description, service_description),
    service_cost = COALESCE(p_service_cost, service_cost),
    duration_minutes = COALESCE(p_duration_minutes, duration_minutes),
    image_link = COALESCE(p_image_link, image_link),
    description = COALESCE(p_description, description),
    overall = COALESCE(p_overall, overall)
  WHERE service_id = p_service_id AND is_active = false;

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."update_medical_service"("p_service_id" "uuid", "p_category_id" "uuid", "p_service_name" "text", "p_service_description" "text", "p_service_cost" numeric, "p_duration_minutes" integer, "p_image_link" "text", "p_description" json, "p_overall" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_period_entry"("p_period_id" bigint, "p_patient_id" "text", "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date", "p_symptoms" "text"[] DEFAULT NULL::"text"[], "p_flow_intensity" "text" DEFAULT NULL::"text", "p_period_description" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_updated_rows INTEGER;
    v_cycle_length INTEGER;
    v_previous_start_date DATE;
BEGIN
    -- Validate input
    IF p_period_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Period ID is required'
        );
    END IF;
    
    IF p_patient_id IS NULL OR p_patient_id = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Patient ID is required'
        );
    END IF;
    
    -- Validate flow intensity if provided
    IF p_flow_intensity IS NOT NULL AND p_flow_intensity NOT IN ('light', 'medium', 'heavy') THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Invalid flow intensity. Must be: light, medium, or heavy'
        );
    END IF;
    
    -- If start_date is being updated, recalculate cycle length
    IF p_start_date IS NOT NULL THEN
        SELECT start_date INTO v_previous_start_date
        FROM period_tracking
        WHERE patient_id = p_patient_id 
          AND start_date < p_start_date
          AND id != p_period_id
        ORDER BY start_date DESC
        LIMIT 1;
        
        IF v_previous_start_date IS NOT NULL THEN
            v_cycle_length := p_start_date - v_previous_start_date;
        END IF;
    END IF;
    
    -- Update the period entry
    UPDATE period_tracking
    SET 
        start_date = COALESCE(p_start_date, start_date),
        end_date = COALESCE(p_end_date, end_date),
        cycle_length = COALESCE(v_cycle_length, cycle_length),
        flow_intensity = COALESCE(p_flow_intensity, flow_intensity),
        symptoms = COALESCE(p_symptoms, symptoms),
        period_description = COALESCE(p_period_description, period_description),
        updated_at = NOW()
    WHERE id = p_period_id 
      AND patient_id = p_patient_id;
    
    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    
    IF v_updated_rows = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Period entry not found or access denied'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Period entry updated successfully',
        'period_id', p_period_id::TEXT,
        'updated_rows', v_updated_rows
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Error updating period entry: ' || SQLERRM
        );
END;
$$;


ALTER FUNCTION "public"."update_period_entry"("p_period_id" bigint, "p_patient_id" "text", "p_start_date" "date", "p_end_date" "date", "p_symptoms" "text"[], "p_flow_intensity" "text", "p_period_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_period_entry"("p_period_id" "uuid", "p_patient_id" "uuid", "p_start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_symptoms" json DEFAULT NULL::json, "p_flow_intensity" "text" DEFAULT NULL::"text", "p_period_description" "text" DEFAULT NULL::"text", "p_period_length" numeric DEFAULT NULL::numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_updated_rows INTEGER;
    v_cycle_length INTEGER;
    v_previous_start_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Validate input
    IF p_period_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Period ID is required'
        );
    END IF;
    
    IF p_patient_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Patient ID is required'
        );
    END IF;
    
    -- Validate flow intensity if provided
    IF p_flow_intensity IS NOT NULL AND p_flow_intensity NOT IN ('light', 'medium', 'heavy') THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Invalid flow intensity. Must be: light, medium, or heavy'
        );
    END IF;
    
    -- If start_date is being updated, recalculate cycle length
    IF p_start_date IS NOT NULL THEN
        SELECT start_date INTO v_previous_start_date
        FROM period_tracking
        WHERE patient_id = p_patient_id 
          AND start_date < p_start_date
          AND period_id != p_period_id
        ORDER BY start_date DESC
        LIMIT 1;
        
        IF v_previous_start_date IS NOT NULL THEN
            v_cycle_length := EXTRACT(DAY FROM (p_start_date - v_previous_start_date))::INTEGER;
        END IF;
    END IF;
    
    -- Update the period entry
    UPDATE period_tracking
    SET 
        start_date = COALESCE(p_start_date, start_date),
        end_date = COALESCE(p_end_date, end_date),
        cycle_length = COALESCE(v_cycle_length, cycle_length),
        flow_intensity = COALESCE(p_flow_intensity, flow_intensity),
        symptoms = COALESCE(p_symptoms, symptoms),
        period_description = COALESCE(p_period_description, period_description),
        period_length = COALESCE(p_period_length, period_length),
        updated_at = CURRENT_TIMESTAMP
    WHERE period_id = p_period_id 
      AND patient_id = p_patient_id;
    
    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    
    IF v_updated_rows = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Period entry not found or access denied'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Period entry updated successfully',
        'period_id', p_period_id::TEXT,
        'updated_rows', v_updated_rows
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Error updating period entry: ' || SQLERRM
        );
END;
$$;


ALTER FUNCTION "public"."update_period_entry"("p_period_id" "uuid", "p_patient_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_symptoms" json, "p_flow_intensity" "text", "p_period_description" "text", "p_period_length" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_staff_by_id"("staff_id_input" "uuid", "full_name_input" "text" DEFAULT NULL::"text", "working_email_input" character varying DEFAULT NULL::character varying, "years_experience_input" integer DEFAULT NULL::integer, "role_input" "public"."staff_role_enum" DEFAULT NULL::"public"."staff_role_enum", "updated_at_input" timestamp with time zone DEFAULT CURRENT_TIMESTAMP) RETURNS TABLE("staff_id" "uuid", "message" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE staff_members
    SET 
        full_name = COALESCE(full_name_input, full_name),
        working_email = working_email_input,
        years_experience = COALESCE(years_experience_input, years_experience),
        role = COALESCE(role_input, role),
        updated_at = updated_at_input
    WHERE staff_id = staff_id_input;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
        NULL, 
        'Error: Staff member not found';
    END IF;
    
    RETURN QUERY SELECT 
        staff_id_input, 
        'Staff member updated successfully';
EXCEPTION
  WHEN others THEN
    RETURN QUERY SELECT 
      NULL, 
      'Error: ' || SQLERRM;
END;
$$;


ALTER FUNCTION "public"."update_staff_by_id"("staff_id_input" "uuid", "full_name_input" "text", "working_email_input" character varying, "years_experience_input" integer, "role_input" "public"."staff_role_enum", "updated_at_input" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."view_medical_service"("p_service_id" "uuid") RETURNS TABLE("service_id" "uuid", "category_id" "uuid", "category_name" "text", "service_name" "text", "service_cost" numeric, "duration_minutes" integer, "is_active" boolean, "image_link" "text", "service_description" json, "excerpt" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ms.service_id,
        ms.category_id,
        sc.category_name,
        ms.service_name,
        ms.service_cost,
        ms.duration_minutes,
        ms.is_active,
        ms.image_link,
        ms.service_description,
        ms.excerpt
    FROM 
        medical_services ms
    JOIN 
        service_categories sc ON ms.category_id = sc.category_id
    WHERE 
        ms.service_id = p_service_id;
END;
$$;


ALTER FUNCTION "public"."view_medical_service"("p_service_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "appointment_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid",
    "phone" "text" NOT NULL,
    "email" "text" NOT NULL,
    "visit_type" "public"."visit_type_enum" NOT NULL,
    "appointment_status" "public"."process_status" DEFAULT 'pending'::"public"."process_status",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "schedule" "public"."schedule_enum" NOT NULL,
    "message" "text",
    "doctor_id" "uuid",
    "category_id" "uuid",
    "slot_id" "uuid",
    "appointment_date" "date",
    "appointment_time" time without time zone,
    "preferred_date" "date",
    "preferred_time" time without time zone
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_posts" (
    "blog_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "doctor_id" "uuid" NOT NULL,
    "blog_title" "text" NOT NULL,
    "blog_content" "text" NOT NULL,
    "excerpt" "text",
    "image_link" "text",
    "blog_tags" json,
    "published_at" timestamp with time zone,
    "blog_status" "public"."blog_status" DEFAULT 'draft'::"public"."blog_status",
    "view_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "blog_posts_check" CHECK (((("blog_status" = 'published'::"public"."blog_status") AND ("published_at" IS NOT NULL)) OR ("blog_status" <> 'published'::"public"."blog_status"))),
    CONSTRAINT "blog_posts_view_count_check" CHECK (("view_count" >= 0))
);


ALTER TABLE "public"."blog_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doctor_details" (
    "doctor_id" "uuid" NOT NULL,
    "department" "public"."department_enum" NOT NULL,
    "speciality" "public"."speciality_enum" NOT NULL,
    "about_me" json,
    "license_no" character varying(50) NOT NULL,
    "bio" "text",
    "slogan" "text",
    "educations" json,
    "certifications" json
);


ALTER TABLE "public"."doctor_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doctor_services" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "doctor_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."doctor_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doctor_slot_assignments" (
    "doctor_slot_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slot_id" "uuid" NOT NULL,
    "doctor_id" "uuid" NOT NULL,
    "appointments_count" integer DEFAULT 0 NOT NULL,
    "max_appointments" integer DEFAULT 2 NOT NULL,
    CONSTRAINT "doctor_slot_assignments_count_check" CHECK ((("appointments_count" >= 0) AND ("appointments_count" <= "max_appointments")))
);


ALTER TABLE "public"."doctor_slot_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guest_appointments" (
    "guest_appointment_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "guest_id" "uuid",
    "phone" "text" NOT NULL,
    "email" "text" NOT NULL,
    "visit_type" "public"."visit_type_enum" NOT NULL,
    "appointment_status" "public"."process_status" DEFAULT 'pending'::"public"."process_status",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "schedule" "public"."schedule_enum" NOT NULL,
    "message" "text",
    "appointment_date" "date",
    "appointment_time" time without time zone,
    "doctor_id" "uuid",
    "slot_id" "uuid",
    "preferred_date" "date",
    "preferred_time" time without time zone,
    "category_id" "uuid"
);


ALTER TABLE "public"."guest_appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guests" (
    "guest_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "full_name" "text",
    "phone" "text" NOT NULL,
    "email" "text" NOT NULL,
    "date_of_birth" "date" NOT NULL,
    "gender" "public"."gender_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."guests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logs" (
    "id" bigint NOT NULL,
    "message" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."logs" OWNER TO "postgres";


DO $$ BEGIN
    ALTER TABLE "public"."logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
        SEQUENCE NAME "public"."logs_id_seq"
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );
EXCEPTION
    WHEN duplicate_object OR others THEN
        NULL;
END $$;



CREATE TABLE IF NOT EXISTS "public"."medical_services" (
    "service_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "service_name" "text" NOT NULL,
    "service_cost" numeric,
    "duration_minutes" integer,
    "is_active" boolean DEFAULT true,
    "image_link" "text",
    "service_description" json,
    "excerpt" "text",
    CONSTRAINT "medical_services_duration_minutes_check" CHECK (("duration_minutes" > 0)),
    CONSTRAINT "medical_services_service_cost_check" CHECK (("service_cost" >= (0)::numeric))
);


ALTER TABLE "public"."medical_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otps" (
    "id" integer NOT NULL,
    "phone" "text",
    "otp_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL,
    "is_used" boolean DEFAULT false,
    "email" "text",
    CONSTRAINT "email_or_phone_required" CHECK ((("email" IS NOT NULL) OR ("phone" IS NOT NULL)))
);


ALTER TABLE "public"."otps" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."otps_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."otps_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."otps_id_seq" OWNED BY "public"."otps"."id";



CREATE TABLE IF NOT EXISTS "public"."patient_reports" (
    "report_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid",
    "report_content" "text" NOT NULL,
    "report_description" "text",
    "staff_id" "uuid",
    "report_status" "public"."report_status" DEFAULT 'pending'::"public"."report_status",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."patient_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patients" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" character varying(255),
    "date_of_birth" "date",
    "gender" "public"."gender_enum" NOT NULL,
    "allergies" json,
    "chronic_conditions" json,
    "past_surgeries" json,
    "vaccination_status" "public"."vaccination_status_enum" DEFAULT 'not_vaccinated'::"public"."vaccination_status_enum",
    "patient_status" "public"."patient_status" DEFAULT 'active'::"public"."patient_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "image_link" "text",
    "bio" "text"
);


ALTER TABLE "public"."patients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."period_tracking" (
    "period_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone,
    "estimated_next_date" timestamp with time zone,
    "cycle_length" integer,
    "flow_intensity" "text",
    "symptoms" json,
    "period_description" "text",
    "predictions" json,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "period_length" numeric,
    CONSTRAINT "period_tracking_cycle_length_check" CHECK (("cycle_length" > 0)),
    CONSTRAINT "period_tracking_flow_intensity_check" CHECK (("flow_intensity" = ANY (ARRAY['light'::"text", 'medium'::"text", 'heavy'::"text"])))
);


ALTER TABLE "public"."period_tracking" OWNER TO "postgres";


COMMENT ON COLUMN "public"."period_tracking"."period_length" IS 'how long does your period usally last';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" character varying(255),
    "phone" "text" NOT NULL,
    "gender" "public"."gender_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receipts" (
    "receipt_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "amount" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "services" json,
    "status" "public"."receipt_status" DEFAULT 'pending'::"public"."receipt_status",
    "transaction_id" "uuid",
    CONSTRAINT "receipts_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refreshtoken" (
    "refreshtoken_id" integer NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "is_revoked" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."refreshtoken" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."refreshtoken_refreshtoken_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."refreshtoken_refreshtoken_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."refreshtoken_refreshtoken_id_seq" OWNED BY "public"."refreshtoken"."refreshtoken_id";



CREATE TABLE IF NOT EXISTS "public"."service_categories" (
    "category_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "category_name" "text" NOT NULL,
    "category_description" "text"
);


ALTER TABLE "public"."service_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."slots" (
    "slot_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slot_date" "date" NOT NULL,
    "slot_time" time without time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_history" (
    "history_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "changed_by" "uuid" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "field_name" "text" NOT NULL,
    "old_value" json,
    "new_value" json,
    "change_reason" "text",
    CONSTRAINT "staff_history_field_name_check" CHECK (("field_name" = ANY (ARRAY['full_name'::"text", 'working_email'::"text", 'role'::"text", 'years_experience'::"text", 'hired_at'::"text", 'is_available'::"text", 'department'::"text", 'speciality'::"text", 'license_no'::"text"])))
);


ALTER TABLE "public"."staff_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff_history" IS 'Save changes time when using update or delete function';



CREATE TABLE IF NOT EXISTS "public"."staff_members" (
    "staff_id" "uuid" NOT NULL,
    "full_name" character varying(100) NOT NULL,
    "working_email" character varying(255) NOT NULL,
    "role" "public"."staff_role_enum" NOT NULL,
    "years_experience" integer,
    "hired_at" "date" NOT NULL,
    "is_available" boolean DEFAULT true NOT NULL,
    "staff_status" "public"."staff_status" DEFAULT 'active'::"public"."staff_status",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "image_link" "text",
    "gender" "public"."gender_enum",
    "languages" json[],
    CONSTRAINT "staff_members_years_experience_check" CHECK (("years_experience" >= 0))
);


ALTER TABLE "public"."staff_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_schedules" (
    "schedule_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "timetable" json,
    CONSTRAINT "staff_schedules_check" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "public"."staff_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "ticket_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid",
    "ticket_status" "public"."process_status" DEFAULT 'pending'::"public"."process_status",
    "message" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "schedule" "public"."ticket_schedule_enum"
);


ALTER TABLE "public"."tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "text" NOT NULL,
    "amount" double precision NOT NULL,
    "order_info" "text" NOT NULL,
    "services" "jsonb",
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "vnpay_response" "jsonb",
    "updated_at" timestamp with time zone,
    "patient_id" "uuid"
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."otps" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."otps_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."refreshtoken" ALTER COLUMN "refreshtoken_id" SET DEFAULT "nextval"('"public"."refreshtoken_refreshtoken_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("appointment_id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("blog_id");



ALTER TABLE ONLY "public"."doctor_details"
    ADD CONSTRAINT "doctor_details_license_no_key" UNIQUE ("license_no");



ALTER TABLE ONLY "public"."doctor_details"
    ADD CONSTRAINT "doctor_details_pkey" PRIMARY KEY ("doctor_id");



ALTER TABLE ONLY "public"."doctor_services"
    ADD CONSTRAINT "doctor_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doctor_services"
    ADD CONSTRAINT "doctor_services_unique" UNIQUE ("doctor_id", "service_id");



ALTER TABLE ONLY "public"."doctor_slot_assignments"
    ADD CONSTRAINT "doctor_slot_assignments_pkey" PRIMARY KEY ("doctor_slot_id");



ALTER TABLE ONLY "public"."doctor_slot_assignments"
    ADD CONSTRAINT "doctor_slot_assignments_unique" UNIQUE ("slot_id", "doctor_id");



ALTER TABLE ONLY "public"."slots"
    ADD CONSTRAINT "doctor_slots_pkey" PRIMARY KEY ("slot_id");



ALTER TABLE ONLY "public"."slots"
    ADD CONSTRAINT "doctor_slots_unique_slot" UNIQUE ("slot_date", "slot_time");



ALTER TABLE ONLY "public"."guest_appointments"
    ADD CONSTRAINT "guest_appointments_pkey" PRIMARY KEY ("guest_appointment_id");



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_id_pkey" PRIMARY KEY ("guest_id");



ALTER TABLE ONLY "public"."logs"
    ADD CONSTRAINT "logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medical_services"
    ADD CONSTRAINT "medical_services_pkey" PRIMARY KEY ("service_id");



ALTER TABLE ONLY "public"."otps"
    ADD CONSTRAINT "otps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_reports"
    ADD CONSTRAINT "patient_reports_pkey" PRIMARY KEY ("report_id");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."period_tracking"
    ADD CONSTRAINT "period_tracking_pkey" PRIMARY KEY ("period_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_phone_unique" UNIQUE ("phone");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_pkey" PRIMARY KEY ("receipt_id");



ALTER TABLE ONLY "public"."refreshtoken"
    ADD CONSTRAINT "refreshtoken_pkey" PRIMARY KEY ("refreshtoken_id");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_category_name_key" UNIQUE ("category_name");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY ("category_id");



ALTER TABLE ONLY "public"."staff_history"
    ADD CONSTRAINT "staff_history_pkey" PRIMARY KEY ("history_id");



ALTER TABLE ONLY "public"."staff_members"
    ADD CONSTRAINT "staff_members_pkey" PRIMARY KEY ("staff_id");



ALTER TABLE ONLY "public"."staff_members"
    ADD CONSTRAINT "staff_members_working_email_key" UNIQUE ("working_email");



ALTER TABLE ONLY "public"."staff_schedules"
    ADD CONSTRAINT "staff_schedules_pkey" PRIMARY KEY ("schedule_id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("ticket_id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otps"
    ADD CONSTRAINT "unique_email_address" UNIQUE ("email");



ALTER TABLE ONLY "public"."otps"
    ADD CONSTRAINT "unique_phone_number" UNIQUE ("phone");



CREATE INDEX "idx_period_tracking_patient_id" ON "public"."period_tracking" USING "btree" ("patient_id");



CREATE INDEX "idx_period_tracking_patient_start" ON "public"."period_tracking" USING "btree" ("patient_id", "start_date" DESC);



CREATE INDEX "idx_period_tracking_start_date" ON "public"."period_tracking" USING "btree" ("start_date" DESC);



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_link_services_by_speciality" AFTER INSERT ON "public"."doctor_details" FOR EACH ROW EXECUTE FUNCTION "public"."auto_link_doctor_by_speciality"();



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("category_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor_details"("doctor_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "public"."doctor_slot_assignments"("doctor_slot_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."staff_members"("staff_id");



ALTER TABLE ONLY "public"."doctor_details"
    ADD CONSTRAINT "doctor_details_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."staff_members"("staff_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doctor_services"
    ADD CONSTRAINT "doctor_services_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor_details"("doctor_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doctor_services"
    ADD CONSTRAINT "doctor_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."medical_services"("service_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doctor_slot_assignments"
    ADD CONSTRAINT "doctor_slot_assignments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."staff_members"("staff_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doctor_slot_assignments"
    ADD CONSTRAINT "doctor_slot_assignments_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "public"."slots"("slot_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "fk_receipts_transaction" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id");



ALTER TABLE ONLY "public"."guest_appointments"
    ADD CONSTRAINT "guest_appointments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("category_id");



ALTER TABLE ONLY "public"."guest_appointments"
    ADD CONSTRAINT "guest_appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor_details"("doctor_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."guest_appointments"
    ADD CONSTRAINT "guest_appointments_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("guest_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guest_appointments"
    ADD CONSTRAINT "guest_appointments_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "public"."doctor_slot_assignments"("doctor_slot_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."medical_services"
    ADD CONSTRAINT "medical_services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("category_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_reports"
    ADD CONSTRAINT "patient_reports_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_reports"
    ADD CONSTRAINT "patient_reports_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("staff_id");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."period_tracking"
    ADD CONSTRAINT "period_tracking_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refreshtoken"
    ADD CONSTRAINT "refreshtoken_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_history"
    ADD CONSTRAINT "staff_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."staff_members"("staff_id");



ALTER TABLE ONLY "public"."staff_history"
    ADD CONSTRAINT "staff_history_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("staff_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_members"
    ADD CONSTRAINT "staff_members_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_schedules"
    ADD CONSTRAINT "staff_schedules_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("staff_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



CREATE POLICY "Users can access own OTPs" ON "public"."otps" USING (("phone" = ( SELECT "otps_1"."phone" AS "phone_number"
   FROM "public"."otps" "otps_1"
  WHERE ("otps_1"."phone" = "otps_1"."phone")
 LIMIT 1)));



ALTER TABLE "public"."otps" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."receipts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."staff_members";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































































































































GRANT ALL ON FUNCTION "public"."assign_doctors_to_slots"("start_date" "date", "end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_doctors_to_slots"("start_date" "date", "end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_doctors_to_slots"("start_date" "date", "end_date" "date") TO "service_role";



GRANT ALL ON PROCEDURE "public"."auto_insert_slots_for_next_month"() TO "anon";
GRANT ALL ON PROCEDURE "public"."auto_insert_slots_for_next_month"() TO "authenticated";
GRANT ALL ON PROCEDURE "public"."auto_insert_slots_for_next_month"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_link_doctor_by_speciality"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_link_doctor_by_speciality"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_link_doctor_by_speciality"() TO "service_role";



GRANT ALL ON FUNCTION "public"."book_appointment_slot"("p_slot_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."book_appointment_slot"("p_slot_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."book_appointment_slot"("p_slot_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_daily_revenue"("target_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_daily_revenue"("target_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_daily_revenue"("target_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_appointment"("p_appointment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_appointment"("p_appointment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_appointment"("p_appointment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."change_status_appointment"("appointment_id_input" "uuid", "new_status_input" "public"."process_status", "updated_at_input" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."change_status_appointment"("appointment_id_input" "uuid", "new_status_input" "public"."process_status", "updated_at_input" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."change_status_appointment"("appointment_id_input" "uuid", "new_status_input" "public"."process_status", "updated_at_input" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."count_appointments_by_day"("target_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."count_appointments_by_day"("target_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_appointments_by_day"("target_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_appointments_by_status"("target_status" "public"."process_status") TO "anon";
GRANT ALL ON FUNCTION "public"."count_appointments_by_status"("target_status" "public"."process_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_appointments_by_status"("target_status" "public"."process_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_patients_by_month"("target_year" integer, "target_month" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."count_patients_by_month"("target_year" integer, "target_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_patients_by_month"("target_year" integer, "target_month" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_appointment"("patient_id_input" "uuid", "visit_type_input" "public"."visit_type_enum", "appointment_status_input" "public"."process_status", "created_at_input" timestamp with time zone, "updated_at_input" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."create_appointment"("patient_id_input" "uuid", "visit_type_input" "public"."visit_type_enum", "appointment_status_input" "public"."process_status", "created_at_input" timestamp with time zone, "updated_at_input" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_appointment"("patient_id_input" "uuid", "visit_type_input" "public"."visit_type_enum", "appointment_status_input" "public"."process_status", "created_at_input" timestamp with time zone, "updated_at_input" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_blog_post"("p_doctor_id" "uuid", "p_blog_title" "text", "p_blog_content" "text", "p_excerpt" "text", "p_image_link" "text", "p_blog_tags" json, "p_published_at" timestamp with time zone, "p_blog_status" "public"."blog_status") TO "anon";
GRANT ALL ON FUNCTION "public"."create_blog_post"("p_doctor_id" "uuid", "p_blog_title" "text", "p_blog_content" "text", "p_excerpt" "text", "p_image_link" "text", "p_blog_tags" json, "p_published_at" timestamp with time zone, "p_blog_status" "public"."blog_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_blog_post"("p_doctor_id" "uuid", "p_blog_title" "text", "p_blog_content" "text", "p_excerpt" "text", "p_image_link" "text", "p_blog_tags" json, "p_published_at" timestamp with time zone, "p_blog_status" "public"."blog_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_doctor_detail"("p_doctor_id" "uuid", "p_department" "public"."department_enum", "p_speciality" "public"."speciality_enum", "p_about_me" json, "p_license_no" character varying, "p_bio" "text", "p_slogan" "text", "p_educations" json, "p_certifications" json) TO "anon";
GRANT ALL ON FUNCTION "public"."create_doctor_detail"("p_doctor_id" "uuid", "p_department" "public"."department_enum", "p_speciality" "public"."speciality_enum", "p_about_me" json, "p_license_no" character varying, "p_bio" "text", "p_slogan" "text", "p_educations" json, "p_certifications" json) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_doctor_detail"("p_doctor_id" "uuid", "p_department" "public"."department_enum", "p_speciality" "public"."speciality_enum", "p_about_me" json, "p_license_no" character varying, "p_bio" "text", "p_slogan" "text", "p_educations" json, "p_certifications" json) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_medical_service"("p_category_id" "uuid", "p_service_name" "text", "p_service_description" "text", "p_service_cost" numeric, "p_duration_minutes" integer, "p_image_link" "text", "p_description" json, "p_overall" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_medical_service"("p_category_id" "uuid", "p_service_name" "text", "p_service_description" "text", "p_service_cost" numeric, "p_duration_minutes" integer, "p_image_link" "text", "p_description" json, "p_overall" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_medical_service"("p_category_id" "uuid", "p_service_name" "text", "p_service_description" "text", "p_service_cost" numeric, "p_duration_minutes" integer, "p_image_link" "text", "p_description" json, "p_overall" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_patient"("p_id" "uuid", "p_full_name" "text", "p_phone" "text", "p_email" character varying, "p_date_of_birth" "date", "p_gender" "public"."gender_enum", "p_allergies" json, "p_chronic_conditions" json, "p_past_surgeries" json, "p_image_link" "text", "p_bio" "text", "p_vaccination_status" "public"."vaccination_status_enum", "p_patient_status" "public"."patient_status") TO "anon";
GRANT ALL ON FUNCTION "public"."create_patient"("p_id" "uuid", "p_full_name" "text", "p_phone" "text", "p_email" character varying, "p_date_of_birth" "date", "p_gender" "public"."gender_enum", "p_allergies" json, "p_chronic_conditions" json, "p_past_surgeries" json, "p_image_link" "text", "p_bio" "text", "p_vaccination_status" "public"."vaccination_status_enum", "p_patient_status" "public"."patient_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_patient"("p_id" "uuid", "p_full_name" "text", "p_phone" "text", "p_email" character varying, "p_date_of_birth" "date", "p_gender" "public"."gender_enum", "p_allergies" json, "p_chronic_conditions" json, "p_past_surgeries" json, "p_image_link" "text", "p_bio" "text", "p_vaccination_status" "public"."vaccination_status_enum", "p_patient_status" "public"."patient_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_period_entry"("p_patient_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_cycle_length" integer, "p_flow_intensity" "text", "p_symptoms" json, "p_period_description" "text", "p_predictions" json, "p_period_length" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."create_period_entry"("p_patient_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_cycle_length" integer, "p_flow_intensity" "text", "p_symptoms" json, "p_period_description" "text", "p_predictions" json, "p_period_length" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_period_entry"("p_patient_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_cycle_length" integer, "p_flow_intensity" "text", "p_symptoms" json, "p_period_description" "text", "p_predictions" json, "p_period_length" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_period_tracking"("p_patient_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_cycle_length" integer, "p_flow_intensity" "text", "p_symptoms" "jsonb", "p_period_description" "text", "p_predictions" "jsonb", "p_period_length" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_period_tracking"("p_patient_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_cycle_length" integer, "p_flow_intensity" "text", "p_symptoms" "jsonb", "p_period_description" "text", "p_predictions" "jsonb", "p_period_length" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_period_tracking"("p_patient_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_cycle_length" integer, "p_flow_intensity" "text", "p_symptoms" "jsonb", "p_period_description" "text", "p_predictions" "jsonb", "p_period_length" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_staff_member"("user_id_input" "uuid", "full_name_input" "text", "role_name_input" "public"."staff_role_enum", "working_email_input" character varying, "department_input" "public"."department_enum", "hire_date_input" "date", "specialty_input" "public"."speciality_enum", "license_no_input" character varying, "years_experience_input" integer, "created_at_input" timestamp with time zone, "updated_at_input" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."create_staff_member"("user_id_input" "uuid", "full_name_input" "text", "role_name_input" "public"."staff_role_enum", "working_email_input" character varying, "department_input" "public"."department_enum", "hire_date_input" "date", "specialty_input" "public"."speciality_enum", "license_no_input" character varying, "years_experience_input" integer, "created_at_input" timestamp with time zone, "updated_at_input" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_staff_member"("user_id_input" "uuid", "full_name_input" "text", "role_name_input" "public"."staff_role_enum", "working_email_input" character varying, "department_input" "public"."department_enum", "hire_date_input" "date", "specialty_input" "public"."speciality_enum", "license_no_input" character varying, "years_experience_input" integer, "created_at_input" timestamp with time zone, "updated_at_input" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_ticket"("p_message" "text", "p_patient_id" "uuid", "p_schedule" "public"."ticket_schedule_enum") TO "anon";
GRANT ALL ON FUNCTION "public"."create_ticket"("p_message" "text", "p_patient_id" "uuid", "p_schedule" "public"."ticket_schedule_enum") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_ticket"("p_message" "text", "p_patient_id" "uuid", "p_schedule" "public"."ticket_schedule_enum") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_appointment"("appointment_id_input" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_appointment"("appointment_id_input" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_appointment"("appointment_id_input" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_period_entry"("p_period_id" bigint, "p_patient_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_period_entry"("p_period_id" bigint, "p_patient_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_period_entry"("p_period_id" bigint, "p_patient_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_period_entry"("p_period_id" "uuid", "p_patient_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_period_entry"("p_period_id" "uuid", "p_patient_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_period_entry"("p_period_id" "uuid", "p_patient_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_staff_by_id"("staff_id_input" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_staff_by_id"("staff_id_input" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_staff_by_id"("staff_id_input" "uuid") TO "service_role";



ALTER FUNCTION "public"."fetch_blog_id"("p_blog_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."fetch_blog_id"("p_blog_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_blog_id"("p_blog_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_blog_id"("p_blog_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_doctor_id"("p_doctor_id" "uuid", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_doctor_id"("p_doctor_id" "uuid", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_doctor_id"("p_doctor_id" "uuid", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_doctorbooking"() TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_doctorbooking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_doctorbooking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_service"() TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_service"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_service"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_service_by_doctor_id"("p_doctor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_service_by_doctor_id"("p_doctor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_service_by_doctor_id"("p_doctor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_service_id"("p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_service_id"("p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_service_id"("p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_servicebooking"() TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_servicebooking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_servicebooking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_slot"() TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_slot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_slot"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_slot_by_doctor_id"("p_doctor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_slot_by_doctor_id"("p_doctor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_slot_by_doctor_id"("p_doctor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."filter_appointments_by_patient_day_status_type"("p_patient_id" "uuid", "p_target_date" "date", "p_status" "public"."process_status", "p_visit_type" "public"."visit_type_enum") TO "anon";
GRANT ALL ON FUNCTION "public"."filter_appointments_by_patient_day_status_type"("p_patient_id" "uuid", "p_target_date" "date", "p_status" "public"."process_status", "p_visit_type" "public"."visit_type_enum") TO "authenticated";
GRANT ALL ON FUNCTION "public"."filter_appointments_by_patient_day_status_type"("p_patient_id" "uuid", "p_target_date" "date", "p_status" "public"."process_status", "p_visit_type" "public"."visit_type_enum") TO "service_role";



GRANT ALL ON FUNCTION "public"."filter_services"("p_category_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."filter_services"("p_category_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."filter_services"("p_category_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_doctor_slots"("p_doctor_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_morning_start" time without time zone, "p_morning_end" time without time zone, "p_afternoon_start" time without time zone, "p_afternoon_end" time without time zone, "p_evening_start" time without time zone, "p_evening_end" time without time zone, "p_slot_duration" interval, "p_max_appointments" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_doctor_slots"("p_doctor_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_morning_start" time without time zone, "p_morning_end" time without time zone, "p_afternoon_start" time without time zone, "p_afternoon_end" time without time zone, "p_evening_start" time without time zone, "p_evening_end" time without time zone, "p_slot_duration" interval, "p_max_appointments" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_doctor_slots"("p_doctor_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_morning_start" time without time zone, "p_morning_end" time without time zone, "p_afternoon_start" time without time zone, "p_afternoon_end" time without time zone, "p_evening_start" time without time zone, "p_evening_end" time without time zone, "p_slot_duration" interval, "p_max_appointments" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_slots"("p_doctor_id" "uuid", "p_slot_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_slot_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_slots"("p_doctor_id" "uuid", "p_slot_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_slot_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_slots"("p_doctor_id" "uuid", "p_slot_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_slot_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_blogs_by_doctor_id"("p_doctor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_blogs_by_doctor_id"("p_doctor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_blogs_by_doctor_id"("p_doctor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_period_history"("p_patient_id" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_period_history"("p_patient_id" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_period_history"("p_patient_id" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_period_stats"("p_patient_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_period_stats"("p_patient_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_period_stats"("p_patient_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_staff_by_id"("staff_id_input" "uuid", "full_name_input" "text", "department_input" "public"."department_enum", "specialty_input" "public"."speciality_enum", "working_email_input" character varying, "years_experience_input" integer, "role" "public"."staff_role_enum") TO "anon";
GRANT ALL ON FUNCTION "public"."get_staff_by_id"("staff_id_input" "uuid", "full_name_input" "text", "department_input" "public"."department_enum", "specialty_input" "public"."speciality_enum", "working_email_input" character varying, "years_experience_input" integer, "role" "public"."staff_role_enum") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_staff_by_id"("staff_id_input" "uuid", "full_name_input" "text", "department_input" "public"."department_enum", "specialty_input" "public"."speciality_enum", "working_email_input" character varying, "years_experience_input" integer, "role" "public"."staff_role_enum") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_view_and_fetch_blog"("input_blog_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_view_and_fetch_blog"("input_blog_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_view_and_fetch_blog"("input_blog_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_slots_range"("start_date" "date", "end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_slots_range"("start_date" "date", "end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_slots_range"("start_date" "date", "end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_patients_by_fields"("p_full_name" "text", "p_phone" "text", "p_email" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."search_patients_by_fields"("p_full_name" "text", "p_phone" "text", "p_email" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_patients_by_fields"("p_full_name" "text", "p_phone" "text", "p_email" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_patients_by_keyword"("p_keyword" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_patients_by_keyword"("p_keyword" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_patients_by_keyword"("p_keyword" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."test_confirm_appointment"("p_appointment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."test_confirm_appointment"("p_appointment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_confirm_appointment"("p_appointment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_medical_services_status"("p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_medical_services_status"("p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_medical_services_status"("p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."track_period_and_fertility"("p_patient_id" "text", "p_start_date" "date", "p_end_date" "date", "p_symptoms" "text"[], "p_flow_intensity" "text", "p_period_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."track_period_and_fertility"("p_patient_id" "text", "p_start_date" "date", "p_end_date" "date", "p_symptoms" "text"[], "p_flow_intensity" "text", "p_period_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_period_and_fertility"("p_patient_id" "text", "p_start_date" "date", "p_end_date" "date", "p_symptoms" "text"[], "p_flow_intensity" "text", "p_period_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_blog_post"("p_blog_id" "uuid", "p_blog_title" "text", "p_blog_content" "text", "p_excerpt" "text", "p_image_link" "text", "p_blog_tags" json, "p_published_at" timestamp with time zone, "p_blog_status" "public"."blog_status") TO "anon";
GRANT ALL ON FUNCTION "public"."update_blog_post"("p_blog_id" "uuid", "p_blog_title" "text", "p_blog_content" "text", "p_excerpt" "text", "p_image_link" "text", "p_blog_tags" json, "p_published_at" timestamp with time zone, "p_blog_status" "public"."blog_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_blog_post"("p_blog_id" "uuid", "p_blog_title" "text", "p_blog_content" "text", "p_excerpt" "text", "p_image_link" "text", "p_blog_tags" json, "p_published_at" timestamp with time zone, "p_blog_status" "public"."blog_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_medical_service"("p_service_id" "uuid", "p_category_id" "uuid", "p_service_name" "text", "p_service_description" "text", "p_service_cost" numeric, "p_duration_minutes" integer, "p_image_link" "text", "p_description" json, "p_overall" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_medical_service"("p_service_id" "uuid", "p_category_id" "uuid", "p_service_name" "text", "p_service_description" "text", "p_service_cost" numeric, "p_duration_minutes" integer, "p_image_link" "text", "p_description" json, "p_overall" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_medical_service"("p_service_id" "uuid", "p_category_id" "uuid", "p_service_name" "text", "p_service_description" "text", "p_service_cost" numeric, "p_duration_minutes" integer, "p_image_link" "text", "p_description" json, "p_overall" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_period_entry"("p_period_id" bigint, "p_patient_id" "text", "p_start_date" "date", "p_end_date" "date", "p_symptoms" "text"[], "p_flow_intensity" "text", "p_period_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_period_entry"("p_period_id" bigint, "p_patient_id" "text", "p_start_date" "date", "p_end_date" "date", "p_symptoms" "text"[], "p_flow_intensity" "text", "p_period_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_period_entry"("p_period_id" bigint, "p_patient_id" "text", "p_start_date" "date", "p_end_date" "date", "p_symptoms" "text"[], "p_flow_intensity" "text", "p_period_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_period_entry"("p_period_id" "uuid", "p_patient_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_symptoms" json, "p_flow_intensity" "text", "p_period_description" "text", "p_period_length" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."update_period_entry"("p_period_id" "uuid", "p_patient_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_symptoms" json, "p_flow_intensity" "text", "p_period_description" "text", "p_period_length" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_period_entry"("p_period_id" "uuid", "p_patient_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_symptoms" json, "p_flow_intensity" "text", "p_period_description" "text", "p_period_length" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_staff_by_id"("staff_id_input" "uuid", "full_name_input" "text", "working_email_input" character varying, "years_experience_input" integer, "role_input" "public"."staff_role_enum", "updated_at_input" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."update_staff_by_id"("staff_id_input" "uuid", "full_name_input" "text", "working_email_input" character varying, "years_experience_input" integer, "role_input" "public"."staff_role_enum", "updated_at_input" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_staff_by_id"("staff_id_input" "uuid", "full_name_input" "text", "working_email_input" character varying, "years_experience_input" integer, "role_input" "public"."staff_role_enum", "updated_at_input" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."view_medical_service"("p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."view_medical_service"("p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."view_medical_service"("p_service_id" "uuid") TO "service_role";





















GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."blog_posts" TO "anon";
GRANT ALL ON TABLE "public"."blog_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_posts" TO "service_role";



GRANT ALL ON TABLE "public"."doctor_details" TO "anon";
GRANT ALL ON TABLE "public"."doctor_details" TO "authenticated";
GRANT ALL ON TABLE "public"."doctor_details" TO "service_role";



GRANT ALL ON TABLE "public"."doctor_services" TO "anon";
GRANT ALL ON TABLE "public"."doctor_services" TO "authenticated";
GRANT ALL ON TABLE "public"."doctor_services" TO "service_role";



GRANT ALL ON TABLE "public"."doctor_slot_assignments" TO "anon";
GRANT ALL ON TABLE "public"."doctor_slot_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."doctor_slot_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."guest_appointments" TO "anon";
GRANT ALL ON TABLE "public"."guest_appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."guest_appointments" TO "service_role";



GRANT ALL ON TABLE "public"."guests" TO "anon";
GRANT ALL ON TABLE "public"."guests" TO "authenticated";
GRANT ALL ON TABLE "public"."guests" TO "service_role";



GRANT ALL ON TABLE "public"."logs" TO "anon";
GRANT ALL ON TABLE "public"."logs" TO "authenticated";
GRANT ALL ON TABLE "public"."logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."medical_services" TO "anon";
GRANT ALL ON TABLE "public"."medical_services" TO "authenticated";
GRANT ALL ON TABLE "public"."medical_services" TO "service_role";



GRANT ALL ON TABLE "public"."otps" TO "anon";
GRANT ALL ON TABLE "public"."otps" TO "authenticated";
GRANT ALL ON TABLE "public"."otps" TO "service_role";



GRANT ALL ON SEQUENCE "public"."otps_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."otps_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."otps_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."patient_reports" TO "anon";
GRANT ALL ON TABLE "public"."patient_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_reports" TO "service_role";



GRANT ALL ON TABLE "public"."patients" TO "anon";
GRANT ALL ON TABLE "public"."patients" TO "authenticated";
GRANT ALL ON TABLE "public"."patients" TO "service_role";



GRANT ALL ON TABLE "public"."period_tracking" TO "anon";
GRANT ALL ON TABLE "public"."period_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."period_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."receipts" TO "anon";
GRANT ALL ON TABLE "public"."receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."receipts" TO "service_role";



GRANT ALL ON TABLE "public"."refreshtoken" TO "anon";
GRANT ALL ON TABLE "public"."refreshtoken" TO "authenticated";
GRANT ALL ON TABLE "public"."refreshtoken" TO "service_role";



GRANT ALL ON SEQUENCE "public"."refreshtoken_refreshtoken_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."refreshtoken_refreshtoken_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."refreshtoken_refreshtoken_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."service_categories" TO "anon";
GRANT ALL ON TABLE "public"."service_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."service_categories" TO "service_role";



GRANT ALL ON TABLE "public"."slots" TO "anon";
GRANT ALL ON TABLE "public"."slots" TO "authenticated";
GRANT ALL ON TABLE "public"."slots" TO "service_role";



GRANT ALL ON TABLE "public"."staff_history" TO "anon";
GRANT ALL ON TABLE "public"."staff_history" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_history" TO "service_role";



GRANT ALL ON TABLE "public"."staff_members" TO "anon";
GRANT ALL ON TABLE "public"."staff_members" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_members" TO "service_role";



GRANT ALL ON TABLE "public"."staff_schedules" TO "anon";
GRANT ALL ON TABLE "public"."staff_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."tickets" TO "anon";
GRANT ALL ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
