import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { TicketStatus, TicketPriority } from '@prisma/client';
import { requireAuth } from '@/util/supabase/require-auth';
import { getUserRoleData } from '@/util/roleCheck';
import { buildTicketListWhere } from '@/lib/ticketScope';

const logApiEvent = (message: string, data?: any) => {
  try {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} [Tickets Stats API] ${message}`);
    if (data) console.log(`${timestamp} [Tickets Stats API] Data:`, typeof data === 'object' ? JSON.stringify(data) : data);
  } catch {
    console.log('[Tickets Stats API]', message);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  logApiEvent('Received request');

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  try {
    const roleData = await getUserRoleData(user.id);
    const scopeWhere = buildTicketListWhere(user.id, roleData);

    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      criticalTickets,
      highPriorityTickets,
    ] = await Promise.all([
      prisma.ticket.count({ where: scopeWhere }),
      prisma.ticket.count({ where: { ...scopeWhere, status: TicketStatus.OPEN } }),
      prisma.ticket.count({ where: { ...scopeWhere, status: TicketStatus.IN_PROGRESS } }),
      prisma.ticket.count({ where: { ...scopeWhere, status: TicketStatus.RESOLVED } }),
      prisma.ticket.count({ where: { ...scopeWhere, status: TicketStatus.CLOSED } }),
      prisma.ticket.count({ where: { ...scopeWhere, priority: TicketPriority.CRITICAL } }),
      prisma.ticket.count({ where: { ...scopeWhere, priority: TicketPriority.HIGH } }),
    ]);

    const ticketsByStatus = await prisma.ticket.groupBy({
      by: ['status'],
      _count: true,
      where: scopeWhere,
    });

    const ticketsByPriority = await prisma.ticket.groupBy({
      by: ['priority'],
      _count: true,
      where: scopeWhere,
    });

    const recentTickets = await prisma.ticket.findMany({
      where: scopeWhere,
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        asset: {
          select: { id: true, name: true, assetId: true },
        },
      },
    });

    const ticketsOverTime = await prisma.ticket.findMany({
      where: {
        ...scopeWhere,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { id: true, createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    const ticketsByDate = ticketsOverTime.reduce((acc, ticket) => {
      const date = ticket.createdAt.toISOString().split('T')[0];
      if (!acc[date]) acc[date] = 0;
      acc[date]++;
      return acc;
    }, {} as Record<string, number>);

    const ticketsWithAssets = await prisma.ticket.count({
      where: { ...scopeWhere, assetId: { not: null } },
    });

    const formattedRecentTickets = recentTickets.map((ticket) => ({
      id: ticket.id,
      displayId: ticket.displayId,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      asset: ticket.asset
        ? { id: ticket.asset.id, name: ticket.asset.name, assetId: ticket.asset.assetId }
        : null,
    }));

    const ticketsOverTimeArray = Object.entries(ticketsByDate).map(([date, count]) => ({ date, count }));

    const response = {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      criticalTickets,
      highPriorityTickets,
      ticketsByStatus: ticketsByStatus.map((item) => ({
        status: item.status,
        count: item._count,
      })),
      ticketsByPriority: ticketsByPriority.map((item) => ({
        priority: item.priority,
        count: item._count,
      })),
      recentTickets: formattedRecentTickets,
      ticketsOverTime: ticketsOverTimeArray,
      ticketsWithAssets,
      ticketsWithoutAssets: totalTickets - ticketsWithAssets,
    };

    res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
    return res.status(200).json(response);
  } catch (dbError) {
    logApiEvent('Database error', dbError);
    return res.status(500).json({
      error: 'Database error',
      details: dbError instanceof Error ? dbError.message : 'Unknown database error',
    });
  }
}
