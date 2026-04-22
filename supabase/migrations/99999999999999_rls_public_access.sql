-- Enable RLS on all public tables
ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."staff_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."medical_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."doctor_details" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."service_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."slots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."doctor_slot_assignments" ENABLE ROW LEVEL SECURITY;

-- Create Public Read Policies (Allow Anon to read)
DROP POLICY IF EXISTS "Public Read Blog Posts" ON "public"."blog_posts";
CREATE POLICY "Public Read Blog Posts" ON "public"."blog_posts" FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public Read Staff Members" ON "public"."staff_members";
CREATE POLICY "Public Read Staff Members" ON "public"."staff_members" FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public Read Medical Services" ON "public"."medical_services";
CREATE POLICY "Public Read Medical Services" ON "public"."medical_services" FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public Read Doctor Details" ON "public"."doctor_details";
CREATE POLICY "Public Read Doctor Details" ON "public"."doctor_details" FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public Read Service Categories" ON "public"."service_categories";
CREATE POLICY "Public Read Service Categories" ON "public"."service_categories" FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public Read Slots" ON "public"."slots";
CREATE POLICY "Public Read Slots" ON "public"."slots" FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public Read Slot Assignments" ON "public"."doctor_slot_assignments";
CREATE POLICY "Public Read Slot Assignments" ON "public"."doctor_slot_assignments" FOR SELECT TO anon USING (true);

-- Ensure RPCs are also accessible to anon
GRANT USAGE ON SCHEMA "public" TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA "public" TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "public" TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA "public" TO anon;
