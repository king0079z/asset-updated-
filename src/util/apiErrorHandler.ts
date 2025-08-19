/**
 * Utility functions for handling API errors gracefully
 */

import { fetchWithCache } from '@/lib/api-cache';

/**
 * Fetches data from an API endpoint with error handling and client-side caching for GET requests.
 * @param url The URL to fetch from
 * @param options Fetch options
 * @returns The parsed JSON response or a default value on error
 */
export async function fetchWithErrorHandling<T>(
  url: string, 
  options?: RequestInit,
  defaultValue: T | null = null
): Promise<T | null> {
  try {
    const method = options?.method ? options.method.toUpperCase() : 'GET';
    const MAX_RETRIES = 3;
    let retries = 0;
    let lastError;

    // Use cache only for GET requests
    if (method === 'GET') {
      while (retries < MAX_RETRIES) {
        try {
          // Use fetchWithCache (5 min default cache)
          const data = await fetchWithCache<T>(url);
          return data;
        } catch (error) {
          lastError = error;
          retries++;
          if (retries < MAX_RETRIES) {
            const delay = Math.pow(2, retries - 1) * 500;
            console.warn(`Retry ${retries}/${MAX_RETRIES} for ${url} after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      console.error(`Error fetching ${url} after ${MAX_RETRIES} retries:`, lastError);
      return defaultValue;
    } else {
      // For non-GET requests, use original fetch logic (no cache)
      while (retries < MAX_RETRIES) {
        try {
          const fetchOptions = {
            ...options,
            headers: {
              ...options?.headers,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            credentials: 'include' as RequestCredentials
          };
          const response = await fetch(url, fetchOptions);
          if (!response.ok) {
            console.warn(`API request failed: ${url} - Status: ${response.status}`);
            if (response.status === 401) {
              console.warn('Authentication error - user may not be logged in');
            }
            if (response.status >= 500) {
              throw new Error(`Server error: ${response.status}`);
            }
            return defaultValue;
          }
          try {
            const data = await response.json();
            return data;
          } catch (jsonError) {
            console.error(`Error parsing JSON from ${url}:`, jsonError);
            return defaultValue;
          }
        } catch (error) {
          lastError = error;
          retries++;
          if (retries < MAX_RETRIES) {
            const delay = Math.pow(2, retries - 1) * 500;
            console.warn(`Retry ${retries}/${MAX_RETRIES} for ${url} after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      console.error(`Error fetching ${url} after ${MAX_RETRIES} retries:`, lastError);
      return defaultValue;
    }
  } catch (error) {
    console.error(`Error in fetch handler for ${url}:`, error);
    return defaultValue;
  }
}

/**
 * Handles API errors in a way that doesn't break the UI
 * @param error The error object
 * @param fallbackData Optional fallback data to return
 * @returns The fallback data or null
 */
export function handleApiError<T>(error: unknown, fallbackData: T | null = null): T | null {
  if (error instanceof Error) {
    console.error(`API Error: ${error.message}`);
  } else {
    console.error('Unknown API error:', error);
  }
  
  return fallbackData;
}