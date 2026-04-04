/**
 * GET /api/users/me
 * Returns a lightweight profile for the currently authenticated user.
 *
 * Supports two auth methods:
 *   1. Cookie-based session  — used by the web app (browser)
 *   2. Bearer token header   — used by the native mobile app
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from '@/util/supabase/env';
import prisma from '@/lib/prisma';

async function getUserIdFromRequest(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
  // 1️⃣ Bearer token (mobile native app)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { url, anonKey } = getSupabaseEnv();
    const supabase = createSupabaseClient(url, anonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user?.id) return user.id;
  }

  // 2️⃣ Cookie-based session (web browser)
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) return session.user.id;

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserIdFromRequest(req, res);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id:                true,
      email:             true,
      role:              true,
      isAdmin:           true,
      mustChangePassword: true,
    },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.status(200).json(user);
}
