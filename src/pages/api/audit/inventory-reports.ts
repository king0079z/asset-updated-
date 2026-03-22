// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/util/supabase/require-auth';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authResult = await requireAuth(req, res);
  if (!authResult) return;
  const { user } = authResult;

  let roleData: { organizationId: string | null; isAdmin: boolean; role: string } = {
    organizationId: null,
    isAdmin: false,
    role: 'STAFF',
  };
  try {
    const rd = await getUserRoleData(user.id);
    if (rd) roleData = rd;
  } catch {}

  const { organizationId, isAdmin } = roleData;

  const page = Math.max(1, parseInt(String(req.query.page || '1')));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '15'))));
  const skip = (page - 1) * limit;
  const severityFilter = req.query.severity as string | undefined;

  // ── Base filter: only reconciliation reports ─────────────────────────────
  const where: any = { action: 'INVENTORY_REVIEW_SUBMITTED' };

  // Non-admins: scope to their own submissions (organizationId may not be set on AuditLog)
  if (!isAdmin) {
    where.userId = user.id;
  }

  if (severityFilter && ['INFO', 'WARNING', 'ERROR'].includes(severityFilter)) {
    where.severity = severityFilter;
  }

  try {
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Enrich each log with submitter info + linked tickets
    const enriched = await Promise.all(
      logs.map(async (log) => {
        let submitter = null;
        if (log.userId) {
          try {
            submitter = await prisma.user.findUnique({
              where: { id: log.userId },
              select: { id: true, name: true, email: true, role: true, imageUrl: true },
            });
          } catch {}
        }

        // Find tickets whose description embeds this audit log's ID
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
              assignedToId: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          });
        } catch {}

        return { ...log, submitter, linkedTickets };
      })
    );

    return res.status(200).json({
      reports: enriched,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    console.error('[audit/inventory-reports] error:', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to load audit reports', detail: err?.message });
  }
}
