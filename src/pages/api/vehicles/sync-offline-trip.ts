// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { user } } = await supabase.auth.getSession();

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tripData = req.body;

    if (!tripData || !tripData.vehicleId || !tripData.points || !tripData.id) {
      return res.status(400).json({ error: 'Invalid trip data' });
    }

    console.log(`Processing offline trip ${tripData.id} with ${tripData.points.length} points`);

    // Verify the user has access to this vehicle
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: tripData.vehicleId,
        OR: [
          { userId: user.id },
          { 
            organization: {
              members: {
                some: {
                  userId: user.id,
                  role: { in: ['ADMIN', 'MANAGER', 'DRIVER'] }
                }
              }
            }
          }
        ]
      }
    });

    if (!vehicle) {
      return res.status(403).json({ error: 'You do not have access to this vehicle' });
    }

    // Process the trip data
    const startPoint = tripData.points[0];
    const endPoint = tripData.points[tripData.points.length - 1];
    
    // Determine if we have any GPS points
    const gpsPoints = tripData.points.filter(p => p.location && 
      p.location.latitude && p.location.longitude);
    
    // Create trip record
    const trip = await prisma.vehicleTrip.create({
      data: {
        vehicleId: tripData.vehicleId,
        userId: user.id,
        startTime: new Date(tripData.startTime),
        endTime: tripData.endTime ? new Date(tripData.endTime) : undefined,
        startLatitude: gpsPoints.length > 0 ? gpsPoints[0].location.latitude : null,
        startLongitude: gpsPoints.length > 0 ? gpsPoints[0].location.longitude : null,
        endLatitude: gpsPoints.length > 0 ? gpsPoints[gpsPoints.length - 1].location.latitude : null,
        endLongitude: gpsPoints.length > 0 ? gpsPoints[gpsPoints.length - 1].location.longitude : null,
        distance: calculateTripDistance(gpsPoints),
        detectionMethod: 'SENSOR_BASED',
        completionStatus: 'COMPLETED',
        offlineDetected: true,
        metadata: {
          offlineTripId: tripData.id,
          pointCount: tripData.points.length,
          gpsPointCount: gpsPoints.length,
          sensorConfidence: calculateAverageConfidence(tripData.points),
          syncedAt: new Date().toISOString()
        }
      }
    });

    // Store trip points for detailed analysis
    if (gpsPoints.length > 0) {
      await prisma.vehicleTripPoint.createMany({
        data: gpsPoints.map(point => ({
          tripId: trip.id,
          timestamp: new Date(point.timestamp),
          latitude: point.location.latitude,
          longitude: point.location.longitude,
          accuracy: point.location.accuracy || null,
          isMoving: point.isMoving,
          confidence: point.confidence,
          metadata: {
            sensorData: point.sensorData || null,
            source: point.location.source || 'sensor'
          }
        }))
      });
    }

    // Log the action
    await createAuditLog({
      action: 'SYNC_OFFLINE_TRIP',
      resourceType: 'VEHICLE_TRIP',
      resourceId: trip.id,
      metadata: {
        vehicleId: tripData.vehicleId,
        offlineTripId: tripData.id,
        pointCount: tripData.points.length,
        gpsPointCount: gpsPoints.length
      }
    });

    return res.status(200).json({ 
      success: true, 
      tripId: trip.id,
      message: `Successfully synced offline trip with ${tripData.points.length} points (${gpsPoints.length} GPS points)`
    });
  } catch (error) {
    console.error('Error syncing offline trip:', error);
    return res.status(500).json({ error: 'Failed to sync offline trip', details: error.message });
  }
}

// Helper function to calculate trip distance from GPS points
function calculateTripDistance(points: any[]): number {
  if (points.length < 2) return 0;
  
  let totalDistance = 0;
  
  for (let i = 1; i < points.length; i++) {
    const prevPoint = points[i - 1];
    const currentPoint = points[i];
    
    if (prevPoint.location && currentPoint.location &&
        prevPoint.location.latitude && prevPoint.location.longitude &&
        currentPoint.location.latitude && currentPoint.location.longitude) {
      
      totalDistance += getDistanceFromLatLonInKm(
        prevPoint.location.latitude,
        prevPoint.location.longitude,
        currentPoint.location.latitude,
        currentPoint.location.longitude
      );
    }
  }
  
  return totalDistance;
}

// Calculate distance between two coordinates using Haversine formula
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Calculate average confidence from motion data
function calculateAverageConfidence(points: any[]): number {
  if (points.length === 0) return 0;
  
  const sum = points.reduce((total, point) => total + (point.confidence || 0), 0);
  return sum / points.length;
}