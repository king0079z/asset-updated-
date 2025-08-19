import { useState, useEffect, useRef } from 'react';

interface MotionData {
  isMoving: boolean;
  confidence: number;
  timestamp: number;
  acceleration?: {
    x: number;
    y: number;
    z: number;
  };
  rotation?: {
    alpha: number;
    beta: number;
    gamma: number;
  };
}

interface UseMotionSensorsOptions {
  threshold: number; // Movement detection threshold
  interval: number; // Sampling interval in ms
  minSamples: number; // Minimum samples needed for detection
  safeMode?: boolean; // Enable safe mode to prevent crashes
  maxBufferSize?: number; // Maximum buffer size to prevent memory issues
}

const DEFAULT_OPTIONS: UseMotionSensorsOptions = {
  threshold: 1.2, // Acceleration threshold in m/s²
  interval: 1000, // Check every second
  minSamples: 3, // Need 3 samples above threshold to confirm movement
  safeMode: true, // Enable safe mode by default
  maxBufferSize: 20, // Limit buffer size to prevent memory issues
};

export function useMotionSensors(options = DEFAULT_OPTIONS) {
  const [motionData, setMotionData] = useState<MotionData>({
    isMoving: false,
    confidence: 0,
    timestamp: Date.now(),
  });
  const [samples, setSamples] = useState<number[]>([]);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  
  // Use refs to track errors and prevent excessive state updates
  const errorCount = useRef<number>(0);
  const lastErrorTime = useRef<number>(0);
  const lastAccelerationRef = useRef({ x: 0, y: 0, z: 0 });
  const isDisabled = useRef<boolean>(false);

  useEffect(() => {
    // Check if device motion is supported
    if (typeof window === 'undefined') return;
    
    try {
      const supported = 'DeviceMotionEvent' in window;
      setIsSupported(supported);
      
      if (!supported) {
        console.warn('Device motion sensors not supported on this device');
        return;
      }
    } catch (error) {
      console.error('Error checking motion sensor support:', error);
      setIsSupported(false);
      return;
    }

    let timer: NodeJS.Timeout | null = null;
    
    const handleMotionEvent = (event: DeviceMotionEvent) => {
      try {
        // Skip processing if we've disabled due to errors
        if (isDisabled.current) return;
        
        // Validate acceleration data
        if (!event.acceleration || 
            event.acceleration.x === null || 
            event.acceleration.y === null || 
            event.acceleration.z === null) {
          return;
        }
        
        // Store acceleration data in ref to avoid state updates
        lastAccelerationRef.current = {
          x: event.acceleration.x || 0,
          y: event.acceleration.y || 0,
          z: event.acceleration.z || 0,
        };
      } catch (error) {
        handleError('processing motion event', error);
      }
    };

    const checkMovement = () => {
      try {
        // Skip processing if we've disabled due to errors
        if (isDisabled.current) return;
        
        const lastAcceleration = lastAccelerationRef.current;
        
        // Calculate magnitude of acceleration vector with bounds checking
        const magnitude = Math.sqrt(
          Math.pow(isFinite(lastAcceleration.x) ? lastAcceleration.x : 0, 2) +
          Math.pow(isFinite(lastAcceleration.y) ? lastAcceleration.y : 0, 2) +
          Math.pow(isFinite(lastAcceleration.z) ? lastAcceleration.z : 0, 2)
        );
        
        // Validate magnitude before proceeding
        if (!isFinite(magnitude)) {
          console.warn('Invalid acceleration magnitude detected');
          return;
        }
        
        // Add to samples with size limit
        const maxSize = options.maxBufferSize || DEFAULT_OPTIONS.maxBufferSize;
        const newSamples = [...samples, magnitude];
        if (newSamples.length > maxSize) {
          newSamples.shift();
        }
        setSamples(newSamples);
        
        // Calculate how many samples are above threshold
        const validSamples = newSamples.filter(s => isFinite(s));
        if (validSamples.length === 0) return;
        
        const samplesAboveThreshold = validSamples.filter(s => s > options.threshold).length;
        const confidence = samplesAboveThreshold / Math.max(1, validSamples.length);
        
        // Determine if moving based on confidence
        const isMoving = confidence > 0.6; // 60% of samples need to be above threshold
        
        setMotionData({
          isMoving,
          confidence,
          timestamp: Date.now(),
          acceleration: lastAcceleration,
        });
      } catch (error) {
        handleError('checking movement', error);
      }
    };

    // Error handling function
    const handleError = (context: string, error: any) => {
      const now = Date.now();
      // Only log errors once every 10 seconds to avoid flooding console
      if (now - lastErrorTime.current > 10000) {
        console.error(`Error ${context}:`, error);
        lastErrorTime.current = now;
        errorCount.current += 1;
        
        // If we're getting too many errors and safe mode is enabled, disable motion detection
        if (errorCount.current > 3 && options.safeMode) {
          console.warn('Too many motion sensor errors, disabling motion detection');
          isDisabled.current = true;
          
          // Clean up event listeners and timers
          window.removeEventListener('devicemotion', handleMotionEvent);
          if (timer) clearInterval(timer);
          
          // Update state to reflect disabled status
          setIsSupported(false);
          setMotionData({
            isMoving: false,
            confidence: 0,
            timestamp: Date.now(),
          });
        }
      }
    };

    try {
      // Set up event listener with error handling
      window.addEventListener('devicemotion', handleMotionEvent);
      timer = setInterval(checkMovement, options.interval);
    } catch (error) {
      handleError('setting up motion detection', error);
      setIsSupported(false);
    }

    return () => {
      try {
        window.removeEventListener('devicemotion', handleMotionEvent);
        if (timer) clearInterval(timer);
      } catch (error) {
        console.error('Error cleaning up motion detection:', error);
      }
    };
  }, [options.interval, options.threshold, options.minSamples, options.safeMode, options.maxBufferSize, samples]);

  return { ...motionData, isSupported };
}