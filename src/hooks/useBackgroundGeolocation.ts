// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isWithinDutyHours, isEndOfDutyHours } from '@/util/duty-hours';
import { connectivityManager } from '@/util/connectivity';
import { getLocationFromIp, getLocationFromIpAlternative, getLocationFromIpFallback } from '@/util/ipGeolocation';

interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
  backgroundTracking?: boolean;
  trackingInterval?: number; // in milliseconds
  fallbackToLastLocation?: boolean; // Use last known location if GPS fails
}

interface BackgroundGeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  isLoading: boolean;
  isTracking: boolean;
  lastUpdated: Date | null;
  startTracking: () => void;
  stopTracking: () => void;
  accuracy: number | null; // GPS accuracy in meters
  isUsingFallbackLocation: boolean; // Whether we're using a fallback location
  gpsStatus: 'available' | 'unavailable' | 'permission_denied' | 'timeout';
}

export const useBackgroundGeolocation = (options: GeolocationOptions = {}): BackgroundGeolocationState => {
  const { user } = useAuth();
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isUsingFallbackLocation, setIsUsingFallbackLocation] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'available' | 'unavailable' | 'permission_denied' | 'timeout'>('available');
  
  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const gpsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastKnownPositionRef = useRef<{lat: number, lng: number, accuracy: number, timestamp: Date} | null>(null);
  const consecutiveErrorsRef = useRef<number>(0);
  
  const {
    enableHighAccuracy = true,
    maximumAge = 0,
    timeout = 30000, // Increased timeout for better GPS acquisition
    backgroundTracking = false,
    trackingInterval = 10000, // Default to 10 seconds for more frequent updates
    fallbackToLastLocation = true, // Default to using last known location
  } = options;

  // Function to get enhanced network-based location when GPS is unavailable
  const getNetworkLocation = async () => {
    console.log('Attempting to get enhanced network-based location...');
    setIsLoading(true);
    
    try {
      // Import the enhanced geolocation utility
      const { getEnhancedLocation } = await import('@/util/enhancedGeolocation');
      
      // Use our enhanced location utility that combines multiple sources
      const enhancedLocation = await getEnhancedLocation();
      
      if (enhancedLocation) {
        console.log('Successfully obtained enhanced location:', enhancedLocation);
        console.log('Location source:', enhancedLocation.source);
        console.log('Estimated accuracy:', enhancedLocation.accuracy, 'meters');
        console.log('Confidence score:', enhancedLocation.confidence);
        
        // Update state with enhanced location
        setLatitude(enhancedLocation.latitude);
        setLongitude(enhancedLocation.longitude);
        setAccuracy(enhancedLocation.accuracy);
        setIsUsingFallbackLocation(true);
        setError(null);
        setIsLoading(false);
        setLastUpdated(new Date());
        setGpsStatus('unavailable');
        
        // Send to server with fallback flag and additional metadata
        if (user) {
          sendLocationToServer(
            enhancedLocation.latitude, 
            enhancedLocation.longitude, 
            true, 
            {
              source: enhancedLocation.source,
              accuracy: enhancedLocation.accuracy,
              confidence: enhancedLocation.confidence,
              metadata: enhancedLocation.metadata
            }
          );
        }
        
        return true;
      }
      
      // If enhanced location failed, try the legacy IP-based methods as last resort
      console.log('Enhanced location failed, falling back to IP-based methods...');
      
      // Try primary IP geolocation service
      let ipLocation = await getLocationFromIp();
      
      // If primary service fails, try alternative
      if (!ipLocation) {
        console.log('Primary IP geolocation service failed, trying alternative...');
        ipLocation = await getLocationFromIpAlternative();
      }
      
      // If both services fail, try the final fallback
      if (!ipLocation && typeof getLocationFromIpFallback === 'function') {
        console.log('Alternative IP geolocation service failed, trying final fallback...');
        ipLocation = await getLocationFromIpFallback();
      }
      
      if (ipLocation) {
        console.log('Successfully obtained location from IP:', ipLocation);
        console.log('IP location provider:', ipLocation.provider);
        console.log('Estimated accuracy:', ipLocation.accuracy, 'meters');
        
        // Update state with IP-based location
        setLatitude(ipLocation.latitude);
        setLongitude(ipLocation.longitude);
        setAccuracy(ipLocation.accuracy);
        setIsUsingFallbackLocation(true);
        setError(null);
        setIsLoading(false);
        setLastUpdated(new Date());
        
        // Send to server with fallback flag and additional metadata
        if (user) {
          sendLocationToServer(
            ipLocation.latitude, 
            ipLocation.longitude, 
            true, 
            {
              provider: ipLocation.provider,
              accuracy: ipLocation.accuracy,
              city: ipLocation.city,
              country: ipLocation.country
            }
          );
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error getting enhanced network-based location:', error);
      return false;
    }
  };

  // Function to get current position
  const getCurrentPosition = () => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      setError('Geolocation is not available in server environment');
      setIsLoading(false);
      return;
    }
    
    if (!navigator.geolocation) {
      console.error('Geolocation API is not supported by this browser');
      setError('Geolocation is not supported by your browser');
      setIsLoading(false);
      setGpsStatus('unavailable');
      connectivityManager.updateGPSStatus(false);
      
      // Try to get location from IP address
      getNetworkLocation();
      return;
    }

    // Set up a timeout for GPS acquisition
    if (gpsTimeoutRef.current) {
      clearTimeout(gpsTimeoutRef.current);
    }
    
    console.log('Attempting to get current position with timeout:', timeout);
    
    // Safety timeout to prevent hanging if geolocation API fails silently
    gpsTimeoutRef.current = setTimeout(async () => {
      try {
        // If we haven't received a position update by now, consider GPS unavailable
        if (isLoading) {
          console.log('GPS acquisition timed out, falling back to IP geolocation');
          setGpsStatus('timeout');
          connectivityManager.updateGPSStatus(false);
          
          // First try IP-based geolocation
          const gotIpLocation = await getNetworkLocation();
          console.log('IP geolocation result:', gotIpLocation ? 'success' : 'failed');
          
          // If IP geolocation failed and we have a last known position, use it as last resort
          if (!gotIpLocation && fallbackToLastLocation && lastKnownPositionRef.current) {
            const { lat, lng, accuracy, timestamp } = lastKnownPositionRef.current;
            console.log('Using last known location as fallback', { lat, lng, timestamp });
            
            setLatitude(lat);
            setLongitude(lng);
            setAccuracy(accuracy);
            setIsUsingFallbackLocation(true);
            setIsLoading(false);
            
            // Still try to send this location to server, but mark it as fallback
            if (user) {
              try {
                sendLocationToServer(lat, lng, true);
              } catch (error) {
                console.error('Error sending fallback location to server:', error);
              }
            }
          } else if (!gotIpLocation) {
            // If all fallbacks failed, set error state
            setError('Unable to determine your location. Please check your device settings.');
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('Error in geolocation timeout handler:', error);
        setError('Location services error. Please try again.');
        setIsLoading(false);
      }
    }, timeout + 5000); // Give a little extra time beyond the geolocation timeout

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          try {
            // Clear the timeout since we got a position
            if (gpsTimeoutRef.current) {
              clearTimeout(gpsTimeoutRef.current);
              gpsTimeoutRef.current = null;
            }
            
            // Update GPS status
            setGpsStatus('available');
            connectivityManager.updateGPSStatus(true);
            consecutiveErrorsRef.current = 0;
            
            // Store this as the last known good position
            lastKnownPositionRef.current = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: new Date()
            };
            
            // Update state
            setLatitude(position.coords.latitude);
            setLongitude(position.coords.longitude);
            setAccuracy(position.coords.accuracy);
            setError(null);
            setIsLoading(false);
            setIsUsingFallbackLocation(false);
            setLastUpdated(new Date());
            
            // If we have user and coordinates, send to server
            if (user && position.coords.latitude && position.coords.longitude) {
              try {
                sendLocationToServer(position.coords.latitude, position.coords.longitude, false);
              } catch (error) {
                console.error('Error sending location to server:', error);
              }
            }
          } catch (error) {
            console.error('Error processing geolocation position:', error);
            // Ensure we don't leave loading state hanging
            setIsLoading(false);
          }
        },
        (error) => {
          try {
            // Clear the timeout since we got an error response
            if (gpsTimeoutRef.current) {
              clearTimeout(gpsTimeoutRef.current);
              gpsTimeoutRef.current = null;
            }
            
            // Increment consecutive errors counter
            consecutiveErrorsRef.current += 1;
            
            // After 3 consecutive errors, consider GPS unavailable
            if (consecutiveErrorsRef.current >= 3) {
              connectivityManager.updateGPSStatus(false);
            }
            
            handleGeolocationError(error);
            
            // If fallback is enabled and we have a last known position, use it
            if (fallbackToLastLocation && lastKnownPositionRef.current) {
              const { lat, lng, accuracy, timestamp } = lastKnownPositionRef.current;
              const ageInMs = new Date().getTime() - timestamp.getTime();
              
              // Only use fallback if it's less than 5 minutes old
              if (ageInMs < 5 * 60 * 1000) {
                console.log('Using fallback location due to GPS error', { lat, lng, timestamp, ageInMs });
                
                setLatitude(lat);
                setLongitude(lng);
                setAccuracy(accuracy);
                setIsUsingFallbackLocation(true);
                setIsLoading(false);
                
                // Still try to send this location to server, but mark it as fallback
                if (user) {
                  try {
                    sendLocationToServer(lat, lng, true);
                  } catch (error) {
                    console.error('Error sending fallback location to server:', error);
                  }
                }
              } else {
                // Fallback location is too old
                setIsLoading(false);
              }
            } else {
              // No fallback available
              setIsLoading(false);
            }
          } catch (error) {
            console.error('Error handling geolocation error:', error);
            // Ensure we don't leave loading state hanging
            setIsLoading(false);
          }
        },
        { enableHighAccuracy, timeout, maximumAge }
      );
    } catch (err) {
      console.error('Error getting current position:', err);
      setError('Failed to access location services');
      setIsLoading(false);
      setGpsStatus('unavailable');
      connectivityManager.updateGPSStatus(false);
      
      // If fallback is enabled and we have a last known position, use it
      if (fallbackToLastLocation && lastKnownPositionRef.current) {
        const { lat, lng, accuracy, timestamp } = lastKnownPositionRef.current;
        const ageInMs = new Date().getTime() - timestamp.getTime();
        
        // Only use fallback if it's less than 5 minutes old
        if (ageInMs < 5 * 60 * 1000) {
          setLatitude(lat);
          setLongitude(lng);
          setAccuracy(accuracy);
          setIsUsingFallbackLocation(true);
        }
      }
    }
  };

  // Function to send location data to server
  const sendLocationToServer = async (lat: number, lng: number, isFallback: boolean = false, metadata?: any) => {
    try {
      // Only send location updates during duty hours
      if (!isWithinDutyHours()) {
        console.log('Outside duty hours, skipping location update');
        return;
      }
      
      // Check if we're online
      const isOnline = connectivityManager.isNetworkOnline();
      
      if (!isOnline) {
        // Store location update for later sync
        console.log('Device is offline, storing location update for later sync');
        connectivityManager.addOfflineLocationUpdate({
          latitude: lat,
          longitude: lng,
          timestamp: new Date(),
          accuracy: accuracy || undefined,
          isFallback,
          locationSource: metadata?.source || (isFallback ? 'network' : 'gps')
        });
        return;
      }
      
      // We're online, send the update with enhanced location data
      const response = await fetch('/api/vehicles/update-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          isFallback,
          timestamp: new Date(),
          accuracy: accuracy,
          locationSource: metadata?.source || (isFallback ? 'network' : 'gps'),
          metadata: metadata || undefined
        }),
      });

      if (!response.ok) {
        console.error('Failed to update location on server');
        
        // If server request failed, store for later retry
        connectivityManager.addOfflineLocationUpdate({
          latitude: lat,
          longitude: lng,
          timestamp: new Date()
        });
      } else {
        // Check if we should auto-detect a trip based on movement
        if (!isFallback) {
          checkForAutoTripDetection(lat, lng);
        }
        
        // Check if we need to auto-complete trips at end of duty hours
        checkForDutyHoursEnd();
      }
    } catch (error) {
      console.error('Error sending location to server:', error);
      
      // If there was an error (likely network-related), store for later
      connectivityManager.addOfflineLocationUpdate({
        latitude: lat,
        longitude: lng,
        timestamp: new Date()
      });
    }
  };
  
  // Function to check if we should auto-detect a trip
  // This function is now disabled to prevent auto-starting trips
  const checkForAutoTripDetection = async (lat: number, lng: number) => {
    // Auto-detection is now disabled to prevent auto-starting trips
    // Trips will only start when the user explicitly clicks the Start Trip button
    return;
  };
  
  // Function to check if we need to auto-complete trips at end of duty hours
  const checkForDutyHoursEnd = async () => {
    // Check if we're at the end of duty hours
    if (isEndOfDutyHours()) {
      try {
        // Send request to auto-complete any active trips
        await fetch('/api/vehicles/auto-complete-trip', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            latitude: latitude || 0,
            longitude: longitude || 0,
            reason: 'duty_hours_ended'
          }),
        });
      } catch (error) {
        console.error('Error auto-completing trip at end of duty hours:', error);
      }
    }
  };

  // Handle geolocation errors with user-friendly messages
  const handleGeolocationError = (error: GeolocationPositionError) => {
    setIsLoading(false);
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        setError('Please allow location access to track vehicles. You can change this in your browser settings.');
        break;
      case error.POSITION_UNAVAILABLE:
        setError('Location information is currently unavailable. Please try again.');
        break;
      case error.TIMEOUT:
        setError('Location request timed out. Please check your connection and try again.');
        break;
      default:
        setError('An error occurred while getting your location.');
    }
  };

  // Start tracking function
  const startTracking = () => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Clear any existing interval
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setError(null);
        setIsLoading(false);
        setLastUpdated(new Date());
        
        // If we have user and coordinates, send to server
        if (user && position.coords.latitude && position.coords.longitude) {
          sendLocationToServer(position.coords.latitude, position.coords.longitude);
        }
      },
      (error) => {
        handleGeolocationError(error);
      },
      { enableHighAccuracy, timeout, maximumAge }
    );

    // If background tracking is enabled, set up interval to periodically get position
    if (backgroundTracking) {
      intervalIdRef.current = setInterval(() => {
        getCurrentPosition();
      }, trackingInterval);
    }

    setIsTracking(true);
  };

  // Stop tracking function
  const stopTracking = () => {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined' && navigator.geolocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    setIsTracking(false);
  };

  // Initialize tracking on mount if backgroundTracking is enabled
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;
    
    // Get initial position
    getCurrentPosition();

    // Start tracking if backgroundTracking is enabled
    if (backgroundTracking) {
      startTracking();
    }

    // Cleanup on unmount
    return () => {
      if (typeof window !== 'undefined' && navigator.geolocation) {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
      }
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [backgroundTracking, user]); // Re-initialize when user changes

  return {
    latitude,
    longitude,
    error,
    isLoading,
    isTracking,
    lastUpdated,
    startTracking,
    stopTracking,
    accuracy,
    isUsingFallbackLocation,
    gpsStatus,
  };
};