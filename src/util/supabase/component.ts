import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseEnv } from './env'

export function createClient() {
  const { url, anonKey } = getSupabaseEnv()
  const supabase = createBrowserClient(
    url,
    anonKey,
    {
      cookieOptions: {
        domain: process.env.NEXT_PUBLIC_CO_DEV_ENV === "preview" ? ".preview.co.dev" : undefined,
      }
    }
  )

  return supabase
}