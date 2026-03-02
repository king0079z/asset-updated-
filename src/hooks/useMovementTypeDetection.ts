import { useState, useEffect, useRef } from 'react';
import { classifyMovement, analyzeMovementSequence } from '@/lib/ml/movementClassifier';
import { enhancedClassifyMovement, enhancedAnalyzeMovementSequence } from '@/lib/ml/enhancedMovementClassifier';
import { logMovementError, withMovementErrorHandling } from '@/lib/movementErrorHandler';

export enum MovementType {
  STATIONARY = 'stationary',
  WALKING = 'walking',
  VEHICLE = 'vehicle',
  UNKNOWN = 'unknown'
}

// Fallback values in case the enum is not available
export const MOVEMENT_TYPE_FALLBACK = {
  STATIONARY: 'stationary',
  WALKING: 'walking',
  VEHICLE: 'vehicle',
  UNKNOWN: 'unknown'
}

interface MovementTypeDetectionOptions {
  sampleSize?: number;           // Number of samples to collect before making a determination
  updateInterval?: number;       // How often to update the movement type (ms)
  vehicleThreshold?: number;     // Acceleration threshold for vehicle detection
  walkingThreshold?: number;     // Acceleration threshold for walking detection
  frequencyThreshold?: number;   // Frequency threshold to distinguish walking from vehicle
  minConfidence?: number;        // Minimum confidence level to report a movement type
  temporalSmoothing?: boolean;   // Whether to apply temporal smoothing for more stable detection
  adaptiveThresholds?: boolean;  // Whether to adapt thresholds based on device characteristics
  safeMode?: boolean;            // Enable safe mode to prevent crashes on problematic devices
  maxSampleBufferSize?: number;  // Maximum buffer size to prevent memory issues
  useSimpleMode?: boolean;       // Use simplified detection algorithm for better stability
  errorThreshold?: number;       // Number of errors before disabling detection
}

interface MovementTypeState {
  type: MovementType;
  confidence: number;
  lastUpdated: Date | null;
  isSupported: boolean | null;
  details?: {
    vehicleConfidence: number;
    walkingConfidence: number;
    stationaryConfidence: number;
    dominantFrequencies?: number[];
  };
}

interface AccelerationSample {
  magnitude: number;
  timestamp: number;
  x: number;
  y: number;
  z: number;
}

/**
 * Hook to detect whether a user is walking or in a vehicle based on motion patterns
 * Uses advanced signal processing and machine learning techniques for accurate classification
 */
export function useMovementTypeDetection(options: MovementTypeDetectionOptions = {}) {
  const {
    sampleSize = 30,             // Reduced sample size for better performance
    updateInterval = 1000,       // Increased interval for better stability
    vehicleThreshold = 1.7,      // Vehicle movement threshold (m/s²)
    walkingThreshold = 0.55,     // Walking threshold (m/s²)
    frequencyThreshold = 1.6,    // Hz - walking typically has higher frequency than vehicle
    minConfidence = 0.5,         // Minimum confidence for detection
    temporalSmoothing = true,    // Apply temporal smoothing by default
    adaptiveThresholds = true,   // Adapt thresholds based on device characteristics
    safeMode = true,             // Enable safe mode by default
    maxSampleBufferSize = 60,    // Limit buffer size to prevent memory issues
    useSimpleMode = false,       // Use simplified detection by default
    errorThreshold = 3           // Number of errors before disabling detection
  } = options;

  const [movementState, setMovementState] = useState<MovementTypeState>({
    type: MovementType.UNKNOWN,
    confidence: 0,
    lastUpdated: null,
    isSupported: null
  });

  // Store acceleration samples and timestamps
  const accelerationSamples = useRef<AccelerationSample[]>([]);
  
  // Store recent classifications for temporal smoothing
  const recentClassifications = useRef<Array<any>>([]);
  
  // Store device-specific calibration data
  const deviceCalibration = useRef<{
    baselineNoise: number;
    adjustedVehicleThreshold: number;
    adjustedWalkingThreshold: number;
    calibrated: boolean;
  }>({
    baselineNoise: 0,
    adjustedVehicleThreshold: vehicleThreshold,
    adjustedWalkingThreshold: walkingThreshold,
    calibrated: false
  });

  // Error tracking
  const errorCount = useRef<number>(0);
  const lastErrorTime = useRef<number>(0);

  // Check if device motion is supported
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const supported = 'DeviceMotionEvent' in window;
    setMovementState(prev => ({ ...prev, isSupported: supported }));
    
    if (!supported) {
      console.warn('Device motion sensors not supported on this device');
      return;
    }

    let lastTimestamp = 0;
    let updateTimer: NodeJS.Timeout | null = null;
    let calibrationSamples: number[] = [];

    // Get current sensor data for error logging
    const getSensorData = () => {
      return {
        samples: accelerationSamples.current.slice(-10), // Last 10 samples
        calibration: deviceCalibration.current,
        state: movementState,
        options: {
          sampleSize,
          updateInterval,
          vehicleThreshold,
          walkingThreshold,
          frequencyThreshold,
          minConfidence,
          temporalSmoothing,
          adaptiveThresholds,
          safeMode,
          maxSampleBufferSize,
          useSimpleMode,
          errorThreshold
        },
        permissions: {
          deviceMotion: 'DeviceMotionEvent' in window,
          deviceOrientation: 'DeviceOrientationEvent' in window
        }
      };
    };

    // Handle motion events with enhanced error handling
    const handleMotionEvent = (event: DeviceMotionEvent) => {
      try {
        // Check if event and acceleration exist and are valid
        if (!event || !event.acceleration) {
          return;
        }
        
        // Safely access acceleration values with fallbacks
        const x = typeof event.acceleration.x === 'number' ? event.acceleration.x : 0;
        const y = typeof event.acceleration.y === 'number' ? event.acceleration.y : 0;
        const z = typeof event.acceleration.z === 'number' ? event.acceleration.z : 0;
        
        const now = Date.now();
        
        // Collect samples at a controlled rate (25ms = 40Hz sampling)
        if (now - lastTimestamp < 25) {
          return;
        }
        
        lastTimestamp = now;
        
        // Calculate magnitude of acceleration vector
        const magnitude = Math.sqrt(x*x + y*y + z*z);
        
        // Collect calibration data if needed
        if (adaptiveThresholds && !deviceCalibration.current.calibrated && calibrationSamples.length < 100) {
          calibrationSamples.push(magnitude);
          
          // Once we have enough samples, calibrate the device
          if (calibrationSamples.length >= 100) {
            try {
              // Use wrapped version of calibrateDevice with error handling
              const safeCalibrate = withMovementErrorHandling(
                calibrateDevice,
                'useMovementTypeDetection',
                'calibrateDevice',
                getSensorData,
                { severity: 'MEDIUM' }
              );
              safeCalibrate(calibrationSamples);
            } catch (error) {
              // Log the error with our specialized error handler
              logMovementError(
                error as Error,
                'useMovementTypeDetection',
                'calibrateDevice',
                {
                  samples: calibrationSamples,
                  calibration: deviceCalibration.current
                },
                { severity: 'MEDIUM' }
              );
              
              // Fall back to default thresholds
              deviceCalibration.current = {
                baselineNoise: 0.1,
                adjustedVehicleThreshold: vehicleThreshold,
                adjustedWalkingThreshold: walkingThreshold,
                calibrated: true
              };
            }
          }
        }
        
        // Add to samples with bounds checking
        if (accelerationSamples.current.length < Math.min(maxSampleBufferSize, sampleSize * 2)) { // Prevent excessive memory usage
          accelerationSamples.current.push({
            magnitude,
            timestamp: now,
            x, y, z
          });
        } else {
          // If buffer is full, remove oldest sample
          accelerationSamples.current.shift();
          accelerationSamples.current.push({
            magnitude,
            timestamp: now,
            x, y, z
          });
        }
      } catch (error) {
        // Track errors to prevent excessive logging
        const now = Date.now();
        if (now - lastErrorTime.current > 10000) { // Only log once every 10 seconds
          // Use our specialized error handler
          logMovementError(
            error as Error,
            'useMovementTypeDetection',
            'handleMotionEvent',
            getSensorData(),
            { 
              severity: 'HIGH',
              additionalContext: {
                errorCount: errorCount.current,
                lastErrorTime: lastErrorTime.current,
                eventData: event ? {
                  accelerationIncludingGravity: event.accelerationIncludingGravity ? {
                    x: event.accelerationIncludingGravity.x,
                    y: event.accelerationIncludingGravity.y,
                    z: event.accelerationIncludingGravity.z
                  } : null,
                  rotationRate: event.rotationRate ? {
                    alpha: event.rotationRate.alpha,
                    beta: event.rotationRate.beta,
                    gamma: event.rotationRate.gamma
                  } : null,
                  interval: event.interval
                } : null
              }
            }
          );
          
          lastErrorTime.current = now;
          errorCount.current += 1;
          
          // If we're getting too many errors, disable motion detection
          if (errorCount.current > errorThreshold && safeMode) {
            console.warn('Too many motion sensor errors, disabling motion detection');
            try {
              window.removeEventListener('devicemotion', handleMotionEvent);
              if (updateTimer) clearInterval(updateTimer);
            } catch (cleanupError) {
              console.error('Error cleaning up motion detection:', cleanupError);
            }
            
            setMovementState(prev => ({
              ...prev,
              isSupported: false,
              type: MovementType.UNKNOWN,
              confidence: 0
            }));
          }
        }
      }
    };

    // Ultra-precise calibration for device-specific thresholds with adaptive noise filtering
    const calibrateDevice = (samples: number[]) => {
      try {
        // Apply outlier rejection to remove extreme values that might skew calibration
        const mean = samples.reduce((sum, val) => sum + val, 0) / samples.length;
        const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length;
        const stdDev = Math.sqrt(variance);
        
        // Filter out extreme outliers (more than 3 standard deviations from mean)
        const filteredSamples = samples.filter(val => Math.abs(val - mean) <= 3 * stdDev);
        
        if (filteredSamples.length < 10) {
          // Not enough valid samples after filtering
          throw new Error('Not enough valid samples for calibration');
        }
        
        // Sort filtered samples for percentile calculations
        const sortedSamples = [...filteredSamples].sort((a, b) => a - b);
        
        // Calculate different percentiles for more accurate noise estimation
        const lowerPercentileIndex = Math.floor(sortedSamples.length * 0.12);
        const medianIndex = Math.floor(sortedSamples.length * 0.5);
        const upperPercentileIndex = Math.floor(sortedSamples.length * 0.88);
        
        // Use lower percentile as baseline noise
        const baselineNoise = sortedSamples[lowerPercentileIndex];
        const medianNoise = sortedSamples[medianIndex];
        const upperNoise = sortedSamples[upperPercentileIndex];
        
        // Calculate noise variance and interquartile range for better threshold adjustment
        const noiseVariance = filteredSamples.reduce((sum, val) => sum + Math.pow(val - medianNoise, 2), 0) / filteredSamples.length;
        const noiseRange = upperNoise - baselineNoise;
        
        // Calculate noise characteristics
        const noiseStdDev = Math.sqrt(noiseVariance);
        const coeffOfVariation = noiseStdDev / (medianNoise + 0.001); // Avoid division by zero
        
        // Adjust thresholds based on comprehensive noise characteristics
        // Use adaptive multipliers based on noise profile of the device
        const noiseFactor = Math.min(1.0, Math.max(0.5, 1.0 - coeffOfVariation));
        
        // For very noisy devices, use higher thresholds
        // For very stable devices, use lower thresholds for better sensitivity
        const walkingMultiplier = 1.4 + (1.0 - noiseFactor) * 0.6;
        const vehicleMultiplier = 2.8 + (1.0 - noiseFactor) * 1.2;
        
        // Calculate adjusted thresholds with noise floor protection
        const noiseFloor = Math.max(0.05, baselineNoise);
        const adjustedWalkingThreshold = Math.max(
          walkingThreshold,
          noiseFloor * walkingMultiplier
        );
        
        // Vehicle threshold needs to be higher than walking but not too high
        const adjustedVehicleThreshold = Math.max(
          vehicleThreshold, 
          noiseFloor * vehicleMultiplier,
          adjustedWalkingThreshold * 1.4
        );
        
        // Apply final adjustments based on device noise profile
        deviceCalibration.current = {
          baselineNoise: noiseFloor,
          adjustedWalkingThreshold: Math.min(adjustedWalkingThreshold, walkingThreshold * 1.5),
          adjustedVehicleThreshold: Math.min(adjustedVehicleThreshold, vehicleThreshold * 1.6),
          calibrated: true
        };
        
        console.log('Device motion calibration complete', deviceCalibration.current);
      } catch (error) {
        console.error('Error during calibration:', error);
        // Fall back to default thresholds
        deviceCalibration.current = {
          baselineNoise: 0.1,
          adjustedVehicleThreshold: vehicleThreshold,
          adjustedWalkingThreshold: walkingThreshold,
          calibrated: true
        };
      }
    };

    // Analysis of collected samples with enhanced error handling
    const analyzeMovement = () => {
      try {
        const samples = accelerationSamples.current;
        
        // Need enough samples to make a determination
        if (!samples || samples.length < sampleSize / 2) {
          return;
        }
        
        // Apply noise filtering to samples before analysis
        let filteredSamples;
        try {
          // Use wrapped version of filterSamples with error handling
          const safeFilterSamples = withMovementErrorHandling(
            filterSamples,
            'useMovementTypeDetection',
            'filterSamples',
            getSensorData,
            { severity: 'MEDIUM' }
          );
          filteredSamples = safeFilterSamples(samples);
        } catch (error) {
          // Log the error with our specialized error handler
          logMovementError(
            error as Error,
            'useMovementTypeDetection',
            'filterSamples',
            getSensorData(),
            { severity: 'MEDIUM' }
          );
          filteredSamples = samples; // Fall back to unfiltered samples
        }
        
        // Use simplified mode if enabled or fall back to it after errors
        let classification;
        if (useSimpleMode || errorCount.current > errorThreshold) {
          try {
            // Use wrapped version of simpleClassifyMovement with error handling
            const safeClassify = withMovementErrorHandling(
              simpleClassifyMovement,
              'useMovementTypeDetection',
              'simpleClassifyMovement',
              getSensorData,
              { severity: 'MEDIUM' }
            );
            classification = safeClassify(filteredSamples);
          } catch (error) {
            // Log the error with our specialized error handler
            logMovementError(
              error as Error,
              'useMovementTypeDetection',
              'simpleClassifyMovement',
              getSensorData(),
              { severity: 'HIGH' }
            );
            
            // Fall back to very basic classification
            try {
              // Use wrapped version of fallbackClassification with error handling
              const safeFallback = withMovementErrorHandling(
                fallbackClassification,
                'useMovementTypeDetection',
                'fallbackClassification',
                getSensorData,
                { severity: 'HIGH' }
              );
              classification = safeFallback(filteredSamples);
            } catch (fallbackError) {
              // Log the error with our specialized error handler
              logMovementError(
                fallbackError as Error,
                'useMovementTypeDetection',
                'fallbackClassification',
                getSensorData(),
                { 
                  severity: 'CRITICAL',
                  additionalContext: { criticalFailure: true }
                }
              );
              // Return early if even the fallback fails
              return;
            }
          }
        } else {
          // Use enhanced movement classification with error handling
          try {
            // Use wrapped version of enhancedClassifyMovement with error handling
            const safeEnhancedClassify = withMovementErrorHandling(
              enhancedClassifyMovement,
              'useMovementTypeDetection',
              'enhancedClassifyMovement',
              getSensorData,
              { severity: 'MEDIUM' }
            );
            classification = safeEnhancedClassify(filteredSamples);
          } catch (error) {
            // Log the error with our specialized error handler
            logMovementError(
              error as Error,
              'useMovementTypeDetection',
              'enhancedClassifyMovement',
              getSensorData(),
              { severity: 'MEDIUM' }
            );
            
            // Fall back to simple classification
            try {
              // Use wrapped version of simpleClassifyMovement with error handling
              const safeClassify = withMovementErrorHandling(
                simpleClassifyMovement,
                'useMovementTypeDetection',
                'simpleClassifyMovement',
                getSensorData,
                { severity: 'MEDIUM' }
              );
              classification = safeClassify(filteredSamples);
            } catch (secondError) {
              // Log the error with our specialized error handler
              logMovementError(
                secondError as Error,
                'useMovementTypeDetection',
                'simpleClassifyMovement (fallback)',
                getSensorData(),
                { severity: 'HIGH' }
              );
              
              // If even simple classification fails, use fallback
              try {
                // Use wrapped version of fallbackClassification with error handling
                const safeFallback = withMovementErrorHandling(
                  fallbackClassification,
                  'useMovementTypeDetection',
                  'fallbackClassification',
                  getSensorData,
                  { severity: 'HIGH' }
                );
                classification = safeFallback(filteredSamples);
              } catch (criticalError) {
                // Log the error with our specialized error handler
                logMovementError(
                  criticalError as Error,
                  'useMovementTypeDetection',
                  'fallbackClassification (last resort)',
                  getSensorData(),
                  { 
                    severity: 'CRITICAL',
                    additionalContext: { criticalFailure: true }
                  }
                );
                // Return early if all classification methods fail
                return;
              }
            }
          }
        }
        
        // Safety check - if classification is undefined or null, use a safe default
        if (!classification) {
          classification = {
            type: MovementType.UNKNOWN,
            confidence: 0.5,
            details: {
              vehicleConfidence: 0.1,
              walkingConfidence: 0.1,
              stationaryConfidence: 0.1,
              frequencySignature: {
                dominantFrequencies: [],
                peakFrequency: null,
                spectralEnergy: 0,
                spectralCentroid: 0
              }
            }
          };
        }
        
        // Apply temporal smoothing if enabled
        let finalClassification = classification;
        if (temporalSmoothing) {
          try {
            // Add current classification to recent history
            recentClassifications.current.push(classification);
            
            // Keep more recent classifications for better temporal analysis
            if (recentClassifications.current.length > 7) {
              recentClassifications.current.shift();
            }
            
            // Apply enhanced temporal smoothing with error handling
            if (recentClassifications.current.length > 1) {
              try {
                // Use wrapped version of enhancedAnalyzeMovementSequence with error handling
                const safeTemporalSmoothing = withMovementErrorHandling(
                  enhancedAnalyzeMovementSequence,
                  'useMovementTypeDetection',
                  'enhancedAnalyzeMovementSequence',
                  getSensorData,
                  { severity: 'LOW' }
                );
                finalClassification = safeTemporalSmoothing(
                  recentClassifications.current.slice(0, -1), 
                  classification
                );
              } catch (error) {
                // Log the error with our specialized error handler
                logMovementError(
                  error as Error,
                  'useMovementTypeDetection',
                  'enhancedAnalyzeMovementSequence',
                  getSensorData(),
                  { severity: 'LOW' }
                );
                finalClassification = classification; // Fall back to current classification
              }
            }
          } catch (error) {
            // Log the error with our specialized error handler
            logMovementError(
              error as Error,
              'useMovementTypeDetection',
              'temporalSmoothingSetup',
              getSensorData(),
              { severity: 'LOW' }
            );
            finalClassification = classification; // Fall back to current classification
          }
        }
        
        // Apply adaptive confidence threshold based on movement type
        let effectiveMinConfidence = minConfidence;
        
        // Walking can be detected with slightly lower confidence
        if (finalClassification.type === MovementType.WALKING) {
          effectiveMinConfidence = Math.max(0.45, minConfidence - 0.05);
        } 
        // Vehicle requires higher confidence to prevent false positives
        else if (finalClassification.type === MovementType.VEHICLE) {
          effectiveMinConfidence = Math.min(0.55, minConfidence + 0.05);
        }
        // Stationary can be detected with lower confidence
        else if (finalClassification.type === MovementType.STATIONARY) {
          effectiveMinConfidence = Math.max(0.4, minConfidence - 0.1);
        }
        
        // Ensure all required properties exist before updating state
        if (finalClassification && 
            finalClassification.details && 
            typeof finalClassification.confidence === 'number') {
          
          // Only update state if confidence meets adaptive minimum threshold
          if (finalClassification.confidence >= effectiveMinConfidence || 
              (finalClassification.type === MovementType.STATIONARY && finalClassification.confidence >= 0.7)) {
            
            // Ensure all required properties exist in details
            const details = {
              vehicleConfidence: finalClassification.details.vehicleConfidence || 0,
              walkingConfidence: finalClassification.details.walkingConfidence || 0,
              stationaryConfidence: finalClassification.details.stationaryConfidence || 0,
              dominantFrequencies: finalClassification.details.frequencySignature?.dominantFrequencies || []
            };
            
            setMovementState({
              type: finalClassification.type,
              confidence: finalClassification.confidence,
              lastUpdated: new Date(),
              isSupported: true,
              details
            });
          }
        }
      } catch (error) {
        // Track errors to prevent excessive logging
        const now = Date.now();
        if (now - lastErrorTime.current > 10000) { // Only log once every 10 seconds
          // Use our specialized error handler
          logMovementError(
            error as Error,
            'useMovementTypeDetection',
            'analyzeMovement',
            getSensorData(),
            { 
              severity: 'HIGH',
              additionalContext: {
                errorCount: errorCount.current,
                lastErrorTime: lastErrorTime.current
              }
            }
          );
          
          lastErrorTime.current = now;
          errorCount.current += 1;
          
          // If we're getting too many errors, disable motion detection
          if (errorCount.current > errorThreshold && safeMode) {
            console.warn('Too many movement analysis errors, disabling motion detection');
            try {
              window.removeEventListener('devicemotion', handleMotionEvent);
              if (updateTimer) clearInterval(updateTimer);
            } catch (cleanupError) {
              console.error('Error cleaning up motion detection:', cleanupError);
            }
            
            setMovementState(prev => ({
              ...prev,
              isSupported: false,
              type: MovementType.UNKNOWN,
              confidence: 0
            }));
          }
        }
      }
    };
    
    // Advanced noise filtering function with error handling
    const filterSamples = (samples: AccelerationSample[]): AccelerationSample[] => {
      if (samples.length < 5) return samples;
      
      // Apply median filter to remove impulse noise
      const filteredSamples: AccelerationSample[] = [];
      
      for (let i = 0; i < samples.length; i++) {
        try {
          // Get window of samples for median filtering
          const windowStart = Math.max(0, i - 2);
          const windowEnd = Math.min(samples.length - 1, i + 2);
          const window = samples.slice(windowStart, windowEnd + 1);
          
          // Extract x, y, z components
          const xValues = window.map(s => s.x).sort((a, b) => a - b);
          const yValues = window.map(s => s.y).sort((a, b) => a - b);
          const zValues = window.map(s => s.z).sort((a, b) => a - b);
          
          // Get median values
          const medianX = xValues[Math.floor(xValues.length / 2)];
          const medianY = yValues[Math.floor(yValues.length / 2)];
          const medianZ = zValues[Math.floor(zValues.length / 2)];
          
          // Calculate filtered magnitude
          const filteredMagnitude = Math.sqrt(medianX * medianX + medianY * medianY + medianZ * medianZ);
          
          // Create filtered sample
          filteredSamples.push({
            x: medianX,
            y: medianY,
            z: medianZ,
            magnitude: filteredMagnitude,
            timestamp: samples[i].timestamp
          });
        } catch (error) {
          // If there's an error processing this sample, just use the original
          filteredSamples.push(samples[i]);
        }
      }
      
      return filteredSamples;
    };

    // Set up event listener and timer with error handling
    try {
      window.addEventListener('devicemotion', handleMotionEvent);
      updateTimer = setInterval(analyzeMovement, updateInterval);
    } catch (error) {
      console.error('Error setting up motion detection:', error);
      setMovementState(prev => ({
        ...prev,
        isSupported: false
      }));
    }

    // Cleanup
    return () => {
      try {
        window.removeEventListener('devicemotion', handleMotionEvent);
        if (updateTimer) clearInterval(updateTimer);
      } catch (error) {
        console.error('Error cleaning up motion detection:', error);
      }
    };
  }, [
    sampleSize, 
    updateInterval, 
    vehicleThreshold, 
    walkingThreshold, 
    frequencyThreshold, 
    minConfidence,
    temporalSmoothing,
    adaptiveThresholds,
    safeMode
  ]);

  // Simple movement classification that's more robust and less likely to crash
  const simpleClassifyMovement = (samples: AccelerationSample[]) => {
    if (samples.length < 5) {
      return fallbackClassification(samples);
    }
    
    // Calculate average magnitude and variance
    let sum = 0;
    let sumSquares = 0;
    
    for (const sample of samples) {
      sum += sample.magnitude;
      sumSquares += sample.magnitude * sample.magnitude;
    }
    
    const avgMagnitude = sum / samples.length;
    const variance = (sumSquares / samples.length) - (avgMagnitude * avgMagnitude);
    const stdDev = Math.sqrt(Math.max(0, variance));
    
    // Calculate vertical (y-axis) dominance
    let verticalSum = 0;
    let horizontalSum = 0;
    let lateralSum = 0;
    
    for (const sample of samples) {
      verticalSum += Math.abs(sample.y);
      horizontalSum += Math.abs(sample.x);
      lateralSum += Math.abs(sample.z);
    }
    
    const totalSum = verticalSum + horizontalSum + lateralSum;
    const verticalRatio = totalSum > 0 ? verticalSum / totalSum : 0.33;
    const horizontalRatio = totalSum > 0 ? horizontalSum / totalSum : 0.33;
    
    // Calculate zero crossings for frequency estimation
    let verticalZeroCrossings = 0;
    let prevVerticalSign = Math.sign(samples[0].y);
    
    for (let i = 1; i < samples.length; i++) {
      const currentSign = Math.sign(samples[i].y);
      if (currentSign !== 0 && prevVerticalSign !== 0 && currentSign !== prevVerticalSign) {
        verticalZeroCrossings++;
      }
      prevVerticalSign = currentSign !== 0 ? currentSign : prevVerticalSign;
    }
    
    // Calculate frequency (Hz)
    const duration = (samples[samples.length-1].timestamp - samples[0].timestamp) / 1000; // seconds
    const frequency = duration > 0 ? verticalZeroCrossings / (2 * duration) : 0; // Hz
    
    // Determine movement type based on simple heuristics
    let type = MovementType.UNKNOWN;
    let confidence = 0.5;
    let vehicleConfidence = 0.1;
    let walkingConfidence = 0.1;
    let stationaryConfidence = 0.1;
    
    // Check if stationary
    if (avgMagnitude < 0.3) {
      type = MovementType.STATIONARY;
      confidence = 0.8;
      stationaryConfidence = 0.8;
    }
    // Check if walking (higher frequency, vertical dominance)
    else if (frequency > 1.0 && frequency < 3.0 && verticalRatio > 0.4) {
      type = MovementType.WALKING;
      confidence = 0.7;
      walkingConfidence = 0.7;
    }
    // Check if in vehicle (lower frequency, horizontal dominance)
    else if (frequency < 1.0 && frequency > 0.1 && horizontalRatio > 0.4) {
      type = MovementType.VEHICLE;
      confidence = 0.7;
      vehicleConfidence = 0.7;
    }
    // Otherwise use magnitude and variance to guess
    else if (avgMagnitude > 0.5) {
      if (stdDev / avgMagnitude > 0.7) {
        // High variance suggests walking
        type = MovementType.WALKING;
        confidence = 0.6;
        walkingConfidence = 0.6;
      } else {
        // Lower variance suggests vehicle
        type = MovementType.VEHICLE;
        confidence = 0.6;
        vehicleConfidence = 0.6;
      }
    }
    
    return {
      type,
      confidence,
      details: {
        vehicleConfidence,
        walkingConfidence,
        stationaryConfidence,
        frequencySignature: {
          dominantFrequencies: [frequency],
          peakFrequency: frequency,
          spectralEnergy: avgMagnitude,
          spectralCentroid: frequency
        }
      }
    };
  };
  
  // Ultra-simple fallback classification when everything else fails
  const fallbackClassification = (samples: AccelerationSample[]) => {
    // If we have no samples, return unknown
    if (!samples || samples.length === 0) {
      return {
        type: MovementType.UNKNOWN,
        confidence: 0.5,
        details: {
          vehicleConfidence: 0.1,
          walkingConfidence: 0.1,
          stationaryConfidence: 0.1,
          frequencySignature: {
            dominantFrequencies: [],
            peakFrequency: null,
            spectralEnergy: 0,
            spectralCentroid: 0
          }
        }
      };
    }
    
    // Calculate average magnitude
    let sum = 0;
    for (const sample of samples) {
      sum += sample.magnitude;
    }
    const avgMagnitude = sum / samples.length;
    
    // Very simple classification based only on magnitude
    let type = MovementType.UNKNOWN;
    let confidence = 0.5;
    
    if (avgMagnitude < 0.2) {
      type = MovementType.STATIONARY;
      confidence = 0.7;
    } else if (avgMagnitude >= 0.2 && avgMagnitude < 0.8) {
      type = MovementType.WALKING;
      confidence = 0.6;
    } else if (avgMagnitude >= 0.8) {
      type = MovementType.VEHICLE;
      confidence = 0.6;
    }
    
    return {
      type,
      confidence,
      details: {
        vehicleConfidence: type === MovementType.VEHICLE ? 0.6 : 0.1,
        walkingConfidence: type === MovementType.WALKING ? 0.6 : 0.1,
        stationaryConfidence: type === MovementType.STATIONARY ? 0.7 : 0.1,
        frequencySignature: {
          dominantFrequencies: [],
          peakFrequency: null,
          spectralEnergy: avgMagnitude,
          spectralCentroid: 0
        }
      }
    };
  };
  
  return movementState;
}