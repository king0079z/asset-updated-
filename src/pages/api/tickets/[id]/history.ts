import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
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
    // Create Supabase client and authenticate user
    const supabase = createClient(req, res);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      logApiEvent('Authentication error', authError);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract and validate ticket ID from URL
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      logApiEvent('Invalid ticket ID provided', id);
      return res.status(400).json({ error: 'Invalid ticket ID' });
    }

    logApiEvent(`Processing ${req.method} request for ticket ${id} from user: ${user.id}`);

    if (req.method === 'GET') {
      try {
        // First check if the ticket belongs to the user
        const ticket = await prisma.ticket.findFirst({
          where: { 
            id,
            userId: user.id
          }
        });

        if (!ticket) {
          logApiEvent(`Ticket ${id} not found for user ${user.id}`);
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

        // First check if the ticket belongs to the user
        const ticket = await prisma.ticket.findFirst({
          where: { 
            id,
            userId: user.id
          }
        });

        if (!ticket) {
          logApiEvent(`Ticket ${id} not found for user ${user.id}`);
          return res.status(404).json({ error: 'Ticket not found' });
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