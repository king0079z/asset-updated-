import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  optimizeForAnimation, 
  optimizeForScrolling,
  createLazyLoader,
  deferOperations,
  performanceMonitor
} from '@/lib/enhanced-performance';
import { 
  optimizeScrollHandler, 
  optimizeResizeHandler,
  addPassiveEventListener,
  removePassiveEventListener,
  isClient
} from '@/lib/performance';
import { logDebug } from '@/lib/client-logger';

/**
 * Hook for applying performance optimizations to components
 * @param componentName Name of the component for performance monitoring
 * @returns Object with performance optimization utilities
 */
export function usePerformanceOptimization(componentName: string) {
  const elementRef = useRef<HTMLElement | null>(null);
  const [isOptimized, setIsOptimized] = useState(false);
  const lazyLoader = useRef(createLazyLoader());
  
  // Start measuring performance when the component mounts
  useEffect(() => {
    performanceMonitor.startMeasure(componentName);
    
    return () => {
      performanceMonitor.endMeasure(componentName);
    };
  }, [componentName]);
  
  // Apply optimizations when the element ref is set
  const setRef = useCallback((element: HTMLElement | null) => {
    if (!element || element === elementRef.current) return;
    
    elementRef.current = element;
    
    // Apply optimizations
    optimizeForAnimation(element);
    optimizeForScrolling(element);
    
    // Mark as optimized
    setIsOptimized(true);
    
    // Defer non-critical operations
    deferOperations([
      () => {
        // Add any deferred operations here
        logDebug(`[Performance] Applied optimizations to ${componentName}`);
      }
    ]);
  }, [componentName]);
  
  // Create an optimized scroll handler
  const createOptimizedScrollHandler = useCallback((handler: (event: Event) => void) => {
    return optimizeScrollHandler(handler, { useRAF: true });
  }, []);
  
  // Create an optimized resize handler
  const createOptimizedResizeHandler = useCallback((handler: (event: Event) => void) => {
    return optimizeResizeHandler(handler, { useDebounce: true });
  }, []);
  
  // Register scroll event with passive listener
  const registerScrollListener = useCallback((handler: (event: Event) => void) => {
    if (!isClient) return () => {};
    
    const optimizedHandler = createOptimizedScrollHandler(handler);
    
    addPassiveEventListener(window, 'scroll', optimizedHandler);
    
    return () => {
      removePassiveEventListener(window, 'scroll', optimizedHandler);
    };
  }, [createOptimizedScrollHandler]);
  
  // Register resize event with optimized handler
  const registerResizeListener = useCallback((handler: (event: Event) => void) => {
    if (!isClient) return () => {};
    
    const optimizedHandler = createOptimizedResizeHandler(handler);
    
    window.addEventListener('resize', optimizedHandler);
    
    return () => {
      window.removeEventListener('resize', optimizedHandler);
    };
  }, [createOptimizedResizeHandler]);
  
  // Register lazy loading for an element
  const registerLazyLoad = useCallback((element: HTMLElement | null, callback: () => void) => {
    if (!element) return;
    
    lazyLoader.current(element, callback);
  }, []);
  
  return {
    setRef,
    isOptimized,
    elementRef,
    createOptimizedScrollHandler,
    createOptimizedResizeHandler,
    registerScrollListener,
    registerResizeListener,
    registerLazyLoad
  };
}

export default usePerformanceOptimization;