import { createClient as createClientPrimitive } from '@supabase/supabase-js'
import { getSupabaseEnv } from './env'

export function createClient() {
  const { url, anonKey } = getSupabaseEnv()
  const supabase = createClientPrimitive(
    url,
    anonKey
  )

  return supabase
}