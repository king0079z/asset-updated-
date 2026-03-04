import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { createClient as createAdminClient } from '@supabase/supabase-js';

/**
 * GET /api/users
 *
 * Returns all users that exist in Supabase Auth, enriched with
 * role / status data from the Prisma User table.
 *
 * Strategy:
 *   1. Use Supabase Admin API (service role key) to list ALL auth users.
 *   2. Fetch matching Prisma rows in one query, keyed by UUID.
 *   3. Merge — every auth user appears; Prisma data augments where available.
 *
 * This ensures users who have registered but haven't been "approved" yet
 * still appear in the assign-to-user dialog.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // ── Caller must be authenticated ─────────────────────────────────────────
  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  if (authError || !session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // ── 1. List all Supabase Auth users via Admin API ───────────────────────
    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    let authUsers: { id: string; email: string }[] = [];

    if (supabaseUrl && serviceKey) {
      const adminClient = createAdminClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // listUsers returns up to 1000 per page; fetch page-by-page if needed
      let page = 1;
      const perPage = 1000;
      while (true) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (error || !data?.users?.length) break;
        authUsers.push(...data.users.map((u: any) => ({ id: u.id, email: u.email ?? '' })));
        if (data.users.length < perPage) break;
        page++;
      }
    }

    // ── 2. Fetch Prisma user rows for all known IDs ─────────────────────────
    const ids = authUsers.map(u => u.id).filter(Boolean);

    const prismaUsers = ids.length
      ? await prisma.user.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            email: true,
            role: true,
            isAdmin: true,
            status: true,
            organizationId: true,
          },
        })
      : [];

    const prismaMap = new Map(prismaUsers.map(u => [u.id, u]));

    // ── 3. Merge ────────────────────────────────────────────────────────────
    const merged = authUsers
      .filter(u => u.email) // skip users with no email
      .map(authUser => {
        const p = prismaMap.get(authUser.id);
        return {
          id:             authUser.id,
          email:          authUser.email,
          role:           p?.role    ?? 'STAFF',
          isAdmin:        p?.isAdmin ?? false,
          status:         p?.status  ?? 'PENDING',
          organizationId: p?.organizationId ?? null,
        };
      })
      .filter(u => u.status !== 'REJECTED') // exclude rejected users from all app lists
      .sort((a, b) => a.email.localeCompare(b.email));

    // ── 4. Fallback: if Admin API not available, use Prisma only ────────────
    if (authUsers.length === 0) {
      const fallback = await prisma.user.findMany({
        where: { status: { not: 'REJECTED' } },
        select: { id: true, email: true, role: true, isAdmin: true, status: true, organizationId: true },
        orderBy: { email: 'asc' },
        take: 500,
      });
      res.setHeader('Cache-Control', 'private, max-age=30');
      return res.status(200).json(fallback);
    }

    res.setHeader('Cache-Control', 'private, max-age=30');
    return res.status(200).json(merged);
  } catch (err) {
    console.error('[GET /api/users]', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
}
