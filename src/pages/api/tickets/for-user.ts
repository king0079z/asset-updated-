// @ts-nocheck
/**
 * GET /api/tickets/for-user?userId=<id>&status=OPEN,IN_PROGRESS,PENDING
 * Returns tickets raised by OR assigned to a specific user.
 * Callable by admins/managers for the assignment workflow.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(user.id);
  const isAdminOrManager =
    roleData?.isAdmin === true ||
    roleData?.role === 'ADMIN' ||
    roleData?.role === 'MANAGER';

  if (!isAdminOrManager) {
    return res.status(403).json({ error: 'Forbidden — admins/managers only' });
  }

  const { userId, status } = req.query;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId query param is required' });
  }

  // Parse optional status filter (comma-separated)
  const statusFilter: string[] = status
    ? String(status).split(',').map(s => s.trim()).filter(Boolean)
    : [];

  try {
    const where: any = {
      OR: [
        { userId },           // raised by the user
        { assignedToId: userId }, // assigned to the user
      ],
    };

    if (statusFilter.length > 0) {
      where.status = { in: statusFilter };
    }

    const tickets = await prisma.ticket.findMany({
      where,
      select: {
        id: true,
        displayId: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        assetId: true,
        asset: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.status(200).json({
      tickets: tickets.map(t => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (err: any) {
    console.error('[tickets/for-user]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
