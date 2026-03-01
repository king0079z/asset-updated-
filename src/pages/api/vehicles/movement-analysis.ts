import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';

// Define types for better code organization
interface Destination {
  startTime: Date;
  endTime: Date;
  latitude: number;
  longitude: number;
  duration: number;
  isCompletedTrip: boolean;
  tripMetadata?: any;
}

// Helper function to calculate distance between two coordinates in kilometers
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Helper function to identify destinations (stops)
function identifyDestinations(locations: any[]): any[] {
  if (locations.length < 2) return [];
  
  const destinations: any[] = [];
  const STOP_THRESHOLD_MINUTES = 10; // Consider a stop if vehicle stays in same area for 10+ minutes
  const DISTANCE_THRESHOLD_KM = 0.1; // 100 meters radius to consider as same location
  
  let currentStop = {
    startTime: new Date(locations[0].timestamp),
    endTime: new Date(locations[0].timestamp),
    latitude: locations[0].latitude,
    longitude: locations[0].longitude,
    duration: 0,
    isCompletedTrip: false,
    tripMetadata: locations[0].metadata
  };
  
  for (let i = 1; i < locations.length; i++) {
    const currentLocation = locations[i];
    const distance = calculateDistance(
      currentStop.latitude, 
      currentStop.longitude, 
      currentLocation.latitude, 
      currentLocation.longitude
    );
    
    // Check if this is a trip end point
    const isTripEnd = currentLocation.metadata && 
                     currentLocation.metadata.tripEvent === 'END';
    
    // If vehicle is still in the same area or this is a trip end point
    if (distance < DISTANCE_THRESHOLD_KM || isTripEnd) {
      currentStop.endTime = new Date(currentLocation.timestamp);
      
      // Calculate duration in minutes, ensure it's positive
      let durationMs = currentStop.endTime.getTime() - currentStop.startTime.getTime();
      if (durationMs < 0) {
        console.warn('Trip duration calculation resulted in negative value, using absolute value instead');
        durationMs = Math.abs(durationMs);
      }
      currentStop.duration = durationMs / (1000 * 60); // in minutes
      
      // If this is a trip end point, mark it as a completed trip
      if (isTripEnd) {
        currentStop.isCompletedTrip = true;
        currentStop.tripMetadata = currentLocation.metadata;
      }
    } else {
      // If previous stop was long enough or is a completed trip, add it to destinations
      if (currentStop.duration >= STOP_THRESHOLD_MINUTES || currentStop.isCompletedTrip) {
        destinations.push({...currentStop});
      }
      
      // Start a new stop
      currentStop = {
        startTime: new Date(currentLocation.timestamp),
        endTime: new Date(currentLocation.timestamp),
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        duration: 0,
        isCompletedTrip: false,
        tripMetadata: currentLocation.metadata
      };
    }
  }
  
  // Check if the last stop should be added
  if (currentStop.duration >= STOP_THRESHOLD_MINUTES || currentStop.isCompletedTrip) {
    destinations.push(currentStop);
  }
  
  return destinations;
}

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
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get query parameters
    const { vehicleId, period } = req.query;
    
    if (!vehicleId) {
      return res.status(400).json({ error: 'Vehicle ID is required' });
    }

    // Log the action
    await logDataAccess(
      'vehicle',
      vehicleId as string,
      { action: 'VEHICLE_MOVEMENT_ANALYSIS', description: 'User analyzed vehicle movement data' }
    );

    // Determine date range based on period
    const now = new Date();
    let startDate = new Date();
    
    if (period === 'day') {
      startDate.setDate(now.getDate() - 1);
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    } else {
      // Default to last 24 hours
      startDate.setDate(now.getDate() - 1);
    }

    // Fetch vehicle locations for the specified period
    const vehicleLocations = await prisma.vehicleLocation.findMany({
      where: {
        vehicleId: vehicleId as string,
        timestamp: {
          gte: startDate
        }
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    // If no locations found
    if (vehicleLocations.length === 0) {
      return res.status(200).json({ 
        totalDistance: 0,
        totalDrivingTime: 0,
        destinations: [],
        message: 'No movement data available for the selected period'
      });
    }

    // Calculate total distance traveled
    let totalDistance = 0;
    let totalDrivingTimeMinutes = 0;
    
    for (let i = 1; i < vehicleLocations.length; i++) {
      const prevLocation = vehicleLocations[i-1];
      const currLocation = vehicleLocations[i];
      
      const distance = calculateDistance(
        prevLocation.latitude,
        prevLocation.longitude,
        currLocation.latitude,
        currLocation.longitude
      );
      
      // Only count if the vehicle actually moved (to filter out GPS jitter)
      if (distance > 0.01) { // More than 10 meters
        totalDistance += distance;
        
        // Calculate time between points in minutes
        const timeDiff = (new Date(currLocation.timestamp).getTime() - new Date(prevLocation.timestamp).getTime()) / (1000 * 60);
        
        // Only count reasonable driving times (filter out long gaps in data)
        if (timeDiff < 60) { // Less than an hour between points
          totalDrivingTimeMinutes += timeDiff;
        }
      }
    }

    // Identify destinations (stops)
    const destinations = identifyDestinations(vehicleLocations);

    // Get vehicle details
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId as string },
      select: { name: true, licensePlate: true }
    });

    return res.status(200).json({
      vehicleName: vehicle?.name,
      licensePlate: vehicle?.licensePlate,
      totalDistance: Math.round(totalDistance * 10) / 10, // Round to 1 decimal place
      totalDrivingTime: Math.round(totalDrivingTimeMinutes), // In minutes
      destinations: destinations,
      firstTimestamp: vehicleLocations[0].timestamp,
      lastTimestamp: vehicleLocations[vehicleLocations.length - 1].timestamp,
      period: period || 'day'
    });
  } catch (error) {
    console.error('Error analyzing vehicle movement data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}