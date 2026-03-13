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

    // Get location data from request body
    const { 
      latitude, 
      longitude,
      timestamp = new Date()
    } = req.body;

    // Validate required fields
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Missing required location data' });
    }

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

    // Check if we're within duty hours
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute; // Convert to minutes since midnight
    
    // Duty hours: Sunday to Thursday, 8:00 AM to 2:30 PM
    const isDutyDay = dayOfWeek >= 0 && dayOfWeek <= 4; // Sunday to Thursday
    const dutyStartTime = 8 * 60; // 8:00 AM in minutes
    const dutyEndTime = 14 * 60 + 30; // 2:30 PM in minutes
    
    const isDutyHours = isDutyDay && currentTime >= dutyStartTime && currentTime <= dutyEndTime;
    
    if (!isDutyHours) {
      return res.status(200).json({
        message: 'Outside of duty hours, no automatic trip detection',
        tripDetected: false,
        isDutyHours: false
      });
    }

    // Get recent locations to check for movement
    const recentLocations = await prisma.vehicleLocation.findMany({
      where: {
        vehicleId: vehicle.id,
        timestamp: {
          gte: new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
        }
      },
      orderBy: {
        timestamp: 'asc',
      },
      take: 10
    });

    // If we have at least 2 locations, check if there's significant movement
    if (recentLocations.length >= 2) {
      // Get the first and last location to check total movement
      const firstLocation = recentLocations[0];
      const lastLocation = recentLocations[recentLocations.length - 1];
      
      // Calculate distance between first and last point
      const distance = calculateDistance(
        firstLocation.latitude,
        firstLocation.longitude,
        lastLocation.latitude,
        lastLocation.longitude
      );
      
      // If moved more than 50 meters, consider it significant movement
      const hasSignificantMovement = distance > 0.05;
      
      if (!hasSignificantMovement) {
        return res.status(200).json({
          message: 'No significant movement detected',
          tripDetected: false,
          distance
        });
      }
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
    let isNearStartingPoint = false;
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
    
    if (!isNearStartingPoint) {
      return res.status(200).json({
        message: 'Not near any known starting point',
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
          description: `Trip auto-detected and started due to vehicle movement near known starting point (${closestDistance.toFixed(2)}km)`
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
      }
    });
  } catch (error) {
    console.error('Error auto-detecting trip:', error);
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