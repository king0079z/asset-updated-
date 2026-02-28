// @ts-nocheck
/**
 * Enhanced performance optimization utilities for the application
 */

import { isClient } from './performance';
import { logDebug } from './client-logger';

/**
 * Intersection Observer cache to avoid creating multiple observers for the same root
 */
const observerCache = new Map<string, IntersectionObserver>();

/**
 * Creates a lazy loading utility for components
 * @param threshold The visibility threshold to trigger loading
 * @param rootMargin The root margin for the intersection observer
 * @returns A function to register elements for lazy loading
 */
export function createLazyLoader(
  threshold = 0.1,
  rootMargin = '200px 0px'
): (element: HTMLElement | null, callback: () => void) => void {
  if (!isClient || !('IntersectionObserver' in window)) {
    // Fallback for environments without IntersectionObserver
    return (_, callback) => callback();
  }

  const cacheKey = `${threshold}-${rootMargin}`;
  
  if (!observerCache.has(cacheKey)) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Get the callback from the element's data attribute
            const callback = (entry.target as any).__lazyCallback;
            if (typeof callback === 'function') {
              callback();
            }
            // Unobserve the element after it's loaded
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin }
    );
    
    observerCache.set(cacheKey, observer);
  }
  
  const observer = observerCache.get(cacheKey)!;
  
  return (element, callback) => {
    if (!element) return;
    
    // Store the callback on the element
    (element as any).__lazyCallback = callback;
    
    // Start observing the element
    observer.observe(element);
  };
}

/**
 * Optimizes animations by using requestAnimationFrame
 * @param callback The animation callback
 * @returns A function to start the animation
 */
export function optimizeAnimation(
  callback: (progress: number, timestamp: number) => boolean | void
): () => void {
  if (!isClient) return () => {};
  
  let animationId: number;
  let startTime: number;
  
  const animate = (timestamp: number) => {
    if (!startTime) startTime = timestamp;
    
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / 1000, 1); // Normalize to 0-1 over 1 second
    
    const result = callback(progress, timestamp);
    
    if (result !== false && progress < 1) {
      animationId = requestAnimationFrame(animate);
    }
  };
  
  return () => {
    startTime = 0;
    animationId = requestAnimationFrame(animate);
    
    // Return a cleanup function
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  };
}

/**
 * Batches DOM updates to minimize layout thrashing
 */
export class DOMBatch {
  private reads: Array<() => void> = [];
  private writes: Array<() => void> = [];
  private scheduled = false;
  
  /**
   * Schedule a DOM read operation
   * @param callback The read operation
   */
  read(callback: () => void): void {
    this.reads.push(callback);
    this.schedule();
  }
  
  /**
   * Schedule a DOM write operation
   * @param callback The write operation
   */
  write(callback: () => void): void {
    this.writes.push(callback);
    this.schedule();
  }
  
  private schedule(): void {
    if (!isClient || this.scheduled) return;
    
    this.scheduled = true;
    
    requestAnimationFrame(() => {
      // Process all read operations first
      const reads = this.reads;
      this.reads = [];
      
      reads.forEach((read) => read());
      
      // Then process all write operations
      const writes = this.writes;
      this.writes = [];
      
      writes.forEach((write) => write());
      
      this.scheduled = false;
      
      // Schedule another frame if there are still operations
      if (this.reads.length > 0 || this.writes.length > 0) {
        this.schedule();
      }
    });
  }
}

// Create a singleton instance for the application
export const domBatch = new DOMBatch();

/**
 * Creates a virtualized list renderer for efficient rendering of large lists
 * @param options Configuration options
 * @returns Functions to manage the virtualized list
 */
export function createVirtualList<T>({
  itemHeight,
  overscan = 5,
  getItemKey = (item: T, index: number) => String(index)
}: {
  itemHeight: number | ((item: T, index: number) => number);
  overscan?: number;
  getItemKey?: (item: T, index: number) => string;
}) {
  // Calculate which items should be rendered based on scroll position
  const getVisibleRange = (
    items: T[],
    scrollTop: number,
    viewportHeight: number
  ) => {
    let totalHeight = 0;
    let startIndex = -1;
    let endIndex = -1;
    
    // Find the start index
    for (let i = 0; i < items.length; i++) {
      const height = typeof itemHeight === 'function' ? itemHeight(items[i], i) : itemHeight;
      
      if (startIndex === -1 && totalHeight + height > scrollTop - overscan * height) {
        startIndex = i;
      }
      
      totalHeight += height;
      
      if (endIndex === -1 && totalHeight > scrollTop + viewportHeight + overscan * height) {
        endIndex = i;
        break;
      }
    }
    
    // If we didn't find an end index, use the last item
    if (endIndex === -1) {
      endIndex = items.length - 1;
    }
    
    return {
      startIndex: Math.max(0, startIndex),
      endIndex: Math.min(items.length - 1, endIndex),
      totalHeight
    };
  };
  
  // Calculate the offset for a given index
  const getOffsetForIndex = (items: T[], index: number) => {
    let offset = 0;
    
    for (let i = 0; i < index; i++) {
      offset += typeof itemHeight === 'function' ? itemHeight(items[i], i) : itemHeight;
    }
    
    return offset;
  };
  
  return {
    getVisibleRange,
    getOffsetForIndex,
    getItemKey
  };
}

/**
 * Optimizes image loading by preloading critical images and lazy loading others
 * @param urls Array of image URLs to preload
 * @returns Promise that resolves when all critical images are loaded
 */
export function optimizeImageLoading(urls: string[]): Promise<void> {
  if (!isClient) return Promise.resolve();
  
  return new Promise((resolve) => {
    let loaded = 0;
    const total = urls.length;
    
    if (total === 0) {
      resolve();
      return;
    }
    
    urls.forEach((url) => {
      const img = new Image();
      
      img.onload = img.onerror = () => {
        loaded++;
        if (loaded === total) {
          resolve();
        }
      };
      
      img.src = url;
    });
  });
}

/**
 * Optimizes font loading by preloading critical fonts
 * @param fontFamilies Array of font families to preload
 */
export function optimizeFontLoading(fontFamilies: string[]): void {
  if (!isClient || !('FontFace' in window)) return;
  
  // Check if the browser supports the Font Loading API
  if ('fonts' in document) {
    fontFamilies.forEach((family) => {
      // This will trigger font loading if the font is used in the CSS
      document.fonts.load(`1em ${family}`);
    });
  }
}

/**
 * Applies performance optimizations for smooth animations
 * @param element The element to optimize
 */
export function optimizeForAnimation(element: HTMLElement): void {
  if (!element) return;
  
  // Apply hardware acceleration
  element.style.transform = 'translateZ(0)';
  element.style.backfaceVisibility = 'hidden';
  element.style.perspective = '1000px';
  
  // Hint to the browser about the content
  element.style.willChange = 'transform, opacity';
  
  // Ensure smooth animations
  element.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
}

/**
 * Applies performance optimizations for smooth scrolling
 * @param element The element to optimize
 */
export function optimizeForScrolling(element: HTMLElement): void {
  if (!element) return;
  
  // Apply optimizations for smooth scrolling
  element.style.overscrollBehavior = 'contain';
  element.style.WebkitOverflowScrolling = 'touch';
  
  // Use passive event listeners for scroll events
  element.addEventListener('scroll', () => {}, { passive: true });
  element.addEventListener('touchstart', () => {}, { passive: true });
  element.addEventListener('touchmove', () => {}, { passive: true });
}

/**
 * Defers non-critical operations until the browser is idle
 * @param operations Array of operations to execute
 * @param timeout Maximum time to wait before executing operations
 */
export function deferOperations(
  operations: Array<() => void>,
  timeout = 2000
): void {
  if (!isClient) return;
  
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(
      () => {
        operations.forEach((operation) => operation());
      },
      { timeout }
    );
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      operations.forEach((operation) => operation());
    }, 1);
  }
}

/**
 * Measures the performance of a function
 * @param name The name of the function to measure
 * @param fn The function to measure
 * @returns The result of the function
 */
export function measurePerformance<T>(name: string, fn: () => T): T {
  if (!isClient || !('performance' in window)) {
    return fn();
  }
  
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  logDebug(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
  
  return result;
}

/**
 * Creates a performance monitor for tracking component render times
 * @returns Functions to start and end performance measurements
 */
export function createPerformanceMonitor() {
  const measurements = new Map<string, { start: number; count: number; total: number }>();
  
  return {
    /**
     * Starts measuring performance for a component
     * @param componentName The name of the component
     */
    startMeasure: (componentName: string) => {
      if (!isClient || !('performance' in window)) return;
      
      measurements.set(componentName, {
        start: performance.now(),
        count: (measurements.get(componentName)?.count || 0) + 1,
        total: measurements.get(componentName)?.total || 0
      });
    },
    
    /**
     * Ends measuring performance for a component
     * @param componentName The name of the component
     */
    endMeasure: (componentName: string) => {
      if (!isClient || !('performance' in window)) return;
      
      const measurement = measurements.get(componentName);
      if (!measurement) return;
      
      const duration = performance.now() - measurement.start;
      
      measurements.set(componentName, {
        start: 0,
        count: measurement.count,
        total: measurement.total + duration
      });
      
      // Log performance data in development
      if (process.env.NODE_ENV === 'development') {
        logDebug(
          `[Performance] ${componentName}: ${duration.toFixed(2)}ms (avg: ${(
            measurements.get(componentName)!.total / measurements.get(componentName)!.count
          ).toFixed(2)}ms)`
        );
      }
    },
    
    /**
     * Gets performance statistics for all measured components
     * @returns Object with performance statistics
     */
    getStats: () => {
      const stats: Record<string, { count: number; totalTime: number; avgTime: number }> = {};
      
      measurements.forEach((measurement, componentName) => {
        stats[componentName] = {
          count: measurement.count,
          totalTime: measurement.total,
          avgTime: measurement.total / measurement.count
        };
      });
      
      return stats;
    },
    
    /**
     * Resets all performance measurements
     */
    reset: () => {
      measurements.clear();
    }
  };
}

// Create a singleton performance monitor for the application
export const performanceMonitor = createPerformanceMonitor();