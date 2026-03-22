import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';

// Enhanced logging function
const logApiEvent = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} [Ticket History API] ${message}`);
  if (data) {
    console.log(`${timestamp} [Ticket History API] Data:`, typeof data === 'object' ? JSON.stringify(data) : data);
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  logApiEvent(`Received ${req.method} request`);
  
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { user } = auth;

    // Extract and validate ticket ID from URL
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      logApiEvent('Invalid ticket ID provided', id);
      return res.status(400).json({ error: 'Invalid ticket ID' });
    }

    logApiEvent(`Processing ${req.method} request for ticket ${id} from user: ${user.id}`);

    if (req.method === 'GET') {
      try {
        // Fetch ticket, then verify access (owner, assignee, admin, or manager)
        const ticket = await prisma.ticket.findUnique({ where: { id } });
        if (!ticket) {
          logApiEvent(`Ticket ${id} not found`);
          return res.status(404).json({ error: 'Ticket not found' });
        }
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, isAdmin: true, organizationId: true },
        });
        const isAdminOrMgr = dbUser?.isAdmin || dbUser?.role === 'ADMIN' || dbUser?.role === 'MANAGER';
        const isOwnerOrAssignee = ticket.userId === user.id || ticket.assignedToId === user.id;
        if (!isOwnerOrAssignee && !isAdminOrMgr) {
          logApiEvent(`Access denied for user ${user.id} on ticket ${id}`);
          return res.status(404).json({ error: 'Ticket not found' });
        }

        // Get the ticket with its display ID
        const ticketDetails = await prisma.ticket.findUnique({
          where: { id },
          select: { 
            id: true, 
            displayId: true,
            title: true,
            status: true,
            priority: true
          }
        });

        // Fetch ticket history
        const history = await prisma.ticketHistory.findMany({
          where: { 
            ticketId: id
          },
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            user: {
              select: {
                id: true,
                email: true
              }
            }
          }
        });

        logApiEvent(`Successfully fetched ${history.length} history entries for ticket ${id}`);

        // Format the response
        const formattedHistory = history.map(entry => ({
          id: entry.id,
          ticketId: entry.ticketId,
          status: entry.status,
          priority: entry.priority,
          comment: entry.comment,
          user: {
            id: entry.user?.id || null,
            email: entry.user?.email || 'System'
          },
          createdAt: entry.createdAt.toISOString(),
          // Add the ticket display ID for better reference
          ticketDisplayId: ticketDetails?.displayId || `T-${id.substring(0, 8)}`,
          ticketTitle: ticketDetails?.title || 'Unknown Ticket',
          // Include resolution time information
          startedAt: entry.startedAt ? entry.startedAt.toISOString() : null,
          resolutionTime: entry.resolutionTime
        }));

        return res.status(200).json(formattedHistory);
      } catch (error) {
        logApiEvent('Error fetching ticket history', error);
        
        return res.status(500).json({ 
          error: 'Failed to fetch ticket history',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else if (req.method === 'POST') {
      try {
        const { status, priority, comment } = req.body;
        
        if (!comment || typeof comment !== 'string' || comment.trim() === '') {
          logApiEvent('Missing required comment');
          return res.status(400).json({ 
            error: 'Comment is required',
            details: 'Please provide a comment explaining the changes'
          });
        }

        // Fetch ticket then verify access
        const ticketPost = await prisma.ticket.findUnique({
          where: { id },
          select: { id: true, userId: true, displayId: true, assignedToId: true },
        });
        if (!ticketPost) {
          logApiEvent(`Ticket ${id} not found`);
          return res.status(404).json({ error: 'Ticket not found' });
        }
        const dbUserPost = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, isAdmin: true },
        });
        const canPostHistory = ticketPost.userId === user.id || ticketPost.assignedToId === user.id
          || dbUserPost?.isAdmin || dbUserPost?.role === 'ADMIN' || dbUserPost?.role === 'MANAGER';
        if (!canPostHistory) {
          return res.status(403).json({ error: 'Access denied' });
        }

        // Create history entry
        const historyEntry = await prisma.ticketHistory.create({
          data: {
            ticketId: id,
            status: status || null,
            priority: priority || null,
            comment,
            userId: user.id
          }
        });

        logApiEvent(`Created history entry ${historyEntry.id} for ticket ${id}`);

        // Notify ticket owner about the new activity (if the updater is not the owner)
        if (ticketPost.userId && ticketPost.userId !== user.id) {
          try {
            const summary = status ? `Status: ${status}. ` : priority ? `Priority: ${priority}. ` : '';
            await prisma.notification.create({
              data: {
                userId: ticketPost.userId,
                ticketId: id,
                type: 'TICKET_UPDATE',
                title: 'Ticket updated',
                message: `${ticketPost.displayId || id}: ${summary}${comment.substring(0, 120)}`,
              },
            });
          } catch { /* notification failure should not block the response */ }
        }

        return res.status(201).json({
          id: historyEntry.id,
          status: historyEntry.status,
          priority: historyEntry.priority,
          comment: historyEntry.comment,
          createdAt: historyEntry.createdAt.toISOString()
        });
      } catch (error) {
        logApiEvent('Error creating ticket history entry', error);
        
        return res.status(500).json({ 
          error: 'Failed to create ticket history entry',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    logApiEvent('Unexpected error in ticket history API', error);
    
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}