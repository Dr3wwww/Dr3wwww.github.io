// The one Supabase client, shared by the site and the admin panel.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const configured = !SUPABASE_URL.includes('YOUR-PROJECT-REF') && !SUPABASE_ANON_KEY.includes('YOUR-ANON');
export const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
export const BUCKET = 'portfolio';

const byOrder = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.created_at).localeCompare(String(b.created_at));

// Everything the public page shows, in one round of parallel reads.
export async function loadAll() {
  const tables = ['social_links', 'skill_categories', 'skills', 'projects', 'education', 'certifications'];
  const [profile, ...rows] = await Promise.all([
    supabase.from('profile').select('*').eq('id', 1).maybeSingle(),
    ...tables.map(t => supabase.from(t).select('*'))
  ]);
  const err = [profile, ...rows].find(r => r.error);
  if (err) throw err.error;
  const data = { profile: profile.data || {} };
  tables.forEach((t, i) => { data[t] = (rows[i].data || []).sort(byOrder); });
  return data;
}
