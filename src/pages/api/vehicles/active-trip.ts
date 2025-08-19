import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { calculateTripDistance, detectStopPoints, filterLocationPoints } from '@/util/tripTracking';

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
            status: 'ACTIVE',
          }
        },
        status: 'RENTED',
      },
    });

    if (!vehicle) {
      return res.status(200).json({ 
        hasActiveTrip: false,
        message: 'No vehicle assigned to you',
        trip: null
      });
    }

    // Check if there's an active trip
    const activeTrip = await prisma.vehicleTrip.findFirst({
      where: {
        vehicleId: vehicle.id,
        userId: user.id,
        endTime: null // No end time means it's active
      }
    });

    if (!activeTrip) {
      return res.status(200).json({ 
        hasActiveTrip: false,
        trip: null
      });
    }

    // Calculate trip duration
    const startTime = new Date(activeTrip.startTime);
    const now = new Date();
    const durationMs = now.getTime() - startTime.getTime();
    const durationMinutes = Math.floor(durationMs / (1000 * 60));

    // Get all location points for this trip
    const tripLocations = await prisma.vehicleLocation.findMany({
      where: {
        vehicleId: vehicle.id,
        timestamp: {
          gte: activeTrip.startTime
        }
      },
      orderBy: {
        timestamp: 'asc',
      },
      select: {
        latitude: true,
        longitude: true,
        timestamp: true
      }
    });

    // Create a simplified version of the location points for processing
    const locationPoints = tripLocations.map(loc => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
      timestamp: loc.timestamp,
      metadata: {} // Add empty metadata for compatibility with utility functions
    }));

    // Filter location points to remove GPS jumps and anomalies
    const filteredPoints = filterLocationPoints(locationPoints, {
      maxSpeed: 180, // 180 km/h max reasonable speed
      maxAcceleration: 5, // 5 m/s² max reasonable acceleration
      minAccuracy: 100 // 100 meters minimum accuracy
    });

    // Calculate accurate trip distance using filtered points
    const currentDistance = calculateTripDistance(filteredPoints);
    
    // Detect stop points during the trip
    const stopPoints = detectStopPoints(locationPoints, {
      minDuration: 3 * 60 * 1000, // 3 minutes minimum stop duration
      maxRadius: 50, // 50 meters maximum radius for a stop
      minConfidence: 0.6 // Minimum confidence to include a stop
    });

    // Get the most recent location
    const lastLocation = tripLocations.length > 0 
      ? tripLocations[tripLocations.length - 1] 
      : null;

    // Log detailed information for debugging
    console.log(`Active trip details for vehicle ${vehicle.id}:`, {
      tripId: activeTrip.id,
      totalPoints: tripLocations.length,
      filteredPoints: filteredPoints.length,
      stopPoints: stopPoints.length,
      currentDistance,
      durationMinutes
    });

    return res.status(200).json({ 
      hasActiveTrip: true,
      trip: {
        id: activeTrip.id,
        startTime: activeTrip.startTime,
        startLatitude: activeTrip.startLatitude,
        startLongitude: activeTrip.startLongitude,
        currentLatitude: lastLocation?.latitude || activeTrip.startLatitude,
        currentLongitude: lastLocation?.longitude || activeTrip.startLongitude,
        targetEndLatitude: activeTrip.targetEndLatitude || null,
        targetEndLongitude: activeTrip.targetEndLongitude || null,
        distance: currentDistance || activeTrip.distance || 0,
        durationMinutes,
        isActive: true,
        isAutoStarted: activeTrip.isAutoStarted || false,
        vehicleId: activeTrip.vehicleId,
        stopPoints: stopPoints.map(stop => ({
          latitude: stop.latitude,
          longitude: stop.longitude,
          startTime: stop.startTime,
          endTime: stop.endTime,
          durationMinutes: Math.round(stop.duration / (60 * 1000))
        })),
        locationPointsCount: tripLocations.length,
        vehicle: {
          id: vehicle.id,
          make: vehicle.make,
          model: vehicle.model,
          licensePlate: vehicle.licensePlate
        }
      }
    });
  } catch (error) {
    console.error('Error checking active trip:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}