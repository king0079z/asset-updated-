/**
 * API caching utilities to improve dashboard performance.
 * Module-level variables survive SPA page navigations — data cached here
 * is available instantly when navigating back to any page.
 */

import { logDebug } from '@/lib/client-logger';

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

type CacheOptions = {
  maxAge: number; // Cache expiration time in milliseconds
};

// Module-level cache — persists across Next.js SPA page navigations
const cacheStore = new Map<string, CacheEntry<any>>();
const pendingRequests = new Map<string, Promise<any>>();

// Default cache options
const defaultOptions: CacheOptions = {
  maxAge: 5 * 60 * 1000, // 5 minutes default cache time
};

/**
 * Synchronously reads from cache. Returns data if fresh, null if missing/stale.
 * Use this in useState(() => getFromCache(...)) to avoid loading flash on revisit.
 */
export function getFromCache<T>(url: string, maxAge = defaultOptions.maxAge): T | null {
  const entry = cacheStore.get(url);
  if (entry && Date.now() - entry.timestamp < maxAge) {
    return entry.data as T;
  }
  return null;
}

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
  
  // No valid cache, make the actual fetch request (timeout 20s, credentials for auth)
  logDebug(`[Cache] Fetching fresh data for ${url}`);
  const API_TIMEOUT_MS = 20000;
  const requestPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        credentials: 'same-origin',
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' },
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      cacheStore.set(cacheKey, { data, timestamp: now });
      return data as T;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
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