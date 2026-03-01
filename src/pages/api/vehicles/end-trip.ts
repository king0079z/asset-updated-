// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';
import { calculateDistance, detectStopPoints, calculateTripDistance, filterLocationPoints } from '@/util/tripTracking';

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

    // Get trip data from request body
    const { 
      endTime = new Date(), 
      endLatitude, 
      endLongitude,
      accuracy = null,
      locationSource = 'gps',
      isAutoEnded = false
    } = req.body;

    // Validate required fields
    if (!endLatitude || !endLongitude) {
      return res.status(400).json({ error: 'Missing required location data' });
    }

    // Parse coordinates to ensure they're numbers
    const parsedEndLatitude = parseFloat(endLatitude.toString());
    const parsedEndLongitude = parseFloat(endLongitude.toString());

    // Validate coordinates are within valid ranges
    if (isNaN(parsedEndLatitude) || isNaN(parsedEndLongitude) ||
        parsedEndLatitude < -90 || parsedEndLatitude > 90 ||
        parsedEndLongitude < -180 || parsedEndLongitude > 180) {
      return res.status(400).json({ 
        error: 'Invalid coordinates',
        message: 'The provided coordinates are outside valid ranges.'
      });
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

    // Find the active trip
    const activeTrip = await prisma.vehicleTrip.findFirst({
      where: {
        vehicleId: vehicle.id,
        userId: user.id,
        endTime: null // No end time means it's active
      }
    });

    if (!activeTrip) {
      return res.status(404).json({ 
        error: 'No active trip found',
        message: 'You do not have an active trip to end.'
      });
    }

    // Get all location points for this trip
    const allLocationPoints = await prisma.vehicleLocation.findMany({
      where: {
        vehicleId: vehicle.id,
        timestamp: {
          gte: activeTrip.startTime,
          lte: new Date(endTime)
        }
      },
      orderBy: {
        timestamp: 'asc'
      },
      select: {
        latitude: true,
        longitude: true,
        timestamp: true
      }
    });

    // Add the end point to the location points for complete analysis
    const allPointsWithEnd = [
      ...allLocationPoints.map(point => ({
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp: point.timestamp,
        metadata: {} // Add empty metadata for compatibility
      })),
      {
        latitude: parsedEndLatitude,
        longitude: parsedEndLongitude,
        timestamp: new Date(endTime),
        metadata: {
          accuracy: accuracy,
          source: locationSource,
          isEndPoint: true
        }
      }
    ];

    // Filter location points to remove GPS jumps and anomalies
    const filteredPoints = filterLocationPoints(allPointsWithEnd, {
      maxSpeed: 180, // 180 km/h max reasonable speed
      maxAcceleration: 5, // 5 m/s² max reasonable acceleration
      minAccuracy: 100 // 100 meters minimum accuracy
    });

    // Calculate accurate trip distance using filtered points
    const calculatedDistance = calculateTripDistance(filteredPoints);
    
    // Detect stop points during the trip
    const stopPoints = detectStopPoints(allPointsWithEnd, {
      minDuration: 3 * 60 * 1000, // 3 minutes minimum stop duration
      maxRadius: 50, // 50 meters maximum radius for a stop
      minConfidence: 0.6 // Minimum confidence to include a stop
    });

    // Check if the trip ended near the starting point (within 100 meters)
    const distanceToStart = calculateDistance(
      activeTrip.startLatitude,
      activeTrip.startLongitude,
      parsedEndLatitude,
      parsedEndLongitude
    );
    
    // Check if the trip has a target end point
    let distanceToTargetEnd = null;
    let isNearTargetEnd = false;
    
    if (activeTrip.targetEndLatitude && activeTrip.targetEndLongitude) {
      distanceToTargetEnd = calculateDistance(
        activeTrip.targetEndLatitude,
        activeTrip.targetEndLongitude,
        parsedEndLatitude,
        parsedEndLongitude
      );
      isNearTargetEnd = distanceToTargetEnd < 0.1; // Within 100 meters of target end point
    }
    
    // Determine trip completion status
    // If manually ended near starting point or target end point, mark as COMPLETED
    // Otherwise, mark as INCOMPLETE with a warning
    const isNearStart = distanceToStart < 0.1; // Within 100 meters of starting point
    const isCompleted = isNearStart || isNearTargetEnd;
    const completionStatus = isCompleted ? 'COMPLETED' : 'INCOMPLETE';

    // Create location metadata for end point
    const locationMetadata = {
      accuracy: accuracy,
      source: locationSource,
      timestamp: new Date(endTime),
      isEndPoint: true
    };

    // Create trip metadata with enhanced information
    const tripMetadata = {
      ...activeTrip.metadata || {},
      endPointAccuracy: accuracy,
      endLocationSource: locationSource,
      calculatedDistance: calculatedDistance,
      reportedDistance: req.body.distance, // Store client-reported distance for comparison
      stopPoints: stopPoints.map(stop => ({
        latitude: stop.latitude,
        longitude: stop.longitude,
        startTime: stop.startTime,
        endTime: stop.endTime,
        duration: stop.duration,
        confidence: stop.confidence
      })),
      filteredPointsCount: filteredPoints.length,
      totalPointsCount: allPointsWithEnd.length,
      deviceInfo: req.headers['user-agent'] || 'unknown'
    };

    // Log the trip ending request for debugging
    console.log('Ending trip with data:', {
      tripId: activeTrip.id,
      endTime,
      endLatitude: parsedEndLatitude,
      endLongitude: parsedEndLongitude,
      calculatedDistance,
      reportedDistance: req.body.distance,
      isAutoEnded,
      completionStatus,
      stopPointsCount: stopPoints.length,
      routePointsCount: filteredPoints.length
    });
    
    // Update the trip record with enhanced data
    try {
      await prisma.vehicleTrip.update({
        where: { id: activeTrip.id },
        data: {
          endTime: new Date(endTime),
          endLatitude: parsedEndLatitude,
          endLongitude: parsedEndLongitude,
          distance: calculatedDistance, // Use our accurately calculated distance
          isAutoEnded: isAutoEnded,
          completionStatus: completionStatus,
          routePoints: filteredPoints.map(point => ({
            latitude: point.latitude,
            longitude: point.longitude,
            timestamp: new Date(point.timestamp)
          }))
          // Removed metadata field as it doesn't exist in the VehicleTrip model
        }
      });
      
      console.log('Trip successfully ended in database with trip metadata:', JSON.stringify(tripMetadata));
    } catch (updateError) {
      console.error('Error updating trip record:', updateError);
      throw updateError; // Re-throw to be caught by the outer try-catch
    }

    // Record trip end location with metadata
    await prisma.vehicleLocation.create({
      data: {
        vehicleId: vehicle.id,
        latitude: parsedEndLatitude,
        longitude: parsedEndLongitude,
        timestamp: new Date(endTime),
        userId: user.id,
        metadata: locationMetadata
      },
    });

    // Update vehicle mileage if available
    if (vehicle.mileage !== null) {
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          mileage: {
            increment: Math.round(calculatedDistance)
          }
        }
      });
    }

    // Calculate total distance from all completed trips
    const trips = await prisma.vehicleTrip.findMany({
      where: {
        vehicleId: vehicle.id,
        userId: user.id,
        endTime: {
          not: null // Only completed trips
        }
      },
      select: {
        distance: true
      }
    });

    const totalDistance = trips.reduce((sum, trip) => sum + (trip.distance || 0), 0);

    // Log the action with enhanced information
    try {
      let actionDescription = '';
      if (isAutoEnded) {
        actionDescription = `Trip auto-ended after returning to starting point and being stationary`;
      } else {
        const stopPointsInfo = stopPoints.length > 0 
          ? ` with ${stopPoints.length} stop points detected` 
          : '';
          
        actionDescription = isCompleted 
          ? `Driver ended completed trip with distance of ${calculatedDistance.toFixed(2)} km${stopPointsInfo}` 
          : `Driver ended incomplete trip with distance of ${calculatedDistance.toFixed(2)} km (${(distanceToStart * 1000).toFixed(0)}m from start)${stopPointsInfo}`;
      }
      
      await logDataAccess(
        'vehicle',
        vehicle.id,
        { 
          action: 'VEHICLE_TRIP_ENDED', 
          description: actionDescription
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    return res.status(200).json({ 
      message: 'Trip ended successfully',
      distance: calculatedDistance,
      totalDistance,
      completionStatus,
      distanceToStart,
      isCompleted,
      stopPoints: stopPoints.map(stop => ({
        latitude: stop.latitude,
        longitude: stop.longitude,
        startTime: stop.startTime,
        endTime: stop.endTime,
        durationMinutes: Math.round(stop.duration / (60 * 1000))
      })),
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
    console.error('Error ending trip:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}