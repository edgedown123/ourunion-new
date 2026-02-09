import { createClient } from '@supabase/supabase-js'

// Vite env (Vercel): set these in Vercel Project Settings → Environment Variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('[Supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // ✅ Keep login session on the device/browser
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
