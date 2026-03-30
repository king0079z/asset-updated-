// @ts-nocheck
/**
 * Creates a User row for the current auth user if missing (server-side provisioning).
 * Ensures new signups appear in admin Pending list even when client-side createUser failed.
 * Uses Prisma only — never Supabase table inserts (RLS blocks Organization inserts from the client).
 *
 * Auth strategy (in priority order):
 *  1. Active session cookie  → trusted immediately.
 *  2. No session but { userId, email } in body → verified against auth.users via raw SQL
 *     (safe: attacker would need to know a valid UUID that matches the email in Supabase auth).
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
  let authUser = session?.user ?? null;

  // ── Fallback: no session yet (email-confirmation signup) ─────────────────────
  // The client passes { userId, email } from the Supabase signUp response.
  // We verify these against auth.users to confirm the user really exists there
  // before provisioning a DB row.
  if (!authUser && req.method === 'POST') {
    const { userId: bodyId, email: bodyEmail } = req.body || {};

    if (bodyId && bodyEmail) {
      try {
        // Query Supabase's auth schema directly — both id AND email must match.
        // Use id::text comparison to avoid UUID cast issues with parameterized queries.
        const rows: Array<{ id: string }> = await prisma.$queryRaw`
          SELECT id::text FROM auth.users
          WHERE id::text = ${bodyId}
            AND email = ${bodyEmail}
          LIMIT 1
        `;

        if (rows.length > 0) {
          // User verified in Supabase auth — safe to provision.
          const user = await ensureUserProvisioned(bodyId, bodyEmail);
          return res.status(201).json({ user });
        }
      } catch (verifyError) {
        console.error('[provision] auth.users verification failed:', verifyError);
        // Fall through to 401 below — don't expose internal errors.
      }
    }

    return res.status(401).json({ error: 'Unauthorized' });
  }

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
