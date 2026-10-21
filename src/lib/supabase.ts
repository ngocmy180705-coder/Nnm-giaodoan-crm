import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// Falls back to a dummy URL so the app still renders (and pages show an ErrorState) when .env.local is missing.
export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-anon-key')
