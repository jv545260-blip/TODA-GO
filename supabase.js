import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// This is a publishable/anon client key, not a service-role secret.
// Never put a Supabase service-role key in browser code.
export const supabase = url && key && !url.includes('YOUR_PROJECT') && !key.includes('YOUR_SUPABASE')
  ? createClient(url, key)
  : null;