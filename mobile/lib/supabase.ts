import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants/config';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  const url = SUPABASE_URL?.trim();
  const key = SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Set them in mobile/.env for local builds, or in Expo → Environment variables / `eas env:create` for EAS builds.'
    );
  }
  if (!client) {
    client = createClient(url, key, {
      auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/**
 * Lazy proxy so missing env never runs `createClient` at import time.
 * EAS production builds omit .env unless EXPO_PUBLIC_* are set on the project — a top-level
 * createClient('', '') throws immediately and looks like an instant app crash.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const c = getSupabaseClient();
    const value = Reflect.get(c as unknown as object, prop, receiver);
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(c);
    }
    return value;
  },
});
