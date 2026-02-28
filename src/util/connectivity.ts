/**
 * Utility functions for monitoring network and GPS connectivity
 */
import { useState, useEffect } from 'react';

// Store offline location updates to sync when back online
interface OfflineLocationUpdate {
  latitude: number;
  longitude: number;
  timestamp: Date;
  tripId?: string;
}

// Singleton class to manage connectivity and offline data
class ConnectivityManager {
  private static instance: ConnectivityManager;
  private offlineLocationUpdates: OfflineLocationUpdate[] = [];
  private isOnline: boolean = true;
  private hasGPS: boolean = true;
  private lastGPSTimestamp: Date | null = null;
  private onlineListeners: Array<(isOnline: boolean) => void> = [];
  private gpsListeners: Array<(hasGPS: boolean) => void> = [];
  private syncInProgress: boolean = false;

  private constructor() {
    // Initialize online status
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      this.setupEventListeners();
      
      // Load any saved offline data from localStorage
      this.loadOfflineData();
    }
  }

  public static getInstance(): ConnectivityManager {
    if (!ConnectivityManager.instance) {
      ConnectivityManager.instance = new ConnectivityManager();
    }
    return ConnectivityManager.instance;
  }

  private setupEventListeners(): void {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnlineStatusChange.bind(this));
    window.addEventListener('offline', this.handleOnlineStatusChange.bind(this));
    
    // Periodically check if we can reach our API
    setInterval(this.checkAPIConnectivity.bind(this), 30000); // Check every 30 seconds
  }

  private handleOnlineStatusChange(): void {
    const wasOnline = this.isOnline;
    this.isOnline = navigator.onLine;
    
    // If we just came back online, try to sync data
    if (!wasOnline && this.isOnline) {
      this.syncOfflineData();
    }
    
    // Notify listeners
    this.notifyOnlineListeners();
  }

  private async checkAPIConnectivity(): Promise<void> {
    if (!navigator.onLine) {
      this.isOnline = false;
      this.notifyOnlineListeners();
      return;
    }
    
    try {
      // Try to ping our API with a GET request instead of HEAD
      // Some environments might not properly handle HEAD requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('/api/hello', { 
        method: 'GET',
        // Use cache: 'no-store' to avoid cached responses
        cache: 'no-store',
        // Use the abort controller for timeout
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const newOnlineStatus = response.ok;
      
      if (this.isOnline !== newOnlineStatus) {
        this.isOnline = newOnlineStatus;
        this.notifyOnlineListeners();
        
        // If we just came back online, sync data
        if (newOnlineStatus) {
          this.syncOfflineData();
        }
      }
    } catch (error) {
      console.log('API connectivity check failed:', error);
      // If we can't reach the API, we're offline
      if (this.isOnline) {
        this.isOnline = false;
        this.notifyOnlineListeners();
      }
    }
  }

  private notifyOnlineListeners(): void {
    this.onlineListeners.forEach(listener => listener(this.isOnline));
  }

  private notifyGPSListeners(): void {
    this.gpsListeners.forEach(listener => listener(this.hasGPS));
  }

  // Update GPS status
  public updateGPSStatus(hasGPS: boolean): void {
    console.log(`Updating GPS status: ${hasGPS ? 'available' : 'unavailable'}`);
    if (this.hasGPS !== hasGPS) {
      this.hasGPS = hasGPS;
      this.lastGPSTimestamp = hasGPS ? new Date() : this.lastGPSTimestamp;
      this.notifyGPSListeners();
    } else if (hasGPS) {
      // Update timestamp if GPS is available
      this.lastGPSTimestamp = new Date();
    }
  }

  // Add location update to queue when offline
  public addOfflineLocationUpdate(update: OfflineLocationUpdate): void {
    this.offlineLocationUpdates.push(update);
    this.saveOfflineData();
    console.log(`Stored offline location update. Queue size: ${this.offlineLocationUpdates.length}`);
  }

  // Save offline data to localStorage
  private saveOfflineData(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'offlineLocationUpdates', 
          JSON.stringify(this.offlineLocationUpdates)
        );
      } catch (error) {
        console.error('Error saving offline data to localStorage:', error);
      }
    }
  }

  // Load offline data from localStorage
  private loadOfflineData(): void {
    if (typeof window !== 'undefined') {
      try {
        const savedData = localStorage.getItem('offlineLocationUpdates');
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          // Convert string timestamps back to Date objects
          this.offlineLocationUpdates = parsedData.map((update: any) => ({
            ...update,
            timestamp: new Date(update.timestamp)
          }));
          console.log(`Loaded ${this.offlineLocationUpdates.length} offline location updates from storage`);
        }
      } catch (error) {
        console.error('Error loading offline data from localStorage:', error);
      }
    }
  }

  // Sync offline data when back online
  public async syncOfflineData(): Promise<void> {
    if (!this.isOnline || this.syncInProgress || this.offlineLocationUpdates.length === 0) {
      return;
    }

    this.syncInProgress = true;
    console.log(`Attempting to sync ${this.offlineLocationUpdates.length} offline location updates`);

    try {
      // Process updates in chronological order
      const sortedUpdates = [...this.offlineLocationUpdates].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      for (const update of sortedUpdates) {
        try {
          // Send update to server
          const response = await fetch('/api/vehicles/update-location', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              latitude: update.latitude,
              longitude: update.longitude,
              timestamp: update.timestamp,
              isBackfill: true, // Flag to indicate this is a backfilled update
              tripId: update.tripId
            }),
          });

          if (response.ok) {
            // Remove from queue if successful
            this.offlineLocationUpdates = this.offlineLocationUpdates.filter(
              item => !(
                item.latitude === update.latitude && 
                item.longitude === update.longitude && 
                item.timestamp.getTime() === update.timestamp.getTime()
              )
            );
          } else {
            console.error('Failed to sync offline location update:', await response.text());
            break; // Stop processing if we encounter an error
          }
        } catch (error) {
          console.error('Error syncing offline location update:', error);
          break; // Stop processing if we encounter an error
        }
      }

      // Save updated queue
      this.saveOfflineData();
      console.log(`Sync completed. Remaining offline updates: ${this.offlineLocationUpdates.length}`);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Get current online status
  public isNetworkOnline(): boolean {
    return this.isOnline;
  }

  // Get current GPS status
  public isGPSAvailable(): boolean {
    return this.hasGPS;
  }

  // Get time since last GPS update
  public getTimeSinceLastGPS(): number | null {
    if (!this.lastGPSTimestamp) return null;
    return Date.now() - this.lastGPSTimestamp.getTime();
  }

  // Register for online status changes
  public addOnlineListener(listener: (isOnline: boolean) => void): () => void {
    this.onlineListeners.push(listener);
    // Return function to remove listener
    return () => {
      this.onlineListeners = this.onlineListeners.filter(l => l !== listener);
    };
  }

  // Register for GPS status changes
  public addGPSListener(listener: (hasGPS: boolean) => void): () => void {
    this.gpsListeners.push(listener);
    // Return function to remove listener
    return () => {
      this.gpsListeners = this.gpsListeners.filter(l => l !== listener);
    };
  }

  // Get number of pending offline updates
  public getPendingUpdateCount(): number {
    return this.offlineLocationUpdates.length;
  }

  // Clear all offline data (for testing or reset)
  public clearOfflineData(): void {
    this.offlineLocationUpdates = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('offlineLocationUpdates');
    }
  }
}

// Export singleton instance
export const connectivityManager = ConnectivityManager.getInstance();

// Enhanced fetch with timeout and retry capability
export const enhancedFetch = async (
  url: string, 
  options: RequestInit = {}, 
  timeoutMs: number = 10000,
  retries: number = 3
): Promise<Response> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const signal = controller.signal;
      
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      // Merge the provided options with our signal
      const fetchOptions = {
        ...options,
        signal,
        headers: {
          ...options.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      };
      
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      
      return response;
    } catch (error) {
      lastError = error as Error;
      console.error(`Request failed (attempt ${attempt}/${retries}):`, url, error);
      
      // If it's not a timeout error and we have more retries, wait before trying again
      if (attempt < retries) {
        // Exponential backoff: 500ms, 1000ms, 2000ms, etc.
        const delay = Math.min(500 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
};

/**
 * Hook to monitor network connectivity
 * @returns Object with online status and pending update count
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof window === 'undefined' ? true : connectivityManager.isNetworkOnline()
  );
  const [pendingUpdates, setPendingUpdates] = useState(
    typeof window === 'undefined' ? 0 : connectivityManager.getPendingUpdateCount()
  );
  
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Update state when online status changes
    const removeListener = connectivityManager.addOnlineListener((online) => {
      setIsOnline(online);
      setPendingUpdates(connectivityManager.getPendingUpdateCount());
    });
    
    // Set up interval to update pending count
    const intervalId = setInterval(() => {
      setPendingUpdates(connectivityManager.getPendingUpdateCount());
    }, 5000);
    
    return () => {
      removeListener();
      clearInterval(intervalId);
    };
  }, []);
  
  return { isOnline, pendingUpdates };
}

/**
 * Hook to monitor GPS availability
 * @returns Object with GPS status and time since last update
 */
export function useGPSStatus() {
  const [hasGPS, setHasGPS] = useState(
    typeof window === 'undefined' ? true : connectivityManager.isGPSAvailable()
  );
  const [timeSinceLastGPS, setTimeSinceLastGPS] = useState<number | null>(
    typeof window === 'undefined' ? null : connectivityManager.getTimeSinceLastGPS()
  );
  
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Update state when GPS status changes
    const removeListener = connectivityManager.addGPSListener((available) => {
      setHasGPS(available);
    });
    
    // Set up interval to update time since last GPS
    const intervalId = setInterval(() => {
      setTimeSinceLastGPS(connectivityManager.getTimeSinceLastGPS());
    }, 1000);
    
    return () => {
      removeListener();
      clearInterval(intervalId);
    };
  }, []);
  
  return { hasGPS, timeSinceLastGPS };
}