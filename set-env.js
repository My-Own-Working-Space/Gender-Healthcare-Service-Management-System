const fs = require('fs');
const path = require('path');

// Target files for both apps
const targets = [
  'apps/product-web/src/app/environments/environment.prod.ts',
  'apps/management-web/src/app/environments/environment.prod.ts'
];

// Configuration template
const envConfigFile = (url, key, api, mock, storage) => `export const environment = {
  production: true,
  supabaseUrl: "${url || 'https://ldmcdielxskywugyohrq.supabase.co'}",
  supabaseKey: "${key || ''}",
  apiEndpoint: "${api || (url ? url + '/functions/v1' : 'https://ldmcdielxskywugyohrq.supabase.co/functions/v1')}",
  mockEndpoint: "${mock || ''}",
  supabaseAnonKey: "${key || ''}",
  supabaseStorageUrl: "${storage || (url ? url + '/storage/v1/object/public/' : 'https://ldmcdielxskywugyohrq.supabase.co/storage/v1/object/public/')}",
  authCallbackUrl: "/auth/callback"
};
`;

console.log('🛠️  Generating environment files from Vercel variables...');

targets.forEach(targetPath => {
  const fullPath = path.resolve(__dirname, targetPath);
  
  // Create directory if it doesn't exist
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const content = envConfigFile(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY,
    process.env.API_ENDPOINT,
    process.env.MOCK_ENDPOINT,
    process.env.SUPABASE_STORAGE_URL
  );

  fs.writeFileSync(fullPath, content);
  console.log(`✅  Updated ${targetPath}`);
});
