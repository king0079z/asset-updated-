import React, { createContext, useState, ReactNode, useContext, useEffect } from 'react';
import { createClient } from '@/util/supabase/component';
import { User, Provider } from '@supabase/supabase-js';
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from 'next/router';
import { enhancedFetch } from '@/util/connectivity';

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
  const supabase = createClient();
  const { toast } = useToast();

  React.useEffect(() => {
    const fetchSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setInitializing(false);
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      setInitializing(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

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
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
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
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
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
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
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