import { useState, useEffect, useCallback, useRef } from 'react';
import { useMotionSensors } from './useMotionSensors';
import { useGeolocation } from './useGeolocation';
import { useAuth } from '@/contexts/AuthContext';
import { useIsIFrame } from './useIsIFrame';
import { useMovementTypeDetection, MovementType } from './useMovementTypeDetection';
import { 
  generateTripSegmentId, 
  saveTripSegment, 
  addPointToTripSegment,
  getUnsyncedTripSegments
} from '@/util/offlineStorage';

interface UseOfflineTripDetectionOptions {
  vehicleId: string;
  motionThreshold?: number;
  samplingInterval?: number;
  minStationaryTime?: number; // Time in ms to consider vehicle stopped
  minMovingTime?: number; // Time in ms to consider vehicle moving
}

interface TripState {
  isMoving: boolean;
  currentTripId: string | null;
  tripStartTime: number | null;
  lastStationaryTime: number | null;
  lastMovingTime: number | null;
  pendingSyncCount: number;
}

export function useOfflineTripDetection({
  vehicleId,
  motionThreshold = 1.2,
  samplingInterval = 1000,
  minStationaryTime = 120000, // 2 minutes
  minMovingTime = 30000, // 30 seconds
}: UseOfflineTripDetectionOptions) {
  const { user } = useAuth();
  const isIframe = useIsIFrame();
  const [tripState, setTripState] = useState<TripState>({
    isMoving: false,
    currentTripId: null,
    tripStartTime: null,
    lastStationaryTime: null,
    lastMovingTime: null,
    pendingSyncCount: 0,
  });
  
  // Get motion data from sensors
  const motion = useMotionSensors({
    threshold: motionThreshold,
    interval: samplingInterval,
    minSamples: 3,
  });
  
  // Get movement type detection
  const movementDetection = useMovementTypeDetection({
    sampleSize: 20,
    updateInterval: 2000,
  });
  
  // Get location data if available
  const location = useGeolocation({
    enableHighAccuracy: true,
    maximumAge: 30000,
    timeout: 27000,
  });
  
  // Track online status
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  
  // Sync interval reference
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update online status
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Function to start a new trip
  const startTrip = useCallback(() => {
    if (!user || !vehicleId) return;
    
    const tripId = generateTripSegmentId();
    const startTime = Date.now();
    
    // Create a new trip segment
    saveTripSegment({
      id: tripId,
      vehicleId,
      userId: user.id,
      startTime,
      points: [],
      synced: false,
    });
    
    setTripState(prev => ({
      ...prev,
      isMoving: true,
      currentTripId: tripId,
      tripStartTime: startTime,
      lastMovingTime: startTime,
    }));
    
    console.log(`Started new offline trip: ${tripId}`);
    
    return tripId;
  }, [user, vehicleId]);
  
  // Function to end current trip
  const endTrip = useCallback(() => {
    if (!tripState.currentTripId) return;
    
    setTripState(prev => ({
      ...prev,
      isMoving: false,
      currentTripId: null,
      tripStartTime: null,
      lastStationaryTime: Date.now(),
    }));
    
    console.log(`Ended offline trip: ${tripState.currentTripId}`);
    
    // Update pending sync count
    const unsyncedTrips = getUnsyncedTripSegments();
    setTripState(prev => ({
      ...prev,
      pendingSyncCount: unsyncedTrips.length,
    }));
  }, [tripState.currentTripId]);
  
  // Record trip point
  const recordTripPoint = useCallback(() => {
    if (!tripState.currentTripId) return;
    
    const point = {
      timestamp: Date.now(),
      isMoving: motion.isMoving,
      confidence: motion.confidence,
      sensorData: {
        acceleration: motion.acceleration,
        rotation: motion.rotation,
      },
      location: location.position ? {
        latitude: location.position.coords.latitude,
        longitude: location.position.coords.longitude,
        accuracy: location.position.coords.accuracy,
        source: 'gps' as const,
      } : undefined,
    };
    
    addPointToTripSegment(tripState.currentTripId, point);
  }, [tripState.currentTripId, motion, location]);
  
  // Sync trips with server when online
  const syncTrips = useCallback(async () => {
    if (!isOnline || !user) return;
    
    const unsyncedTrips = getUnsyncedTripSegments();
    if (unsyncedTrips.length === 0) return;
    
    console.log(`Attempting to sync ${unsyncedTrips.length} offline trips`);
    
    try {
      // For each unsynced trip, send to server
      for (const trip of unsyncedTrips) {
        const response = await fetch('/api/vehicles/sync-offline-trip', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(trip),
        });
        
        if (response.ok) {
          // Mark as synced in local storage
          const data = await response.json();
          console.log(`Successfully synced trip ${trip.id} to server`, data);
          
          // Mark trip as synced
          markTripSegmentAsSynced(trip.id);
        } else {
          console.error(`Failed to sync trip ${trip.id}:`, await response.text());
        }
      }
      
      // Update pending sync count
      const remainingUnsynced = getUnsyncedTripSegments();
      setTripState(prev => ({
        ...prev,
        pendingSyncCount: remainingUnsynced.length,
      }));
    } catch (error) {
      console.error('Error syncing offline trips:', error);
    }
  }, [isOnline, user]);
  
  // Main effect for trip detection logic
  useEffect(() => {
    if (isIframe || !user || !vehicleId) return;
    
    const now = Date.now();
    
    // Record data point if trip is in progress
    if (tripState.currentTripId) {
      recordTripPoint();
    }
    
    // Check if we're in a vehicle based on movement type detection
    const isInVehicle = movementDetection.type === MovementType.VEHICLE;
    const isWalking = movementDetection.type === MovementType.WALKING;
    
    // Trip state machine logic with movement type detection
    if (motion.isMoving) {
      // Update last moving time
      setTripState(prev => ({
        ...prev,
        lastMovingTime: now,
      }));
      
      // Only start a trip if we detect vehicle movement (not walking)
      if (!tripState.currentTripId && 
          tripState.lastMovingTime && 
          (now - tripState.lastMovingTime) > minMovingTime &&
          isInVehicle && 
          !isWalking &&
          movementDetection.confidence > 0.6) {
        console.log("Starting trip - detected vehicle movement", { 
          movementType: movementDetection.type,
          confidence: movementDetection.confidence 
        });
        startTrip();
      }
      
      // If we're in a trip but detect walking, consider ending the trip
      if (tripState.currentTripId && 
          isWalking && 
          movementDetection.confidence > 0.7) {
        console.log("Ending trip - detected walking", { 
          movementType: movementDetection.type,
          confidence: movementDetection.confidence 
        });
        endTrip();
      }
    } else {
      // Vehicle is stationary
      setTripState(prev => ({
        ...prev,
        lastStationaryTime: now,
      }));
      
      // If we're tracking a trip and have been stationary for enough time, end the trip
      if (tripState.currentTripId && 
          tripState.lastStationaryTime && 
          (now - tripState.lastStationaryTime) > minStationaryTime) {
        endTrip();
      }
    }
    
    // Set up sync interval when online
    if (isOnline && !syncIntervalRef.current) {
      syncIntervalRef.current = setInterval(syncTrips, 60000); // Try to sync every minute when online
    } else if (!isOnline && syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [
    isIframe, 
    user, 
    vehicleId, 
    motion.isMoving, 
    tripState.currentTripId,
    tripState.lastMovingTime,
    tripState.lastStationaryTime,
    isOnline,
    minMovingTime,
    minStationaryTime,
    startTrip,
    endTrip,
    recordTripPoint,
    syncTrips
  ]);
  
  // Sync when coming back online
  useEffect(() => {
    if (isOnline) {
      syncTrips();
    }
  }, [isOnline, syncTrips]);
  
  return {
    isMoving: tripState.isMoving,
    currentTripId: tripState.currentTripId,
    tripStartTime: tripState.tripStartTime,
    isOnline,
    pendingSyncCount: tripState.pendingSyncCount,
    motionConfidence: motion.confidence,
    motionSupported: motion.isSupported,
    hasLocation: !!location.position,
    startTrip,
    endTrip,
    syncTrips,
  };
}

// Import this function from offlineStorage.ts
const markTripSegmentAsSynced = (tripId: string): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const STORAGE_KEY = 'offline_trip_data';
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (!storedData) return;
    
    const segments = JSON.parse(storedData);
    const segmentIndex = segments.findIndex((s: any) => s.id === tripId);
    
    if (segmentIndex >= 0) {
      segments[segmentIndex].synced = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(segments));
    }
  } catch (error) {
    console.error('Failed to mark trip segment as synced:', error);
  }
};