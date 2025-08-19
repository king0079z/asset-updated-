/**
 * API caching utilities to improve dashboard performance
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

type CacheOptions = {
  maxAge: number; // Cache expiration time in milliseconds
};

// In-memory cache store
const cacheStore = new Map<string, CacheEntry<any>>();

// Default cache options
const defaultOptions: CacheOptions = {
  maxAge: 5 * 60 * 1000, // 5 minutes default cache time
};

/**
 * Fetches data with caching support
 * @param url The URL to fetch
 * @param options Cache options
 * @returns The fetched data
 */
export async function fetchWithCache<T>(
  url: string, 
  options: Partial<CacheOptions> = {}
): Promise<T> {
  const cacheOptions = { ...defaultOptions, ...options };
  const cacheKey = url;
  
  // Check if we have a valid cached response
  const cachedEntry = cacheStore.get(cacheKey);
  const now = Date.now();
  
  if (cachedEntry && (now - cachedEntry.timestamp < cacheOptions.maxAge)) {
    console.log(`[Cache] Using cached data for ${url}`);
    return cachedEntry.data as T;
  }
  
  // No valid cache, make the actual fetch request
  console.log(`[Cache] Fetching fresh data for ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Store in cache
    cacheStore.set(cacheKey, {
      data,
      timestamp: now
    });
    
    return data as T;
  } catch (error) {
    console.error(`[Cache] Error fetching ${url}:`, error);
    
    // If we have stale cache, return it as fallback
    if (cachedEntry) {
      console.log(`[Cache] Returning stale cached data for ${url}`);
      return cachedEntry.data as T;
    }
    
    throw error;
  }
}

/**
 * Invalidates a specific cache entry
 * @param url The URL key to invalidate
 */
export function invalidateCache(url: string): void {
  cacheStore.delete(url);
}

/**
 * Invalidates all cache entries
 */
export function clearCache(): void {
  cacheStore.clear();
}

/**
 * Gets cache statistics
 * @returns Object with cache statistics
 */
export function getCacheStats() {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;
  
  cacheStore.forEach((entry) => {
    if (now - entry.timestamp < defaultOptions.maxAge) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  });
  
  return {
    totalEntries: cacheStore.size,
    validEntries,
    expiredEntries
  };
}