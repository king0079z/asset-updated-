import { useState, useEffect, useRef, useCallback } from 'react';
import {
  enhancedClassifyMovement,
  enhancedAnalyzeMovementSequence,
  type ClassificationResult,
} from '@/lib/ml/enhancedMovementClassifier';

/* ─── Public types ───────────────────────────────────────────────────────────── */

export enum MovementType {
  STATIONARY = 'stationary',
  WALKING    = 'walking',
  VEHICLE    = 'vehicle',
  UNKNOWN    = 'unknown',
}

// Fallback constants for code that imports this directly
export const MOVEMENT_TYPE_FALLBACK = {
  STATIONARY: 'stationary',
  WALKING:    'walking',
  VEHICLE:    'vehicle',
  UNKNOWN:    'unknown',
} as const;

export interface MovementTypeState {
  type: MovementType;
  confidence: number;
  lastUpdated: Date | null;
  isSupported: boolean | null;
  permissionGranted: boolean | null;
  requestPermission: () => Promise<void>;
  details?: {
    vehicleConfidence: number;
    walkingConfidence: number;
    stationaryConfidence: number;
    dominantFrequencies?: number[];
    avgMagnitude?: number;
    frequency?: number;
    diagnostics?: {
      autocorrelation: number;
      jerkScore: number;
      stepRegularity: number;
      horizontalDominance: number;
      avgDynMagnitude: number;
      gpsSpeedKmh?: number;
    };
  };
}

interface MovementTypeDetectionOptions {
  /** Number of raw samples to accumulate before classifying */
  sampleSize?: number;
  /** How often to re-classify (ms) */
  updateInterval?: number;
  /** Minimum confidence to emit a state change */
  minConfidence?: number;
  /** Apply temporal smoothing across several readings */
  temporalSmoothing?: boolean;
  /** Maximum internal buffer size (prevents memory leaks) */
  maxSampleBufferSize?: number;
  /**
   * Optional GPS speed in km/h.
   * When provided this is the STRONGEST signal:
   *   >15 km/h  → VEHICLE with high confidence
   *   <5 km/h   → cannot be in a vehicle
   */
  gpsSpeedKmh?: number;
  /** Use adaptive thresholds for classification */
  adaptiveThresholds?: boolean;
}

interface AccelerationSample {
  magnitude: number;
  timestamp: number;
  x: number;
  y: number;
  z: number;
}

/* ─── Hook ───────────────────────────────────────────────────────────────────── */

export function useMovementTypeDetection(options: MovementTypeDetectionOptions = {}) {
  const {
    sampleSize           = 50,          // ~1.25 s at 40 Hz
    updateInterval       = 1000,
    minConfidence        = 0.40,
    temporalSmoothing    = true,
    maxSampleBufferSize  = 120,
    gpsSpeedKmh,
  } = options;

  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [movementState, setMovementState] = useState<MovementTypeState>({
    type: MovementType.UNKNOWN,
    confidence: 0,
    lastUpdated: null,
    isSupported: null,
    permissionGranted: null,
    requestPermission: async () => {},
  });

  const sampleBuffer     = useRef<AccelerationSample[]>([]);
  const historyBuffer    = useRef<ClassificationResult[]>([]);
  const lastTimestamp    = useRef<number>(0);
  const errorCount       = useRef<number>(0);
  const lastErrorLogTime = useRef<number>(0);

  // Keep gpsSpeedKmh in a ref so the motion event handler can always read the latest value
  const gpsSpeedRef = useRef<number | undefined>(gpsSpeedKmh);
  useEffect(() => { gpsSpeedRef.current = gpsSpeedKmh; }, [gpsSpeedKmh]);

  /* ── iOS permission request ── */
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const DME = DeviceMotionEvent as any;
      if (typeof DME.requestPermission === 'function') {
        const result = await DME.requestPermission();
        const granted = result === 'granted';
        setPermissionGranted(granted);
        setMovementState(prev => ({ ...prev, permissionGranted: granted, requestPermission }));
      } else {
        setPermissionGranted(true);
        setMovementState(prev => ({ ...prev, permissionGranted: true, requestPermission }));
      }
    } catch {
      setPermissionGranted(false);
      setMovementState(prev => ({ ...prev, permissionGranted: false }));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supported = 'DeviceMotionEvent' in window;
    setMovementState(prev => ({
      ...prev, isSupported: supported, requestPermission, permissionGranted,
    }));
    if (!supported) return;

    // Grant permission automatically on non-iOS
    const DME = DeviceMotionEvent as any;
    if (typeof DME.requestPermission !== 'function') {
      setPermissionGranted(true);
      setMovementState(prev => ({ ...prev, permissionGranted: true, requestPermission }));
    }

    /* ── Motion event handler ── */
    const handleMotion = (event: DeviceMotionEvent) => {
      try {
        if (!event?.acceleration) return;
        const { x = 0, y = 0, z = 0 } = event.acceleration as { x: number | null; y: number | null; z: number | null };
        const safeX = x ?? 0, safeY = y ?? 0, safeZ = z ?? 0;

        const now = Date.now();
        // Collect at ~40 Hz
        if (now - lastTimestamp.current < 25) return;
        lastTimestamp.current = now;

        const magnitude = Math.sqrt(safeX * safeX + safeY * safeY + safeZ * safeZ);
        const buf = sampleBuffer.current;

        if (buf.length >= maxSampleBufferSize) buf.shift();
        buf.push({ x: safeX, y: safeY, z: safeZ, magnitude, timestamp: now });
      } catch (err) {
        const now = Date.now();
        if (now - lastErrorLogTime.current > 10_000) {
          console.warn('[movement] Motion event error:', err);
          lastErrorLogTime.current = now;
          errorCount.current += 1;
        }
        // After 5 consecutive errors, give up (avoids infinite loops on broken devices)
        if (errorCount.current > 5) {
          window.removeEventListener('devicemotion', handleMotion);
          setMovementState(prev => ({
            ...prev, isSupported: false, type: MovementType.UNKNOWN, confidence: 0,
          }));
        }
      }
    };

    /* ── Periodic classifier ── */
    const classify = () => {
      const samples = sampleBuffer.current;
      if (samples.length < Math.min(sampleSize / 2, 15)) return;

      try {
        // Pass the current GPS speed (from ref so it's always fresh)
        const raw = enhancedClassifyMovement(samples, gpsSpeedRef.current);

        let result = raw;

        // Temporal smoothing
        if (temporalSmoothing && historyBuffer.current.length >= 2) {
          result = enhancedAnalyzeMovementSequence(historyBuffer.current, raw);
        }

        // Accumulate history (keep last 8 readings)
        historyBuffer.current.push(raw);
        if (historyBuffer.current.length > 8) historyBuffer.current.shift();

        if (result.confidence < minConfidence) return;

        setMovementState(prev => ({
          ...prev,
          type:         result.type,
          confidence:   result.confidence,
          lastUpdated:  new Date(),
          isSupported:  true,
          details: {
            vehicleConfidence:   result.details.vehicleConfidence,
            walkingConfidence:   result.details.walkingConfidence,
            stationaryConfidence: result.details.stationaryConfidence,
            dominantFrequencies: result.details.frequencySignature.dominantFrequencies,
            avgMagnitude:        result.details.diagnostics?.avgDynMagnitude,
            frequency:           result.details.frequencySignature.peakFrequency ?? undefined,
            diagnostics:         result.details.diagnostics,
          },
        }));
      } catch (err) {
        console.warn('[movement] Classification error:', err);
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    const timer = setInterval(classify, updateInterval);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      clearInterval(timer);
    };
  }, [sampleSize, updateInterval, minConfidence, temporalSmoothing, maxSampleBufferSize, requestPermission]);

  return { ...movementState, requestPermission, permissionGranted };
}
