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

    // Find vehicle assigned to this user with rental and user details
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
      include: {
        rentals: {
          where: {
            userId: user.id,
            status: 'ACTIVE',
          },
          include: {
            user: true
          },
          take: 1
        }
      }
    });

    if (!vehicle) {
      return res.status(404).json({ 
        error: 'No vehicle assigned to you',
        message: 'You do not have any vehicle assigned to you currently.'
      });
    }

    // Calculate total distance traveled by this vehicle with this user
    const vehicleLocations = await prisma.vehicleLocation.findMany({
      where: {
        vehicleId: vehicle.id,
        // Note: VehicleLocation doesn't have userId field according to the schema
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    // Calculate total distance from location points
    let totalDistance = 0;
    if (vehicleLocations.length > 1) {
      for (let i = 1; i < vehicleLocations.length; i++) {
        const prevLocation = vehicleLocations[i - 1];
        const currLocation = vehicleLocations[i];
        
        // Calculate distance between consecutive points
        const distance = calculateDistance(
          prevLocation.latitude,
          prevLocation.longitude,
          currLocation.latitude,
          currLocation.longitude
        );
        
        // Only add reasonable distances (less than 10km between consecutive points)
        // This helps filter out GPS jumps
        if (distance < 10) {
          totalDistance += distance;
        }
      }
    }

    // Log the access
    try {
      await logDataAccess(
        'vehicle',
        vehicle.id,
        { 
          action: 'VEHICLE_DETAILS_VIEW', 
          description: `Driver viewed assigned vehicle details` 
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    return res.status(200).json({ 
      vehicle,
      totalDistance
    });
  } catch (error) {
    console.error('Error fetching assigned vehicle:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Function to calculate distance between two coordinates in kilometers
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
}