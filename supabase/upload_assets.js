require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ldmcdielxskywugyohrq.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const doctorImages = [
  path.join(__dirname, '../apps/product-web/doctor-assets/doctor_1.png'),
  path.join(__dirname, '../apps/product-web/doctor-assets/doctor_2.png'),
  path.join(__dirname, '../apps/product-web/doctor-assets/doctor_3.png')
];

const serviceImage = '/home/minhchau/.gemini/antigravity/brain/e9038e8a-f6f2-4982-ab55-21ad305e9e86/service_bg_1776852507537.png';

async function setupStorage() {
  console.log('🚀 Starting asset upload and linking...');

  // 1. Create buckets if they don't exist
  const buckets = ['staff-uploads', 'service-uploads'];
  for (const b of buckets) {
    const { data: bucket, error } = await supabase.storage.getBucket(b);
    if (error && error.message.includes('not found')) {
      console.log(`Creating bucket: ${b}`);
      await supabase.storage.createBucket(b, { public: true });
    } else {
      console.log(`Bucket ${b} already exists`);
    }
  }

  // 2. Upload Doctor Images
  const docUrls = [];
  for (let i = 0; i < doctorImages.length; i++) {
    const filePath = doctorImages[i];
    const fileName = `doctor_${i + 1}.jpg`;
    const fileContent = fs.readFileSync(filePath);
    
    console.log(`Uploading ${fileName}...`);
    const { data, error } = await supabase.storage.from('staff-uploads').upload(fileName, fileContent, {
      contentType: 'image/jpeg',
      upsert: true
    });

    if (error) {
      console.error(`Error uploading ${fileName}:`, error.message);
    } else {
      docUrls.push(fileName);
    }
  }

  // 3. Upload Service Image
  const serviceFileName = 'service_bg.png';
  const serviceFileContent = fs.readFileSync(serviceImage);
  console.log('Uploading service background...');
  const { error: sError } = await supabase.storage.from('service-uploads').upload(serviceFileName, serviceFileContent, {
    contentType: 'image/png',
    upsert: true
  });
  if (sError) console.error('Error uploading service bg:', sError.message);

  // 4. Update Database
  console.log('Linking assets in database...');

  // Get first 3 doctors
  const { data: doctors, error: dError } = await supabase
    .from('staff_members')
    .select('staff_id')
    .eq('role', 'doctor')
    .limit(3);

  if (dError) {
    console.error('Error fetching doctors:', dError.message);
  } else {
    for (let i = 0; i < doctors.length; i++) {
      if (docUrls[i]) {
        await supabase
          .from('staff_members')
          .update({ image_link: docUrls[i] })
          .eq('staff_id', doctors[i].staff_id);
        console.log(`Linked doctor ${doctors[i].staff_id} to ${docUrls[i]}`);
      }
    }
  }

  // Update services
  const { data: services, error: svError } = await supabase
    .from('medical_services')
    .select('service_id')
    .limit(5);

  if (svError) {
    console.error('Error fetching services:', svError.message);
  } else {
    for (const sv of services) {
      await supabase
        .from('medical_services')
        .update({ image_link: '/service-bg.png' }) // Using a generic path prefix logic if needed
        .eq('service_id', sv.service_id);
        // Wait, the app might expect a full path or just the name depending on how getFullImageUrl is implemented.
        // I saw in DoctorHeaderComponent: return `${supabaseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
    }
    // Correcting the service image link to match bucket expectation
    await supabase.rpc('execute_sql', {
      query: `UPDATE medical_services SET image_link = 'service_bg.png' WHERE image_link IS NULL OR image_link = ''`
    });
  }

  console.log('✅ Done!');
}

setupStorage();
