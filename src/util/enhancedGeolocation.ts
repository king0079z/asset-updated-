// @ts-nocheck
/**
 * Enhanced Geolocation Utility
 * Provides improved network-based location when GPS is unavailable
 * Uses multiple data sources and fusion techniques to improve accuracy
 */

import { 
  getLocationFromIp, 
  getLocationFromIpAlternative, 
  getLocationFromIpFallback, 
  getLocationFromExtremeIpLookup,
  getDefaultLocation,
  getBrowserCachedLocation as getBrowserCachedIpLocation,
  cacheCurrentLocation as cacheIpLocation
} from './ipGeolocation';

export interface EnhancedLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  source: string;
  timestamp: Date;
  confidence: number; // 0-100 confidence score
  metadata?: any;
}

interface LocationSource {
  name: string;
  priority: number; // Higher number = higher priority
  getLocation: () => Promise<EnhancedLocationResult | null>;
}

/**
 * Gets enhanced location using multiple sources and data fusion
 * Prioritizes more accurate sources but combines data when possible
 */
export const getEnhancedLocation = async (): Promise<EnhancedLocationResult | null> => {
  console.log('Getting enhanced location from multiple sources...');
  
  try {
    // Try to get location from multiple sources in parallel
    const locationPromises = [
      getWifiLocation(),
      getCellTowerLocation(),
      getIpBasedLocation(),
      getBrowserCachedLocation()
    ];
    
    // Wait for all location sources to resolve or reject
    const locationResults = await Promise.allSettled(locationPromises);
    
    // Filter out successful results
    const validLocations = locationResults
      .filter((result): result is PromiseFulfilledResult<EnhancedLocationResult> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value)
      .sort((a, b) => b.confidence - a.confidence); // Sort by confidence (highest first)
    
    if (validLocations.length === 0) {
      console.log('No valid locations found from any source');
      return null;
    }
    
    // If we have multiple locations, use data fusion to improve accuracy
    if (validLocations.length > 1) {
      return fuseLocationData(validLocations);
    }
    
    // Otherwise return the single location we found
    return validLocations[0];
  } catch (error) {
    console.error('Error getting enhanced location:', error);
    return null;
  }
};

/**
 * Gets location from WiFi networks (if available)
 * This is typically more accurate than IP-based geolocation
 */
const getWifiLocation = async (): Promise<EnhancedLocationResult | null> => {
  try {
    // Check if Network Information API is available
    if ('navigator' in globalThis && 'connection' in navigator && 
        navigator.connection && 'type' in navigator.connection) {
      
      const connection = navigator.connection as any;
      
      // If not connected to WiFi, return null
      if (connection.type !== 'wifi') {
        return null;
      }
      
      // Try to use the Geolocation API with specific options that prioritize WiFi
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // Check if the accuracy suggests WiFi-based location
            // WiFi positioning typically has accuracy between 15-40m
            if (position.coords.accuracy < 100) {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                source: 'wifi',
                timestamp: new Date(),
                confidence: calculateConfidenceScore('wifi', position.coords.accuracy),
                metadata: {
                  originalAccuracy: position.coords.accuracy
                }
              });
            } else {
              // Accuracy too low, likely not WiFi-based
              resolve(null);
            }
          },
          (error) => {
            // Silently reject - we'll try other methods
            resolve(null);
          },
          {
            enableHighAccuracy: false, // Set to false to prioritize network-based location
            timeout: 5000, // Short timeout for quick response
            maximumAge: 60000 // Accept cached positions up to 1 minute old
          }
        );
      });
    }
    
    return null;
  } catch (error) {
    console.error('Error getting WiFi location:', error);
    return null;
  }
};

/**
 * Gets location from cell tower data (if available)
 * This is typically less accurate than WiFi but better than IP
 */
const getCellTowerLocation = async (): Promise<EnhancedLocationResult | null> => {
  try {
    // Check if Network Information API is available
    if ('navigator' in globalThis && 'connection' in navigator && 
        navigator.connection && 'type' in navigator.connection) {
      
      const connection = navigator.connection as any;
      
      // If not connected to cellular, return null
      if (!['cellular', '4g', '3g', '2g', '5g'].includes(connection.type)) {
        return null;
      }
      
      // Try to use the Geolocation API with specific options that work better for cellular
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // Cell tower positioning typically has accuracy between 100-1000m
            // If accuracy is too good, it's likely not cell tower based
            if (position.coords.accuracy >= 100 && position.coords.accuracy < 3000) {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                source: 'cell',
                timestamp: new Date(),
                confidence: calculateConfidenceScore('cell', position.coords.accuracy),
                metadata: {
                  originalAccuracy: position.coords.accuracy,
                  effectiveType: connection.effectiveType
                }
              });
            } else {
              // Accuracy suggests this isn't cell tower based
              resolve(null);
            }
          },
          (error) => {
            // Silently reject - we'll try other methods
            resolve(null);
          },
          {
            enableHighAccuracy: false, // Set to false to prioritize network-based location
            timeout: 5000, // Short timeout for quick response
            maximumAge: 60000 // Accept cached positions up to 1 minute old
          }
        );
      });
    }
    
    return null;
  } catch (error) {
    console.error('Error getting cell tower location:', error);
    return null;
  }
};

/**
 * Gets location from IP address using multiple services
 * Always returns a location, even if it's a default one
 */
const getIpBasedLocation = async (): Promise<EnhancedLocationResult> => {
  try {
    // Try to get location from browser cache first (fastest)
    let ipLocation = await getBrowserCachedLocation();
    
    // If cache fails, try primary IP geolocation service
    if (!ipLocation) {
      console.log('Browser cache location not available, trying primary IP service...');
      ipLocation = await getLocationFromIp();
    }
    
    // If primary service fails, try alternative
    if (!ipLocation) {
      console.log('Primary IP geolocation service failed, trying alternative...');
      ipLocation = await getLocationFromIpAlternative();
    }
    
    // If both services fail, try extreme-ip-lookup
    if (!ipLocation) {
      console.log('Alternative IP geolocation service failed, trying extreme-ip-lookup...');
      ipLocation = await getLocationFromExtremeIpLookup();
    }
    
    // If that fails too, try the final fallback
    if (!ipLocation) {
      console.log('Extreme IP lookup failed, trying final fallback...');
      ipLocation = await getLocationFromIpFallback();
    }
    
    // If all services fail, use default location
    if (!ipLocation) {
      console.log('All IP geolocation services failed, using default location...');
      ipLocation = getDefaultLocation();
    } else {
      // Cache successful location for future use
      cacheCurrentLocation(ipLocation);
    }
    
    // At this point, ipLocation is guaranteed to have a value
    return {
      latitude: ipLocation.latitude,
      longitude: ipLocation.longitude,
      accuracy: ipLocation.accuracy,
      source: ipLocation.provider === 'default' ? 'default' : 'ip',
      timestamp: new Date(),
      confidence: calculateConfidenceScore(
        ipLocation.provider === 'default' ? 'default' : 'ip', 
        ipLocation.accuracy
      ),
      metadata: {
        provider: ipLocation.provider,
        city: ipLocation.city,
        country: ipLocation.country,
        ip: ipLocation.ip,
        isDefaultLocation: ipLocation.provider === 'default'
      }
    };
  } catch (error) {
    console.error('Error getting IP-based location:', error);
    // Even in case of unexpected errors, return default location
    const defaultLocation = getDefaultLocation();
    return {
      latitude: defaultLocation.latitude,
      longitude: defaultLocation.longitude,
      accuracy: defaultLocation.accuracy,
      source: 'default',
      timestamp: new Date(),
      confidence: 10, // Very low confidence for default location
      metadata: {
        provider: 'default',
        isDefaultLocation: true,
        errorOccurred: true
      }
    };
  }
};

/**
 * Gets location from browser cache if available
 */
const getBrowserCachedLocation = async (): Promise<EnhancedLocationResult | null> => {
  try {
    // Check if we have a cached location in localStorage
    if (typeof localStorage !== 'undefined') {
      const cachedLocationStr = localStorage.getItem('lastKnownLocation');
      
      if (cachedLocationStr) {
        const cachedLocation = JSON.parse(cachedLocationStr);
        const timestamp = new Date(cachedLocation.timestamp);
        const now = new Date();
        
        // Only use cached location if it's less than 30 minutes old
        if (now.getTime() - timestamp.getTime() < 30 * 60 * 1000) {
          return {
            latitude: cachedLocation.latitude,
            longitude: cachedLocation.longitude,
            accuracy: cachedLocation.accuracy,
            source: 'cache',
            timestamp: timestamp,
            confidence: calculateConfidenceScore('cache', cachedLocation.accuracy, 
              (now.getTime() - timestamp.getTime()) / (60 * 1000)) // Age in minutes
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting cached location:', error);
    return null;
  }
};

/**
 * Fuses multiple location data sources to improve accuracy
 * Uses weighted averaging based on confidence scores
 */
const fuseLocationData = (locations: EnhancedLocationResult[]): EnhancedLocationResult => {
  // If we only have one location, return it
  if (locations.length === 1) {
    return locations[0];
  }
  
  // Calculate total confidence (for weighted average)
  const totalConfidence = locations.reduce((sum, loc) => sum + loc.confidence, 0);
  
  // Calculate weighted average of latitude and longitude
  let weightedLat = 0;
  let weightedLng = 0;
  
  locations.forEach(loc => {
    const weight = loc.confidence / totalConfidence;
    weightedLat += loc.latitude * weight;
    weightedLng += loc.longitude * weight;
  });
  
  // Find the most accurate source for metadata
  const mostAccurateSource = locations.reduce((prev, curr) => 
    prev.accuracy < curr.accuracy ? prev : curr
  );
  
  // Calculate a new confidence score based on the sources we have
  const combinedConfidence = Math.min(
    100, // Cap at 100
    locations.reduce((sum, loc) => sum + (loc.confidence * 0.7), 0) // 70% of sum of individual confidences
  );
  
  // Calculate a new accuracy estimate based on the sources
  // This is a heuristic that considers the best accuracy but adjusts based on confidence
  const combinedAccuracy = mostAccurateSource.accuracy * (100 / combinedConfidence);
  
  return {
    latitude: weightedLat,
    longitude: weightedLng,
    accuracy: combinedAccuracy,
    source: 'fusion',
    timestamp: new Date(),
    confidence: combinedConfidence,
    metadata: {
      sources: locations.map(loc => loc.source),
      originalLocations: locations
    }
  };
};

/**
 * Calculates a confidence score (0-100) for a location source
 * Based on source type, accuracy, and age
 */
const calculateConfidenceScore = (
  source: string, 
  accuracy: number,
  ageInMinutes: number = 0
): number => {
  // Base confidence by source type
  let baseConfidence: number;
  switch (source) {
    case 'wifi':
      baseConfidence = 80;
      break;
    case 'cell':
      baseConfidence = 60;
      break;
    case 'ip':
      baseConfidence = 40;
      break;
    case 'cache':
      baseConfidence = 50;
      break;
    case 'default':
      baseConfidence = 10; // Very low confidence for default location
      break;
    default:
      baseConfidence = 30;
  }
  
  // Adjust for accuracy
  // Higher accuracy (lower number) increases confidence
  let accuracyFactor = 1.0;
  
  if (source === 'wifi') {
    // WiFi accuracy is typically 15-40m
    accuracyFactor = accuracy < 20 ? 1.2 : 
                     accuracy < 50 ? 1.0 : 
                     accuracy < 100 ? 0.8 : 0.6;
  } else if (source === 'cell') {
    // Cell accuracy is typically 100-1000m
    accuracyFactor = accuracy < 200 ? 1.2 : 
                     accuracy < 500 ? 1.0 : 
                     accuracy < 1000 ? 0.8 : 0.6;
  } else if (source === 'ip') {
    // IP accuracy is typically 1-10km
    accuracyFactor = accuracy < 1000 ? 1.2 : 
                     accuracy < 5000 ? 1.0 : 
                     accuracy < 10000 ? 0.8 : 0.6;
  }
  
  // Adjust for age (only applies to cached locations)
  // Newer locations have higher confidence
  let ageFactor = 1.0;
  if (source === 'cache') {
    ageFactor = ageInMinutes < 5 ? 1.0 :
                ageInMinutes < 10 ? 0.9 :
                ageInMinutes < 20 ? 0.7 : 0.5;
  }
  
  // Calculate final confidence score
  let confidenceScore = baseConfidence * accuracyFactor * ageFactor;
  
  // Ensure score is between 0-100
  return Math.max(0, Math.min(100, confidenceScore));
};

/**
 * Caches the current location for future use
 * Should be called whenever a good location is obtained
 */
export const cacheCurrentLocation = (location: {
  latitude: number;
  longitude: number;
  accuracy: number;
}): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lastKnownLocation', JSON.stringify({
        ...location,
        timestamp: new Date().toISOString()
      }));
    }
  } catch (error) {
    console.error('Error caching location:', error);
  }
};

/**
 * Estimates location accuracy based on available data
 * Returns a human-readable description of the accuracy
 */
export const getLocationAccuracyDescription = (
  accuracy: number, 
  source: string
): string => {
  if (source === 'fusion') {
    return `Enhanced accuracy (±${Math.round(accuracy)}m)`;
  }
  
  if (source === 'wifi') {
    return accuracy < 30 
      ? `Very accurate (±${Math.round(accuracy)}m)` 
      : `Accurate (±${Math.round(accuracy)}m)`;
  }
  
  if (source === 'cell') {
    return `Approximate location (±${Math.round(accuracy / 100) / 10}km)`;
  }
  
  if (source === 'ip') {
    return accuracy < 5000 
      ? `General area (±${Math.round(accuracy / 1000)}km)` 
      : `Approximate area (±${Math.round(accuracy / 1000)}km)`;
  }
  
  if (source === 'cache') {
    return `Last known location (±${Math.round(accuracy)}m)`;
  }
  
  if (source === 'default') {
    return `Approximate location (using default)`;
  }
  
  return `Location accuracy: ±${Math.round(accuracy)}m`;
};