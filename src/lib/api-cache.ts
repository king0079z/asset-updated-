/**
 * API caching utilities to improve dashboard performance
 */

import { logDebug } from '@/lib/client-logger';

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

type CacheOptions = {
  maxAge: number; // Cache expiration time in milliseconds
};

// In-memory cache store
const cacheStore = new Map<string, CacheEntry<any>>();
const pendingRequests = new Map<string, Promise<any>>();

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
    logDebug(`[Cache] Using cached data for ${url}`);
    return cachedEntry.data as T;
  }

  // Reuse any in-flight request for the same URL to avoid duplicate fetches.
  const pendingRequest = pendingRequests.get(cacheKey);
  if (pendingRequest) {
    logDebug(`[Cache] Reusing in-flight request for ${url}`);
    return pendingRequest as Promise<T>;
  }
  
  // No valid cache, make the actual fetch request
  logDebug(`[Cache] Fetching fresh data for ${url}`);
  const requestPromise = (async () => {
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
  })();

  pendingRequests.set(cacheKey, requestPromise);

  try {
    return await requestPromise;
  } catch (error) {
    console.error(`[Cache] Error fetching ${url}:`, error);

    // If we have stale cache, return it as fallback
    if (cachedEntry) {
      logDebug(`[Cache] Returning stale cached data for ${url}`);
      return cachedEntry.data as T;
    }

    throw error;
  } finally {
    pendingRequests.delete(cacheKey);
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