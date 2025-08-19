// Offline storage utility for trip data
import { compressTripData, decompressTripData } from './tripDataCompression';

export interface TripPoint {
  timestamp: number;
  isMoving: boolean;
  confidence: number;
  sensorData?: {
    acceleration?: {
      x: number;
      y: number;
      z: number;
    };
    rotation?: {
      alpha: number;
      beta: number;
      gamma: number;
    };
  };
  location?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    source: 'gps' | 'network' | 'sensor' | 'estimated';
  };
}

export interface OfflineTripSegment {
  id: string;
  vehicleId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  points: TripPoint[];
  synced: boolean;
  metadata?: {
    deviceModel?: string;
    batteryLevel?: number;
    networkType?: string;
    appVersion?: string;
    compressionRatio?: number;
  };
}

const STORAGE_KEY = 'offline_trip_data';
const STORAGE_VERSION = 'v2'; // Version to handle schema changes
const MAX_STORAGE_SIZE = 10 * 1024 * 1024; // 10MB limit

// Get all stored trip segments
export const getStoredTripSegments = (): OfflineTripSegment[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const storedData = localStorage.getItem(`${STORAGE_KEY}_${STORAGE_VERSION}`);
    if (!storedData) return [];
    
    // Parse and decompress all segments
    const compressedSegments = JSON.parse(storedData);
    return compressedSegments.map((segment: any) => {
      // Check if this is a compressed segment
      if (segment.compressedPoints) {
        return decompressTripData(segment);
      }
      return segment;
    });
  } catch (error) {
    console.error('Failed to retrieve offline trip data:', error);
    return [];
  }
};

// Save a trip segment to local storage with compression
export const saveTripSegment = (segment: OfflineTripSegment): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const existingSegments = getStoredTripSegments();
    
    // Check if segment with this ID already exists
    const index = existingSegments.findIndex(s => s.id === segment.id);
    
    // Add device metadata
    segment.metadata = {
      ...segment.metadata,
      deviceModel: navigator.userAgent,
      batteryLevel: (navigator as any).getBattery ? 
        (navigator as any).getBattery().then((b: any) => b.level) : undefined,
      networkType: (navigator as any).connection ? 
        (navigator as any).connection.effectiveType : undefined,
      appVersion: '2.0.0', // Update with your app version
    };
    
    // Compress the segment before storing
    const compressedSegment = compressTripData(segment);
    
    if (index >= 0) {
      // Update existing segment
      existingSegments[index] = segment;
      
      // Compress all segments for storage
      const compressedSegments = existingSegments.map(s => 
        s.id === segment.id ? compressedSegment : compressTripData(s)
      );
      
      localStorage.setItem(`${STORAGE_KEY}_${STORAGE_VERSION}`, JSON.stringify(compressedSegments));
    } else {
      // Add new segment
      const allSegments = [...existingSegments, segment];
      
      // Compress all segments for storage
      const compressedSegments = allSegments.map(s => 
        s.id === segment.id ? compressedSegment : compressTripData(s)
      );
      
      // Check storage size and prune if necessary
      const dataString = JSON.stringify(compressedSegments);
      if (dataString.length > MAX_STORAGE_SIZE) {
        pruneOldestSyncedTrips();
      }
      
      localStorage.setItem(`${STORAGE_KEY}_${STORAGE_VERSION}`, JSON.stringify(compressedSegments));
    }
  } catch (error) {
    console.error('Failed to save offline trip data:', error);
  }
};

// Add a point to an existing trip segment
export const addPointToTripSegment = (segmentId: string, point: TripPoint): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const segments = getStoredTripSegments();
    const segmentIndex = segments.findIndex(s => s.id === segmentId);
    
    if (segmentIndex >= 0) {
      segments[segmentIndex].points.push(point);
      segments[segmentIndex].endTime = point.timestamp;
      
      // Compress and save
      const compressedSegments = segments.map(s => 
        s.id === segmentId ? compressTripData(s) : compressTripData(s)
      );
      
      localStorage.setItem(`${STORAGE_KEY}_${STORAGE_VERSION}`, JSON.stringify(compressedSegments));
    }
  } catch (error) {
    console.error('Failed to add point to trip segment:', error);
  }
};

// Mark a trip segment as synced
export const markTripSegmentAsSynced = (segmentId: string): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const segments = getStoredTripSegments();
    const segmentIndex = segments.findIndex(s => s.id === segmentId);
    
    if (segmentIndex >= 0) {
      segments[segmentIndex].synced = true;
      
      // Compress and save
      const compressedSegments = segments.map(s => compressTripData(s));
      localStorage.setItem(`${STORAGE_KEY}_${STORAGE_VERSION}`, JSON.stringify(compressedSegments));
    }
  } catch (error) {
    console.error('Failed to mark trip segment as synced:', error);
  }
};

// Get all unsynced trip segments
export const getUnsyncedTripSegments = (): OfflineTripSegment[] => {
  return getStoredTripSegments().filter(segment => !segment.synced);
};

// Clear all synced trip segments to free up storage
export const clearSyncedTripSegments = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const segments = getStoredTripSegments();
    const unsyncedSegments = segments.filter(segment => !segment.synced);
    
    // Compress and save only unsynced segments
    const compressedSegments = unsyncedSegments.map(s => compressTripData(s));
    localStorage.setItem(`${STORAGE_KEY}_${STORAGE_VERSION}`, JSON.stringify(compressedSegments));
  } catch (error) {
    console.error('Failed to clear synced trip segments:', error);
  }
};

// Prune oldest synced trips when storage is getting full
export const pruneOldestSyncedTrips = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const segments = getStoredTripSegments();
    
    // First try to remove all synced segments
    let filteredSegments = segments.filter(segment => !segment.synced);
    
    // If we still have too many segments, sort by date and keep only the newest ones
    if (filteredSegments.length > 20) {
      filteredSegments.sort((a, b) => b.startTime - a.startTime);
      filteredSegments = filteredSegments.slice(0, 20);
    }
    
    // Compress and save
    const compressedSegments = filteredSegments.map(s => compressTripData(s));
    localStorage.setItem(`${STORAGE_KEY}_${STORAGE_VERSION}`, JSON.stringify(compressedSegments));
    
    console.log(`Pruned storage: kept ${filteredSegments.length} of ${segments.length} trip segments`);
  } catch (error) {
    console.error('Failed to prune trip segments:', error);
  }
};

// Generate a unique ID for a new trip segment
export const generateTripSegmentId = (): string => {
  return `trip_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// Estimate storage usage
export const getStorageUsage = (): number => {
  if (typeof window === 'undefined') return 0;
  
  try {
    const data = localStorage.getItem(`${STORAGE_KEY}_${STORAGE_VERSION}`) || '';
    return data.length;
  } catch (error) {
    console.error('Failed to get storage usage:', error);
    return 0;
  }
};

// Get storage usage as percentage of maximum
export const getStorageUsagePercentage = (): number => {
  const usage = getStorageUsage();
  return (usage / MAX_STORAGE_SIZE) * 100;
};