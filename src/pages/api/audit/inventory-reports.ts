// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireAuth, getUserRoleData } from '@/util/supabase/require-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const roleData = await getUserRoleData(user.id);
  const { organizationId, isAdmin, role } = roleData;

  if (req.method === 'GET') {
    // ── Fetch all INVENTORY_REVIEW_SUBMITTED audit logs ──────────────────────
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'))));
    const skip = (page - 1) * limit;
    const severityFilter = req.query.severity as string | undefined;

    const where: any = {
      action: 'INVENTORY_REVIEW_SUBMITTED',
    };

    // Scope to org unless super-admin
    if (!isAdmin && organizationId) {
      where.organizationId = organizationId;
    }

    if (severityFilter && ['INFO', 'WARNING', 'ERROR'].includes(severityFilter)) {
      where.severity = severityFilter;
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Enrich each log with user info and linked tickets
    const enriched = await Promise.all(
      logs.map(async (log) => {
        let submitter = null;
        if (log.userId) {
          submitter = await prisma.user.findUnique({
            where: { id: log.userId },
            select: { id: true, name: true, email: true, role: true, imageUrl: true },
          });
        }

        // Find tickets that reference this audit log in their metadata/description
        const linkedTickets = await prisma.ticket.findMany({
          where: {
            OR: [
              { description: { contains: log.id } },
              { description: { contains: 'INVENTORY_REVIEW' } },
            ],
            ...((!isAdmin && organizationId) ? { organizationId } : {}),
          },
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

        // More precise: tickets whose description contains the auditLogId
        const preciseLinkedTickets = linkedTickets.filter(
          (t) => t.description?.includes(log.id)
        );

        return {
          ...log,
          submitter,
          linkedTickets: preciseLinkedTickets,
        };
      })
    );

    return res.status(200).json({
      reports: enriched,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
