import { createClient } from '@/util/supabase/component';

/**
 * Checks if a user has access to a specific page
 * 
 * @param userId The user ID to check permissions for
 * @param pagePath The path of the page to check access for
 * @returns Promise resolving to a boolean indicating if the user has access
 */
export async function checkPageAccess(userId: string, pagePath: string): Promise<boolean> {
  if (!userId) return false;
  
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('User')
      .select('isAdmin, role, pageAccess, status, customRoleId')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error checking page access:', error);
      return false;
    }
    
    // Admin has access to all pages
    if (data.isAdmin) {
      console.log(`[checkPageAccess] User ${userId} is admin, granting access to ${pagePath}`);
      return true;
    }
    
    // Manager has access to all pages except admin settings
    if (data.role === 'MANAGER' && !pagePath.startsWith('/admin')) {
      console.log(`[checkPageAccess] User ${userId} is manager, granting access to ${pagePath}`);
      return true;
    }
    
    // Check if user is a supervisor (has a custom role with "supervisor" in the name)
    if (data.customRoleId) {
      const { data: customRoleData, error: customRoleError } = await supabase
        .from('CustomRole')
        .select('name')
        .eq('id', data.customRoleId)
        .single();
      
      if (!customRoleError && customRoleData && customRoleData.name.toLowerCase().includes('supervisor')) {
        // Supervisors have access to staff-activity page and other monitoring pages
        if (pagePath === '/staff-activity' || pagePath.startsWith('/staff-activity/')) {
          console.log(`[checkPageAccess] User ${userId} is supervisor, granting access to ${pagePath}`);
          return true;
        }
      }
    }
    
    // Check if user is approved
    if (data.status !== 'APPROVED') {
      console.log(`[checkPageAccess] User ${userId} has status ${data.status}, denying access`);
      return false;
    }
    
    // Special case: Always allow approved users to access dashboard
    if (pagePath === '/dashboard') {
      console.log(`[checkPageAccess] Special case: Always granting dashboard access to approved user ${userId}`);
      return true;
    }
    
    // Check page access from the pageAccess JSON field
    if (data.pageAccess && Object.keys(data.pageAccess).length > 0) {
      // Direct match
      if (data.pageAccess[pagePath] === true) {
        console.log(`[checkPageAccess] Direct page access match for ${pagePath}`);
        return true;
      }
      
      // Check for dynamic route access
      const pathParts = pagePath.split('/');
      if (pathParts.length > 2) {
        // Try to match dynamic routes
        const dynamicPath = pathParts.slice(0, -1).join('/') + '/[id]';
        if (data.pageAccess[dynamicPath] === true) {
          console.log(`[checkPageAccess] Dynamic route access match for ${pagePath} via ${dynamicPath}`);
          return true;
        }
        
        // Also check parent path
        const parentPath = `${pathParts[0]}/${pathParts[1]}`;
        if (data.pageAccess[parentPath] === true) {
          console.log(`[checkPageAccess] Parent path access match for ${pagePath} via ${parentPath}`);
          return true;
        }
      }
      
      // Special case for dashboard via root permission
      if (data.pageAccess['/']) {
        console.log(`[checkPageAccess] Special case: granting access to ${pagePath} via root permission`);
        return true;
      }
    } else {
      console.log(`[checkPageAccess] No pageAccess object or empty permissions for user ${userId}`);
    }
    
    return false;
  } catch (error) {
    console.error('Error in checkPageAccess:', error);
    return false;
  }
}

/**
 * Hook to check if the current user has access to a specific page
 * This is a client-side utility that can be used in components
 * 
 * @param user The user object from AuthContext
 * @param pagePath The path of the page to check access for
 * @returns Boolean indicating if the user has access based on cached data
 */
export function hasPageAccess(user: any, pagePath: string, isAdmin: boolean, pageAccess: any, role?: string, customRole?: any): boolean {
  if (!user) return false;
  
  // Admin has access to all pages
  if (isAdmin) return true;
  
  // Manager has access to all pages except admin settings
  if (role === 'MANAGER' && !pagePath.startsWith('/admin')) {
    return true;
  }
  
  // Check if user is a supervisor (has a custom role with "supervisor" in the name)
  if (customRole && customRole.name && customRole.name.toLowerCase().includes('supervisor')) {
    // Supervisors have access to staff-activity page and other monitoring pages
    if (pagePath === '/staff-activity' || pagePath.startsWith('/staff-activity/')) {
      return true;
    }
  }
  
  // Special case: Always allow access to dashboard
  if (pagePath === '/dashboard') {
    return true;
  }
  
  // Check page access from the pageAccess JSON field
  if (pageAccess && Object.keys(pageAccess).length > 0) {
    // Direct match
    if (pageAccess[pagePath] === true) {
      return true;
    }
    
    // Check for dynamic route access
    const pathParts = pagePath.split('/');
    if (pathParts.length > 2) {
      // Try to match dynamic routes
      const dynamicPath = pathParts.slice(0, -1).join('/') + '/[id]';
      if (pageAccess[dynamicPath] === true) {
        return true;
      }
      
      // Also check parent path
      const parentPath = `${pathParts[0]}/${pathParts[1]}`;
      if (pageAccess[parentPath] === true) {
        return true;
      }
    }
    
    // Special case for root permission
    if (pageAccess['/']) {
      return true;
    }
  }
  
  return false;
}