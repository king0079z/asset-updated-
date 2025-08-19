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

    // First, get all completed vehicle trips
    const vehicleTrips = await prisma.vehicleTrip.findMany({
      where: {
        endTime: {
          not: null // Only completed trips
        }
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        distance: true,
        vehicleId: true,
        userId: true,
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
            plateNumber: true,
            rentalAmount: true
          }
        }
      }
    });

    // Get unique user IDs from the trips
    const userIds = [...new Set(vehicleTrips.map(trip => trip.userId))];

    // Get user details for these IDs
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds
        }
      },
      select: {
        id: true,
        email: true,
        role: true
      }
    });

    // Combine the data
    const drivers = users.map(user => {
      const userTrips = vehicleTrips.filter(trip => trip.userId === user.id);
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        _count: {
          vehicleTrips: userTrips.length
        },
        vehicleTrips: userTrips
      };
    });

    // Calculate summary statistics
    const driverSummaries = drivers.map(driver => {
      // Calculate total distance
      const totalDistance = driver.vehicleTrips.reduce((sum, trip) => sum + (trip.distance || 0), 0);
      
      // Calculate total duration in milliseconds
      let totalDurationMs = 0;
      driver.vehicleTrips.forEach(trip => {
        if (trip.endTime && trip.startTime) {
          const startTime = new Date(trip.startTime);
          const endTime = new Date(trip.endTime);
          const durationMs = endTime.getTime() - startTime.getTime();
          totalDurationMs += durationMs > 0 ? durationMs : 0;
        }
      });
      
      // Calculate approximate fuel cost (assuming 10 QAR per liter and 10 km per liter)
      const fuelCostPerKm = 1; // 10 QAR per liter / 10 km per liter = 1 QAR per km
      const approximateFuelCost = totalDistance * fuelCostPerKm;
      
      // Get unique vehicles used by this driver
      const uniqueVehicles = Array.from(
        new Set(driver.vehicleTrips.map(trip => trip.vehicleId))
      ).map(vehicleId => {
        const vehicleTrip = driver.vehicleTrips.find(trip => trip.vehicleId === vehicleId);
        return vehicleTrip?.vehicle;
      }).filter(Boolean);
      
      return {
        driver: {
          id: driver.id,
          email: driver.email,
          name: driver.email?.split('@')[0] || 'Unknown',
          role: driver.role
        },
        tripCount: driver._count.vehicleTrips,
        totalDistance: totalDistance,
        totalDurationMs: totalDurationMs,
        totalDuration: formatDuration(totalDurationMs),
        approximateFuelCost: approximateFuelCost,
        vehicles: uniqueVehicles,
        vehicleCount: uniqueVehicles.length
      };
    });

    // Sort by total distance (descending)
    driverSummaries.sort((a, b) => b.totalDistance - a.totalDistance);

    // Calculate overall totals
    const overallSummary = {
      totalDrivers: driverSummaries.length,
      totalTrips: driverSummaries.reduce((sum, driver) => sum + driver.tripCount, 0),
      totalDistance: driverSummaries.reduce((sum, driver) => sum + driver.totalDistance, 0),
      totalDurationMs: driverSummaries.reduce((sum, driver) => sum + driver.totalDurationMs, 0),
      totalApproximateFuelCost: driverSummaries.reduce((sum, driver) => sum + driver.approximateFuelCost, 0),
      uniqueVehicleCount: new Set(
        driverSummaries.flatMap(driver => driver.vehicles.map(vehicle => vehicle?.id))
      ).size
    };

    // Log the access
    try {
      await logDataAccess(
        'user',
        user.id,
        { 
          action: 'DRIVER_TRIP_SUMMARY_VIEW', 
          description: `User viewed driver trip summary report` 
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    return res.status(200).json({ 
      driverSummaries,
      overallSummary,
      totalDuration: formatDuration(overallSummary.totalDurationMs)
    });
  } catch (error) {
    console.error('Error fetching driver trip summary:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Format time duration from milliseconds
function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}