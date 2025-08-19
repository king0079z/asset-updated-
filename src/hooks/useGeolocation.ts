import { useState, useEffect, useRef } from 'react';
import { getLocationFromIp, getLocationFromIpAlternative, getLocationFromIpFallback } from '@/util/ipGeolocation';
import { getEnhancedLocation, cacheCurrentLocation, getLocationAccuracyDescription, EnhancedLocationResult } from '@/util/enhancedGeolocation';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  isLoading: boolean;
  isUsingFallbackLocation?: boolean; // Indicates if we're using network-based location instead of GPS
  accuracy?: number | null; // Accuracy in meters if available
  locationSource?: string; // Source of the location data (gps, wifi, cell, ip, etc.)
  locationAccuracyDescription?: string; // Human-readable description of accuracy
}

interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
}

export const useGeolocation = (options?: GeolocationOptions): GeolocationState => {
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallbackLocation, setIsUsingFallbackLocation] = useState(false);
  const [locationSource, setLocationSource] = useState<string>('gps');
  const [locationAccuracyDescription, setLocationAccuracyDescription] = useState<string>('');
  
  // Store the last known good GPS position
  const lastGpsPositionRef = useRef<{
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: Date;
  } | null>(null);

  // Default options for geolocation with high accuracy settings
  const {
    enableHighAccuracy = true,
    timeout = 30000,
    maximumAge = 0
  } = options || {};

  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      setError('Geolocation is not available in server environment');
      setIsLoading(false);
      return;
    }
    
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setIsLoading(false);
      return;
    }

    // Define success handler for GPS
    const successHandler = (position: GeolocationPosition) => {
      // Store this as the last known good GPS position
      lastGpsPositionRef.current = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date()
      };
      
      // Cache this location for future use
      cacheCurrentLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
      
      setLatitude(position.coords.latitude);
      setLongitude(position.coords.longitude);
      setAccuracy(position.coords.accuracy);
      setLocationSource('gps');
      setLocationAccuracyDescription(
        position.coords.accuracy < 10 
          ? `Precise location (±${Math.round(position.coords.accuracy)}m)`
          : position.coords.accuracy < 50
            ? `Accurate location (±${Math.round(position.coords.accuracy)}m)`
            : `Location accuracy: ±${Math.round(position.coords.accuracy)}m`
      );
      setIsUsingFallbackLocation(false);
      setError(null);
      setIsLoading(false);
    };

    // Function to get enhanced network-based location when GPS is unavailable
    const getNetworkBasedLocation = async () => {
      console.log('Attempting to get enhanced network-based location...');
      
      try {
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
          setLocationSource(enhancedLocation.source);
          setLocationAccuracyDescription(
            getLocationAccuracyDescription(enhancedLocation.accuracy, enhancedLocation.source)
          );
          setIsUsingFallbackLocation(true);
          setError(null);
          setIsLoading(false);
          
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
        if (!ipLocation) {
          console.log('Alternative IP geolocation service failed, trying final fallback...');
          ipLocation = await getLocationFromIpFallback();
        }
        
        if (ipLocation) {
          console.log('Successfully obtained location from IP:', ipLocation);
          
          // Update state with IP-based location
          setLatitude(ipLocation.latitude);
          setLongitude(ipLocation.longitude);
          setAccuracy(ipLocation.accuracy);
          setLocationSource('ip');
          setLocationAccuracyDescription(
            `Approximate area (±${Math.round(ipLocation.accuracy / 1000)}km)`
          );
          setIsUsingFallbackLocation(true);
          setError(null);
          setIsLoading(false);
          
          return true;
        }
        
        return false;
      } catch (error) {
        console.error('Error getting network-based location:', error);
        return false;
      }
    };

    // Define error handler with user-friendly messages
    const errorHandler = async (error: GeolocationPositionError) => {
      // Show more user-friendly error messages
      let errorMessage = '';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Please allow location access to register assets. You can change this in your browser settings.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information is currently unavailable. Please try again.';
          break;
        case error.TIMEOUT:
          errorMessage = 'Location request timed out. Please check your connection and try again.';
          break;
        default:
          errorMessage = 'An error occurred while getting your location.';
      }
      
      // Try to get enhanced network-based location
      console.log('GPS location error, trying enhanced network-based geolocation...');
      const gotNetworkLocation = await getNetworkBasedLocation();
      
      // Only set error if network-based geolocation also failed
      if (!gotNetworkLocation) {
        // Check if we have a recent last known position we can use
        if (lastGpsPositionRef.current) {
          const ageInMs = new Date().getTime() - lastGpsPositionRef.current.timestamp.getTime();
          
          // Only use last known position if it's less than 5 minutes old
          if (ageInMs < 5 * 60 * 1000) {
            console.log('Using last known GPS position as fallback');
            
            setLatitude(lastGpsPositionRef.current.latitude);
            setLongitude(lastGpsPositionRef.current.longitude);
            setAccuracy(lastGpsPositionRef.current.accuracy);
            setLocationSource('last_gps');
            setLocationAccuracyDescription(
              `Last known location (±${Math.round(lastGpsPositionRef.current.accuracy)}m)`
            );
            setIsUsingFallbackLocation(true);
            setError(null);
            setIsLoading(false);
            return;
          }
        }
        
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    // Options for geolocation with high accuracy settings
    const geoOptions = {
      enableHighAccuracy, // Request the most accurate position available
      timeout, // Timeout for position acquisition
      maximumAge, // Maximum age of a cached position
    };

    // Use a try-catch block to handle potential permissions policy violations
    try {
      // Check if we're in an iframe or if there might be permissions policy restrictions
      const isInIframe = window.self !== window.top;
      const isPermissionsPolicyRestricted = isInIframe || 
        (document.featurePolicy && !document.featurePolicy.allowsFeature('geolocation'));
      
      if (isPermissionsPolicyRestricted) {
        console.warn('Geolocation might be restricted by permissions policy. Trying network-based location...');
        getNetworkBasedLocation().then(success => {
          if (!success) {
            setError('Geolocation is restricted in this context, and network-based location failed.');
            setIsLoading(false);
          }
        });
        return;
      }
      
      // Start watching position only if not restricted
      let watchId: number;
      watchId = navigator.geolocation.watchPosition(
        successHandler,
        errorHandler,
        geoOptions
      );
      
      // Cleanup function to stop watching when component unmounts
      return () => {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.clearWatch(watchId);
        }
      };
    } catch (err) {
      console.error('Error starting geolocation watch:', err);
      
      // Try network-based location as fallback
      getNetworkBasedLocation().then(success => {
        if (!success) {
          setError('Failed to initialize location tracking. This may be due to permissions policy restrictions.');
          setIsLoading(false);
        }
      });
    }
  }, [enableHighAccuracy, timeout, maximumAge]);

  return { 
    latitude, 
    longitude, 
    error, 
    isLoading, 
    isUsingFallbackLocation,
    accuracy,
    locationSource,
    locationAccuracyDescription
  };
};