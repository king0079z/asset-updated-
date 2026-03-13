/**
 * Trip Tracking Utilities
 * Provides enhanced functionality for accurate trip tracking
 */

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: Date | string;
  accuracy?: number;
}

interface StopPoint {
  latitude: number;
  longitude: number;
  startTime: Date;
  endTime: Date;
  duration: number; // in milliseconds
  confidence: number; // 0-1 confidence score
}

/**
 * Calculates distance between two coordinates in kilometers using the Haversine formula
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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
};

/**
 * Detects stop points in a sequence of location points
 * A stop point is defined as a location where the user stayed for a minimum duration
 * within a specified radius
 */
export const detectStopPoints = (
  locationPoints: LocationPoint[],
  options: {
    minDuration?: number; // Minimum duration in milliseconds to consider a stop (default: 3 minutes)
    maxRadius?: number; // Maximum radius in meters to consider the same stop (default: 50 meters)
    minConfidence?: number; // Minimum confidence to include a stop (default: 0.6)
  } = {}
): StopPoint[] => {
  // Default options
  const {
    minDuration = 3 * 60 * 1000, // 3 minutes
    maxRadius = 50, // 50 meters
    minConfidence = 0.6
  } = options;
  
  // Need at least 3 points to detect stops
  if (!locationPoints || locationPoints.length < 3) {
    return [];
  }
  
  // Sort points by timestamp
  const sortedPoints = [...locationPoints].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeA - timeB;
  });
  
  const stopPoints: StopPoint[] = [];
  let currentStopStart: LocationPoint | null = null;
  let currentStopPoints: LocationPoint[] = [];
  
  // Process each location point
  for (let i = 0; i < sortedPoints.length; i++) {
    const currentPoint = sortedPoints[i];
    
    // If we haven't started a potential stop yet
    if (!currentStopStart) {
      currentStopStart = currentPoint;
      currentStopPoints = [currentPoint];
      continue;
    }
    
    // Calculate distance from the stop start point
    const distance = calculateDistance(
      currentStopStart.latitude,
      currentStopStart.longitude,
      currentPoint.latitude,
      currentPoint.longitude
    ) * 1000; // Convert to meters
    
    // If point is within the radius, add to current stop
    if (distance <= maxRadius) {
      currentStopPoints.push(currentPoint);
    } else {
      // Point is outside radius, check if we have a valid stop
      const stopStartTime = new Date(currentStopStart.timestamp);
      const stopEndTime = new Date(currentStopPoints[currentStopPoints.length - 1].timestamp);
      const stopDuration = stopEndTime.getTime() - stopStartTime.getTime();
      
      // If stop duration meets minimum requirement, record it
      if (stopDuration >= minDuration) {
        // Calculate average position of all points in the stop
        const sumLat = currentStopPoints.reduce((sum, p) => sum + p.latitude, 0);
        const sumLng = currentStopPoints.reduce((sum, p) => sum + p.longitude, 0);
        const avgLat = sumLat / currentStopPoints.length;
        const avgLng = sumLng / currentStopPoints.length;
        
        // Calculate confidence based on number of points and duration
        const pointDensity = currentStopPoints.length / (stopDuration / 60000); // points per minute
        const durationFactor = Math.min(1, stopDuration / (10 * 60 * 1000)); // Max out at 10 minutes
        const confidence = Math.min(1, (pointDensity * 0.3 + durationFactor * 0.7));
        
        // Only include stops with sufficient confidence
        if (confidence >= minConfidence) {
          stopPoints.push({
            latitude: avgLat,
            longitude: avgLng,
            startTime: stopStartTime,
            endTime: stopEndTime,
            duration: stopDuration,
            confidence
          });
        }
      }
      
      // Start a new potential stop
      currentStopStart = currentPoint;
      currentStopPoints = [currentPoint];
    }
  }
  
  // Check if the last sequence of points forms a stop
  if (currentStopStart && currentStopPoints.length > 1) {
    const stopStartTime = new Date(currentStopStart.timestamp);
    const stopEndTime = new Date(currentStopPoints[currentStopPoints.length - 1].timestamp);
    const stopDuration = stopEndTime.getTime() - stopStartTime.getTime();
    
    if (stopDuration >= minDuration) {
      // Calculate average position
      const sumLat = currentStopPoints.reduce((sum, p) => sum + p.latitude, 0);
      const sumLng = currentStopPoints.reduce((sum, p) => sum + p.longitude, 0);
      const avgLat = sumLat / currentStopPoints.length;
      const avgLng = sumLng / currentStopPoints.length;
      
      // Calculate confidence
      const pointDensity = currentStopPoints.length / (stopDuration / 60000); // points per minute
      const durationFactor = Math.min(1, stopDuration / (10 * 60 * 1000)); // Max out at 10 minutes
      const confidence = Math.min(1, (pointDensity * 0.3 + durationFactor * 0.7));
      
      if (confidence >= minConfidence) {
        stopPoints.push({
          latitude: avgLat,
          longitude: avgLng,
          startTime: stopStartTime,
          endTime: stopEndTime,
          duration: stopDuration,
          confidence
        });
      }
    }
  }
  
  return stopPoints;
};

/**
 * Filters out GPS jumps and anomalies from location points
 * Returns a cleaned array of location points
 */
export const filterLocationPoints = (
  locationPoints: LocationPoint[],
  options: {
    maxSpeed?: number; // Maximum reasonable speed in km/h (default: 180 km/h)
    maxAcceleration?: number; // Maximum reasonable acceleration in m/s² (default: 5 m/s²)
    minAccuracy?: number; // Minimum GPS accuracy in meters (default: 100 meters)
  } = {}
): LocationPoint[] => {
  // Default options
  const {
    maxSpeed = 180, // 180 km/h
    maxAcceleration = 5, // 5 m/s²
    minAccuracy = 100 // 100 meters
  } = options;
  
  // Need at least 2 points to filter
  if (!locationPoints || locationPoints.length < 2) {
    return locationPoints;
  }
  
  // Sort points by timestamp
  const sortedPoints = [...locationPoints].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeA - timeB;
  });
  
  const filteredPoints: LocationPoint[] = [sortedPoints[0]]; // Always keep the first point
  
  // Process each location point
  for (let i = 1; i < sortedPoints.length; i++) {
    const prevPoint = filteredPoints[filteredPoints.length - 1];
    const currentPoint = sortedPoints[i];
    
    // Skip points with poor accuracy if accuracy data is available
    if (currentPoint.accuracy && currentPoint.accuracy > minAccuracy) {
      continue;
    }
    
    // Calculate time difference in seconds
    const prevTime = new Date(prevPoint.timestamp).getTime();
    const currentTime = new Date(currentPoint.timestamp).getTime();
    const timeDiffSeconds = (currentTime - prevTime) / 1000;
    
    // Skip if time difference is too small (duplicate points)
    if (timeDiffSeconds < 1) {
      continue;
    }
    
    // Calculate distance in kilometers
    const distance = calculateDistance(
      prevPoint.latitude,
      prevPoint.longitude,
      currentPoint.latitude,
      currentPoint.longitude
    );
    
    // Calculate speed in km/h
    const speed = (distance / timeDiffSeconds) * 3600;
    
    // Skip points that would require unreasonable speed
    if (speed > maxSpeed) {
      continue;
    }
    
    // If we have at least 2 filtered points, check acceleration
    if (filteredPoints.length >= 2) {
      const prevPrevPoint = filteredPoints[filteredPoints.length - 2];
      const prevPrevTime = new Date(prevPrevPoint.timestamp).getTime();
      const prevDistance = calculateDistance(
        prevPrevPoint.latitude,
        prevPrevPoint.longitude,
        prevPoint.latitude,
        prevPoint.longitude
      );
      const prevTimeDiffSeconds = (prevTime - prevPrevTime) / 1000;
      const prevSpeed = (prevDistance / prevTimeDiffSeconds) * 3600;
      
      // Calculate acceleration in m/s²
      const speedDiff = (speed - prevSpeed) / 3.6; // Convert km/h to m/s
      const acceleration = speedDiff / timeDiffSeconds;
      
      // Skip points that would require unreasonable acceleration
      if (Math.abs(acceleration) > maxAcceleration) {
        continue;
      }
    }
    
    // Point passed all filters, add it
    filteredPoints.push(currentPoint);
  }
  
  return filteredPoints;
};

/**
 * Calculates the total distance of a trip from a sequence of location points
 * Filters out GPS jumps and anomalies for more accurate distance calculation
 */
export const calculateTripDistance = (
  locationPoints: LocationPoint[],
  options: {
    filterPoints?: boolean; // Whether to filter points before calculation (default: true)
    maxSpeed?: number; // Maximum reasonable speed in km/h (default: 180 km/h)
    maxAcceleration?: number; // Maximum reasonable acceleration in m/s² (default: 5 m/s²)
    minAccuracy?: number; // Minimum GPS accuracy in meters (default: 100 meters)
  } = {}
): number => {
  // Default options
  const {
    filterPoints = true,
    maxSpeed = 180,
    maxAcceleration = 5,
    minAccuracy = 100
  } = options;
  
  // Need at least 2 points to calculate distance
  if (!locationPoints || locationPoints.length < 2) {
    return 0;
  }
  
  // Filter points if requested
  const pointsToUse = filterPoints 
    ? filterLocationPoints(locationPoints, { maxSpeed, maxAcceleration, minAccuracy })
    : locationPoints;
  
  // Sort points by timestamp
  const sortedPoints = [...pointsToUse].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeA - timeB;
  });
  
  // Calculate total distance
  let totalDistance = 0;
  
  for (let i = 1; i < sortedPoints.length; i++) {
    const prevPoint = sortedPoints[i - 1];
    const currentPoint = sortedPoints[i];
    
    const distance = calculateDistance(
      prevPoint.latitude,
      prevPoint.longitude,
      currentPoint.latitude,
      currentPoint.longitude
    );
    
    totalDistance += distance;
  }
  
  return totalDistance;
};