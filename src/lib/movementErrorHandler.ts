// @ts-nocheck
import { logErrorToServer } from './globalErrorHandler';

/**
 * Specialized error handler for movement detection
 * Captures detailed sensor and motion data for better debugging
 */
export function logMovementError(
  error: Error, 
  componentName: string, 
  functionName: string, 
  sensorData?: any,
  options?: {
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    additionalContext?: Record<string, any>;
  }
) {
  try {
    // Capture detailed sensor information if available
    const sensorContext = sensorData ? {
      lastAccelerationSamples: Array.isArray(sensorData.samples) ? 
        sensorData.samples.slice(-10) : undefined, // Last 10 samples
      calibrationData: sensorData.calibration,
      deviceSupport: {
        accelerometer: 'DeviceMotionEvent' in window,
        gyroscope: 'DeviceOrientationEvent' in window,
        permissions: sensorData.permissions
      },
      detectionState: sensorData.state,
      configOptions: sensorData.options
    } : {};
    
    // Capture device orientation if available
    let orientation = {};
    try {
      if (window.screen && window.screen.orientation) {
        orientation = {
          type: window.screen.orientation.type,
          angle: window.screen.orientation.angle
        };
      }
    } catch (e) {
      // Ignore orientation errors
    }
    
    // Capture battery info if available
    let batteryInfo = {};
    try {
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          batteryInfo = {
            level: battery.level,
            charging: battery.charging
          };
        });
      }
    } catch (e) {
      // Ignore battery errors
    }
    
    // Log the error with enhanced context
    logErrorToServer({
      message: `[Movement Detector] ${error.message}`,
      stack: error.stack,
      context: {
        componentName,
        functionName,
        sensorData: {
          ...sensorContext,
          deviceOrientation: orientation,
          batteryInfo
        },
        additionalInfo: {
          ...options?.additionalContext,
          errorType: 'MovementDetectionError',
          errorSource: 'MovementDetector'
        }
      }
    });
  } catch (loggingError) {
    // If enhanced logging fails, fall back to basic error logging
    console.error('Failed to log movement error with enhanced context:', loggingError);
    console.error('Original movement error:', error);
    
    // Try basic error logging as fallback
    try {
      logErrorToServer({
        message: `[Movement Detector] ${error.message}`,
        stack: error.stack,
        context: {
          componentName,
          functionName
        }
      });
    } catch (e) {
      // Last resort: log to console
      console.error('Movement detection error:', error);
    }
  }
}

/**
 * Creates a wrapped version of a function that catches and logs errors
 * specifically for movement detection functions
 */
export function withMovementErrorHandling<T extends (...args: any[]) => any>(
  fn: T,
  componentName: string,
  functionName: string,
  getSensorData?: () => any,
  options?: {
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    additionalContext?: Record<string, any>;
  }
): (...args: Parameters<T>) => ReturnType<T> {
  return (...args: Parameters<T>): ReturnType<T> => {
    try {
      return fn(...args);
    } catch (error) {
      // Get sensor data if function provided
      const sensorData = getSensorData ? getSensorData() : undefined;
      
      // Log the error with enhanced context
      logMovementError(
        error as Error,
        componentName,
        functionName,
        sensorData,
        options
      );
      
      // Return a safe fallback value
      return undefined as unknown as ReturnType<T>;
    }
  };
}

/**
 * Wraps an async function with movement error handling
 */
export function withAsyncMovementErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  componentName: string,
  functionName: string,
  getSensorData?: () => any,
  options?: {
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    additionalContext?: Record<string, any>;
  }
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  return async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Get sensor data if function provided
      const sensorData = getSensorData ? getSensorData() : undefined;
      
      // Log the error with enhanced context
      logMovementError(
        error as Error,
        componentName,
        functionName,
        sensorData,
        options
      );
      
      // Return a safe fallback value or rethrow based on options
      if (options?.additionalContext?.rethrow) {
        throw error;
      }
      return undefined as unknown as Awaited<ReturnType<T>>;
    }
  };
}