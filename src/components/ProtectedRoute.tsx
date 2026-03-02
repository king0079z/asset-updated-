// @ts-nocheck
import { useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { AuthContext } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { createClient } from '@/util/supabase/component';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CreditCard } from 'lucide-react';
import SubscriptionKeyInput from '@/components/SubscriptionKeyInput';
import { logDebug } from '@/lib/client-logger';

const publicRoutes = ['/', '/login', '/signup', '/forgot-password', '/magic-link-login', '/reset-password'];
// Routes that are accessible even with an expired subscription
const subscriptionExemptRoutes = [
  '/settings/organization',
  '/settings',
];

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowManager?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false,
  allowManager = false
}) => {
  const { user, initializing } = useContext(AuthContext);
  const { isSubscriptionExpired, subscription } = useOrganization();
  const router = useRouter();
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isManager, setIsManager] = useState<boolean>(false);
  const [pageAccess, setPageAccess] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [hasSubscriptionKey, setHasSubscriptionKey] = useState<boolean>(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const checkUserStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        logDebug(`[ProtectedRoute] Checking status for user ${user.id} on path ${router.pathname}`);
        const { data, error } = await supabase
          .from('User')
          .select('status, isAdmin, role, pageAccess, email')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user status:', error);
          setLoading(false);
          return;
        }

        logDebug(`[ProtectedRoute] User ${user.id} (${data.email}) status: ${data.status}, role: ${data.role}, isAdmin: ${data.isAdmin}`);
        setUserStatus(data.status);
        setIsAdmin(data.isAdmin);
        setIsManager(data.role === 'MANAGER');
        setPageAccess(data.pageAccess);
        setUserEmail(data.email);
        
        // Check if this user has previously been shown the subscription key input
        const hasSeenKeyInput = localStorage.getItem(`subscription_key_shown_${user.id}`);
        setHasSubscriptionKey(!!hasSeenKeyInput);
        
        setLoading(false);
      } catch (error) {
        console.error('Error:', error);
        setLoading(false);
      }
    };

    if (!initializing) {
      checkUserStatus();
    }
  }, [user, initializing, supabase, router.pathname]);

  useEffect(() => {
    if (!initializing && !user && !publicRoutes.includes(router.pathname)) {
      logDebug('Redirecting to login from:', router.pathname);
      router.push('/login');
    }
  }, [user, initializing, router]);

  // Check if current page is accessible
  const checkPageAccess = () => {
    if (isAdmin) return true; // Admin has access to all pages
    
    // Manager has access to all pages except admin pages
    if (isManager && !router.pathname.startsWith('/admin')) return true;
    
    if (!pageAccess) {
      logDebug(`[ProtectedRoute] No pageAccess object found for user ${user?.id}`);
      return false;
    }
    
    // Get current path without query parameters
    const currentPath = router.pathname;
    
    // Check if the user has access to this specific page
    if (pageAccess[currentPath] === true) {
      logDebug(`[ProtectedRoute] Direct access match for ${currentPath}`);
      return true;
    }
    
    // Check for dynamic route access
    // For example, if the user is on /vehicles/123, check if they have access to /vehicles/[id]
    const pathParts = currentPath.split('/');
    if (pathParts.length > 2) {
      // Try to match dynamic routes
      const dynamicPath = pathParts.slice(0, -1).join('/') + '/[id]';
      if (pageAccess[dynamicPath] === true) {
        logDebug(`[ProtectedRoute] Dynamic route access match for ${currentPath} via ${dynamicPath}`);
        return true;
      }
      
      // Also check parent path
      const parentPath = pathParts.slice(0, 2).join('/');
      if (pageAccess[parentPath] === true) {
        logDebug(`[ProtectedRoute] Parent path access match for ${currentPath} via ${parentPath}`);
        return true;
      }
    }
    
    // If we got here, no access was found
    logDebug(`[ProtectedRoute] No access found for ${currentPath}. Available permissions:`, JSON.stringify(pageAccess, null, 2));
    return false;
  };

  if (initializing || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user && !publicRoutes.includes(router.pathname)) {
    return null;
  }
  
  // Check for subscription expiration
  if (
    user && 
    isSubscriptionExpired && 
    !publicRoutes.includes(router.pathname) && 
    !subscriptionExemptRoutes.includes(router.pathname) &&
    !router.pathname.startsWith('/settings/organization')
  ) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Alert className="max-w-md bg-amber-50 border-amber-200">
          <CreditCard className="h-5 w-5 text-amber-600" />
          <AlertTitle className="text-amber-800">Subscription Expired</AlertTitle>
          <AlertDescription className="text-amber-700">
            Your subscription has expired. Please renew your subscription to continue using the application.
            {subscription?.licenseKey && (
              <div className="mt-2 p-2 bg-amber-100 rounded text-sm font-mono">
                License Key: {subscription.licenseKey}
              </div>
            )}
          </AlertDescription>
        </Alert>
        <Button 
          className="mt-4 bg-amber-600 hover:bg-amber-700" 
          onClick={() => router.push('/settings/organization?tab=subscription')}
        >
          Renew Subscription
        </Button>
      </div>
    );
  }

  // Only check status for protected routes
  if (user && !publicRoutes.includes(router.pathname)) {
    if (userStatus === 'REJECTED') {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <Alert className="max-w-md">
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              Your account has been rejected by the administrator. Please contact the system administrator for more information.
            </AlertDescription>
          </Alert>
          <Button 
            className="mt-4" 
            onClick={() => {
              supabase.auth.signOut();
              router.push('/login');
            }}
          >
            Back to Login
          </Button>
        </div>
      );
    }

    if (userStatus === 'PENDING') {
      // If the user has already been shown the subscription key input
      if (hasSubscriptionKey) {
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <SubscriptionKeyInput userId={user.id} userEmail={userEmail} />
          </div>
        );
      } else {
        // First time login after registration - show the pending approval message
        localStorage.setItem(`subscription_key_shown_${user.id}`, 'true');
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <Alert className="max-w-md bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <AlertTitle className="text-xl font-semibold text-blue-800 dark:text-blue-300">Account Pending Approval</AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                <p className="mb-4">Thank you for registering! Your account is pending approval from the administrator.</p>
                <div className="bg-white dark:bg-blue-900 p-4 rounded-md border border-blue-200 dark:border-blue-700 mb-4">
                  <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Next Steps:</h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>An administrator will review your registration</li>
                    <li>You will receive a subscription key within 24 hours</li>
                    <li>Use this key to activate your account when you log in again</li>
                  </ol>
                </div>
                <p className="text-sm italic">Please contact support if you don't receive your subscription key within 24 hours.</p>
              </AlertDescription>
            </Alert>
            <div className="mt-6 flex gap-4">
              <Button 
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900"
                onClick={() => {
                  supabase.auth.signOut();
                  router.push('/login');
                }}
              >
                Back to Login
              </Button>
              <Button 
                variant="default"
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
                onClick={() => {
                  window.location.href = "mailto:support@kitchenmanagement.com?subject=Subscription Key Request";
                }}
              >
                Contact Support
              </Button>
            </div>
          </div>
        );
      }
    }

    if (requireAdmin && !(isAdmin || (allowManager && isManager))) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <Alert className="max-w-md">
            <AlertTitle>Admin Access Required</AlertTitle>
            <AlertDescription>
              This page requires administrator privileges. Please contact your system administrator.
            </AlertDescription>
          </Alert>
          <Button 
            className="mt-4" 
            onClick={() => router.back()}
          >
            Go Back
          </Button>
        </div>
      );
    }

    // Check page access for non-admin users
    if (!isAdmin && !checkPageAccess()) {
      // Enhanced logging for troubleshooting
      logDebug(`[ProtectedRoute] Access denied for user ${user.id} to page ${router.pathname}`);
      logDebug(`[ProtectedRoute] User pageAccess:`, JSON.stringify(pageAccess, null, 2));
      logDebug(`[ProtectedRoute] User status: ${userStatus}, isAdmin: ${isAdmin}, isManager: ${isManager}`);
      
      // Check if this is a dynamic route and log additional info
      const pathParts = router.pathname.split('/');
      if (pathParts.length > 2) {
        const parentPath = pathParts.slice(0, 2).join('/');
        const dynamicPath = `${pathParts.slice(0, 2).join('/')}/[id]`;
        logDebug(`[ProtectedRoute] Parent path: ${parentPath}, Dynamic path: ${dynamicPath}`);
        logDebug(`[ProtectedRoute] Has access to parent: ${pageAccess?.[parentPath] === true}`);
        logDebug(`[ProtectedRoute] Has access to dynamic: ${pageAccess?.[dynamicPath] === true}`);
      }
      
      // Dashboard access is now controlled by pageAccess settings
      if (router.pathname === '/dashboard') {
        logDebug(`[ProtectedRoute] Checking dashboard access for user ${user.id}`);
        // Only allow if the user has explicit dashboard access in their pageAccess settings
        if (pageAccess && pageAccess['/dashboard'] === true) {
          logDebug(`[ProtectedRoute] User has explicit dashboard access`);
          return <>{children}</>;
        }
        logDebug(`[ProtectedRoute] User does not have dashboard access, redirecting to staff activity page`);
        // Redirect users without dashboard access to the staff activity page
        router.push('/staff-activity');
        return null;
      }
      
      // Special case for staff-activity page - allow access to all users
      if (router.pathname === '/staff-activity' || router.pathname.startsWith('/staff-activity/')) {
        logDebug(`[ProtectedRoute] Allowing access to staff activity page for all users`);
        return <>{children}</>;
      }
      
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <Alert className="max-w-md">
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              You do not have permission to access this page. Please contact your administrator.
            </AlertDescription>
          </Alert>
          <Button 
            className="mt-4" 
            onClick={() => router.push('/staff-activity')}
          >
            Go to Staff Activity
          </Button>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;