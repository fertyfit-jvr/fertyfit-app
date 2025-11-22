import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zoanaxbpbklpbhtcqiwb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvYW5heGJwYmtscGJodGNxaXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NDkyOTAsImV4cCI6MjA3OTIyNTI5MH0.LwcDeVL-qdr3lf5lqpNnvZW3j16oJqjoyhFHOpM2vtU';

export const supabase = createClient(supabaseUrl, supabaseKey);