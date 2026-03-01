import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Create Supabase client and authenticate user
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if the user has admin privileges (you may want to add more checks)
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // Count tickets without displayId
    const ticketsWithoutDisplayId = await prisma.ticket.count({
      where: {
        displayId: null
      }
    });

    console.log(`Found ${ticketsWithoutDisplayId} tickets without displayId`);

    if (ticketsWithoutDisplayId === 0) {
      return res.status(200).json({ message: 'No tickets need updating' });
    }

    // Get all tickets without displayId
    const tickets = await prisma.ticket.findMany({
      where: {
        displayId: null
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`Processing ${tickets.length} tickets...`);

    // Update each ticket with a displayId
    const updatedTickets = [];
    for (const ticket of tickets) {
      // Generate a user-friendly display ID in format TKT-YYYYMMDD-XXXX
      const createdAt = ticket.createdAt;
      const datePart = createdAt.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Get the count of tickets created on the same day before this ticket
      const todayStart = new Date(createdAt);
      todayStart.setHours(0, 0, 0, 0);
      
      const todayEnd = new Date(createdAt);
      todayEnd.setHours(23, 59, 59, 999);
      
      const sameDayEarlierTicketsCount = await prisma.ticket.count({
        where: {
          createdAt: {
            gte: todayStart,
            lte: createdAt
          },
          NOT: {
            id: ticket.id
          }
        }
      });
      
      // Format the sequential number with leading zeros
      const sequentialNumber = String(sameDayEarlierTicketsCount + 1).padStart(4, '0');
      const displayId = `TKT-${datePart}-${sequentialNumber}`;
      
      console.log(`Assigning displayId ${displayId} to ticket ${ticket.id}`);
      
      // Update the ticket
      const updatedTicket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { displayId }
      });
      
      updatedTickets.push({
        id: updatedTicket.id,
        displayId: updatedTicket.displayId
      });
    }

    return res.status(200).json({ 
      message: `Successfully updated ${updatedTickets.length} tickets with display IDs`,
      updatedTickets
    });
  } catch (error) {
    console.error('Error updating ticket display IDs:', error);
    return res.status(500).json({ 
      error: 'Failed to update ticket display IDs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}