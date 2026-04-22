export const environment = {
  production: false,
  supabaseUrl: (globalThis as any).ENV?.SUPABASE_URL || 'https://YOUR_PROJECT_REF.supabase.co',
  supabaseKey: (globalThis as any).ENV?.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY',
  apiEndpoint: (globalThis as any).ENV?.API_ENDPOINT || 'https://YOUR_PROJECT_REF.supabase.co/functions/v1',
  mockEndpoint: (globalThis as any).ENV?.MOCK_ENDPOINT || 'https://your-mock-id.mock.pstmn.io',
  authorization: (globalThis as any).ENV?.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY',
};
