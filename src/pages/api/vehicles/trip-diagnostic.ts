import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate the user
    const supabase = createClient(req, res);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user information
    const userInfo = {
      id: user.id,
      email: user.email
    };

    // Get all trips in the system (for diagnostic purposes)
    const allTrips = await prisma.vehicleTrip.findMany({
      select: {
        id: true,
        userId: true,
        vehicleId: true,
        startTime: true,
        endTime: true,
        distance: true,
        completionStatus: true,
        createdAt: true
      }
    });

    // Get user's vehicle rental information
    const userRentals = await prisma.vehicleRental.findMany({
      where: {
        userId: user.id
      },
      include: {
        vehicle: true
      }
    });

    // Get all vehicles assigned to this user
    const userVehicles = await prisma.vehicle.findMany({
      where: {
        rentals: {
          some: {
            userId: user.id
          }
        }
      },
      select: {
        id: true,
        name: true,
        plateNumber: true,
        status: true
      }
    });

    // Get user's trips specifically
    const userTrips = await prisma.vehicleTrip.findMany({
      where: {
        userId: user.id
      },
      select: {
        id: true,
        vehicleId: true,
        startTime: true,
        endTime: true,
        distance: true,
        completionStatus: true,
        createdAt: true
      }
    });

    return res.status(200).json({
      userInfo,
      userVehicles,
      userRentals,
      userTrips,
      allTrips,
      tripCount: allTrips.length,
      userTripCount: userTrips.length
    });
  } catch (error) {
    console.error('Error in trip diagnostic:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}