import React, { createContext, useState, ReactNode, useContext, useEffect } from 'react';
import { createClient } from '@/util/supabase/component';
import { useAuth } from './AuthContext';
import { useToast } from "@/components/ui/use-toast";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  invitedEmail?: string;
  inviteAccepted: boolean;
  createdAt: string;
  updatedAt: string;
  organization: Organization;
}

interface Subscription {
  id: string;
  organizationId: string;
  plan: 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
  startDate: string;
  endDate?: string;
  isActive: boolean;
  maxUsers: number;
  maxKitchens: number;
  maxRecipes: number;
  maxAssets: number;
  features: Record<string, any>;
  licenseKey?: string;
  licenseKeyCreatedAt?: string;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  userOrganizations: OrganizationMember[];
  subscription: Subscription | null;
  switchOrganization: (organizationId: string) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  createOrganization: (name: string) => Promise<Organization>;
  inviteUser: (email: string, role: string) => Promise<void>;
  updateOrganization: (id: string, updates: Partial<Organization>) => Promise<void>;
  loading: boolean;
}

export const OrganizationContext = createContext<OrganizationContextType>({
  currentOrganization: null,
  userOrganizations: [],
  subscription: null,
  switchOrganization: async () => {},
  refreshOrganizations: async () => {},
  createOrganization: async () => ({} as Organization),
  inviteUser: async () => {},
  updateOrganization: async () => {},
  loading: false,
});

export const OrganizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();
  
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<OrganizationMember[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);

  // Load user's organizations when user changes
  useEffect(() => {
    if (user) {
      refreshOrganizations();
    } else {
      setCurrentOrganization(null);
      setUserOrganizations([]);
      setSubscription(null);
    }
  }, [user]);

  const refreshOrganizations = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get user's organization memberships
      const { data: memberships, error: memberError } = await supabase
        .from('OrganizationMember')
        .select(`
          *,
          organization:Organization(*)
        `)
        .eq('userId', user.id)
        .eq('inviteAccepted', true);

      if (memberError) {
        console.error('Error fetching organizations:', memberError);
        return;
      }

      setUserOrganizations(memberships || []);

      // Set current organization (first one or from localStorage)
      const savedOrgId = localStorage.getItem('currentOrganizationId');
      let targetOrg = null;

      if (savedOrgId) {
        targetOrg = memberships?.find(m => m.organizationId === savedOrgId);
      }
      
      if (!targetOrg && memberships && memberships.length > 0) {
        targetOrg = memberships[0];
      }

      if (targetOrg) {
        setCurrentOrganization(targetOrg.organization);
        localStorage.setItem('currentOrganizationId', targetOrg.organizationId);
        
        // Load subscription for current organization
        await loadSubscription(targetOrg.organizationId);
      }
    } catch (error) {
      console.error('Error refreshing organizations:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load organizations",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSubscription = async (organizationId: string) => {
    try {
      const { data: sub, error } = await supabase
        .from('Subscription')
        .select('*')
        .eq('organizationId', organizationId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading subscription:', error);
        return;
      }

      setSubscription(sub);
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const switchOrganization = async (organizationId: string) => {
    const membership = userOrganizations.find(m => m.organizationId === organizationId);
    if (!membership) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Organization not found",
      });
      return;
    }

    setCurrentOrganization(membership.organization);
    localStorage.setItem('currentOrganizationId', organizationId);
    
    // Load subscription for new organization
    await loadSubscription(organizationId);

    toast({
      title: "Success",
      description: `Switched to ${membership.organization.name}`,
    });
  };

  const createOrganization = async (name: string): Promise<Organization> => {
    if (!user) throw new Error('User not authenticated');

    try {
      const slug = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).substring(2, 7)}`;
      
      // Create organization
      const { data: newOrg, error: orgError } = await supabase
        .from('Organization')
        .insert({
          name,
          slug,
          status: 'ACTIVE',
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Create subscription
      const { error: subError } = await supabase
        .from('Subscription')
        .insert({
          organizationId: newOrg.id,
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

      // Create membership for current user as owner
      const { error: memberError } = await supabase
        .from('OrganizationMember')
        .insert({
          organizationId: newOrg.id,
          userId: user.id,
          role: 'OWNER',
          inviteAccepted: true,
        });

      if (memberError) throw memberError;

      // Refresh organizations
      await refreshOrganizations();

      toast({
        title: "Success",
        description: `Organization "${name}" created successfully`,
      });

      return newOrg;
    } catch (error: any) {
      console.error('Error creating organization:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create organization",
      });
      throw error;
    }
  };

  const inviteUser = async (email: string, role: string) => {
    if (!currentOrganization) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No organization selected",
      });
      return;
    }

    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('User')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        // User exists, create membership directly
        const { error } = await supabase
          .from('OrganizationMember')
          .insert({
            organizationId: currentOrganization.id,
            userId: existingUser.id,
            role,
            inviteAccepted: true,
          });

        if (error) throw error;
      } else {
        // User doesn't exist, create invitation
        const { error } = await supabase
          .from('OrganizationMember')
          .insert({
            organizationId: currentOrganization.id,
            invitedEmail: email,
            role,
            inviteAccepted: false,
          });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Invitation sent to ${email}`,
      });
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to invite user",
      });
    }
  };

  const updateOrganization = async (id: string, updates: Partial<Organization>) => {
    try {
      const { error } = await supabase
        .from('Organization')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Update local state
      if (currentOrganization?.id === id) {
        setCurrentOrganization({ ...currentOrganization, ...updates });
      }

      // Update in organizations list
      setUserOrganizations(prev => 
        prev.map(membership => 
          membership.organizationId === id 
            ? { ...membership, organization: { ...membership.organization, ...updates } }
            : membership
        )
      );

      toast({
        title: "Success",
        description: "Organization updated successfully",
      });
    } catch (error: any) {
      console.error('Error updating organization:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update organization",
      });
    }
  };

  return (
    <OrganizationContext.Provider value={{
      currentOrganization,
      userOrganizations,
      subscription,
      switchOrganization,
      refreshOrganizations,
      createOrganization,
      inviteUser,
      updateOrganization,
      loading,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => useContext(OrganizationContext);