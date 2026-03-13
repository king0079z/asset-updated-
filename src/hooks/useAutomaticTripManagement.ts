import { useState, useEffect, useCallback, useRef } from 'react';
import { useMovementTypeDetection, MovementType } from './useMovementTypeDetection';
import { useGeolocation } from './useGeolocation';
import { useAuth } from '@/contexts/AuthContext';
import { useBackgroundGeolocation } from './useBackgroundGeolocation';

interface AutomaticTripManagementOptions {
  destinationLatitude?: number;
  destinationLongitude?: number;
  autoStartDistance?: number; // Distance in km from destination to auto-start trip
  autoEndDistance?: number; // Distance in km from start to auto-end trip
  minStationaryTime?: number; // Time in ms to consider vehicle stopped
  minVehicleConfidence?: number; // Minimum confidence for vehicle detection
  backgroundTracking?: boolean; // Whether to track in the background
}

interface TripState {
  isActive: boolean;
  tripId: string | null;
  startTime: Date | null;
  startLocation: { latitude: number; longitude: number } | null;
  distance: number | null;
  isAutoStarted: boolean;
  isAutoEnded: boolean;
  lastError: string | null;
}

export function useAutomaticTripManagement({
  destinationLatitude,
  destinationLongitude,
  autoStartDistance = 0.8, // 800 meters default
  autoEndDistance = 0.1, // 100 meters default
  minStationaryTime = 120000, // 2 minutes default
  minVehicleConfidence = 0.65, // Minimum confidence for vehicle detection
  backgroundTracking = true, // Track in background by default
}: AutomaticTripManagementOptions = {}) {
  const { user } = useAuth();
  const [tripState, setTripState] = useState<TripState>({
    isActive: false,
    tripId: null,
    startTime: null,
    startLocation: null,
    distance: null,
    isAutoStarted: false,
    isAutoEnded: false,
    lastError: null,
  });
  
  // Get movement type detection with enhanced precision
  const movementDetection = useMovementTypeDetection({
    sampleSize: 60, // Use larger sample size for better accuracy
    updateInterval: 1000, // More frequent updates
    temporalSmoothing: true, // Apply temporal smoothing
    adaptiveThresholds: true, // Use adaptive thresholds
  });
  
  // Get background location tracking
  const backgroundLocation = useBackgroundGeolocation({
    enableHighAccuracy: true,
    backgroundTracking,
    trackingInterval: 15000, // Check location every 15 seconds
    fallbackToLastLocation: true,
  });
  
  // Get high-precision location for foreground use
  const foregroundLocation = useGeolocation({
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 15000,
  });
  
  // Use the best available location
  const location = backgroundTracking ? backgroundLocation : foregroundLocation;
  
  // Track stationary time
  const lastMovementTimeRef = useRef<number | null>(null);
  const lastLocationRef = useRef<{lat: number, lng: number} | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingTripRef = useRef<boolean>(false);
  
  // Function to check if we should auto-start a trip
  const checkForAutoTripStart = useCallback(async () => {
    if (!user || !location.latitude || !location.longitude || tripState.isActive || isCheckingTripRef.current) {
      return;
    }
    
    // Check if movement detection is supported
    if (movementDetection.isSupported === false) {
      console.log('Movement detection not supported on this device');
      return;
    }
    
    // Only proceed if movement type is vehicle with sufficient confidence
    if (movementDetection.type !== MovementType.VEHICLE || 
        movementDetection.confidence < minVehicleConfidence) {
      console.log('Not in a vehicle or confidence too low:', {
        type: movementDetection.type,
        confidence: movementDetection.confidence
      });
      return;
    }
    
    try {
      isCheckingTripRef.current = true;
      
      // Call the auto-detect-trip-with-movement API
      const response = await fetch('/api/vehicles/auto-detect-trip-with-movement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          movementType: movementDetection.type,
          movementConfidence: movementDetection.confidence,
          destinationLatitude,
          destinationLongitude,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.tripDetected) {
        // Trip was auto-started
        setTripState({
          isActive: true,
          tripId: data.tripId,
          startTime: new Date(data.startTime),
          startLocation: data.startLocation,
          distance: 0,
          isAutoStarted: true,
          isAutoEnded: false,
          lastError: null,
        });
        
        console.log('Trip auto-started:', data);
      } else if (response.ok && data.hasActiveTrip) {
        // There's already an active trip
        fetchActiveTripDetails();
      } else {
        console.log('Trip not auto-started:', data.message);
      }
    } catch (error) {
      console.error('Error checking for auto trip start:', error);
      setTripState(prev => ({
        ...prev,
        lastError: 'Failed to check for auto trip start'
      }));
    } finally {
      isCheckingTripRef.current = false;
    }
  }, [
    user, 
    location.latitude, 
    location.longitude, 
    tripState.isActive, 
    movementDetection.type, 
    movementDetection.confidence,
    minVehicleConfidence,
    destinationLatitude,
    destinationLongitude
  ]);
  
  // Function to check if we should auto-end a trip
  const checkForAutoTripEnd = useCallback(async () => {
    if (!user || !location.latitude || !location.longitude || !tripState.isActive || isCheckingTripRef.current) {
      return;
    }
    
    // Check if movement detection is supported
    if (movementDetection.isSupported === false) {
      console.log('Movement detection not supported on this device');
      // We can still try to auto-end based on location only
    }
    
    // Check if we've been stationary for long enough
    const now = Date.now();
    const isStationary = movementDetection.type === MovementType.STATIONARY || 
                         (movementDetection.type === MovementType.UNKNOWN && lastMovementTimeRef.current);
    
    // Update last movement time if we're not stationary
    if (!isStationary) {
      lastMovementTimeRef.current = now;
      return;
    }
    
    // Check if we've been stationary long enough
    if (lastMovementTimeRef.current && (now - lastMovementTimeRef.current) < minStationaryTime) {
      return;
    }
    
    // Check if we're near the starting point
    if (!tripState.startLocation) {
      return;
    }
    
    try {
      isCheckingTripRef.current = true;
      
      // Call the auto-complete-trip API
      const response = await fetch('/api/vehicles/auto-complete-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          reason: 'returned_to_start',
          movementType: movementDetection.type,
          movementConfidence: movementDetection.confidence,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Trip was auto-ended
        setTripState({
          isActive: false,
          tripId: null,
          startTime: null,
          startLocation: null,
          distance: data.distance || 0,
          isAutoStarted: tripState.isAutoStarted,
          isAutoEnded: true,
          lastError: null,
        });
        
        console.log('Trip auto-ended:', data);
      } else {
        console.error('Failed to auto-end trip:', data.error || data.message);
        setTripState(prev => ({
          ...prev,
          lastError: 'Failed to auto-end trip'
        }));
      }
    } catch (error) {
      console.error('Error checking for auto trip end:', error);
      setTripState(prev => ({
        ...prev,
        lastError: 'Failed to check for auto trip end'
      }));
    } finally {
      isCheckingTripRef.current = false;
    }
  }, [
    user, 
    location.latitude, 
    location.longitude, 
    tripState.isActive,
    tripState.startLocation,
    tripState.isAutoStarted,
    movementDetection.type,
    movementDetection.confidence,
    minStationaryTime
  ]);
  
  // Function to fetch active trip details
  const fetchActiveTripDetails = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/vehicles/active-trip');
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.trip) {
          setTripState({
            isActive: true,
            tripId: data.trip.id,
            startTime: new Date(data.trip.startTime),
            startLocation: {
              latitude: data.trip.startLatitude,
              longitude: data.trip.startLongitude,
            },
            distance: data.trip.distance || 0,
            isAutoStarted: data.trip.isAutoStarted || false,
            isAutoEnded: false,
            lastError: null,
          });
        } else {
          setTripState({
            isActive: false,
            tripId: null,
            startTime: null,
            startLocation: null,
            distance: null,
            isAutoStarted: false,
            isAutoEnded: false,
            lastError: null,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching active trip:', error);
    }
  }, [user]);
  
  // Set up periodic checking for auto trip start/end
  useEffect(() => {
    // Fetch active trip on mount
    fetchActiveTripDetails();
    
    // Set up interval for checking
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    
    checkIntervalRef.current = setInterval(() => {
      if (tripState.isActive) {
        checkForAutoTripEnd();
      } else {
        checkForAutoTripStart();
      }
    }, 10000); // Check every 10 seconds
    
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [
    fetchActiveTripDetails, 
    checkForAutoTripStart, 
    checkForAutoTripEnd, 
    tripState.isActive
  ]);
  
  // Check for location changes that might trigger trip start/end
  useEffect(() => {
    if (!location.latitude || !location.longitude) return;
    
    // Store the current location
    lastLocationRef.current = {
      lat: location.latitude,
      lng: location.longitude
    };
    
    // Check for auto trip start/end on significant location changes
    if (tripState.isActive) {
      checkForAutoTripEnd();
    } else {
      checkForAutoTripStart();
    }
  }, [
    location.latitude, 
    location.longitude, 
    tripState.isActive,
    checkForAutoTripStart,
    checkForAutoTripEnd
  ]);
  
  // Manual trip start function
  const startTrip = useCallback(async () => {
    if (!user || !location.latitude || !location.longitude || tripState.isActive) {
      return false;
    }
    
    try {
      const response = await fetch('/api/vehicles/start-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTripState({
          isActive: true,
          tripId: data.tripId,
          startTime: new Date(data.startTime),
          startLocation: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          distance: 0,
          isAutoStarted: false,
          isAutoEnded: false,
          lastError: null,
        });
        return true;
      } else {
        setTripState(prev => ({
          ...prev,
          lastError: data.error || 'Failed to start trip'
        }));
        return false;
      }
    } catch (error) {
      console.error('Error starting trip:', error);
      setTripState(prev => ({
        ...prev,
        lastError: 'Failed to start trip'
      }));
      return false;
    }
  }, [user, location.latitude, location.longitude, tripState.isActive]);
  
  // Manual trip end function
  const endTrip = useCallback(async () => {
    if (!user || !location.latitude || !location.longitude || !tripState.isActive) {
      return false;
    }
    
    try {
      const response = await fetch('/api/vehicles/end-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTripState({
          isActive: false,
          tripId: null,
          startTime: null,
          startLocation: null,
          distance: data.distance || 0,
          isAutoStarted: tripState.isAutoStarted,
          isAutoEnded: false,
          lastError: null,
        });
        return true;
      } else {
        setTripState(prev => ({
          ...prev,
          lastError: data.error || 'Failed to end trip'
        }));
        return false;
      }
    } catch (error) {
      console.error('Error ending trip:', error);
      setTripState(prev => ({
        ...prev,
        lastError: 'Failed to end trip'
      }));
      return false;
    }
  }, [user, location.latitude, location.longitude, tripState.isActive, tripState.isAutoStarted]);
  
  return {
    ...tripState,
    startTrip,
    endTrip,
    refreshTripStatus: fetchActiveTripDetails,
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      isLoading: location.isLoading,
      error: location.error,
    },
    movement: {
      type: movementDetection.type,
      confidence: movementDetection.confidence,
      isSupported: movementDetection.isSupported,
      details: movementDetection.details,
    },
    isBackgroundTracking: backgroundTracking,
  };
}