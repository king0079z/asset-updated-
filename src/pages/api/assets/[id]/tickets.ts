import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

// Enhanced logging function
const logAssetTicketsEvent = (message: string, data?: any) => {
  try {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} [Asset Tickets API] ${message}`);
    if (data) {
      console.log(`${timestamp} [Asset Tickets API] Data:`, 
        typeof data === 'object' ? JSON.stringify(data) : data);
    }
  } catch (loggingError) {
    console.error('Error in logging function:', loggingError);
    console.log('Original message:', message);
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    logAssetTicketsEvent(`Method not allowed: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create Supabase client and authenticate user
    const supabase = createClient(req, res);
    const { data: { user } } = await supabase.auth.getSession();

    if (!user) {
      logAssetTicketsEvent('Unauthorized access attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    logAssetTicketsEvent(`User authenticated: ${user.id}`);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      logAssetTicketsEvent('Invalid asset ID', { id });
      return res.status(400).json({ error: 'Invalid asset ID' });
    }

    logAssetTicketsEvent(`Fetching tickets for asset: ${id}`);

    // First check if the asset exists
    const asset = await prisma.asset.findUnique({
      where: { id },
    });

    if (!asset) {
      logAssetTicketsEvent(`Asset not found: ${id}`);
      return res.status(404).json({ error: 'Asset not found' });
    }

    logAssetTicketsEvent(`Asset found: ${asset.name} (${asset.id})`);

    // Fetch tickets for this asset
    const tickets = await prisma.ticket.findMany({
      where: {
        assetId: id,
        // Removed userId filter to show all tickets linked to this asset
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    logAssetTicketsEvent(`Found ${tickets.length} tickets for asset: ${id}`);
    
    // Log ticket IDs for debugging
    if (tickets.length > 0) {
      logAssetTicketsEvent('Ticket IDs found:', tickets.map(t => ({ 
        id: t.id, 
        title: t.title,
        createdAt: t.createdAt
      })));
    } else {
      logAssetTicketsEvent('No tickets found for this asset');
    }

    // Format dates to ISO strings to ensure proper serialization
    const formattedTickets = tickets.map(ticket => ({
      ...ticket,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString()
    }));
  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');


    return res.status(200).json(formattedTickets);
  } catch (error) {
    console.error('Error fetching asset tickets:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}