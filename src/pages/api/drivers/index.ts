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
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all users who have been assigned vehicles
    const drivers = await prisma.user.findMany({
      where: {
        vehicles: {
          some: {} // Users who have at least one vehicle rental
        }
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        vehicles: {
          select: {
            id: true,
            vehicleId: true,
          }
        },
        _count: {
          select: {
            vehicles: true, // Count of vehicle rentals
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // For each driver, get trip statistics
    const driversWithStats = await Promise.all(
      drivers.map(async (driver) => {
        // Get all trips for this driver
        const trips = await prisma.vehicleTrip.findMany({
          where: {
            userId: driver.id,
            endTime: {
              not: null // Only completed trips
            }
          },
          select: {
            startTime: true,
            endTime: true,
            distance: true,
          }
        });

        // Calculate total distance and hours
        let totalDistance = 0;
        let totalHours = 0;

        trips.forEach(trip => {
          totalDistance += trip.distance || 0;
          
          if (trip.endTime && trip.startTime) {
            const durationMs = new Date(trip.endTime).getTime() - new Date(trip.startTime).getTime();
            const durationHours = durationMs / (1000 * 60 * 60);
            totalHours += durationHours;
          }
        });

        // Get unique vehicles assigned to this driver (matching the driver details page)
        const uniqueVehicleIds = new Set();
        driver.vehicles.forEach(rental => {
          uniqueVehicleIds.add(rental.vehicleId);
        });

        return {
          id: driver.id,
          email: driver.email,
          createdAt: driver.createdAt,
          vehicleCount: uniqueVehicleIds.size, // Count unique vehicles instead of rentals
          tripCount: trips.length,
          totalDistance,
          totalHours
        };
      })
    );

    // Log the access
    try {
      await logDataAccess(
        'user',
        user.id,
        { 
          action: 'DRIVERS_LIST_VIEW', 
          description: `User viewed the drivers list` 
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    return res.status(200).json({ 
      drivers: driversWithStats
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}