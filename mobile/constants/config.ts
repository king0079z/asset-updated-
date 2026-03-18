/**
 * App configuration. Override EXPO_PUBLIC_* in .env or EAS secrets for production.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_SITE_URL || 'https://assetxai.live';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isConfigValid = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
