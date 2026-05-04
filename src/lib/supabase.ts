import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://novfhetxargozmceelee.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vdmZoZXR4YXJnb3ptY2VlbGVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTkxMzgsImV4cCI6MjA5MzQ3NTEzOH0.JigOJowVLZ4e7STLnresbuKOuVMYRs15y9FG8M1JyDc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
