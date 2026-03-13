/**
 * Shared server-side auth helper.
 * Wraps supabase.auth.getSession() in try/catch so that
 * an expired/revoked refresh token returns 401 instead of
 * bubbling up to the outer catch as a 500.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from './api';
import type { User } from '@supabase/supabase-js';

interface AuthResult {
  user: User;
  supabase: ReturnType<typeof createClient>;
}

export async function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthResult | null> {
  const supabase = createClient(req, res);

  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      res.status(401).json({ message: 'Unauthorized', error: error.message });
      return null;
    }

    if (!session?.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return null;
    }

    return { user: session.user, supabase };
  } catch (e: any) {
    // getSession() can throw when the refresh token is completely invalid
    // (Supabase client internally tries to refresh & fails).
    // Return 401 instead of letting it propagate as 500.
    res.status(401).json({ message: 'Unauthorized - Session expired', error: e?.message });
    return null;
  }
}
