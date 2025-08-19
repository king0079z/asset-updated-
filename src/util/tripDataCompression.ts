/**
 * Trip data compression utilities
 * 
 * These utilities help reduce the storage footprint of trip data
 * while preserving important information for analysis.
 */

import { TripPoint, OfflineTripSegment } from './offlineStorage';

/**
 * Compresses trip data by reducing redundant points and applying
 * delta encoding for timestamps and coordinates
 */
export function compressTripData(tripSegment: OfflineTripSegment): any {
  if (!tripSegment.points || tripSegment.points.length === 0) {
    return tripSegment;
  }

  // Sort points by timestamp (just to be safe)
  const sortedPoints = [...tripSegment.points].sort((a, b) => a.timestamp - b.timestamp);
  
  // Base values for delta encoding
  const baseTimestamp = sortedPoints[0].timestamp;
  let baseLatitude = 0;
  let baseLongitude = 0;
  
  // Find first point with location data to use as base
  for (const point of sortedPoints) {
    if (point.location && typeof point.location.latitude === 'number' && 
        typeof point.location.longitude === 'number') {
      baseLatitude = point.location.latitude;
      baseLongitude = point.location.longitude;
      break;
    }
  }
  
  // Apply adaptive sampling - keep more points during high movement periods
  const sampledPoints = adaptiveSamplePoints(sortedPoints);
  
  // Apply delta encoding
  const compressedPoints = sampledPoints.map((point, index) => {
    // Delta encode timestamp (milliseconds since start)
    const timestampDelta = point.timestamp - baseTimestamp;
    
    // Delta encode location if available (using fixed precision)
    let locationDelta;
    if (point.location && typeof point.location.latitude === 'number' && 
        typeof point.location.longitude === 'number') {
      // Convert to fixed precision deltas (6 decimal places ≈ 10cm precision)
      const latDelta = Math.round((point.location.latitude - baseLatitude) * 1000000) / 1000000;
      const lngDelta = Math.round((point.location.longitude - baseLongitude) * 1000000) / 1000000;
      
      locationDelta = {
        lat: latDelta,
        lng: lngDelta,
        acc: point.location.accuracy,
        src: point.location.source
      };
    }
    
    // Compress sensor data by rounding to fewer decimal places
    const sensorData = point.sensorData ? {
      a: point.sensorData.acceleration ? {
        x: Math.round(point.sensorData.acceleration.x * 100) / 100,
        y: Math.round(point.sensorData.acceleration.y * 100) / 100,
        z: Math.round(point.sensorData.acceleration.z * 100) / 100
      } : undefined,
      r: point.sensorData.rotation ? {
        a: Math.round(point.sensorData.rotation.alpha * 10) / 10,
        b: Math.round(point.sensorData.rotation.beta * 10) / 10,
        g: Math.round(point.sensorData.rotation.gamma * 10) / 10
      } : undefined
    } : undefined;
    
    return {
      t: timestampDelta,
      m: point.isMoving ? 1 : 0,
      c: Math.round(point.confidence * 100) / 100,
      l: locationDelta,
      s: sensorData
    };
  });
  
  return {
    ...tripSegment,
    baseTimestamp,
    baseLocation: {
      latitude: baseLatitude,
      longitude: baseLongitude
    },
    compressedPoints: compressedPoints,
    compressionRatio: tripSegment.points.length / compressedPoints.length,
    originalPointCount: tripSegment.points.length
  };
}

/**
 * Decompresses trip data back to its original format
 */
export function decompressTripData(compressedTrip: any): OfflineTripSegment {
  if (!compressedTrip.compressedPoints) {
    return compressedTrip as OfflineTripSegment;
  }
  
  const baseTimestamp = compressedTrip.baseTimestamp;
  const baseLatitude = compressedTrip.baseLocation?.latitude || 0;
  const baseLongitude = compressedTrip.baseLocation?.longitude || 0;
  
  const decompressedPoints: TripPoint[] = compressedTrip.compressedPoints.map((cp: any) => {
    // Reconstruct timestamp
    const timestamp = baseTimestamp + cp.t;
    
    // Reconstruct location if available
    let location;
    if (cp.l) {
      location = {
        latitude: baseLatitude + cp.l.lat,
        longitude: baseLongitude + cp.l.lng,
        accuracy: cp.l.acc,
        source: cp.l.src
      };
    }
    
    // Reconstruct sensor data
    let sensorData;
    if (cp.s) {
      sensorData = {
        acceleration: cp.s.a ? {
          x: cp.s.a.x,
          y: cp.s.a.y,
          z: cp.s.a.z
        } : undefined,
        rotation: cp.s.r ? {
          alpha: cp.s.r.a,
          beta: cp.s.r.b,
          gamma: cp.s.r.g
        } : undefined
      };
    }
    
    return {
      timestamp,
      isMoving: cp.m === 1,
      confidence: cp.c,
      location,
      sensorData
    };
  });
  
  // Return decompressed trip segment
  return {
    id: compressedTrip.id,
    vehicleId: compressedTrip.vehicleId,
    userId: compressedTrip.userId,
    startTime: compressedTrip.startTime,
    endTime: compressedTrip.endTime,
    points: decompressedPoints,
    synced: compressedTrip.synced
  };
}

/**
 * Adaptively samples points to reduce data size while preserving important features
 * Keeps more points during high movement/turning periods and fewer during steady movement
 */
function adaptiveSamplePoints(points: TripPoint[]): TripPoint[] {
  if (points.length <= 10) return points;
  
  const result: TripPoint[] = [points[0]]; // Always keep first point
  let lastIncludedIndex = 0;
  
  // Calculate movement variance to determine sampling rate
  const calculateVariance = (start: number, end: number): number => {
    if (end - start <= 1) return 0;
    
    // Calculate variance in acceleration magnitude
    const accelerations = points.slice(start, end + 1)
      .map(p => p.sensorData?.acceleration)
      .filter(a => a !== undefined)
      .map(a => {
        if (!a) return 0;
        return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      });
    
    if (accelerations.length <= 1) return 0;
    
    const mean = accelerations.reduce((sum, val) => sum + val, 0) / accelerations.length;
    const variance = accelerations.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / accelerations.length;
    
    return variance;
  };
  
  // Calculate location change to determine sampling rate
  const calculateLocationChange = (p1: TripPoint, p2: TripPoint): number => {
    if (!p1.location || !p2.location || 
        !p1.location.latitude || !p2.location.latitude || 
        !p1.location.longitude || !p2.location.longitude) {
      return 0;
    }
    
    // Simple distance calculation (not using haversine for performance)
    const latDiff = p1.location.latitude - p2.location.latitude;
    const lngDiff = p1.location.longitude - p2.location.longitude;
    return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
  };
  
  for (let i = 1; i < points.length - 1; i++) {
    const timeSinceLastIncluded = points[i].timestamp - points[lastIncludedIndex].timestamp;
    const variance = calculateVariance(lastIncludedIndex, i);
    const locationChange = calculateLocationChange(points[lastIncludedIndex], points[i]);
    
    // Include point if:
    // 1. It's been a while since last included point (30 seconds)
    // 2. There's significant movement variance (high acceleration/deceleration)
    // 3. There's significant location change
    // 4. Movement state changed (moving -> stationary or vice versa)
    if (timeSinceLastIncluded > 30000 || 
        variance > 0.5 || 
        locationChange > 0.0001 || 
        points[i].isMoving !== points[lastIncludedIndex].isMoving) {
      
      result.push(points[i]);
      lastIncludedIndex = i;
    }
  }
  
  // Always include last point
  if (points.length > 1 && lastIncludedIndex < points.length - 1) {
    result.push(points[points.length - 1]);
  }
  
  return result;
}

/**
 * Estimates storage size of trip data in bytes
 */
export function estimateTripDataSize(tripSegment: OfflineTripSegment): number {
  // Convert to JSON and measure string length as bytes
  return JSON.stringify(tripSegment).length;
}

/**
 * Estimates storage size of compressed trip data in bytes
 */
export function estimateCompressedTripDataSize(compressedTrip: any): number {
  return JSON.stringify(compressedTrip).length;
}

/**
 * Calculates compression ratio (original size / compressed size)
 */
export function calculateCompressionRatio(original: OfflineTripSegment, compressed: any): number {
  const originalSize = estimateTripDataSize(original);
  const compressedSize = estimateCompressedTripDataSize(compressed);
  return originalSize / compressedSize;
}