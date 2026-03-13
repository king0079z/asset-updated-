// @ts-nocheck
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

// Extremely simplified version to reduce dependencies during build
export default function PendingApprovalPage() {
  const { user, initializing, refreshUser } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [subscriptionKey, setSubscriptionKey] = useState('');

  useEffect(() => {
    // If user is not logged in, redirect to login
    if (!initializing && !user) {
      router.push('/login');
    }
    
    // If user is logged in and approved, redirect to dashboard
    if (!initializing && user && user.status === 'APPROVED') {
      router.push('/dashboard');
    }
  }, [user, initializing, router]);

  const handleActivateAccount = async () => {
    if (!subscriptionKey) {
      setError('Please enter your subscription key');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/organizations/current/subscription/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to validate subscription key');
      }

      setSuccess('Your account has been successfully activated!');
      
      // Refresh user data to update status
      await refreshUser();
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'An error occurred while validating your subscription key');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (initializing) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Account Pending Approval</CardTitle>
          <CardDescription>
            Thank you for registering! Your account is pending approval from the administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Next Steps:</h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>An administrator will review your registration</li>
              <li>You will receive a subscription key within 24 hours</li>
              <li>Use this key to activate your account when you log in again</li>
            </ul>
          </div>

          <div className="space-y-3 pt-4">
            <h3 className="text-sm font-medium">Enter your subscription key:</h3>
            <Input
              id="licenseKey"
              placeholder="Enter your subscription key"
              value={subscriptionKey}
              onChange={(e) => setSubscriptionKey(e.target.value)}
              className="text-center font-mono text-lg"
            />
            
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="bg-green-50 text-green-800 border-green-200">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button 
            className="w-full" 
            onClick={handleActivateAccount}
            disabled={isSubmitting || !subscriptionKey}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Activating...
              </>
            ) : (
              'Activate Account'
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Please contact support if you don&apos;t receive your subscription key within 24 hours.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}