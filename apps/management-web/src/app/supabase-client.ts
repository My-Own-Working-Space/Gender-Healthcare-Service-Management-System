import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ldmcdielxskywugyohrq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6eHhvZHhwbHlldGVjcnNieG1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MTE2MjAsImV4cCI6MjA2NTE4NzYyMH0.O60A63ihSaQ_2qbLozpU04yy7ZB5h8BUZqEvWWCLnf0';

export const supabase = createClient(supabaseUrl, supabaseKey);
