import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from "@/util/supabase/api";
import { TicketStatus, TicketPriority } from '@prisma/client';

// Enhanced logging function
const logApiEvent = (message: string, data?: any) => {
  try {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} [Tickets Stats API] ${message}`);
    if (data) {
      console.log(`${timestamp} [Tickets Stats API] Data:`, 
        typeof data === 'object' ? JSON.stringify(data) : data);
    }
  } catch (loggingError) {
    console.error('Error in logging function:', loggingError);
    console.log('Original message:', message);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  logApiEvent('Received request');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      logApiEvent('Authentication error', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    logApiEvent('Processing ticket stats for user', user.id);

    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    try {
      // Get basic ticket stats
      const [
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        closedTickets,
        criticalTickets,
        highPriorityTickets
      ] = await Promise.all([
        prisma.ticket.count({
          where: { userId: user.id }
        }),
        prisma.ticket.count({
          where: { 
            userId: user.id,
            status: TicketStatus.OPEN
          }
        }),
        prisma.ticket.count({
          where: { 
            userId: user.id,
            status: TicketStatus.IN_PROGRESS
          }
        }),
        prisma.ticket.count({
          where: { 
            userId: user.id,
            status: TicketStatus.RESOLVED
          }
        }),
        prisma.ticket.count({
          where: { 
            userId: user.id,
            status: TicketStatus.CLOSED
          }
        }),
        prisma.ticket.count({
          where: { 
            userId: user.id,
            priority: TicketPriority.CRITICAL
          }
        }),
        prisma.ticket.count({
          where: { 
            userId: user.id,
            priority: TicketPriority.HIGH
          }
        })
      ]);

      // Get tickets by status
      const ticketsByStatus = await prisma.ticket.groupBy({
        by: ['status'],
        _count: true,
        where: { userId: user.id }
      });

      // Get tickets by priority
      const ticketsByPriority = await prisma.ticket.groupBy({
        by: ['priority'],
        _count: true,
        where: { userId: user.id }
      });

      // Get recent tickets
      const recentTickets = await prisma.ticket.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          asset: {
            select: {
              id: true,
              name: true,
              assetId: true,
            }
          }
        }
      });

      // Get tickets created over time (last 30 days)
      const ticketsOverTime = await prisma.ticket.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: thirtyDaysAgo }
        },
        select: {
          id: true,
          createdAt: true,
          status: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      // Process tickets over time data
      const ticketsByDate = ticketsOverTime.reduce((acc, ticket) => {
        const date = ticket.createdAt.toISOString().split('T')[0];
        
        if (!acc[date]) {
          acc[date] = 0;
        }
        acc[date]++;
        return acc;
      }, {} as Record<string, number>);

      // Get tickets with assets vs without assets
      const ticketsWithAssets = await prisma.ticket.count({
        where: {
          userId: user.id,
          assetId: { not: null }
        }
      });

      // Format the response
      const formattedRecentTickets = recentTickets.map(ticket => ({
        id: ticket.id,
        displayId: ticket.displayId,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        asset: ticket.asset ? {
          id: ticket.asset.id,
          name: ticket.asset.name,
          assetId: ticket.asset.assetId
        } : null
      }));

      const ticketsOverTimeArray = Object.entries(ticketsByDate).map(([date, count]) => ({
        date,
        count
      }));

      const response = {
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        closedTickets,
        criticalTickets,
        highPriorityTickets,
        ticketsByStatus: ticketsByStatus.map(item => ({
          status: item.status,
          count: item._count
        })),
        ticketsByPriority: ticketsByPriority.map(item => ({
          priority: item.priority,
          count: item._count
        })),
        recentTickets: formattedRecentTickets,
        ticketsOverTime: ticketsOverTimeArray,
        ticketsWithAssets,
        ticketsWithoutAssets: totalTickets - ticketsWithAssets
      };

      logApiEvent('Successfully retrieved ticket stats');
      return res.status(200).json(response);
    } catch (dbError) {
      logApiEvent('Database error', dbError);
      return res.status(500).json({
        error: 'Database error',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      });
    }
  } catch (error) {
    logApiEvent('Unexpected error', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}