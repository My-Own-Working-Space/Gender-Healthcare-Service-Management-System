const fs = require('fs');
const path = require('path');

const target = 'src/app/environments/environment.prod.ts';

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

const fullPath = path.resolve(__dirname, target);
const content = envConfigFile(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY,
  process.env.API_ENDPOINT,
  process.env.MOCK_ENDPOINT,
  process.env.SUPABASE_STORAGE_URL
);

fs.writeFileSync(fullPath, content);
console.log(`✅ Updated ${target}`);
