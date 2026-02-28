// @ts-nocheck
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
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get trip data from request body
    const { 
      startTime = new Date(), 
      startLatitude, 
      startLongitude,
      accuracy = null,
      locationSource = 'gps',
      isAutoStarted = false
    } = req.body;

    // Validate required fields
    if (!startLatitude || !startLongitude) {
      return res.status(400).json({ error: 'Missing required location data' });
    }

    // Validate location accuracy if provided
    if (accuracy !== null) {
      // If accuracy is poor (>100m), warn the user but still allow the trip to start
      if (accuracy > 100) {
        console.warn(`Starting trip with poor location accuracy: ${accuracy}m`);
      }
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

    // Parse coordinates to ensure they're numbers
    const parsedStartLatitude = parseFloat(startLatitude.toString());
    const parsedStartLongitude = parseFloat(startLongitude.toString());

    // Validate coordinates are within valid ranges
    if (isNaN(parsedStartLatitude) || isNaN(parsedStartLongitude) ||
        parsedStartLatitude < -90 || parsedStartLatitude > 90 ||
        parsedStartLongitude < -180 || parsedStartLongitude > 180) {
      return res.status(400).json({ 
        error: 'Invalid coordinates',
        message: 'The provided coordinates are outside valid ranges.'
      });
    }

    // If there's an active trip, automatically end it before starting a new one
    if (activeTrip) {
      console.log(`Automatically ending active trip ${activeTrip.id} before starting a new one`);
      
      try {
        // Update the trip record with end time and location
        await prisma.vehicleTrip.update({
          where: { id: activeTrip.id },
          data: {
            endTime: new Date(),
            endLatitude: parsedStartLatitude,
            endLongitude: parsedStartLongitude,
            isAutoEnded: true,
            completionStatus: 'INCOMPLETE',
            metadata: {
              ...activeTrip.metadata || {},
              autoEndReason: 'new_trip_started',
              endLocationSource: locationSource,
              endPointAccuracy: accuracy
            }
          }
        });
        
        // Log the auto-ending of the previous trip
        try {
          await logDataAccess(
            'vehicle',
            vehicle.id,
            { 
              action: 'VEHICLE_TRIP_AUTO_ENDED', 
              description: `Previous trip automatically ended to start a new trip`
            }
          );
        } catch (logError) {
          console.error('Error creating audit log for auto-ending trip:', logError);
          // Continue execution even if logging fails
        }
      } catch (endTripError) {
        console.error('Error automatically ending active trip:', endTripError);
        // Continue with starting new trip even if ending the previous one fails
      }
    }

    // Create location metadata
    const locationMetadata = {
      accuracy: accuracy,
      source: locationSource,
      timestamp: new Date(startTime),
      isStartPoint: true
    };

    // Create a new trip record with enhanced data
    const trip = await prisma.vehicleTrip.create({
      data: {
        vehicleId: vehicle.id,
        userId: user.id,
        startTime: new Date(startTime),
        startLatitude: parsedStartLatitude,
        startLongitude: parsedStartLongitude,
        isAutoStarted: isAutoStarted || false,
        distance: 0,
        metadata: {
          startPointAccuracy: accuracy,
          startLocationSource: locationSource,
          deviceInfo: req.headers['user-agent'] || 'unknown'
        }
      }
    });

    // Also record trip start location in the location history with metadata
    await prisma.vehicleLocation.create({
      data: {
        vehicleId: vehicle.id,
        latitude: parsedStartLatitude,
        longitude: parsedStartLongitude,
        timestamp: new Date(startTime),
        userId: user.id,
        metadata: locationMetadata
      },
    });

    // Log the action with enhanced information
    try {
      await logDataAccess(
        'vehicle',
        vehicle.id,
        { 
          action: 'VEHICLE_TRIP_STARTED', 
          description: isAutoStarted 
            ? `Trip auto-started due to vehicle movement (accuracy: ${accuracy || 'unknown'}m)` 
            : `Driver manually started trip (accuracy: ${accuracy || 'unknown'}m, source: ${locationSource})`
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    console.log(`Trip started for vehicle ${vehicle.id} at coordinates (${parsedStartLatitude}, ${parsedStartLongitude}) with accuracy ${accuracy || 'unknown'}m`);

    return res.status(200).json({ 
      message: 'Trip started successfully',
      tripStarted: true,
      tripId: trip.id,
      startTime: new Date(startTime),
      startLocation: {
        latitude: parsedStartLatitude,
        longitude: parsedStartLongitude,
        accuracy: accuracy
      },
      locationQuality: accuracy 
        ? accuracy < 20 
          ? 'excellent' 
          : accuracy < 50 
            ? 'good' 
            : accuracy < 100 
              ? 'fair' 
              : 'poor'
        : 'unknown'
    });
  } catch (error) {
    console.error('Error starting trip:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}