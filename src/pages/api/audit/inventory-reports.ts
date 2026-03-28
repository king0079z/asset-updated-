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
 * World-class multi-layer email resolution for inventory report submitters.
 * Tries every possible source so "Unknown Staff" never shows.
 */
async function resolveSubmitter(
  userId: string | null | undefined,
  details: Record<string, any>,
  logUserEmail: string | null | undefined,
  supabaseServiceKey?: string,
  supabaseUrl?: string,
): Promise<{ id: string | null; email: string | null; role: string | null; imageUrl: null }> {
  // Layer 1 — in-memory cache (fastest)
  if (userId && emailCache.has(userId)) {
    const cached = emailCache.get(userId)!;
    let roleVal: string | null = null;
    try {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      roleVal = u?.role ?? null;
    } catch {}
    return { id: userId, email: cached, role: roleVal, imageUrl: null };
  }

  // Layer 2 — Prisma user table
  if (userId) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true },
      });
      if (u?.email) {
        emailCache.set(userId, u.email);
        return { id: u.id, email: u.email, role: u.role ?? null, imageUrl: null };
      }
    } catch (e) {
      console.warn('[inventory-reports] Prisma user lookup failed for', userId, (e as any)?.message);
    }
  }

  // Layer 3 — log.userEmail column (most reliable for older records)
  if (logUserEmail) {
    if (userId) emailCache.set(userId, logUserEmail);
    let roleVal: string | null = null;
    try {
      if (userId) {
        const u = await prisma.user.findFirst({ where: { email: logUserEmail }, select: { role: true } });
        roleVal = u?.role ?? null;
      }
    } catch {}
    return { id: userId || null, email: logUserEmail, role: roleVal, imageUrl: null };
  }

  // Layer 4 — details JSON (captured at submission time)
  const detailEmail = details?.submittedByEmail || null;
  const detailName  = details?.submittedByName  || null;
  if (detailEmail || detailName) {
    const resolvedEmail = detailEmail || detailName;
    if (userId && resolvedEmail) emailCache.set(userId, resolvedEmail);
    return { id: userId || null, email: resolvedEmail, role: null, imageUrl: null };
  }

  // Layer 5 — Supabase Auth admin API (for stale records where email not yet stored)
  if (userId && supabaseServiceKey && supabaseUrl) {
    try {
      const admin = createSupabaseJsClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (!error && data?.user?.email) {
        emailCache.set(userId, data.user.email);
        // Backfill userEmail on the log so future requests skip Supabase
        try {
          await prisma.auditLog.updateMany({
            where: { userId, userEmail: null, action: 'INVENTORY_REVIEW_SUBMITTED' },
            data: { userEmail: data.user.email },
          });
        } catch {}
        return { id: userId, email: data.user.email, role: null, imageUrl: null };
      }
    } catch {
      // Service role key not available or call failed — fall through
    }
  }

  // Layer 6 — search by userId in Supabase users directly
  if (userId) {
    try {
      const userByAny = await prisma.user.findFirst({
        where: { OR: [{ id: userId }] },
        select: { email: true, role: true },
      });
      if (userByAny?.email) {
        emailCache.set(userId, userByAny.email);
        return { id: userId, email: userByAny.email, role: userByAny.role ?? null, imageUrl: null };
      }
    } catch {}
  }

  return { id: userId || null, email: null, role: null, imageUrl: null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ── PATCH: mark report as completed ──────────────────────────────────────
  if (req.method === 'PATCH') {
    const authResult = await requireAuth(req, res);
    if (!authResult) return;
    const { user } = authResult;

    let roleData = { organizationId: null, isAdmin: false, role: 'STAFF' };
    try { const rd = await getUserRoleData(user.id); if (rd) roleData = rd; } catch {}
    if (!roleData.isAdmin && !['ADMIN', 'MANAGER'].includes(roleData.role)) {
      return res.status(403).json({ error: 'Only admins and managers can complete reports' });
    }

    const { id, completed } = req.body;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Report id required' });

    try {
      const log = await prisma.auditLog.findFirst({
        where: { id, action: 'INVENTORY_REVIEW_SUBMITTED' },
        select: { id: true },
      });
      if (!log) return res.status(404).json({ error: 'Report not found' });

      const updated = await prisma.auditLog.update({
        where: { id },
        data: {
          verified: !!completed,
          verifiedAt: completed ? new Date() : null,
          verifiedBy: completed ? user.id : null,
        },
        select: { id: true, verified: true, verifiedAt: true, verifiedBy: true },
      });
      return res.status(200).json({ success: true, report: updated });
    } catch (err: any) {
      console.error('[inventory-reports PATCH]', err?.message);
      return res.status(500).json({ error: 'Failed to update report' });
    }
  }

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
  const statusFilter   = req.query.status as string | undefined; // 'active' | 'completed' | undefined

  const where: any = { action: 'INVENTORY_REVIEW_SUBMITTED' };
  if (!isAdmin) where.userId = user.id;
  if (severityFilter && ['INFO', 'WARNING', 'ERROR'].includes(severityFilter)) {
    where.severity = severityFilter;
  }
  if (statusFilter === 'completed') where.verified = true;
  else if (statusFilter === 'active') where.verified = false;

  // Pick up service role key if available (for old-record auth lookups)
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
  const { url: supabaseUrl } = getSupabaseEnv();

  try {
    // Fetch total counts for both statuses (for dashboard stats)
    const baseWhere: any = { action: 'INVENTORY_REVIEW_SUBMITTED' };
    if (!isAdmin) baseWhere.userId = user.id;
    if (severityFilter && ['INFO', 'WARNING', 'ERROR'].includes(severityFilter)) {
      baseWhere.severity = severityFilter;
    }

    const [total, completedCount, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.count({ where: { ...baseWhere, verified: true } }),
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, timestamp: true, userId: true, userEmail: true,
          severity: true, details: true, verified: true,
          verifiedAt: true, verifiedBy: true, metadata: true,
        },
      }),
    ]);

    const enriched = await Promise.all(
      logs.map(async (log) => {
        const details = (log.details as any) || {};

        const submitter = await resolveSubmitter(
          log.userId, details, log.userEmail, supabaseServiceKey, supabaseUrl,
        );

        // Resolve who completed the report
        let completedBy: string | null = null;
        if (log.verified && log.verifiedBy) {
          try {
            const cv = await prisma.user.findUnique({
              where: { id: log.verifiedBy },
              select: { email: true },
            });
            completedBy = cv?.email || log.verifiedBy;
          } catch {}
        }

        // Linked tickets: description references this audit log id
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

        return {
          ...log,
          submitter,
          linkedTickets,
          completedBy,
        };
      })
    );

    return res.status(200).json({
      reports: enriched,
      total,
      completedCount,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    console.error('[audit/inventory-reports]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to load audit reports', detail: err?.message });
  }
}
