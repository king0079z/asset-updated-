// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';
import { calculateDistance } from '@/util/tripTracking';

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

    // Get location data from request body
    const { 
      latitude, 
      longitude, 
      isFallback = false, 
      isBackfill = false,
      timestamp = new Date(),
      tripId = null,
      accuracy = null,
      speed = null,
      heading = null,
      altitude = null,
      locationSource = null,
      isMoving = null,
      metadata: additionalMetadata = {}
    } = req.body;

    // Validate location data
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'Invalid location data. Latitude and longitude must be numbers.' });
    }

    // Parse coordinates to ensure they're numbers
    const parsedLatitude = parseFloat(latitude.toString());
    const parsedLongitude = parseFloat(longitude.toString());

    // Validate coordinates are within valid ranges
    if (isNaN(parsedLatitude) || isNaN(parsedLongitude) ||
        parsedLatitude < -90 || parsedLatitude > 90 ||
        parsedLongitude < -180 || parsedLongitude > 180) {
      return res.status(400).json({ 
        error: 'Invalid coordinates',
        message: 'The provided coordinates are outside valid ranges.'
      });
    }

    // Find vehicles assigned to this user
    const userVehicles = await prisma.vehicle.findMany({
      where: {
        assignedToUserId: user.id,
        status: 'rented', // Only update location for vehicles that are currently rented
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (userVehicles.length === 0) {
      // No vehicles assigned to this user, but we don't want to return an error
      // Just log the attempt and return success
      console.log(`User ${user.id} attempted to update location but has no assigned vehicles`);
      return res.status(200).json({ 
        message: 'No vehicles assigned to update',
        updated: 0
      });
    }

    // Parse timestamp
    const locationTimestamp = timestamp instanceof Date ? timestamp : new Date(timestamp);

    // Check if there's an active trip for this user
    const activeTrip = await prisma.vehicleTrip.findFirst({
      where: {
        vehicleId: { in: userVehicles.map(v => v.id) },
        userId: user.id,
        endTime: null // No end time means it's active
      }
    });

    // Get the last recorded location for distance calculation
    let lastLocation = null;
    if (activeTrip) {
      lastLocation = await prisma.vehicleLocation.findFirst({
        where: {
          vehicleId: activeTrip.vehicleId,
          timestamp: {
            lt: locationTimestamp
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      });
    }

    // Calculate distance from last location if available
    let distanceFromLast = 0;
    if (lastLocation) {
      distanceFromLast = calculateDistance(
        lastLocation.latitude,
        lastLocation.longitude,
        parsedLatitude,
        parsedLongitude
      );
    }

    // Create enhanced metadata object with detailed location data
    const metadata = {
      isFallback,
      isBackfill,
      tripId: activeTrip?.id || tripId || undefined,
      syncedAt: new Date(),
      source: isBackfill 
        ? 'offline_sync' 
        : (isFallback 
            ? (locationSource || 'fallback_location') 
            : 'realtime'),
      accuracy: accuracy !== null ? accuracy : undefined,
      speed: speed !== null ? speed : undefined,
      heading: heading !== null ? heading : undefined,
      altitude: altitude !== null ? altitude : undefined,
      locationSource: locationSource || (isFallback ? 'network' : 'gps'),
      isMoving: isMoving !== null ? isMoving : undefined,
      distanceFromLastPoint: distanceFromLast,
      timeSinceLastPoint: lastLocation 
        ? (locationTimestamp.getTime() - new Date(lastLocation.timestamp).getTime()) / 1000 
        : undefined,
      ...additionalMetadata // Include any additional metadata passed from client
    };

    // Update location for all vehicles assigned to this user
    const updatePromises = userVehicles.map(vehicle => {
      return prisma.vehicleLocation.create({
        data: {
          vehicleId: vehicle.id,
          latitude: parsedLatitude,
          longitude: parsedLongitude,
          timestamp: locationTimestamp,
          userId: user.id,
          metadata
        },
      });
    });

    const results = await Promise.all(updatePromises);

    // Log the action (only for non-backfill updates to avoid log spam)
    if (!isBackfill) {
      await logDataAccess(
        'vehicle',
        userVehicles.map(v => v.id).join(','),
        { 
          action: 'VEHICLE_LOCATION_UPDATE', 
          description: `Location updated for ${userVehicles.length} vehicle(s)${isFallback ? ' (using fallback location)' : ''}` 
        }
      );
    }

    // Log detailed information for debugging
    console.log(`Location updated for ${userVehicles.length} vehicle(s):`, {
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      timestamp: locationTimestamp,
      accuracy,
      speed,
      heading,
      locationSource,
      isMoving,
      distanceFromLast,
      hasActiveTrip: !!activeTrip
    });

    // If this is a backfilled location from offline storage, return a specific message
    if (isBackfill) {
      return res.status(200).json({ 
        message: 'Backfilled location recorded successfully',
        updated: results.length,
        vehicles: userVehicles.map(v => v.name)
      });
    }

    return res.status(200).json({ 
      message: 'Location updated successfully',
      updated: results.length,
      vehicles: userVehicles.map(v => v.name),
      isFallback,
      locationQuality: accuracy 
        ? accuracy < 20 
          ? 'excellent' 
          : accuracy < 50 
            ? 'good' 
            : accuracy < 100 
              ? 'fair' 
              : 'poor'
        : 'unknown',
      activeTrip: activeTrip ? {
        id: activeTrip.id,
        distanceFromStart: activeTrip ? calculateDistance(
          activeTrip.startLatitude,
          activeTrip.startLongitude,
          parsedLatitude,
          parsedLongitude
        ) : null
      } : null
    });
  } catch (error) {
    console.error('Error updating vehicle location:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}