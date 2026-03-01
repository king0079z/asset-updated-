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

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Driver ID is required' });
    }

    // Get driver information
    const driver = await prisma.user.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      }
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Get all vehicles assigned to this driver
    const vehicleRentals = await prisma.vehicleRental.findMany({
      where: {
        userId: id,
      },
      include: {
        vehicle: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    // Create a map to track unique vehicles and their latest rental date
    const uniqueVehiclesMap = new Map();
    
    // Process rentals to get unique vehicles with their latest rental date
    vehicleRentals.forEach(rental => {
      const vehicleId = rental.vehicleId;
      
      if (!uniqueVehiclesMap.has(vehicleId) || 
          new Date(rental.startDate) > new Date(uniqueVehiclesMap.get(vehicleId).startDate)) {
        uniqueVehiclesMap.set(vehicleId, {
          vehicle: rental.vehicle,
          startDate: rental.startDate
        });
      }
    });

    // Get all trips for each unique vehicle
    const vehiclesWithTrips = await Promise.all(
      Array.from(uniqueVehiclesMap.entries()).map(async ([vehicleId, data]) => {
        const trips = await prisma.vehicleTrip.findMany({
          where: {
            vehicleId: vehicleId,
            userId: id,
            endTime: {
              not: null // Only completed trips
            }
          },
          orderBy: {
            startTime: 'desc',
          },
        });

        return {
          vehicle: data.vehicle,
          trips,
          assignmentDate: data.startDate // Include the assignment date
        };
      })
    );

    // Log the access
    try {
      await logDataAccess(
        'user',
        user.id,
        { 
          action: 'DRIVER_DETAILS_VIEW', 
          description: `User viewed driver details for driver ${id}` 
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    return res.status(200).json({ 
      driver,
      vehiclesWithTrips
    });
  } catch (error) {
    console.error('Error fetching driver details:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}