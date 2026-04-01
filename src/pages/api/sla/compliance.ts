// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const roleData = await getUserRoleData(auth.user.id);
  const orgId = roleData?.organizationId || null;

  const { days = '30' } = req.query;
  const since = new Date(Date.now() - Number(days) * 86_400_000);

  const [total, breached, escalated, resolved, byCategory, byPriority, avgResolution] = await Promise.all([
    prisma.ticket.count({ where: { ...(orgId ? { organizationId: orgId } : {}), createdAt: { gte: since } } }),
    prisma.ticket.count({ where: { ...(orgId ? { organizationId: orgId } : {}), createdAt: { gte: since }, slaBreached: true } }),
    prisma.ticket.count({ where: { ...(orgId ? { organizationId: orgId } : {}), createdAt: { gte: since }, status: 'ESCALATED' } }),
    prisma.ticket.count({ where: { ...(orgId ? { organizationId: orgId } : {}), createdAt: { gte: since }, status: { in: ['RESOLVED', 'CLOSED'] } } }),
    // By category
    prisma.ticket.groupBy({
      by: ['category'],
      where: { ...(orgId ? { organizationId: orgId } : {}), createdAt: { gte: since } },
      _count: { id: true },
      _sum: { slaBreached: true },
    }),
    // By priority
    prisma.ticket.groupBy({
      by: ['priority'],
      where: { ...(orgId ? { organizationId: orgId } : {}), createdAt: { gte: since } },
      _count: { id: true },
      _sum: { slaBreached: true },
    }),
    // Avg resolution time (hours) for resolved tickets
    prisma.$queryRaw`
      SELECT AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 3600) as avg_hours
      FROM "Ticket"
      WHERE status IN ('RESOLVED', 'CLOSED')
      AND "createdAt" >= ${since}
      ${orgId ? prisma.$queryRaw`AND "organizationId" = ${orgId}` : prisma.$queryRaw``}
    `.catch(() => [{ avg_hours: null }]),
  ]);

  const complianceRate = total > 0 ? Math.round(((total - breached) / total) * 100) : 100;

  return res.status(200).json({
    period: { days: Number(days), since: since.toISOString() },
    summary: {
      total,
      breached,
      escalated,
      resolved,
      complianceRate,
      avgResolutionHours: (avgResolution as any[])[0]?.avg_hours
        ? Math.round(Number((avgResolution as any[])[0].avg_hours) * 10) / 10
        : null,
    },
    byCategory: byCategory.map(c => ({
      category: c.category || 'Uncategorized',
      total: c._count.id,
      breached: (c._sum as any).slaBreached || 0,
      complianceRate: c._count.id > 0
        ? Math.round(((c._count.id - ((c._sum as any).slaBreached || 0)) / c._count.id) * 100)
        : 100,
    })),
    byPriority: byPriority.map(p => ({
      priority: p.priority,
      total: p._count.id,
      breached: (p._sum as any).slaBreached || 0,
      complianceRate: p._count.id > 0
        ? Math.round(((p._count.id - ((p._sum as any).slaBreached || 0)) / p._count.id) * 100)
        : 100,
    })),
  });
}
