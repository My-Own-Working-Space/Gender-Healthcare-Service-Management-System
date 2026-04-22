import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
function createErrorResponse(error, status = 400, details = null) {
  const response = {
    error,
    details
  };
  if (details) response.details = details;
  return new Response(JSON.stringify(response), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
function createSuccessResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      }
    });
  }
  if (req.method !== "GET") {
    return createErrorResponse("Method not allowed", 405);
  }
  const url = new URL(req.url);
  const doctor_id = url.searchParams.get("doctor_id");
  const email = url.searchParams.get("email");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return createErrorResponse("Server configuration error", 500);
  }
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  try {
    if (!doctor_id && !email) {
      return createErrorResponse("Missing query parameter: doctor_id or email", 400);
    }
    let doctor = supabase.from("doctor_details").select(`
        doctor_id,
        department,
        speciality,
        about_me,
        bio,
        slogan,
        educations,
        certifications,
        license_no,
        staff_members (
          full_name,
          gender,
          image_link,
          working_email,
          years_experience,
          languages
        )
      `);
    let data, error;
    if (doctor_id) {
      ({ data, error } = await doctor.eq("doctor_id", doctor_id).maybeSingle());
    } else {
      const { data: staffData, error: staffError } = await supabase.from("staff_members").select("staff_id").eq("working_email", email).maybeSingle();
      if (staffError) {
        return createErrorResponse("Database query error for staff", 500, staffError.message);
      }
      if (!staffData) {
        return createErrorResponse("Doctor not found", 404);
      }
      ({ data, error } = await doctor.eq("doctor_id", staffData.staff_id).maybeSingle());
    }
    if (error) {
      return createErrorResponse("Database query error", 500, error.message);
    }
    if (!data) {
      return createErrorResponse("Doctor not found", 404);
    }
    // Extract image_link from staff_members
    const imageLink = data.staff_members?.image_link;
    let image = null;
    if (imageLink) {
      const { data: publicData, error: publicDataError } = await supabase.storage.from("staff-uploads").getPublicUrl(imageLink);
      if (publicDataError) {
        console.error("Storage error:", publicDataError.message);
      } else {
        image = publicData.publicUrl;
      }
    }
    // Fetch blog data
    const { data: blogData, error: blogError } = await supabase.from("blog_posts").select("*").eq("doctor_id", data.doctor_id).eq("blog_status", "published");
    if (blogError) {
      return createErrorResponse("Failed to fetch blog data", 500, blogError.message);
    }

    //Extract image link for blogs 
    const blog_image_link = blogData.image_link;
    let blogImage = null;
    if (blog_image_link) {
      const { data: publicData, error: publicDataError } = await supabase.storage.from("blog-uploads").getPublicUrl(blog_image_link);
      if (publicDataError) {
        console.error("Storage error:", publicDataError.message);
      } else {
        blogImage = publicData.publicUrl;
      }
    }
    // Prepare response data
    const responseData = {
      doctor_id: data.doctor_id,
      department: data.department,
      speciality: data.speciality,
      bio: data.bio,
      slogan: data.slogan,
      educations: data.educations,
      certifications: data.certifications,
      about_me: data.about_me,
      license_no: data.license_no,
      staff_members: {
        full_name: data.staff_members?.full_name,
        gender: data.staff_members?.gender,
        image_link: image,
        working_email: data.staff_members?.working_email,
        years_experience: data.staff_members?.years_experience,
        languages: data.staff_members?.languages
      },
      blogs: blogData ? blogData.map((blog) => ({
        blog_id: blog.blog_id,
        title: blog.blog_title,
        excerpt: blog.excerpt,
        image_link: blogImage ?? 'https://ldmcdielxskywugyohrq.supabase.co/storage/v1/object/public/blog-uploads//blog_bg.webp',
        created_at: blog.created_at,
        updated_at: blog.updated_at,
        doctor_id: blog.doctor_id
      })) : []
    };
    return createSuccessResponse(responseData);
  } catch (error) {
    return createErrorResponse("Internal server error", 500, error.message);
  }
});

// curl -X GET "http://127.0.0.1:54321/functions/v1/fetch-doctor-id?doctor_id=550e8400-e29b-41d4-a716-446655440003" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" -H "Content-Type: application/json"
