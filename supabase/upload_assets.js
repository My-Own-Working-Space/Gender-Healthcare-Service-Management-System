require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const assetsDir = path.join(__dirname, '../apps/product-web/doctor-assets');

async function uploadAll() {
  console.log('🚀 Starting robust asset upload...');

  // 1. Ensure buckets
  const buckets = ['staff-uploads', 'service-uploads'];
  for (const b of buckets) {
    try {
      await supabase.storage.createBucket(b, { public: true });
    } catch (e) {
      // Ignore bucket already exists
    }
  }

  // 2. Upload all files in doctor-assets
  const files = fs.readdirSync(assetsDir);
  console.log(`Found ${files.length} files in doctor-assets`);

  for (const file of files) {
    const filePath = path.join(assetsDir, file);
    const fileContent = fs.readFileSync(filePath);
    const contentType = file.endsWith('.png') ? 'image/png' : 'image/jpeg';

    console.log(`Uploading ${file}...`);
    await supabase.storage.from('staff-uploads').upload(file, fileContent, {
      contentType,
      upsert: true
    });
  }

  // 3. Special: Service image
  const serviceImage = '/home/minhchau/.gemini/antigravity/brain/e9038e8a-f6f2-4982-ab55-21ad305e9e86/service_bg_1776852507537.png';
  if (fs.existsSync(serviceImage)) {
    console.log('Uploading service background...');
    const content = fs.readFileSync(serviceImage);
    await supabase.storage.from('service-uploads').upload('service_bg.png', content, {
      contentType: 'image/png',
      upsert: true
    });
  }

  // 4. Update Database to match filenames (doctor_N.png)
  console.log('Syncing database image links...');
  
  const updateQuery = `
    UPDATE staff_members 
    SET image_link = regexp_replace(image_link, '/?doctor([0-9]+)\\..*', 'doctor_\\1.png')
    WHERE image_link LIKE '%doctor%';
  `;
  
  let sqlError = null;
  try {
    const { error } = await supabase.rpc('execute_sql', { query: updateQuery });
    sqlError = error;
  } catch (e) {
    sqlError = e;
  }
  
  if (sqlError) {
    console.warn('SQL sync via RPC failed, trying direct update...');
    // Fallback: Fetch all and update
    const { data: staff } = await supabase.from('staff_members').select('staff_id, image_link');
    if (staff) {
      for (const s of staff) {
        if (s.image_link && s.image_link.includes('doctor')) {
          const match = s.image_link.match(/doctor(\d+)/);
          if (match) {
            const newLink = `doctor_${match[1]}.png`;
            await supabase.from('staff_members').update({ image_link: newLink }).eq('staff_id', s.staff_id);
          }
        }
      }
    }
  }

  // Ensure services use the correct link
  try {
    const { error: sSqlError } = await supabase.rpc('execute_sql', {
      query: "UPDATE medical_services SET image_link = 'service_bg.png' WHERE image_link IS NULL OR image_link = '' OR image_link LIKE '%service%'"
    });
    if (sSqlError) throw sSqlError;
  } catch (e) {
    console.warn('SQL sync for services via RPC failed, trying direct update...');
    const { data: services } = await supabase.from('medical_services').select('service_id, image_link');
    if (services) {
      for (const sv of services) {
        if (!sv.image_link || sv.image_link === '' || sv.image_link.includes('service')) {
          await supabase.from('medical_services').update({ image_link: 'service_bg.png' }).eq('service_id', sv.service_id);
        }
      }
    }
  }

  console.log('✅ Asset sync complete!');
}

uploadAll();
