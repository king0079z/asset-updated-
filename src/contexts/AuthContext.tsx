import React, { createContext, useState, ReactNode, useContext, useEffect } from 'react';
import { createClient } from '@/util/supabase/component';
import { User, Provider } from '@supabase/supabase-js';
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from 'next/router';
import { enhancedFetch } from '@/util/connectivity';
import { isSupabaseConfigured } from '@/util/supabase/env';
import { clearCache } from '@/lib/api-cache';
import { getPublicSiteUrl } from '@/lib/site-url';

interface AuthContextType {
  user: User | null;
  createUser: (user: User) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  initializing: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  createUser: async () => {},
  signIn: async () => {},
  signUp: async () => {},
  signInWithMagicLink: async () => {},
  signInWithGoogle: async () => {},
  signInWithMicrosoft: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
  refreshUser: async () => {},
  initializing: false
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const supabaseConfigured = isSupabaseConfigured();
  const supabase = createClient();
  const { toast } = useToast();
  const ensureSupabaseConfigured = () => {
    if (supabaseConfigured) return true;
    toast({
      variant: "destructive",
      title: "Missing configuration",
      description: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env to enable authentication.",
    });
    return false;
  };

  React.useEffect(() => {
    if (!supabaseConfigured) {
      setUser(null);
      setInitializing(false);
      return;
    }

    const forceSignOut = async (reason = 'Session expired') => {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Auth] ${reason} — clearing session and redirecting to login`);
      }
      clearCache();
      try { await supabase.auth.signOut(); } catch { /* already gone */ }
      setUser(null);
      setInitializing(false);
      // Use replace so the user can't go Back to a broken authenticated state.
      // Skip redirect for Outlook add-in pages — they handle auth themselves in an iframe.
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/outlook')
      ) {
        window.location.replace('/login');
      }
    };

    const isTokenError = (msg: string = '') =>
      msg.toLowerCase().includes('refresh token') ||
      msg.toLowerCase().includes('invalid token') ||
      msg.toLowerCase().includes('refresh_token_not_found') ||
      msg.toLowerCase().includes('token expired');

    const fetchSession = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          if (isTokenError(error.message) || (error as any).status === 401 || (error as any).status === 400) {
            // Silently handle — no console.error, just redirect
            await forceSignOut('Invalid refresh token detected on session load');
            return;
          }
        }
        setUser(user);
        setInitializing(false);
      } catch (err: any) {
        // Only log truly unexpected errors, not token refresh failures
        if (!isTokenError(err?.message)) {
          console.error('[Auth] Unexpected error fetching session:', err?.message);
        }
        await forceSignOut('Unexpected session error');
      }
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event: string, session) => {
      if (event === 'TOKEN_REFRESH_FAILED') {
        // Silently redirect — the Supabase client already logs internally
        await forceSignOut('Token refresh failed');
        return;
      }
      if (event === 'SIGNED_OUT') {
        clearCache();
      }
      setUser(session?.user ?? null);
      setInitializing(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase, supabaseConfigured]);

  const createUser = async (user: User) => {
    try {
      // Pass userId + email in the body so the server can verify via auth.users
      // even when there is no active session (e.g. email-confirmation required on signup).
      const res = await fetch('/api/users/provision', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, email: user?.email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[createUser] provision failed:', res.status, err);
        // Don't show a destructive toast on 401 during signup — the user just hasn't
        // confirmed their email yet and the record will be created on first sign-in.
        if (res.status !== 401) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: err?.error || 'Failed to create user profile. Try again or contact support.',
          });
        }
        return;
      }
    } catch (error) {
      console.error('[createUser]', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create user profile',
      });
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!ensureSupabaseConfigured()) return;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      await createUser(data.user);
    }
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      throw error;
    } else {
      toast({
        title: "Success",
        description: "You have successfully signed in",
      });
    }
  };

  const signUp = async (email: string, password: string) => {
    if (!ensureSupabaseConfigured()) return;
    const siteUrl = getPublicSiteUrl();
    if (!siteUrl) {
      toast({
        variant: 'destructive',
        title: 'Configuration error',
        description: 'Set NEXT_PUBLIC_SITE_URL to your live site (e.g. https://assetxai.live) in Vercel environment variables so confirmation emails use the correct link.',
      });
      throw new Error('NEXT_PUBLIC_SITE_URL is not set');
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (data.user) {
      await createUser(data.user);
    }

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      throw error;
    } else {
      toast({
        title: "Success",
        description: "Sign up successful! Please login to continue.",
      });
    }
  };

  const signInWithMagicLink = async (email: string) => {
    if (!ensureSupabaseConfigured()) return;
    const siteUrl = getPublicSiteUrl();
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${siteUrl}/dashboard`,
      },
    });
    if (!error && data.user) {
      await createUser(data.user);
    }
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      throw error;
    } else {
      toast({
        title: "Success",
        description: "Check your email for the login link",
      });
    }
  };

  const signInWithGoogle = async () => {
    if (!ensureSupabaseConfigured()) return;
    const siteUrl = getSiteUrl();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google' as Provider,
      options: {
        redirectTo: `${siteUrl}/auth/callback`
      }
    });
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      throw error;
    }
  };

  const signInWithMicrosoft = async () => {
    if (!ensureSupabaseConfigured()) return;
    const siteUrl = typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL || '');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure' as Provider,
      options: {
        scopes: 'email profile openid User.Read',
        redirectTo: `${siteUrl}/auth/callback`,
      },
    });
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Microsoft Sign-In Error',
        description: error.message,
      });
      throw error;
    }
  };

  const signOut = async () => {
    if (!ensureSupabaseConfigured()) return;
    clearCache();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({
        title: "Success",
        description: "You have successfully signed out",
      });
      router.push('/');
    }
  };

  const resetPassword = async (email: string) => {
    if (!ensureSupabaseConfigured()) return;
    const siteUrl = getPublicSiteUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      throw error;
    } else {
      toast({
        title: "Success",
        description: "Check your email for the password reset link",
      });
    }
  };

  const refreshUser = async () => {
    if (!supabaseConfigured) return;
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser(authUser);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      createUser,
      signIn,
      signUp,
      signInWithMagicLink,
      signInWithGoogle,
      signInWithMicrosoft,
      signOut,
      resetPassword,
      refreshUser,
      initializing,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);