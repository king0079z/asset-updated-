import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useToast } from '@/components/ui/use-toast';

/**
 * Supabase email links redirect here with ?error=... or #error=... when the link
 * is expired, invalid, or redirect URL was wrong (e.g. localhost in production).
 */
export function SupabaseAuthUrlErrors() {
  const router = useRouter();
  const { toast } = useToast();
  const handled = useRef(false);

  useEffect(() => {
    if (!router.isReady || handled.current || typeof window === 'undefined') return;

    const readSearch = (search: string) => {
      const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
      return {
        error: q.get('error'),
        code: q.get('error_code'),
        desc: q.get('error_description'),
      };
    };

    let { error, code, desc } = readSearch(window.location.search);
    if (!error && window.location.hash) {
      const h = readSearch(window.location.hash.replace(/^#/, '?'));
      if (h.error) {
        error = h.error;
        code = h.code;
        desc = h.desc;
      }
    }

    if (!error && !code) return;

    handled.current = true;

    const description = desc
      ? decodeURIComponent(desc.replace(/\+/g, ' '))
      : code === 'otp_expired'
        ? 'This confirmation link has expired or was already used. Sign up again or ask an admin to send a new magic login link.'
        : 'This email link could not be used.';

    toast({
      variant: 'destructive',
      title: 'Email link problem',
      description,
      duration: 12_000,
    });

    const path = router.pathname;
    window.history.replaceState(null, '', path);
    router.replace(path, undefined, { shallow: true }).catch(() => {});
  }, [router.isReady, router.pathname, toast]);

  return null;
}
