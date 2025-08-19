import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';

// Helper function to calculate distance between two coordinates in kilometers
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

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

    // Get all trips for this user
    const vehicleTrips = await prisma.vehicleTrip.findMany({
      where: {
        userId: user.id,
        endTime: {
          not: null // Only completed trips
        }
      },
      include: {
        vehicle: true,
      },
      orderBy: {
        startTime: 'desc',
      },
    });
    
    // Process route points to calculate durations for stops
    const processedTrips = vehicleTrips.map(trip => {
      if (trip.routePoints) {
        const routePointsArray = trip.routePoints as any[];
        if (routePointsArray.length > 0) {
          // Calculate duration at each point (time spent stationary)
          const processedRoutePoints = routePointsArray.map((point, index, arr) => {
            if (index < arr.length - 1) {
              // Calculate time difference to next point in seconds
              const currentTime = new Date(point.timestamp).getTime();
              const nextTime = new Date(arr[index + 1].timestamp).getTime();
              const duration = (nextTime - currentTime) / 1000; // in seconds
              
              // If duration is more than 60 seconds (1 minute), consider it a stop
              if (duration > 60) {
                return { ...point, duration };
              }
            }
            return point;
          });
          
          return {
            ...trip,
            routePoints: processedRoutePoints
          };
        }
      }
      return trip;
    });

    // Log the access
    try {
      await logDataAccess(
        'vehicleTrip',
        user.id,
        { 
          action: 'VEHICLE_TRIP_HISTORY_VIEW', 
          description: `User viewed their vehicle trip history` 
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    return res.status(200).json({ 
      vehicleTrips: processedTrips
    });
  } catch (error) {
    console.error('Error fetching vehicle trip history:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}