import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate the user
    const supabase = createClient(req, res);
    const { data: { session }, error } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (error || !user) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all vehicle rentals for this user (both active and past)
    const vehicleRentals = await prisma.vehicleRental.findMany({
      where: {
        userId: user.id,
      },
      include: {
        vehicle: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    // Log the access
    try {
      await logDataAccess(
        'vehicleRental',
        user.id,
        { 
          action: 'VEHICLE_HISTORY_VIEW', 
          description: `User viewed their vehicle assignment history` 
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    return res.status(200).json({ 
      vehicleRentals
    });
  } catch (error) {
    console.error('Error fetching vehicle assignment history:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}