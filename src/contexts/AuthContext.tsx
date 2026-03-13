import React, { createContext, useState, ReactNode, useContext, useEffect } from 'react';
import { createClient } from '@/util/supabase/component';
import { User, Provider } from '@supabase/supabase-js';
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from 'next/router';
import { enhancedFetch } from '@/util/connectivity';
import { isSupabaseConfigured } from '@/util/supabase/env';
import { clearCache } from '@/lib/api-cache';

interface AuthContextType {
  user: User | null;
  createUser: (user: User) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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
  const getSiteUrl = () =>
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || '';

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
      // Use replace so the user can't go Back to a broken authenticated state
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
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
      const { data, error } = await supabase
        .from('User')
        .select('id, isAdmin, role, organizationId')
        .eq('id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      // Special case for admin@example.com - automatically set as admin and approved
      const isAdminEmail = user.email === 'admin@example.com';
      
      if (!data) {
        let organizationId = null;
        let userRole = isAdminEmail ? 'ADMIN' : 'STAFF';
        let memberRole = isAdminEmail ? 'OWNER' : 'MEMBER';
        
        // Check if user is invited to an organization
        const { data: inviteData, error: inviteError } = await supabase
          .from('OrganizationMember')
          .select('organizationId, role, inviteAccepted')
          .eq('invitedEmail', user.email)
          .maybeSingle();
          
        if (inviteError && inviteError.code !== 'PGRST116') {
          console.error('Error checking for invites:', inviteError);
        }
        
        if (inviteData) {
          // User was invited to an organization
          organizationId = inviteData.organizationId;
          memberRole = inviteData.role;
        } else {
          // Create a new organization for the user
          const orgName = `${user.email.split('@')[0]}'s Organization`;
          const slug = `${user.email.split('@')[0]}-${Math.random().toString(36).substring(2, 7)}`.toLowerCase();
          
          const { data: newOrg, error: orgError } = await supabase
            .from('Organization')
            .insert({
              name: orgName,
              slug: slug,
              status: 'ACTIVE',
            })
            .select()
            .single();
            
          if (orgError) {
            console.error('Error creating organization:', orgError);
            throw orgError;
          }
          
          organizationId = newOrg.id;
          memberRole = 'OWNER';
          
          // Create a subscription for the new organization
          const { error: subError } = await supabase
            .from('Subscription')
            .insert({
              organizationId: organizationId,
              plan: 'FREE',
              isActive: true,
              maxUsers: 5,
              maxKitchens: 2,
              maxRecipes: 50,
              maxAssets: 100,
              features: {},
            });
            
          if (subError) {
            console.error('Error creating subscription:', subError);
          }
        }
        
        // Create the user with organization
        const { error: insertError } = await supabase
          .from('User')
          .insert({
            id: user.id,
            email: user.email,
            status: isAdminEmail ? 'APPROVED' : 'PENDING',
            isAdmin: isAdminEmail,
            role: userRole,
            pageAccess: isAdminEmail ? {} : null,
            canDeleteDocuments: isAdminEmail, // Admin can delete documents by default
            organizationId: organizationId,
          });
        if (insertError) {
          throw insertError;
        }
        
        // Create organization membership
        const { error: memberError } = await supabase
          .from('OrganizationMember')
          .insert({
            organizationId: organizationId,
            userId: user.id,
            role: memberRole,
            inviteAccepted: true,
          });
          
        if (memberError) {
          console.error('Error creating organization membership:', memberError);
        }
        
        // If user was invited, update the invitation
        if (inviteData) {
          const { error: updateInviteError } = await supabase
            .from('OrganizationMember')
            .update({
              userId: user.id,
              inviteAccepted: true,
            })
            .eq('invitedEmail', user.email);
            
          if (updateInviteError) {
            console.error('Error accepting invitation:', updateInviteError);
          }
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create user profile",
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password
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
    const siteUrl = getSiteUrl();
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
    const siteUrl = getSiteUrl();
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