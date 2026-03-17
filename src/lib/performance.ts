// @ts-nocheck
/**
 * Performance optimization utilities for the application
 */

/**
 * Debounce function to limit how often a function can be called
 * @param func The function to debounce
 * @param wait The time to wait in milliseconds
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit how often a function can be called
 * @param func The function to throttle
 * @param limit The time limit in milliseconds
 * @returns A throttled version of the function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastFunc: NodeJS.Timeout;
  let lastRan: number;
  
  return function(...args: Parameters<T>): void {
    if (!inThrottle) {
      func(...args);
      lastRan = Date.now();
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func(...args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

/**
 * Creates a memoized version of a function that caches results
 * @param func The function to memoize
 * @param maxCacheSize Maximum number of results to cache (default: unlimited)
 * @returns A memoized version of the function
 */
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  maxCacheSize?: number
): (...args: Parameters<T>) => ReturnType<T> {
  const cache = new Map<string, ReturnType<T>>();
  
  return function(...args: Parameters<T>): ReturnType<T> {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }
    
    const result = func(...args);
    
    // If we've reached the max cache size, remove the oldest entry
    if (maxCacheSize && cache.size >= maxCacheSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    cache.set(key, result);
    return result;
  };
}

/**
 * Checks if the code is running on the client side
 * @returns boolean indicating if code is running in browser
 */
export const isClient = typeof window !== 'undefined';

/**
 * Checks if the browser supports the Intersection Observer API
 * @returns boolean indicating if IntersectionObserver is supported
 */
export const supportsIntersectionObserver = isClient && 'IntersectionObserver' in window;

/**
 * Checks if the browser supports the ResizeObserver API
 * @returns boolean indicating if ResizeObserver is supported
 */
export const supportsResizeObserver = isClient && 'ResizeObserver' in window;

/**
 * Checks if the browser supports the requestIdleCallback API
 * @returns boolean indicating if requestIdleCallback is supported
 */
export const supportsIdleCallback = isClient && 'requestIdleCallback' in window;

/**
 * Checks if the browser supports the requestAnimationFrame API
 * @returns boolean indicating if requestAnimationFrame is supported
 */
export const supportsAnimationFrame = isClient && 'requestAnimationFrame' in window;

/**
 * Checks if the browser supports passive event listeners
 * @returns boolean indicating if passive event listeners are supported
 */
export const supportsPassiveEvents = (() => {
  if (!isClient) return false;
  
  let supportsPassive = false;
  try {
    const opts = Object.defineProperty({}, 'passive', {
      get: function() {
        supportsPassive = true;
        return true;
      }
    });
    
    window.addEventListener('testPassive', null as any, opts);
    window.removeEventListener('testPassive', null as any, opts);
  } catch (e) {}
  
  return supportsPassive;
})();

/**
 * Runs a function when the browser is idle
 * @param callback The function to run
 * @param options Options for requestIdleCallback
 */
export function runWhenIdle(
  callback: () => void,
  options?: { timeout?: number }
): void {
  if (supportsIdleCallback) {
    window.requestIdleCallback(() => callback(), options);
  } else {
    // Fallback for browsers that don't support requestIdleCallback
    setTimeout(callback, 1);
  }
}

/**
 * Runs a function on the next animation frame
 * @param callback The function to run
 * @returns A function to cancel the scheduled callback
 */
export function runOnNextFrame(callback: () => void): () => void {
  if (!isClient) return () => {};
  
  let frameId: number;
  
  if (supportsAnimationFrame) {
    frameId = requestAnimationFrame(() => callback());
    return () => cancelAnimationFrame(frameId);
  } else {
    // Fallback for environments without requestAnimationFrame
    const timeoutId = setTimeout(callback, 16); // ~60fps
    return () => clearTimeout(timeoutId);
  }
}

/**
 * Loads a script dynamically
 * @param src The source URL of the script
 * @param async Whether to load the script asynchronously
 * @param defer Whether to defer loading the script
 * @returns A promise that resolves when the script is loaded
 */
export function loadScript(
  src: string,
  async = true,
  defer = true
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isClient) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.async = async;
    script.defer = defer;
    
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    
    document.head.appendChild(script);
  });
}

/**
 * Adds passive event listener to an element
 * @param element The element to add the event listener to
 * @param event The event type
 * @param handler The event handler
 * @param options Additional options
 */
export function addPassiveEventListener(
  element: HTMLElement | Window | Document,
  event: string,
  handler: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
): void {
  if (!isClient) return;
  
  const passiveOption = supportsPassiveEvents ? { passive: true, ...options } : options;
  element.addEventListener(event, handler, passiveOption);
}

/**
 * Removes passive event listener from an element
 * @param element The element to remove the event listener from
 * @param event The event type
 * @param handler The event handler
 * @param options Additional options
 */
export function removePassiveEventListener(
  element: HTMLElement | Window | Document,
  event: string,
  handler: EventListenerOrEventListenerObject,
  options?: boolean | EventListenerOptions
): void {
  if (!isClient) return;
  
  const passiveOption = supportsPassiveEvents ? { passive: true, ...options } : options;
  element.removeEventListener(event, handler, passiveOption);
}

/**
 * Creates a function that will only execute once
 * @param func The function to execute once
 * @returns A function that will only execute once
 */
export function once<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let called = false;
  let result: ReturnType<T>;
  
  return function(...args: Parameters<T>): ReturnType<T> | undefined {
    if (called) return result;
    
    called = true;
    result = func(...args);
    return result;
  };
}

/**
 * Measures the execution time of a function
 * @param func The function to measure
 * @param label A label for the console output
 * @returns A function that measures execution time
 */
export function measureExecutionTime<T extends (...args: any[]) => any>(
  func: T,
  label = 'Execution time'
): (...args: Parameters<T>) => ReturnType<T> {
  return function(...args: Parameters<T>): ReturnType<T> {
    if (!isClient || !('performance' in window)) {
      return func(...args);
    }
    
    const start = performance.now();
    const result = func(...args);
    const end = performance.now();
    
    console.log(`${label}: ${(end - start).toFixed(2)}ms`);
    
    return result;
  };
}

/**
 * Optimizes event handlers for scroll events
 * @param handler The scroll event handler
 * @param options Options for the optimization
 * @returns An optimized scroll event handler
 */
export function optimizeScrollHandler<T extends (event: Event) => void>(
  handler: T,
  options: {
    throttleTime?: number;
    useRAF?: boolean;
  } = {}
): (event: Event) => void {
  const { throttleTime = 100, useRAF = true } = options;
  
  // Use requestAnimationFrame for smoother scrolling if available
  if (useRAF && supportsAnimationFrame) {
    let ticking = false;
    let lastEvent: Event;
    
    return function(event: Event): void {
      lastEvent = event;
      
      if (!ticking) {
        ticking = true;
        
        requestAnimationFrame(() => {
          handler(lastEvent);
          ticking = false;
        });
      }
    };
  }
  
  // Fall back to throttling if requestAnimationFrame is not preferred or available
  return throttle(handler, throttleTime);
}

/**
 * Optimizes event handlers for resize events
 * @param handler The resize event handler
 * @param options Options for the optimization
 * @returns An optimized resize event handler
 */
export function optimizeResizeHandler<T extends (event: Event) => void>(
  handler: T,
  options: {
    debounceTime?: number;
    throttleTime?: number;
    useDebounce?: boolean;
  } = {}
): (event: Event) => void {
  const { debounceTime = 200, throttleTime = 100, useDebounce = true } = options;
  
  // Use debounce for resize events by default
  if (useDebounce) {
    return debounce(handler, debounceTime);
  }
  
  // Fall back to throttling if debounce is not preferred
  return throttle(handler, throttleTime);
}

/**
 * Optimizes event handlers for input events
 * @param handler The input event handler
 * @param options Options for the optimization
 * @returns An optimized input event handler
 */
export function optimizeInputHandler<T extends (event: Event) => void>(
  handler: T,
  options: {
    debounceTime?: number;
    immediate?: boolean;
  } = {}
): (event: Event) => void {
  const { debounceTime = 300, immediate = false } = options;
  
  if (immediate) {
    // For immediate feedback, use a combination of immediate execution and debounce
    return function(event: Event): void {
      // Execute immediately for responsive UI
      handler(event);
      
      // Debounce subsequent calls
      const debouncedHandler = debounce(handler, debounceTime);
      debouncedHandler(event);
    };
  }
  
  // Standard debounce for input events
  return debounce(handler, debounceTime);
}