// @ts-nocheck
/**
 * Admin-only endpoint: finds every Supabase auth user that has no row in the
 * app's User table and provisions them as PENDING.
 *
 * This fixes accounts that signed up before the client-side provision fix was
 * deployed, or where the provision call failed silently (e.g. no session during
 * email-confirmation flow).
 *
 * POST /api/admin/users/sync-from-auth
 * Response: { synced: number; users: { email, id }[] }
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { getUserRoleData } from '@/util/roleCheck';
import { ensureUserProvisioned } from '@/lib/ensureUserProvisioned';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  if (!roleData?.isAdmin) return res.status(403).json({ error: 'Forbidden: Admin access required' });

  try {
    // 1. Get all Supabase auth users (id + email) directly from the auth schema.
    const authUsers: Array<{ id: string; email: string }> = await prisma.$queryRaw`
      SELECT id::text, email
      FROM auth.users
      WHERE email IS NOT NULL
        AND email <> ''
      ORDER BY created_at DESC
      LIMIT 500
    `;

    if (!authUsers.length) {
      return res.status(200).json({ synced: 0, users: [] });
    }

    // 2. Find which IDs already have a User row.
    const authIds = authUsers.map(u => u.id);
    const existingUsers = await prisma.user.findMany({
      where: { id: { in: authIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingUsers.map(u => u.id));

    // 3. Provision any auth user that is not yet in the User table.
    const missing = authUsers.filter(u => !existingIds.has(u.id));
    const provisioned: { email: string; id: string }[] = [];

    for (const u of missing) {
      try {
        await ensureUserProvisioned(u.id, u.email);
        provisioned.push({ id: u.id, email: u.email });
      } catch (err) {
        console.error(`[sync-from-auth] Failed to provision ${u.email}:`, err);
      }
    }

    console.info(`[sync-from-auth] Synced ${provisioned.length} missing user(s):`, provisioned.map(u => u.email));
    return res.status(200).json({ synced: provisioned.length, users: provisioned });
  } catch (error) {
    console.error('[sync-from-auth] Error:', error);
    return res.status(500).json({ error: 'Failed to sync users from auth' });
  }
}
