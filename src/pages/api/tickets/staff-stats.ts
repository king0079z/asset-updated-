import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';
import { TicketStatus } from '@prisma/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    // Fetch all users (staff) with their assigned tickets
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        assignedTickets: {
          select: {
            id: true,
            displayId: true,
            title: true,
            status: true,
            priority: true,
            ticketType: true,
            category: true,
            subcategory: true,
            createdAt: true,
            updatedAt: true,
            history: {
              where: {
                status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
              },
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { createdAt: true, status: true },
            },
          },
        },
      },
      orderBy: { email: 'asc' },
    });

    // Compute stats per user
    const staffStats = users
      .filter(u => u.assignedTickets.length > 0 || u.role !== 'ADMIN') // include all non-admin
      .map(u => {
        const tickets = u.assignedTickets;
        const openTickets = tickets.filter(t => t.status === TicketStatus.OPEN);
        const inProgressTickets = tickets.filter(t => t.status === TicketStatus.IN_PROGRESS);
        const resolvedTickets = tickets.filter(t => t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED);
        const activeTickets = [...openTickets, ...inProgressTickets];

        // Calculate average resolution time (ms) for resolved tickets
        const resolutionTimes = resolvedTickets
          .map(t => {
            const resolvedAt = t.history[0]?.createdAt;
            if (!resolvedAt) return null;
            return resolvedAt.getTime() - t.createdAt.getTime();
          })
          .filter((v): v is number => v !== null);

        const avgResolutionMs = resolutionTimes.length > 0
          ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
          : null;

        // Format avg resolution time nicely
        const formatDuration = (ms: number | null): string => {
          if (ms === null) return 'N/A';
          const hours = ms / (1000 * 60 * 60);
          if (hours < 1) return `${Math.round(ms / 60000)}m`;
          if (hours < 24) return `${Math.round(hours)}h`;
          const days = Math.floor(hours / 24);
          const remHours = Math.round(hours % 24);
          return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
        };

        // Workload score (higher = more loaded)
        const workloadScore = (openTickets.length * 3) + (inProgressTickets.length * 2);

        // Critical tickets count
        const criticalCount = activeTickets.filter(t => t.priority === 'CRITICAL').length;
        const highCount = activeTickets.filter(t => t.priority === 'HIGH').length;

        return {
          id: u.id,
          email: u.email,
          name: u.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          role: u.role,
          stats: {
            total: tickets.length,
            open: openTickets.length,
            inProgress: inProgressTickets.length,
            resolved: resolvedTickets.length,
            active: activeTickets.length,
            critical: criticalCount,
            high: highCount,
          },
          avgResolutionMs,
          avgResolutionFormatted: formatDuration(avgResolutionMs),
          workloadScore,
          activeTickets: activeTickets.slice(0, 5).map(t => ({
            id: t.id,
            displayId: t.displayId,
            title: t.title,
            status: t.status,
            priority: t.priority,
            ticketType: t.ticketType,
            subcategory: t.subcategory,
            createdAt: t.createdAt.toISOString(),
          })),
        };
      });

    // Sort by workload score descending
    staffStats.sort((a, b) => b.workloadScore - a.workloadScore);

    return res.status(200).json({ staff: staffStats });
  } catch (error) {
    console.error('Staff stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch staff stats' });
  }
}
