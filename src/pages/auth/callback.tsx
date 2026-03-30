import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@/util/supabase/component';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClient();
  const { createUser } = useAuth();
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.user) {
        try {
          await createUser(session.user);
          await router.replace('/dashboard');
        } catch (e) {
          console.error('Auth callback createUser:', e);
          setMessage('Could not finish sign-in. Try logging in from the login page.');
        }
      }
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          await createUser(session.user);
          await router.replace('/dashboard');
        } catch (e) {
          console.error('Auth callback:', e);
          setMessage('Could not finish sign-in. Try the login page.');
        }
      }
    });

    const timer = setTimeout(() => {
      if (cancelled) return;
      void supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (!cancelled && !s) {
          setMessage('No session from this link. It may have expired — try signing in or sign up again.');
        }
      });
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      authListener.subscription.unsubscribe();
    };
  }, [createUser, router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
