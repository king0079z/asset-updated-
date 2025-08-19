/**
 * Utility for getting approximate location via IP address
 * This serves as a fallback when GPS is unavailable or disabled
 */

interface IpGeolocationResponse {
  latitude: number;
  longitude: number;
  accuracy: number; // Estimated accuracy in meters (typically less accurate than GPS)
  city?: string;
  country?: string;
  ip?: string;
  provider?: string; // Which provider gave us this location
  accuracyRadius?: number; // Accuracy radius in km if available
}

/**
 * Gets the approximate location based on IP address
 * Uses a free IP geolocation service with multiple fallbacks
 * 
 * @returns Promise with location data or null if unavailable
 */
export const getLocationFromIp = async (): Promise<IpGeolocationResponse | null> => {
  try {
    console.log('Attempting to get location from IP using ipinfo.io service');
    
    // Check if we're running in a development or test environment
    const isDev = process.env.NEXT_PUBLIC_CO_DEV_ENV === 'development' || 
                 process.env.NODE_ENV === 'development' ||
                 typeof window !== 'undefined' && window.location.hostname === 'localhost';
    
    // Skip actual API call in development to avoid errors
    if (isDev) {
      console.log('Development environment detected, using mock IP location data');
      return {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 5000,
        city: 'New York',
        country: 'United States',
        ip: '192.168.1.1',
        provider: 'mock-ipinfo.io',
        accuracyRadius: 5
      };
    }
    
    // Check if we're in a browser environment
    const isBrowser = typeof window !== 'undefined';
    
    // In browser environments, prioritize JSONP to avoid CORS issues
    if (isBrowser) {
      try {
        // Use JSONP approach which can bypass CORS
        return await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          const callbackName = 'ipinfoCallback_' + Math.round(Math.random() * 10000000);
          
          // Set timeout to prevent hanging
          const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('JSONP request timed out'));
          }, 5000);
          
          // Cleanup function to remove script and global callback
          const cleanup = () => {
            document.body.removeChild(script);
            delete window[callbackName];
            clearTimeout(timeoutId);
          };
          
          // Create global callback function
          window[callbackName] = (data) => {
            cleanup();
            
            if (data && data.loc) {
              const [latitude, longitude] = data.loc.split(',').map(parseFloat);
              
              if (!isNaN(latitude) && !isNaN(longitude)) {
                let estimatedAccuracy = 5000;
                
                if (data.postal) {
                  estimatedAccuracy = 3000;
                } else if (data.city) {
                  estimatedAccuracy = 5000;
                } else if (data.region) {
                  estimatedAccuracy = 25000;
                } else if (data.country) {
                  estimatedAccuracy = 100000;
                }
                
                resolve({
                  latitude,
                  longitude,
                  accuracy: estimatedAccuracy,
                  city: data.city,
                  country: data.country,
                  ip: data.ip,
                  provider: 'ipinfo.io-jsonp',
                  accuracyRadius: estimatedAccuracy / 1000
                });
              } else {
                reject(new Error('Invalid location data'));
              }
            } else {
              reject(new Error('No location data'));
            }
          };
          
          // Create and append script element
          script.src = `https://ipinfo.io/json?callback=${callbackName}`;
          script.async = true;
          script.onerror = () => {
            cleanup();
            reject(new Error('JSONP request failed'));
          };
          
          document.body.appendChild(script);
        });
      } catch (jsonpError) {
        console.log('JSONP ipinfo.io request failed:', jsonpError);
        // Continue to next fallback
      }
    } else {
      // In Node.js environments, try direct request
      try {
        const response = await fetch('https://ipinfo.io/json', {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          },
          signal: AbortSignal.timeout(3000) // Shorter timeout to fail faster
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('ipinfo.io direct response:', data);
          
          if (data.loc) {
            // Parse the location string which is in format "latitude,longitude"
            const [latitude, longitude] = data.loc.split(',').map(parseFloat);
            
            if (!isNaN(latitude) && !isNaN(longitude)) {
              // Calculate a more realistic accuracy value
              let estimatedAccuracy = 5000; // Default to 5km
              
              // If we have postal code, it's likely more accurate
              if (data.postal) {
                estimatedAccuracy = 3000; // ~3km for postal code level
              } else if (data.city) {
                estimatedAccuracy = 5000; // ~5km for city level
              } else if (data.region) {
                estimatedAccuracy = 25000; // ~25km for region/state level
              } else if (data.country) {
                estimatedAccuracy = 100000; // ~100km for country level
              }

              return {
                latitude,
                longitude,
                accuracy: estimatedAccuracy,
                city: data.city,
                country: data.country,
                ip: data.ip,
                provider: 'ipinfo.io',
                accuracyRadius: estimatedAccuracy / 1000 // Convert to km
              };
            }
          }
        }
      } catch (directError) {
        console.log('Direct ipinfo.io request failed:', directError);
      }
    }
    
    // If all attempts failed, return null to try alternative services
    console.warn('All ipinfo.io attempts failed');
    return null;
  } catch (error) {
    console.error('Error getting location from primary IP service:', error);
    return null;
  }
};

/**
 * Alternative implementation using ipapi.co
 * This was previously the primary service but is now used as a fallback
 */
export const getLocationFromIpAlternative = async (): Promise<IpGeolocationResponse | null> => {
  try {
    console.log('Attempting to get location from IP using ipapi.co service');
    
    // Check if we're running in a development or test environment
    const isDev = process.env.NEXT_PUBLIC_CO_DEV_ENV === 'development' || 
                 process.env.NODE_ENV === 'development' ||
                 typeof window !== 'undefined' && window.location.hostname === 'localhost';
    
    // Skip actual API call in development to avoid errors
    if (isDev) {
      console.log('Development environment detected, using mock IP location data');
      return {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 5000,
        city: 'New York',
        country: 'United States',
        ip: '192.168.1.1',
        provider: 'mock-ipapi.co',
        accuracyRadius: 5
      };
    }
    
    // Add cache-busting parameter to avoid cached responses
    const cacheBuster = new Date().getTime();
    
    // Check if we're in a browser environment
    const isBrowser = typeof window !== 'undefined';
    
    // In browser environments, prioritize JSONP to avoid CORS issues
    if (isBrowser) {
      try {
        // Try JSONP approach as primary method in browsers
        return await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          const callbackName = 'ipapiCallback_' + Math.round(Math.random() * 10000000);
          
          // Set timeout to prevent hanging
          const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('JSONP request timed out'));
          }, 5000);
          
          // Cleanup function to remove script and global callback
          const cleanup = () => {
            document.body.removeChild(script);
            delete window[callbackName];
            clearTimeout(timeoutId);
          };
          
          // Create global callback function
          window[callbackName] = (data) => {
            cleanup();
            
            if (data && data.latitude && data.longitude) {
              let estimatedAccuracy = 5000;
              
              if (data.postal) {
                estimatedAccuracy = 3000;
              } else if (data.city) {
                estimatedAccuracy = 5000;
              } else if (data.region) {
                estimatedAccuracy = 25000;
              } else if (data.country) {
                estimatedAccuracy = 100000;
              }
              
              resolve({
                latitude: data.latitude,
                longitude: data.longitude,
                accuracy: estimatedAccuracy,
                city: data.city,
                country: data.country_name,
                ip: data.ip,
                provider: 'ipapi.co-jsonp',
                accuracyRadius: estimatedAccuracy / 1000
              });
            } else {
              reject(new Error('No location data'));
            }
          };
          
          // Create and append script element
          script.src = `https://ipapi.co/jsonp/?callback=${callbackName}&_=${cacheBuster}`;
          script.async = true;
          script.onerror = () => {
            cleanup();
            reject(new Error('JSONP request failed'));
          };
          
          document.body.appendChild(script);
        });
      } catch (jsonpError) {
        console.log('JSONP ipapi.co request failed:', jsonpError);
      }
    } else {
      // In Node.js environments, try direct request
      try {
        const response = await fetch(`https://ipapi.co/json/?_=${cacheBuster}`, {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          // Set a timeout to avoid hanging requests
          signal: AbortSignal.timeout(3000)
        });

        if (response.ok) {
          const data = await response.json();
          console.log('ipapi.co response:', data);
          
          // Check if we have the required location data
          if (data.latitude && data.longitude) {
            // Calculate a more realistic accuracy value based on the type of location data
            // IP-based geolocation is typically accurate to city level at best (3-10km)
            let estimatedAccuracy = 5000; // Default to 5km
            
            // If we have postal code, it's likely more accurate
            if (data.postal) {
              estimatedAccuracy = 3000; // ~3km for postal code level
            } else if (data.city) {
              estimatedAccuracy = 5000; // ~5km for city level
            } else if (data.region) {
              estimatedAccuracy = 25000; // ~25km for region/state level
            } else if (data.country) {
              estimatedAccuracy = 100000; // ~100km for country level
            }
            
            return {
              latitude: data.latitude,
              longitude: data.longitude,
              accuracy: estimatedAccuracy,
              city: data.city,
              country: data.country_name,
              ip: data.ip,
              provider: 'ipapi.co',
              accuracyRadius: estimatedAccuracy / 1000 // Convert to km
            };
          }
        }
      } catch (directError) {
        console.log('Direct ipapi.co request failed:', directError);
      }
    }
    
    // If all attempts failed
    console.warn('All ipapi.co attempts failed');
    return null;
  } catch (error) {
    console.error('Error getting location from alternative IP service:', error);
    return null;
  }
};

/**
 * Fallback to geolocation-db.com if other services fail
 * This is the least accurate option but better than nothing
 */
export const getLocationFromIpFallback = async (): Promise<IpGeolocationResponse | null> => {
  try {
    console.log('Attempting to get location from IP using geolocation-db.com service');
    
    // Check if we're running in a development or test environment
    const isDev = process.env.NEXT_PUBLIC_CO_DEV_ENV === 'development' || 
                 process.env.NODE_ENV === 'development' ||
                 typeof window !== 'undefined' && window.location.hostname === 'localhost';
    
    // Skip actual API call in development to avoid errors
    if (isDev) {
      console.log('Development environment detected, using mock IP location data');
      return {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10000,
        city: 'New York',
        country: 'United States',
        ip: '192.168.1.1',
        provider: 'mock-geolocation-db.com',
        accuracyRadius: 10
      };
    }
    
    // Check if we're in a browser environment
    const isBrowser = typeof window !== 'undefined';
    
    // In browser environments, prioritize JSONP to avoid CORS issues
    if (isBrowser) {
      try {
        // Try JSONP approach as primary method in browsers
        return await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          const callbackName = 'geoDbCallback_' + Math.round(Math.random() * 10000000);
          
          // Set timeout to prevent hanging
          const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('JSONP request timed out'));
          }, 5000);
          
          // Cleanup function to remove script and global callback
          const cleanup = () => {
            document.body.removeChild(script);
            delete window[callbackName];
            clearTimeout(timeoutId);
          };
          
          // Create global callback function
          window[callbackName] = (data) => {
            cleanup();
            
            if (data && data.latitude && data.longitude) {
              resolve({
                latitude: parseFloat(data.latitude),
                longitude: parseFloat(data.longitude),
                accuracy: 10000,
                city: data.city,
                country: data.country_name,
                ip: data.IPv4,
                provider: 'geolocation-db.com-jsonp',
                accuracyRadius: 10
              });
            } else {
              reject(new Error('No location data'));
            }
          };
          
          // Create and append script element
          script.src = `https://geolocation-db.com/jsonp/?callback=${callbackName}`;
          script.async = true;
          script.onerror = () => {
            cleanup();
            reject(new Error('JSONP request failed'));
          };
          
          document.body.appendChild(script);
        });
      } catch (jsonpError) {
        console.log('JSONP geolocation-db.com request failed:', jsonpError);
      }
    } else {
      // In Node.js environments, try direct request
      try {
        const response = await fetch('https://geolocation-db.com/json/', {
          signal: AbortSignal.timeout(3000),
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.latitude && data.longitude) {
            return {
              latitude: parseFloat(data.latitude),
              longitude: parseFloat(data.longitude),
              accuracy: 10000, // This service is typically less accurate (~10km)
              city: data.city,
              country: data.country_name,
              ip: data.IPv4,
              provider: 'geolocation-db.com',
              accuracyRadius: 10 // ~10km accuracy
            };
          }
        }
      } catch (directError) {
        console.log('Direct geolocation-db.com request failed:', directError);
      }
    }
    
    // If all attempts failed
    console.warn('All geolocation-db.com attempts failed');
    return null;
  } catch (error) {
    console.error('Error getting location from fallback IP service:', error);
    return null;
  }
};

/**
 * Additional fallback using extreme-ip-lookup.com
 * This provides another option if other services fail
 */
export const getLocationFromExtremeIpLookup = async (): Promise<IpGeolocationResponse | null> => {
  try {
    console.log('Attempting to get location from extreme-ip-lookup.com service');
    
    // Check if we're running in a development or test environment
    const isDev = process.env.NEXT_PUBLIC_CO_DEV_ENV === 'development' || 
                 process.env.NODE_ENV === 'development' ||
                 typeof window !== 'undefined' && window.location.hostname === 'localhost';
    
    // Skip actual API call in development to avoid errors
    if (isDev) {
      console.log('Development environment detected, using mock IP location data');
      return {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 8000,
        city: 'New York',
        country: 'United States',
        ip: '192.168.1.1',
        provider: 'mock-extreme-ip',
        accuracyRadius: 8
      };
    }
    
    // Try JSONP approach (this service works well with JSONP)
    try {
      return await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const callbackName = 'extremeIpCallback_' + Math.round(Math.random() * 10000000);
        
        // Set timeout to prevent hanging
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error('JSONP request timed out'));
        }, 5000);
        
        // Cleanup function to remove script and global callback
        const cleanup = () => {
          if (script.parentNode) {
            document.body.removeChild(script);
          }
          delete window[callbackName];
          clearTimeout(timeoutId);
        };
        
        // Create global callback function
        window[callbackName] = (data) => {
          cleanup();
          
          if (data && data.lat && data.lon) {
            resolve({
              latitude: parseFloat(data.lat),
              longitude: parseFloat(data.lon),
              accuracy: 8000, // ~8km accuracy
              city: data.city,
              country: data.country,
              ip: data.query,
              provider: 'extreme-ip-lookup',
              accuracyRadius: 8
            });
          } else {
            reject(new Error('No location data'));
          }
        };
        
        // Create and append script element
        script.src = `https://extreme-ip-lookup.com/json/?callback=${callbackName}`;
        script.async = true;
        script.onerror = () => {
          cleanup();
          reject(new Error('JSONP request failed'));
        };
        
        document.body.appendChild(script);
      });
    } catch (jsonpError) {
      console.log('JSONP extreme-ip-lookup.com request failed:', jsonpError);
      return null;
    }
  } catch (error) {
    console.error('Error getting location from extreme-ip-lookup service:', error);
    return null;
  }
};

/**
 * Browser-based location fallback
 * Uses the browser's cached location data if available
 */
export const getBrowserCachedLocation = async (): Promise<IpGeolocationResponse | null> => {
  try {
    console.log('Attempting to get location from browser cache');
    
    // Check if localStorage is available
    if (typeof localStorage === 'undefined') {
      return null;
    }
    
    // Try to get cached location from localStorage
    const cachedLocationStr = localStorage.getItem('lastKnownLocation');
    if (!cachedLocationStr) {
      return null;
    }
    
    try {
      const cachedLocation = JSON.parse(cachedLocationStr);
      const timestamp = new Date(cachedLocation.timestamp);
      const now = new Date();
      
      // Only use cached location if it's less than 24 hours old
      if (now.getTime() - timestamp.getTime() < 24 * 60 * 60 * 1000) {
        return {
          latitude: cachedLocation.latitude,
          longitude: cachedLocation.longitude,
          accuracy: cachedLocation.accuracy || 10000,
          city: cachedLocation.city || 'Unknown',
          country: cachedLocation.country || 'Unknown',
          ip: cachedLocation.ip || 'Unknown',
          provider: 'browser-cache',
          accuracyRadius: (cachedLocation.accuracy || 10000) / 1000
        };
      }
    } catch (parseError) {
      console.error('Error parsing cached location:', parseError);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting location from browser cache:', error);
    return null;
  }
};

/**
 * Ultimate fallback that returns a default location
 * This ensures the application always has some location data to work with
 * Uses a generic location (New York City) with very low confidence
 */
export const getDefaultLocation = (): IpGeolocationResponse => {
  console.log('Using default location as ultimate fallback');
  return {
    latitude: 40.7128, // New York City coordinates
    longitude: -74.0060,
    accuracy: 100000, // Very low accuracy (100km)
    city: 'Default City',
    country: 'Default Country',
    provider: 'default',
    accuracyRadius: 100 // 100km accuracy
  };
};

/**
 * Cache the current location for future use
 */
export const cacheCurrentLocation = (location: {
  latitude: number;
  longitude: number;
  accuracy?: number;
  city?: string;
  country?: string;
  ip?: string;
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