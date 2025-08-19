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

    // Find vehicle assigned to this user
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        rentals: {
          some: {
            userId: user.id,
            status: 'ACTIVE', // Only get vehicles that are currently rented by this user
          }
        },
        status: 'RENTED', // Only get vehicles that are currently rented
      },
      select: {
        id: true
      }
    });

    if (!vehicle) {
      return res.status(404).json({ 
        error: 'No vehicle assigned to you',
        message: 'You do not have any vehicle assigned to you currently.'
      });
    }

    // Get all completed trips for this vehicle with this user
    const trips = await prisma.vehicleTrip.findMany({
      where: {
        vehicleId: vehicle.id,
        userId: user.id,
        endTime: {
          not: null // Only completed trips
        }
      },
      select: {
        startTime: true,
        endTime: true,
        distance: true
      }
    });

    // Calculate total duration in milliseconds
    let totalDurationMs = 0;
    let totalDistance = 0;

    trips.forEach(trip => {
      if (trip.endTime && trip.startTime) {
        const startTime = new Date(trip.startTime);
        const endTime = new Date(trip.endTime);
        let durationMs = endTime.getTime() - startTime.getTime();
        
        // Handle case where endTime might be before startTime (data inconsistency)
        if (durationMs < 0) {
          console.warn('Trip duration calculation resulted in negative value, using absolute value instead');
          durationMs = Math.abs(durationMs);
        }
        
        totalDurationMs += durationMs;
        totalDistance += trip.distance || 0;
      }
    });

    // Format total duration
    const totalDuration = formatDuration(totalDurationMs);

    // Log the access
    try {
      await logDataAccess(
        'vehicle',
        vehicle.id,
        { 
          action: 'VEHICLE_TRIP_STATS_VIEW', 
          description: `Driver viewed vehicle trip statistics` 
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    return res.status(200).json({ 
      totalDuration,
      totalDurationMs,
      totalDistance,
      tripCount: trips.length
    });
  } catch (error) {
    console.error('Error fetching trip statistics:', error);
    return res.status(500).json({ error: 'Internal server error' });
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