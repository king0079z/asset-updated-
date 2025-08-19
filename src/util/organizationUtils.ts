import { createClient } from '@/util/supabase/component';

/**
 * Utility functions for organization-scoped operations
 */

export interface OrganizationScopedQuery {
  organizationId: string;
}

/**
 * Get the current user's organization ID from the database
 */
export async function getCurrentUserOrganizationId(): Promise<string | null> {
  const supabase = createClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('User')
      .select('organizationId')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching user organization:', error);
      return null;
    }

    return data?.organizationId || null;
  } catch (error) {
    console.error('Error getting current user organization:', error);
    return null;
  }
}

/**
 * Create an organization-scoped query builder
 */
export function createOrganizationScopedQuery(tableName: string, organizationId: string) {
  const supabase = createClient();
  return supabase
    .from(tableName)
    .select('*')
    .eq('organizationId', organizationId);
}

/**
 * Validate that a user has access to a specific organization
 */
export async function validateOrganizationAccess(organizationId: string): Promise<boolean> {
  const supabase = createClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('OrganizationMember')
      .select('id')
      .eq('organizationId', organizationId)
      .eq('userId', user.id)
      .eq('inviteAccepted', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error validating organization access:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error validating organization access:', error);
    return false;
  }
}

/**
 * Get all organizations a user has access to
 */
export async function getUserOrganizations() {
  const supabase = createClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('OrganizationMember')
      .select(`
        *,
        organization:Organization(*)
      `)
      .eq('userId', user.id)
      .eq('inviteAccepted', true);

    if (error) {
      console.error('Error fetching user organizations:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching user organizations:', error);
    return [];
  }
}

/**
 * Check if user has a specific role in an organization
 */
export async function hasOrganizationRole(organizationId: string, requiredRole: string): Promise<boolean> {
  const supabase = createClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('OrganizationMember')
      .select('role')
      .eq('organizationId', organizationId)
      .eq('userId', user.id)
      .eq('inviteAccepted', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking organization role:', error);
      return false;
    }

    if (!data) return false;

    // Define role hierarchy
    const roleHierarchy = {
      'MEMBER': 1,
      'ADMIN': 2,
      'OWNER': 3
    };

    const userRoleLevel = roleHierarchy[data.role as keyof typeof roleHierarchy] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

    return userRoleLevel >= requiredRoleLevel;
  } catch (error) {
    console.error('Error checking organization role:', error);
    return false;
  }
}

/**
 * Get organization subscription details
 */
export async function getOrganizationSubscription(organizationId: string) {
  const supabase = createClient();
  
  try {
    const { data, error } = await supabase
      .from('Subscription')
      .select('*')
      .eq('organizationId', organizationId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching organization subscription:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching organization subscription:', error);
    return null;
  }
}

/**
 * Check if organization has reached a specific limit
 */
export async function checkOrganizationLimit(
  organizationId: string, 
  limitType: 'users' | 'kitchens' | 'recipes' | 'assets'
): Promise<{ hasReachedLimit: boolean; current: number; max: number }> {
  const supabase = createClient();
  
  try {
    // Get subscription limits
    const subscription = await getOrganizationSubscription(organizationId);
    if (!subscription) {
      return { hasReachedLimit: true, current: 0, max: 0 };
    }

    let current = 0;
    let max = 0;

    switch (limitType) {
      case 'users':
        max = subscription.maxUsers;
        const { count: userCount } = await supabase
          .from('OrganizationMember')
          .select('*', { count: 'exact', head: true })
          .eq('organizationId', organizationId)
          .eq('inviteAccepted', true);
        current = userCount || 0;
        break;

      case 'kitchens':
        max = subscription.maxKitchens;
        const { count: kitchenCount } = await supabase
          .from('Kitchen')
          .select('*', { count: 'exact', head: true })
          .eq('organizationId', organizationId);
        current = kitchenCount || 0;
        break;

      case 'recipes':
        max = subscription.maxRecipes;
        const { count: recipeCount } = await supabase
          .from('Recipe')
          .select('*', { count: 'exact', head: true })
          .eq('organizationId', organizationId);
        current = recipeCount || 0;
        break;

      case 'assets':
        max = subscription.maxAssets;
        const { count: assetCount } = await supabase
          .from('Asset')
          .select('*', { count: 'exact', head: true })
          .eq('organizationId', organizationId);
        current = assetCount || 0;
        break;
    }

    return {
      hasReachedLimit: current >= max,
      current,
      max
    };
  } catch (error) {
    console.error('Error checking organization limit:', error);
    return { hasReachedLimit: true, current: 0, max: 0 };
  }
}

/**
 * Middleware function to ensure organization access in API routes
 */
export async function withOrganizationAccess(
  req: any,
  organizationId: string
): Promise<{ hasAccess: boolean; user: any }> {
  const supabase = createClient();
  
  try {
    // Get user from request (assuming it's set by auth middleware)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return { hasAccess: false, user: null };
    }

    const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (error || !user) {
      return { hasAccess: false, user: null };
    }

    // Check organization access
    const hasAccess = await validateOrganizationAccess(organizationId);
    
    return { hasAccess, user };
  } catch (error) {
    console.error('Error in organization access middleware:', error);
    return { hasAccess: false, user: null };
  }
}