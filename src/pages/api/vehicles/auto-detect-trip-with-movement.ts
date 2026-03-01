import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
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

    // Get location and movement data from request body
    const { 
      latitude, 
      longitude,
      movementType,
      movementConfidence,
      timestamp = new Date(),
      destinationLatitude,
      destinationLongitude
    } = req.body;

    // Validate required fields
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Missing required location data' });
    }

    // Log the movement type for debugging
    console.log('Auto-detect trip with movement:', { 
      movementType, 
      movementConfidence,
      latitude,
      longitude
    });

    // Find vehicle assigned to this user
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        rentals: {
          some: {
            userId: user.id,
            status: 'ACTIVE',
          }
        },
        status: 'RENTED',
      },
    });

    if (!vehicle) {
      return res.status(404).json({ 
        error: 'No vehicle assigned to you',
        message: 'You do not have any vehicle assigned to you currently.'
      });
    }

    // Check if there's already an active trip
    const activeTrip = await prisma.vehicleTrip.findFirst({
      where: {
        vehicleId: vehicle.id,
        userId: user.id,
        endTime: null // No end time means it's active
      }
    });

    if (activeTrip) {
      return res.status(200).json({ 
        message: 'Active trip already exists',
        tripDetected: false,
        hasActiveTrip: true,
        tripId: activeTrip.id
      });
    }

    // Only proceed if movement type is "vehicle" with sufficient confidence
    if (movementType !== 'vehicle' || movementConfidence < 0.6) {
      return res.status(200).json({
        message: `Not in a vehicle (detected: ${movementType}, confidence: ${movementConfidence})`,
        tripDetected: false,
        movementType,
        movementConfidence
      });
    }

    // Get previous trips to find potential starting points
    const previousTrips = await prisma.vehicleTrip.findMany({
      where: {
        vehicleId: vehicle.id,
        userId: user.id,
        endTime: {
          not: null // Only completed trips
        }
      },
      orderBy: {
        endTime: 'desc',
      },
      take: 5
    });

    // Check if current location is within 800 meters of any previous starting point
    // or the specified destination (if provided)
    let isNearStartingPoint = false;
    let isNearDestination = false;
    let isNearTargetEndPoint = false;
    let closestStartPoint = null;
    let closestDistance = Infinity;
    
    // First check if we're near any previous starting points
    for (const trip of previousTrips) {
      const distanceToStart = calculateDistance(
        trip.startLatitude,
        trip.startLongitude,
        parseFloat(latitude.toString()),
        parseFloat(longitude.toString())
      );
      
      if (distanceToStart < closestDistance) {
        closestDistance = distanceToStart;
        closestStartPoint = {
          latitude: trip.startLatitude,
          longitude: trip.startLongitude
        };
      }
      
      if (distanceToStart < 0.8) { // Within 800 meters
        isNearStartingPoint = true;
        break;
      }
    }
    
    // If not near any previous starting point, also check ending points
    if (!isNearStartingPoint && previousTrips.length > 0) {
      for (const trip of previousTrips) {
        if (trip.endLatitude && trip.endLongitude) {
          const distanceToEnd = calculateDistance(
            trip.endLatitude,
            trip.endLongitude,
            parseFloat(latitude.toString()),
            parseFloat(longitude.toString())
          );
          
          if (distanceToEnd < closestDistance) {
            closestDistance = distanceToEnd;
            closestStartPoint = {
              latitude: trip.endLatitude,
              longitude: trip.endLongitude
            };
          }
          
          if (distanceToEnd < 0.8) { // Within 800 meters
            isNearStartingPoint = true;
            break;
          }
        }
      }
    }

    // Check if we're near the destination (if provided)
    if (destinationLatitude && destinationLongitude) {
      const distanceToDestination = calculateDistance(
        parseFloat(destinationLatitude.toString()),
        parseFloat(destinationLongitude.toString()),
        parseFloat(latitude.toString()),
        parseFloat(longitude.toString())
      );

      if (distanceToDestination < 0.8) { // Within 800 meters of destination
        isNearDestination = true;
        
        // If we're closer to the destination than any starting point, use it
        if (distanceToDestination < closestDistance) {
          closestDistance = distanceToDestination;
          closestStartPoint = {
            latitude: parseFloat(destinationLatitude.toString()),
            longitude: parseFloat(destinationLongitude.toString())
          };
        }
      }
    }
    
    // If not near any known point, don't start a trip
    if (!isNearStartingPoint && !isNearDestination) {
      return res.status(200).json({
        message: 'Not near any known starting point or destination',
        tripDetected: false,
        closestDistance
      });
    }

    // Create a new trip record
    const trip = await prisma.vehicleTrip.create({
      data: {
        vehicleId: vehicle.id,
        userId: user.id,
        startTime: new Date(timestamp),
        startLatitude: parseFloat(latitude.toString()),
        startLongitude: parseFloat(longitude.toString()),
        isAutoStarted: true,
        distance: 0
      }
    });

    // Also record trip start location in the location history
    await prisma.vehicleLocation.create({
      data: {
        vehicleId: vehicle.id,
        latitude: parseFloat(latitude.toString()),
        longitude: parseFloat(longitude.toString()),
        timestamp: new Date(timestamp)
      },
    });

    // Log the action
    try {
      await logDataAccess(
        'vehicle',
        vehicle.id,
        { 
          action: 'VEHICLE_TRIP_AUTO_DETECTED', 
          description: `Trip auto-detected and started due to vehicle movement near ${isNearDestination ? 'destination' : 'known starting point'} (${closestDistance.toFixed(2)}km) with movement type: ${movementType}, confidence: ${movementConfidence.toFixed(2)}`
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    return res.status(200).json({ 
      message: 'Trip auto-detected and started successfully',
      tripDetected: true,
      tripId: trip.id,
      startTime: timestamp,
      startLocation: {
        latitude,
        longitude
      },
      movementType,
      movementConfidence
    });
  } catch (error) {
    console.error('Error auto-detecting trip with movement:', error);
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