import React, { createContext, useContext, useEffect, useState } from 'react';
import { performanceMonitor } from '@/lib/enhanced-performance';
import { isClient, supportsIdleCallback } from '@/lib/performance';

interface PerformanceContextType {
  /**
   * Performance statistics for components
   */
  stats: Record<string, { count: number; totalTime: number; avgTime: number }>;
  
  /**
   * Reset performance statistics
   */
  resetStats: () => void;
  
  /**
   * Whether the browser supports performance APIs
   */
  supportsPerformanceAPI: boolean;
}

const PerformanceContext = createContext<PerformanceContextType>({
  stats: {},
  resetStats: () => {},
  supportsPerformanceAPI: false
});

/**
 * Provider component for performance monitoring and optimization
 */
export function PerformanceProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<Record<string, { count: number; totalTime: number; avgTime: number }>>({});
  const [supportsPerformanceAPI, setSupportsPerformanceAPI] = useState(false);
  
  // Check if the browser supports performance APIs
  useEffect(() => {
    if (isClient) {
      setSupportsPerformanceAPI('performance' in window);
    }
  }, []);
  
  // Update stats periodically
  useEffect(() => {
    if (!isClient) return;
    
    const updateStats = () => {
      setStats(performanceMonitor.getStats());
    };
    
    // Update stats initially
    updateStats();
    
    // Set up periodic updates using requestIdleCallback if available
    let intervalId: number;
    
    if (supportsIdleCallback) {
      const scheduleUpdate = () => {
        window.requestIdleCallback(() => {
          updateStats();
          scheduleUpdate();
        }, { timeout: 2000 });
      };
      
      scheduleUpdate();
    } else {
      // Fall back to setInterval
      intervalId = window.setInterval(updateStats, 5000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);
  
  // Reset stats
  const resetStats = () => {
    performanceMonitor.reset();
    setStats({});
  };
  
  return (
    <PerformanceContext.Provider
      value={{
        stats,
        resetStats,
        supportsPerformanceAPI
      }}
    >
      {children}
    </PerformanceContext.Provider>
  );
}

/**
 * Hook to access performance context
 */
export function usePerformance() {
  return useContext(PerformanceContext);
}

export default PerformanceProvider;