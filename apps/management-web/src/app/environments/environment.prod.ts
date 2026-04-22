export const environment = {
    production: true,
    supabaseUrl: 'https://ldmcdielxskywugyohrq.supabase.co',
    supabaseKey: 'sb_publishable_4PoXxbvFyOd1NzUBf7iruw_jj77_Wex',
    apiEndpoint: 'https://ldmcdielxskywugyohrq.supabase.co/functions/v1',
    mockEndpoint: '',  // Disabled in production
    authorization: 'sb_publishable_4PoXxbvFyOd1NzUBf7iruw_jj77_Wex',

    // Production-specific settings
    enableDevMode: false,
    enableDebugInfo: false,
    logLevel: 'error', // Only log errors in production

    // Performance settings
    cacheTimeout: 300000, // 5 minutes cache
    imageCompressionQuality: 0.8,
    maxUploadSize: 5 * 1024 * 1024, // 5MB
};
