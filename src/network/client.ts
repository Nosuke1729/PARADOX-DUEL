import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let sharedClient: SupabaseClient | undefined

export function supabaseClient(): SupabaseClient {
  if (sharedClient) return sharedClient
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Supabase 設定がありません。.env.local を確認してください。')
  sharedClient = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  return sharedClient
}
