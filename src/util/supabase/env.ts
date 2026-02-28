const SUPABASE_FALLBACK_URL = "https://placeholder.supabase.co";
const SUPABASE_FALLBACK_ANON_KEY = "missing-supabase-anon-key";

let hasWarnedMissingSupabaseEnv = false;

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey) {
    return { url, anonKey, configured: true as const };
  }

  if (!hasWarnedMissingSupabaseEnv) {
    hasWarnedMissingSupabaseEnv = true;
    console.warn(
      "[supabase] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Using placeholder values to avoid runtime crash."
    );
  }

  return {
    url: url || SUPABASE_FALLBACK_URL,
    anonKey: anonKey || SUPABASE_FALLBACK_ANON_KEY,
    configured: false as const,
  };
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
