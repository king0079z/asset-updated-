// @ts-nocheck
/**
 * Creates a User row for the current auth user if missing (server-side provisioning).
 * Ensures new signups appear in admin Pending list even when client-side createUser failed.
 * Uses Prisma only — never Supabase table inserts (RLS blocks Organization inserts from the client).
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { ensureUserProvisioned } from '@/lib/ensureUserProvisioned';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  const authUser = session?.user ?? null;

  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const already = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, email: true, status: true, organizationId: true },
    });
    const user = await ensureUserProvisioned(authUser.id, authUser.email);
    return res.status(already ? 200 : 201).json({ user });
  } catch (error) {
    console.error('[provision] Error:', error);
    return res.status(500).json({ error: 'Failed to provision user' });
  }
}
