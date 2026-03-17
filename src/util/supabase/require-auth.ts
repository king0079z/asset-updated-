/**
 * Shared server-side auth helpers.
 * Wraps supabase.auth.getSession() in try/catch so that
 * an expired/revoked refresh token returns 401 instead of
 * bubbling up to the outer catch as a 500.
 * Supports cookie session OR Authorization: Bearer <access_token> (e.g. for Outlook add-in).
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { createClient } from './api';
import { getSupabaseEnv } from './env';
import type { User } from '@supabase/supabase-js';

const createSupabase = (req: NextApiRequest, res: NextApiResponse) => createClient(req, res);

interface AuthResult {
  user: User;
  supabase: ReturnType<typeof createClient>;
}

/** Use when the route requires auth: returns { user, supabase } or sends 401 and returns null. */
export async function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthResult | null> {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (bearerToken) {
    try {
      const { url, anonKey } = getSupabaseEnv();
      const anon = createSupabaseJsClient(url, anonKey);
      const { data: { user }, error } = await anon.auth.getUser(bearerToken);
      if (error || !user) {
        res.status(401).json({ message: 'Unauthorized', error: error?.message ?? 'Invalid token' });
        return null;
      }
      return { user, supabase: createSupabase(req, res) };
    } catch (e: any) {
      res.status(401).json({ message: 'Unauthorized - Invalid token', error: e?.message });
      return null;
    }
  }

  const supabase = createSupabase(req, res);

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
    res.status(401).json({ message: 'Unauthorized - Session expired', error: e?.message });
    return null;
  }
}

/** Use when you need to handle auth yourself (e.g. optional auth). Never throws. */
export async function getSessionSafe(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ user: User | null; supabase: ReturnType<typeof createClient>; error?: string }> {
  const supabase = createSupabase(req, res);
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) return { user: null, supabase, error: error.message };
    return { user: session?.user ?? null, supabase };
  } catch (e: any) {
    return { user: null, supabase, error: e?.message ?? 'Session error' };
  }
}
