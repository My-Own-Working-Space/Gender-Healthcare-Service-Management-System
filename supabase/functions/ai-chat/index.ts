import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query } = await req.json()
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")

    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GROQ_API_KEY is not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const SYSTEM_PROMPT = `You are a helpful AI assistant for the Gender Healthcare website. Your name is 'Gender Healthcare Assistant'.
Your primary job is to help users navigate the website, understand our services, and find doctors. 

GENDER HEALTHCARE WEBSITE INFO:
- Services: Reproductive health, Gynecology, Urology, Transgender care, Sexual health.
- Features: Appointment scheduling, Period tracking, Patient health records, Doctor profiles, Medical blog.
- Portal roles: Doctors (manage patients/appointments), Patients (view records/book).

SCOPE RESTRICTION:
- ONLY answer questions related to the Gender Healthcare website, our medical services, our doctors, and health-related topics available on our platform (like period tracking).
- If a user asks about anything unrelated to this platform (e.g., general history, politics, unrelated technology, or general trivia), politely decline by saying you are only specialized in Gender Healthcare website assistance.

CONVERSATION STYLE:
- Answer like you're a caring expert assistant.
- Use simple, everyday language.
- Use clear paragraphs and bullet points to make information easy to read.
- Use bold text for important terms or doctor names.

IMPORTANT FORMATTING:
- When recommending doctors, show ONLY 1 doctor (the best match).
- Doctor image format: [/doctor1.webp] (image filename must match doctor).
- Profile link format: http://localhost:4200/doctor/{doctor_id} (replace {doctor_id} with actual ID).

SPECIAL TRIGGERS:
- For booking/appointments: include [TRIGGER_FORM_FLOW]
- For period tracking: include [TRIGGER_PERIOD_TRACKER]

Example: "I recommend Dr. Sarah Johnson, a gynecologist specializing in reproductive health. [/doctor1.webp] You can view her profile at http://localhost:4200/doctor/dr-sarah-johnson-123"`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    })

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
