export const environment = {
    production: true,
    supabaseUrl: 'https://ldmcdielxskywugyohrq.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6eHhvZHhwbHlldGVjcnNieG1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MTE2MjAsImV4cCI6MjA2NTE4NzYyMH0.O60A63ihSaQ_2qbLozpU04yy7ZB5h8BUZqEvWWCLnf0',
    apiEndpoint: 'https://ldmcdielxskywugyohrq.supabase.co/functions/v1',
    mockEndpoint: '',  // Disabled in production
    authorization: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6eHhvZHhwbHlldGVjcnNieG1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MTE2MjAsImV4cCI6MjA2NTE4NzYyMH0.O60A63ihSaQ_2qbLozpU04yy7ZB5h8BUZqEvWWCLnf0',

    // Production-specific settings
    enableDevMode: false,
    enableDebugInfo: false,
    logLevel: 'error', // Only log errors in production

    // Performance settings
    cacheTimeout: 300000, // 5 minutes cache
    imageCompressionQuality: 0.8,
    maxUploadSize: 5 * 1024 * 1024, // 5MB
};
