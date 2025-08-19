import { ErrorContext } from './errorLogger';

/**
 * Global error handler for client-side errors
 */
export function setupGlobalErrorHandler() {
  if (typeof window !== 'undefined') {
    // Store original console.error
    const originalConsoleError = console.error;
    
    // Track user actions for better error context
    const userActions: string[] = [];
    const MAX_USER_ACTIONS = 10;
    
    // Track last visited URLs
    const visitedUrls: string[] = [];
    const MAX_VISITED_URLS = 5;
    
    // Add current URL to visited URLs
    visitedUrls.push(window.location.href);
    
    // Monitor navigation events
    window.addEventListener('popstate', () => {
      if (visitedUrls.length >= MAX_VISITED_URLS) {
        visitedUrls.shift();
      }
      visitedUrls.push(window.location.href);
    });
    
    // Monitor user clicks to track actions
    document.addEventListener('click', (event) => {
      try {
        const target = event.target as HTMLElement;
        let actionDescription = '';
        
        // Try to get a meaningful description of what was clicked
        if (target.tagName === 'BUTTON') {
          actionDescription = `Clicked button: ${target.textContent || target.id || 'unnamed'}`;
        } else if (target.tagName === 'A') {
          actionDescription = `Clicked link: ${target.textContent || target.getAttribute('href') || 'unnamed'}`;
        } else if (target.closest('button')) {
          const button = target.closest('button');
          actionDescription = `Clicked button: ${button?.textContent || button?.id || 'unnamed'}`;
        } else if (target.closest('a')) {
          const link = target.closest('a');
          actionDescription = `Clicked link: ${link?.textContent || link?.getAttribute('href') || 'unnamed'}`;
        } else {
          // Try to get any identifiable information
          const id = target.id || target.closest('[id]')?.id;
          const className = target.className || target.closest('[class]')?.className;
          actionDescription = `Clicked element: ${target.tagName}${id ? ` #${id}` : ''}${className ? ` .${className.split(' ')[0]}` : ''}`;
        }
        
        // Add to user actions
        if (userActions.length >= MAX_USER_ACTIONS) {
          userActions.shift();
        }
        userActions.push(actionDescription);
      } catch (e) {
        // Ignore errors in the click handler
      }
    });
    
    // Collect device and browser information
    const getDeviceInfo = () => {
      try {
        const connection = (navigator as any).connection || 
                          (navigator as any).mozConnection || 
                          (navigator as any).webkitConnection;
        
        return {
          platform: navigator.platform,
          browser: navigator.userAgent,
          screenSize: `${window.screen.width}x${window.screen.height}`,
          orientation: window.screen.orientation ? window.screen.orientation.type : 'unknown',
          memoryInfo: (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory}GB` : 'unknown',
          connectionType: connection ? connection.effectiveType : 'unknown'
        };
      } catch (e) {
        return {
          platform: navigator.platform || 'unknown',
          browser: navigator.userAgent || 'unknown'
        };
      }
    };
    
    // Collect performance metrics
    const getPerformanceMetrics = () => {
      try {
        const memory = (performance as any).memory ? {
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize
        } : undefined;
        
        const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        return {
          memoryUsage: memory ? memory.usedJSHeapSize / memory.jsHeapSizeLimit : undefined,
          loadTime: navigationTiming ? navigationTiming.loadEventEnd - navigationTiming.startTime : undefined,
          networkLatency: navigationTiming ? navigationTiming.responseStart - navigationTiming.requestStart : undefined,
          memoryDetails: memory
        };
      } catch (e) {
        return {};
      }
    };
    
    // Collect sensor availability information
    const getSensorInfo = () => {
      try {
        const accelerometerAvailable = 'DeviceMotionEvent' in window;
        const gyroscopeAvailable = 'DeviceOrientationEvent' in window;
        const magnetometerAvailable = 'DeviceOrientationAbsoluteEvent' in window;
        
        return {
          accelerometer: accelerometerAvailable,
          gyroscope: gyroscopeAvailable,
          magnetometer: magnetometerAvailable
        };
      } catch (e) {
        return {
          accelerometer: false,
          gyroscope: false,
          magnetometer: false
        };
      }
    };
    
    // Override console.error to capture errors
    console.error = function(...args) {
      // Call original console.error
      originalConsoleError.apply(console, args);
      
      // Log the error to our system
      try {
        const errorMessage = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        // Collect enhanced context information
        const enhancedContext = {
          additionalInfo: { 
            consoleError: true,
            recentUserActions: [...userActions],
            recentUrls: [...visitedUrls]
          },
          deviceInfo: getDeviceInfo(),
          performanceMetrics: getPerformanceMetrics(),
          sensorData: getSensorInfo(),
          userAction: userActions.length > 0 ? userActions[userActions.length - 1] : undefined
        };
        
        logErrorToServer({
          message: errorMessage.substring(0, 1000), // Limit message length
          stack: args[0] instanceof Error ? args[0].stack : undefined,
          context: enhancedContext
        });
      } catch (e) {
        // If logging fails, use original console.error
        originalConsoleError('Failed to log error:', e);
      }
    };

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      
      // Collect enhanced context information
      const enhancedContext = {
        additionalInfo: { 
          unhandledRejection: true,
          recentUserActions: [...userActions],
          recentUrls: [...visitedUrls]
        },
        deviceInfo: getDeviceInfo(),
        performanceMetrics: getPerformanceMetrics(),
        sensorData: getSensorInfo(),
        userAction: userActions.length > 0 ? userActions[userActions.length - 1] : undefined
      };
      
      logErrorToServer({
        message: error.message || 'Unhandled Promise Rejection',
        stack: error.stack,
        context: enhancedContext
      });
    });

    // Handle uncaught exceptions
    window.addEventListener('error', (event) => {
      // Collect enhanced context information
      const enhancedContext = {
        additionalInfo: {
          uncaughtException: true,
          fileName: event.filename,
          lineNumber: event.lineno,
          columnNumber: event.colno,
          recentUserActions: [...userActions],
          recentUrls: [...visitedUrls]
        },
        deviceInfo: getDeviceInfo(),
        performanceMetrics: getPerformanceMetrics(),
        sensorData: getSensorInfo(),
        userAction: userActions.length > 0 ? userActions[userActions.length - 1] : undefined
      };
      
      logErrorToServer({
        message: event.message || 'Uncaught Exception',
        stack: event.error?.stack,
        context: enhancedContext
      });
      
      // Prevent the error from being reported to the console
      // event.preventDefault();
    });
  }
}

/**
 * Logs an error to the server
 */
export async function logErrorToServer(error: {
  message: string;
  stack?: string;
  context?: ErrorContext;
}) {
  try {
    // Get user info from localStorage if available
    let userId = undefined;
    let userEmail = undefined;
    
    if (typeof window !== 'undefined') {
      try {
        const userJson = localStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson);
          userId = user.id;
          userEmail = user.email;
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }
    
    // Create a queue for errors if it doesn't exist
    if (typeof window !== 'undefined' && !window.errorQueue) {
      window.errorQueue = [];
    }
    
    // Add error to queue
    const errorData = {
      message: error.message,
      stack: error.stack,
      context: error.context,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
      userId,
      userEmail,
      timestamp: new Date().toISOString()
    };
    
    // Add to queue
    if (typeof window !== 'undefined') {
      window.errorQueue.push(errorData);
    }
    
    // Process queue with retry logic
    if (typeof window !== 'undefined' && !window.isProcessingErrorQueue) {
      window.isProcessingErrorQueue = true;
      
      const processQueue = async () => {
        if (window.errorQueue.length === 0) {
          window.isProcessingErrorQueue = false;
          return;
        }
        
        const currentError = window.errorQueue[0];
        
        try {
          // Send error to API with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
          
          await fetch('/api/admin/error-logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(currentError),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          // Remove from queue if successful
          window.errorQueue.shift();
          
          // Continue processing queue
          setTimeout(processQueue, 100);
        } catch (e) {
          // If API call fails, log to console as fallback
          console.error('Failed to send error to server:', e);
          
          // Remove from queue after 3 retries
          if (currentError.retryCount >= 2) {
            window.errorQueue.shift();
          } else {
            // Increment retry count
            currentError.retryCount = (currentError.retryCount || 0) + 1;
          }
          
          // Retry after a delay
          setTimeout(processQueue, 2000);
        }
      };
      
      processQueue();
    }
  } catch (e) {
    // If all else fails, log to console as fallback
    console.error('Failed to process error:', e);
  }
}

// Add type definitions for window
declare global {
  interface Window {
    errorQueue?: Array<any>;
    isProcessingErrorQueue?: boolean;
  }
}