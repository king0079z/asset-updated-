// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/util/supabase/require-auth';
import { getUserRoleData } from '@/util/roleCheck';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from '@/util/supabase/env';

// In-memory email cache so we don't hit Supabase auth for every log
const emailCache = new Map<string, string>();

/**
 * Try every possible source to resolve a display name for a userId.
 * Order of precedence:
 *  1. Prisma User (email field only — User model has no `name` column)
 *  2. details JSON submittedByEmail / submittedByName
 *  3. log.userEmail field
 *  4. In-memory cache from a previous successful lookup
 *  5. Supabase Auth admin lookup (requires service-role key — skipped if not configured)
 */
async function resolveSubmitter(
  userId: string | null | undefined,
  details: Record<string, any>,
  logUserEmail: string | null | undefined,
  supabaseServiceKey?: string,
  supabaseUrl?: string,
): Promise<{ id: string | null; email: string | null; role: string | null; imageUrl: null }> {
  // Layer 1 — Prisma (only fields that actually exist on the User model)
  if (userId) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true },  // NO name / imageUrl — they don't exist
      });
      if (u?.email) {
        emailCache.set(userId, u.email);
        return { id: u.id, email: u.email, role: u.role ?? null, imageUrl: null };
      }
    } catch (e) {
      console.warn('[inventory-reports] Prisma user lookup failed for', userId, (e as any)?.message);
    }
  }

  // Layer 2 — details JSON (captured at submission time)
  const detailEmail = details?.submittedByEmail || null;
  const detailName  = details?.submittedByName  || null;
  if (detailEmail || detailName) {
    return { id: userId || null, email: detailEmail || detailName, role: null, imageUrl: null };
  }

  // Layer 3 — log.userEmail column
  if (logUserEmail) {
    return { id: userId || null, email: logUserEmail, role: null, imageUrl: null };
  }

  // Layer 4 — in-memory cache from a previous request
  if (userId && emailCache.has(userId)) {
    return { id: userId, email: emailCache.get(userId)!, role: null, imageUrl: null };
  }

  // Layer 5 — Supabase Auth admin API (needs SUPABASE_SERVICE_ROLE_KEY)
  if (userId && supabaseServiceKey && supabaseUrl) {
    try {
      const admin = createSupabaseJsClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (!error && data?.user?.email) {
        emailCache.set(userId, data.user.email);
        return { id: userId, email: data.user.email, role: null, imageUrl: null };
      }
    } catch {
      // Service role key not available or call failed — fall through
    }
  }

  return { id: userId || null, email: null, role: null, imageUrl: null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authResult = await requireAuth(req, res);
  if (!authResult) return;
  const { user } = authResult;

  let roleData: { organizationId: string | null; isAdmin: boolean; role: string } = {
    organizationId: null, isAdmin: false, role: 'STAFF',
  };
  try {
    const rd = await getUserRoleData(user.id);
    if (rd) roleData = rd;
  } catch {}

  const { isAdmin } = roleData;

  const page  = Math.max(1, parseInt(String(req.query.page  || '1')));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '15'))));
  const skip  = (page - 1) * limit;
  const severityFilter = req.query.severity as string | undefined;

  const where: any = { action: 'INVENTORY_REVIEW_SUBMITTED' };
  if (!isAdmin) where.userId = user.id;
  if (severityFilter && ['INFO', 'WARNING', 'ERROR'].includes(severityFilter)) {
    where.severity = severityFilter;
  }

  // Pick up service role key if available (for old-record auth lookups)
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
  const { url: supabaseUrl } = getSupabaseEnv();

  try {
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, orderBy: { timestamp: 'desc' }, skip, take: limit }),
    ]);

    const enriched = await Promise.all(
      logs.map(async (log) => {
        const details = (log.details as any) || {};

        const submitter = await resolveSubmitter(
          log.userId, details, log.userEmail, supabaseServiceKey, supabaseUrl,
        );

        // If Prisma returned an email but no name, use email as display name (User has no name col)
        // The UI should display email when name is absent — the resolveSubmitter already does this.

        // Linked tickets: description references this audit log id (Report ID / [Inventory audit report:] / _Audit log ref_)
        let linkedTickets: any[] = [];
        try {
          linkedTickets = await prisma.ticket.findMany({
            where: { description: { contains: log.id } },
            select: {
              id: true,
              displayId: true,
              title: true,
              status: true,
              priority: true,
              createdAt: true,
              updatedAt: true,
              assignedToId: true,
              _count: { select: { history: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 100,
          });
        } catch {}

        return { ...log, submitter, linkedTickets };
      })
    );

    return res.status(200).json({ reports: enriched, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    console.error('[audit/inventory-reports]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to load audit reports', detail: err?.message });
  }
}
