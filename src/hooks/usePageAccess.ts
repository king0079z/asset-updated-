import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { logDebug, warnDebug } from '@/lib/client-logger';

// Module-level cache: avoids re-fetching when multiple components mount simultaneously
// and survives SPA navigations within the same session.
const _permCache = new Map<string, { data: any; ts: number }>();
const _PERM_TTL = 5 * 60 * 1000; // 5 minutes — was 30 seconds (reduced PostgREST calls by ~10×)

async function fetchPermissions(userId: string) {
  const cached = _permCache.get(userId);
  if (cached && Date.now() - cached.ts < _PERM_TTL) return cached.data;

  // 6-second abort timeout — prevents indefinite spinner on Vercel cold-start
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);

  try {
    // Uses Prisma on the server — bypasses PostgREST entirely
    const res = await fetch('/api/users/permissions', { signal: controller.signal });
    if (!res.ok) throw new Error('Failed to fetch permissions');
    const data = await res.json();
    _permCache.set(userId, { data, ts: Date.now() });
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hook to provide page access information for the current user.
 * Permissions are fetched via /api/users/permissions (Prisma, not PostgREST)
 * and cached client-side for 5 minutes to eliminate the previous 30-second
 * polling storm that generated 60k+ Supabase User table queries.
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
        const data = await fetchPermissions(user.id);

        logDebug(`[usePageAccess] User ${user.id} (${data.email}) role: ${data.role}, isAdmin: ${data.isAdmin}`);

        setIsAdmin(data.isAdmin || false);
        setRole(data.role || 'STAFF');
        setIsManager(data.role === 'MANAGER');
        setPageAccess(data.pageAccess || {});

        if (data.customRole) {
          setCustomRole(data.customRole);
          if (data.customRole.name?.toLowerCase().includes('supervisor')) {
            setIsSupervisor(true);
          }
        }

        setLoading(false);

        if (data.status !== 'APPROVED') {
          warnDebug(`[usePageAccess] Warning: User ${user.id} has status ${data.status}`);
        }
      } catch (error) {
        console.error('Error in usePageAccess:', error);
        setLoading(false);
      }
    };
    
    fetchUserAccess();

    // Refresh every 5 minutes instead of every 30 seconds.
    // The module-level cache means back-to-back calls within the TTL are free.
    const refreshInterval = setInterval(fetchUserAccess, _PERM_TTL);
    
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
      logDebug(`[usePageAccess] No user found, denying access to ${pagePath}`);
      return false;
    }
    
    // Admin has access to all pages
    if (isAdmin) {
      logDebug(`[usePageAccess] User is admin, granting access to ${pagePath}`);
      return true;
    }
    
    // Manager has access to all pages except admin settings
    if (isManager && !pagePath.startsWith('/admin')) {
      logDebug(`[usePageAccess] User is manager, granting access to ${pagePath}`);
      return true;
    }
    
    // Supervisor has access to staff activity page
    if (isSupervisor && (pagePath === '/staff-activity' || pagePath.startsWith('/staff-activity/'))) {
      logDebug(`[usePageAccess] User is supervisor, granting access to staff activity page`);
      return true;
    }
    
    // Dashboard access is now controlled by pageAccess settings
    if (pagePath === '/dashboard') {
      logDebug(`[usePageAccess] Checking dashboard access for user ${user.id}`);
      // Only return true if the user has explicit dashboard access
      if (pageAccess && pageAccess['/dashboard'] === true) {
        logDebug(`[usePageAccess] User has explicit dashboard access`);
        return true;
      }
      logDebug(`[usePageAccess] User does not have dashboard access`);
      return false;
    }
    
    // Check page access from the pageAccess JSON field
    if (pageAccess && Object.keys(pageAccess).length > 0) {
      // Direct match
      if (pageAccess[pagePath] === true) {
        logDebug(`[usePageAccess] Direct page access match for ${pagePath}`);
        return true;
      }
      
      // Check for dynamic route access
      // For example, if the user is on /vehicles/123, check if they have access to /vehicles/[id]
      const pathParts = pagePath.split('/');
      if (pathParts.length > 2) {
        // Try to match dynamic routes
        const dynamicPath = pathParts.slice(0, -1).join('/') + '/[id]';
        if (pageAccess[dynamicPath] === true) {
          logDebug(`[usePageAccess] Dynamic route access match for ${pagePath} via ${dynamicPath}`);
          return true;
        }
        
        // Also check parent path
        const parentPath = `${pathParts[0]}/${pathParts[1]}`;
        if (pageAccess[parentPath] === true) {
          logDebug(`[usePageAccess] Parent path access match for ${pagePath} via ${parentPath}`);
          return true;
        }
      }
      
      // Special case for root permission
      if (pageAccess['/']) {
        logDebug(`[usePageAccess] Special case: granting access to ${pagePath} via root permission`);
        return true;
      }
      
      // If we got here, no access was found
      logDebug(`[usePageAccess] No access found for ${pagePath}. Available permissions:`, JSON.stringify(pageAccess, null, 2));
    } else {
      logDebug(`[usePageAccess] No pageAccess object or empty permissions for user ${user.id}`);
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