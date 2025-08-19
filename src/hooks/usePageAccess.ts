import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { createClient } from '@/util/supabase/component';

/**
 * Hook to provide page access information for the current user
 * This hook fetches the user's role and page access permissions
 * and provides functions to check if a user has access to specific pages
 */
export function usePageAccess() {
  const { user } = useContext(AuthContext);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isManager, setIsManager] = useState<boolean>(false);
  const [isSupervisor, setIsSupervisor] = useState<boolean>(false);
  const [role, setRole] = useState<string>('STAFF');
  const [customRole, setCustomRole] = useState<any>(null);
  const [pageAccess, setPageAccess] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  
  useEffect(() => {
    const fetchUserAccess = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('User')
          .select('isAdmin, role, pageAccess, status, email, customRoleId')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching user access:', error);
          setLoading(false);
          return;
        }
        
        console.log(`[usePageAccess] User ${user.id} (${data.email}) status: ${data.status}, role: ${data.role}, isAdmin: ${data.isAdmin}, customRoleId: ${data.customRoleId}`);
        
        setIsAdmin(data.isAdmin || false);
        setRole(data.role || 'STAFF');
        setIsManager(data.role === 'MANAGER');
        setPageAccess(data.pageAccess || {});
        
        // Check if user has a custom role and if it's a supervisor role
        if (data.customRoleId) {
          const { data: customRoleData, error: customRoleError } = await supabase
            .from('CustomRole')
            .select('id, name, description')
            .eq('id', data.customRoleId)
            .single();
          
          if (!customRoleError && customRoleData) {
            setCustomRole(customRoleData);
            
            // Check if the custom role name contains "supervisor"
            if (customRoleData.name.toLowerCase().includes('supervisor')) {
              setIsSupervisor(true);
              console.log(`[usePageAccess] User ${user.id} is a supervisor with custom role: ${customRoleData.name}`);
            }
          }
        }
        
        setLoading(false);
        
        if (data.status !== 'APPROVED') {
          console.warn(`[usePageAccess] Warning: User ${user.id} has status ${data.status} which may prevent access`);
        }
      } catch (error) {
        console.error('Error in usePageAccess:', error);
        setLoading(false);
      }
    };
    
    fetchUserAccess();
    
    // Set up a refresh interval to periodically check for permission changes
    const refreshInterval = setInterval(fetchUserAccess, 30000); // Check every 30 seconds
    
    return () => clearInterval(refreshInterval);
  }, [user]);
  
  /**
   * Check if the current user has access to a specific page
   * 
   * @param pagePath The path of the page to check access for
   * @returns Boolean indicating if the user has access
   */
  const hasAccess = (pagePath: string): boolean => {
    if (!user) {
      console.log(`[usePageAccess] No user found, denying access to ${pagePath}`);
      return false;
    }
    
    // Admin has access to all pages
    if (isAdmin) {
      console.log(`[usePageAccess] User is admin, granting access to ${pagePath}`);
      return true;
    }
    
    // Manager has access to all pages except admin settings
    if (isManager && !pagePath.startsWith('/admin')) {
      console.log(`[usePageAccess] User is manager, granting access to ${pagePath}`);
      return true;
    }
    
    // Supervisor has access to staff activity page
    if (isSupervisor && (pagePath === '/staff-activity' || pagePath.startsWith('/staff-activity/'))) {
      console.log(`[usePageAccess] User is supervisor, granting access to staff activity page`);
      return true;
    }
    
    // Dashboard access is now controlled by pageAccess settings
    if (pagePath === '/dashboard') {
      console.log(`[usePageAccess] Checking dashboard access for user ${user.id}`);
      // Only return true if the user has explicit dashboard access
      if (pageAccess && pageAccess['/dashboard'] === true) {
        console.log(`[usePageAccess] User has explicit dashboard access`);
        return true;
      }
      console.log(`[usePageAccess] User does not have dashboard access`);
      return false;
    }
    
    // Check page access from the pageAccess JSON field
    if (pageAccess && Object.keys(pageAccess).length > 0) {
      // Direct match
      if (pageAccess[pagePath] === true) {
        console.log(`[usePageAccess] Direct page access match for ${pagePath}`);
        return true;
      }
      
      // Check for dynamic route access
      // For example, if the user is on /vehicles/123, check if they have access to /vehicles/[id]
      const pathParts = pagePath.split('/');
      if (pathParts.length > 2) {
        // Try to match dynamic routes
        const dynamicPath = pathParts.slice(0, -1).join('/') + '/[id]';
        if (pageAccess[dynamicPath] === true) {
          console.log(`[usePageAccess] Dynamic route access match for ${pagePath} via ${dynamicPath}`);
          return true;
        }
        
        // Also check parent path
        const parentPath = `${pathParts[0]}/${pathParts[1]}`;
        if (pageAccess[parentPath] === true) {
          console.log(`[usePageAccess] Parent path access match for ${pagePath} via ${parentPath}`);
          return true;
        }
      }
      
      // Special case for root permission
      if (pageAccess['/']) {
        console.log(`[usePageAccess] Special case: granting access to ${pagePath} via root permission`);
        return true;
      }
      
      // If we got here, no access was found
      console.log(`[usePageAccess] No access found for ${pagePath}. Available permissions:`, JSON.stringify(pageAccess, null, 2));
    } else {
      console.log(`[usePageAccess] No pageAccess object or empty permissions for user ${user.id}`);
    }
    
    return false;
  };
  
  return {
    isAdmin,
    isManager,
    isSupervisor,
    role,
    customRole,
    pageAccess,
    hasAccess,
    loading
  };
}