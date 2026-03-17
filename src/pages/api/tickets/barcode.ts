import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

// Enhanced logging function with error handling
const logApiEvent = (message: string, data?: any) => {
  try {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} [Tickets Barcode API] ${message}`);
    if (data) {
      // Safely stringify objects, handling circular references
      if (typeof data === 'object' && data !== null) {
        let safeData;
        try {
          // Use a replacer function to handle circular references
          const seen = new WeakSet();
          safeData = JSON.stringify(data, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) {
                return '[Circular Reference]';
              }
              seen.add(value);
            }
            return value;
          });
        } catch (stringifyError) {
          safeData = `[Object that couldn't be stringified: ${stringifyError.message}]`;
        }
        console.log(`${timestamp} [Tickets Barcode API] Data:`, safeData);
      } else {
        console.log(`${timestamp} [Tickets Barcode API] Data:`, data);
      }
    }
  } catch (loggingError) {
    // Fallback logging if the enhanced logging fails
    console.error('Error in logging function:', loggingError);
    console.log('Original message:', message);
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  logApiEvent(`Tickets Barcode API: Received ${req.method} request`);
  
  try {
    // Create Supabase client and authenticate user
    const supabase = createClient(req, res);
    
    // Wrap auth check in try-catch to handle potential Supabase errors
    let user;
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      user = session?.user ?? null;
      
      if (authError || !user || !user.id) {
        logApiEvent('Authentication error', authError || 'No user found');
        return res.status(401).json({ error: 'Unauthorized - Please log in to continue' });
      }
      
      logApiEvent(`User authenticated successfully`, { userId: user.id });
    } catch (authError) {
      logApiEvent('Unexpected authentication error', authError);
      return res.status(500).json({ error: 'Authentication service error - Please try again later' });
    }

    if (req.method === 'GET') {
      try {
        const { barcode } = req.query;
        
        if (!barcode || typeof barcode !== 'string') {
          logApiEvent('Missing or invalid barcode parameter');
          return res.status(400).json({ error: 'Barcode parameter is required' });
        }
        
        logApiEvent(`Searching for ticket with barcode: ${barcode}`);
        
        // Find ticket by barcode
        const ticket = await prisma.ticket.findUnique({
          where: {
            barcode: barcode
          },
          include: {
            asset: {
              select: {
                id: true,
                name: true,
                assetId: true,
              },
            },
          },
        });
        
        if (!ticket) {
          logApiEvent(`No ticket found with barcode: ${barcode}`);
          return res.status(404).json({ error: 'No ticket found with this barcode' });
        }
        
        // Format dates to ISO strings to ensure proper serialization
        const formattedTicket = {
          ...ticket,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString()
        };
        
        logApiEvent(`Found ticket with barcode ${barcode}`, { ticketId: ticket.id });
        return res.status(200).json(formattedTicket);
      } catch (error) {
        logApiEvent('Error searching for ticket by barcode', error);
        
        // Log the full error details for debugging
        if (error instanceof Error) {
          console.error(`Error name: ${error.name}`);
          console.error(`Error message: ${error.message}`);
          console.error(`Error stack: ${error.stack}`);
        }
        
        return res.status(500).json({ 
          error: 'Failed to search for ticket', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    logApiEvent('Unexpected error in tickets barcode API', error);
    
    // Log the full error details for debugging
    if (error instanceof Error) {
      console.error(`Error name: ${error.name}`);
      console.error(`Error message: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
    }
    
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}