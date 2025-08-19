import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataAccess } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Invalid vehicle ID' });
    }

    // Check if vehicle exists
    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: id,
      },
    });

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    // Get all rental history for this vehicle
    const rentalHistory = await prisma.vehicleRental.findMany({
      where: {
        vehicleId: id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    // Log the access
    try {
      await logDataAccess(
        'vehicle',
        id,
        { 
          action: 'VEHICLE_RENTAL_HISTORY_VIEW', 
          description: `User viewed vehicle rental history` 
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    return res.status(200).json({ rentalHistory });
  } catch (error) {
    console.error('Error fetching vehicle rental history:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}