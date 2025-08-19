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
      latitude, 
      longitude,
      reason,
      movementType,
      movementConfidence
    } = req.body;

    // Validate required fields
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Missing required location data' });
    }

    // Log the auto-complete request for debugging
    console.log('Auto-complete trip request:', { 
      reason, 
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

    // Calculate distance from start to current location
    const distanceToStart = calculateDistance(
      activeTrip.startLatitude,
      activeTrip.startLongitude,
      parseFloat(latitude.toString()),
      parseFloat(longitude.toString())
    );
    
    // Calculate total trip distance
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
    });

    // Calculate distance from location points
    let totalDistance = 0;
    if (tripLocations.length > 1) {
      for (let i = 1; i < tripLocations.length; i++) {
        const prevLocation = tripLocations[i - 1];
        const currLocation = tripLocations[i];
        
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

    // Check if we should auto-complete the trip based on returning to starting point
    const isReturnedToStart = distanceToStart < 0.1; // Within 100 meters of starting point
    const isNearStart = distanceToStart < 0.3; // Within 300 meters of starting point
    
    // Check if we're near the target end point (if set)
    let isNearTargetEnd = false;
    let distanceToTargetEnd = null;
    
    if (activeTrip.targetEndLatitude && activeTrip.targetEndLongitude) {
      distanceToTargetEnd = calculateDistance(
        activeTrip.targetEndLatitude,
        activeTrip.targetEndLongitude,
        parseFloat(latitude.toString()),
        parseFloat(longitude.toString())
      );
      isNearTargetEnd = distanceToTargetEnd < 0.1; // Within 100 meters of target end point
    }
    
    // Log the distance to starting point and target end point for debugging
    console.log('Auto-complete trip - distance checks:', {
      distanceToStart,
      isReturnedToStart,
      isNearStart,
      distanceToTargetEnd,
      isNearTargetEnd,
      hasTargetEndPoint: !!activeTrip.targetEndLatitude,
      reason
    });
    
    // If reason is not specified but we're near the starting point or target end point, create a new variable
    let tripReason = reason;
    if (!tripReason) {
      if (isNearStart) {
        tripReason = 'returned_to_start';
      } else if (isNearTargetEnd) {
        tripReason = 'reached_target_end';
      }
    }

    // Determine trip completion status based on reason and location
    let completionStatus = 'COMPLETED';
    if (tripReason === 'duty_hours_ended') {
      completionStatus = 'COMPLETED';
    } else if (tripReason === 'returned_to_start' || isReturnedToStart) {
      completionStatus = 'COMPLETED';
      console.log('Trip marked as COMPLETED - returned to starting point');
    } else if (tripReason === 'reached_target_end' || isNearTargetEnd) {
      completionStatus = 'COMPLETED';
      console.log('Trip marked as COMPLETED - reached target end point');
    } else {
      completionStatus = 'INCOMPLETE';
      console.log('Trip marked as INCOMPLETE - not at starting point or target end point');
    }

    // Update the trip record
    await prisma.vehicleTrip.update({
      where: { id: activeTrip.id },
      data: {
        endTime: new Date(),
        endLatitude: parseFloat(latitude.toString()),
        endLongitude: parseFloat(longitude.toString()),
        distance: totalDistance > 0 ? totalDistance : activeTrip.distance || 0,
        isAutoEnded: true,
        completionStatus: completionStatus
      }
    });

    // Record trip end location with metadata
    await prisma.vehicleLocation.create({
      data: {
        vehicleId: vehicle.id,
        latitude: parseFloat(latitude.toString()),
        longitude: parseFloat(longitude.toString()),
        timestamp: new Date()
      },
    });

    // Update vehicle mileage if available
    if (vehicle.mileage !== null) {
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          mileage: {
            increment: Math.round(totalDistance)
          }
        }
      });
    }

    // Log the action
    try {
      let actionDescription = '';
      if (tripReason === 'duty_hours_ended') {
        actionDescription = 'Trip auto-completed due to end of duty hours';
      } else if (tripReason === 'returned_to_start' || isReturnedToStart) {
        actionDescription = `Trip auto-completed after returning to starting point (distance: ${distanceToStart.toFixed(2)}km)`;
      } else if (tripReason === 'reached_target_end' || isNearTargetEnd) {
        actionDescription = `Trip auto-completed after reaching target end point (distance: ${distanceToTargetEnd?.toFixed(2)}km)`;
      } else {
        actionDescription = `Trip auto-completed (${tripReason || 'system initiated'})`;
      }
      
      // Add movement type info if available
      if (movementType) {
        actionDescription += ` - Movement type: ${movementType}, confidence: ${movementConfidence?.toFixed(2) || 'N/A'}`;
      }
      
      await logDataAccess(
        'vehicle',
        vehicle.id,
        { 
          action: 'VEHICLE_TRIP_AUTO_COMPLETED', 
          description: actionDescription
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    return res.status(200).json({ 
      message: 'Trip auto-completed successfully',
      distance: totalDistance,
      completionStatus,
      distanceToStart,
      distanceToTargetEnd,
      isNearTargetEnd,
      hasTargetEndPoint: !!activeTrip.targetEndLatitude,
      reason: tripReason || (isReturnedToStart ? 'returned_to_start' : (isNearTargetEnd ? 'reached_target_end' : 'system_initiated')),
      isReturnedToStart
    });
  } catch (error) {
    console.error('Error auto-completing trip:', error);
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