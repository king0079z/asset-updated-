import { supabase } from './supabase';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

export async function signInWithMicrosoft() {
  const redirectUri = makeRedirectUri({ scheme: 'assetxai', path: 'auth/callback' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo: redirectUri,
      scopes: 'email profile openid User.Read',
    },
  });

  if (error) throw error;

  if (data?.url) {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
    if (result.type === 'success') {
      const params = new URLSearchParams(result.url.split('#')[1] || result.url.split('?')[1] || '');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken || '' });
      }
    }
  }
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
