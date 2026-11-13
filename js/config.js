// Supabase connection for the site and the admin panel.
// Paste your project's values from Supabase: Project Settings > API (README step 5).
// The anon key is PUBLIC by design: it is safe in this file because row-level security
// (supabase/setup.sql) lets it read only. NEVER put the service_role key here or anywhere in this repo.
export const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
