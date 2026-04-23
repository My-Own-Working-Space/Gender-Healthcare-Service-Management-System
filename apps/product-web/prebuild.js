const fs = require('fs');
const path = require('path');

const target = 'src/app/environments/environment.prod.ts';

console.log('🚀 PREBUILD: Starting environment variable injection...');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const apiEndpoint = process.env.API_ENDPOINT;
const mockEndpoint = process.env.MOCK_ENDPOINT;
const storageUrl = process.env.SUPABASE_STORAGE_URL;

console.log(`📡 PREBUILD: Detected SUPABASE_URL: ${supabaseUrl ? 'FOUND' : 'MISSING'}`);
console.log(`📡 PREBUILD: Detected SUPABASE_KEY: ${supabaseKey ? 'FOUND' : 'MISSING'}`);

const envConfigFile = `export const environment = {
  production: true,
  supabaseUrl: "${supabaseUrl || 'https://ldmcdielxskywugyohrq.supabase.co'}",
  supabaseKey: "${supabaseKey || ''}",
  apiEndpoint: "${apiEndpoint || (supabaseUrl ? supabaseUrl + '/functions/v1' : 'https://ldmcdielxskywugyohrq.supabase.co/functions/v1')}",
  mockEndpoint: "${mockEndpoint || ''}",
  supabaseAnonKey: "${supabaseKey || ''}",
  supabaseStorageUrl: "${storageUrl || (supabaseUrl ? supabaseUrl + '/storage/v1/object/public/' : 'https://ldmcdielxskywugyohrq.supabase.co/storage/v1/object/public/')}",
  authCallbackUrl: "/auth/callback"
};
`;

try {
  const fullPath = path.resolve(__dirname, target);
  fs.writeFileSync(fullPath, envConfigFile);
  console.log(`✅ PREBUILD: Successfully updated ${target}`);
  
  // Verify content
  const check = fs.readFileSync(fullPath, 'utf8');
  if (check.includes('your-project.supabase.co')) {
    console.error('❌ PREBUILD ERROR: Placeholders still present in file!');
  } else {
    console.log('✨ PREBUILD: Verified file content is updated.');
  }
} catch (err) {
  console.error('❌ PREBUILD FATAL ERROR:', err);
  process.exit(1);
}
