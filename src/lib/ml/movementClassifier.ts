// Advanced movement classification using signal processing techniques
// This module provides sophisticated movement pattern analysis

import { MovementType } from '@/hooks/useMovementTypeDetection';

interface AccelerationSample {
  magnitude: number;
  timestamp: number;
  x: number;
  y: number;
  z: number;
}

interface FrequencyData {
  peakFrequency: number | null;
  spectralEnergy: number;
  dominantFrequencies: number[];
  spectralCentroid: number;
}

interface ClassificationResult {
  type: MovementType;
  confidence: number;
  details: {
    vehicleConfidence: number;
    walkingConfidence: number;
    stationaryConfidence: number;
    frequencySignature: FrequencyData;
    patternMatches: {
      vehiclePatternMatch: number;
      walkingPatternMatch: number;
    };
  };
}

// Vehicle movement patterns have specific signatures
const VEHICLE_PATTERNS = [
  // Low frequency vibration pattern (engine idle)
  { minFreq: 0.1, maxFreq: 0.6, minEnergy: 0.4, maxEnergy: 3.5, weight: 0.8 },
  // Medium frequency road vibration pattern
  { minFreq: 0.6, maxFreq: 1.2, minEnergy: 0.8, maxEnergy: 6.0, weight: 0.9 },
  // High frequency bumps/acceleration pattern
  { minFreq: 1.2, maxFreq: 2.5, minEnergy: 1.5, maxEnergy: 10.0, weight: 0.6 },
  // Sustained consistent vibration (highway driving)
  { minFreq: 0.3, maxFreq: 0.9, minEnergy: 1.0, maxEnergy: 4.0, weight: 0.7 },
];

// Walking patterns have specific signatures
const WALKING_PATTERNS = [
  // Slow walking cadence
  { minFreq: 1.2, maxFreq: 1.8, minEnergy: 0.6, maxEnergy: 2.5, weight: 0.8 },
  // Regular walking cadence
  { minFreq: 1.8, maxFreq: 2.2, minEnergy: 0.8, maxEnergy: 3.5, weight: 1.0 },
  // Fast walking/jogging
  { minFreq: 2.2, maxFreq: 3.5, minEnergy: 1.2, maxEnergy: 5.0, weight: 0.7 },
  // Step impact pattern
  { minFreq: 1.5, maxFreq: 2.8, minEnergy: 1.0, maxEnergy: 4.0, weight: 0.9 },
];

/**
 * Analyzes acceleration samples to extract frequency domain features
 */
export function analyzeFrequencyDomain(samples: AccelerationSample[]): FrequencyData {
  if (samples.length < 10) {
    return {
      peakFrequency: null,
      spectralEnergy: 0,
      dominantFrequencies: [],
      spectralCentroid: 0
    };
  }

  // Calculate time differences between samples
  const timeDiffs: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    timeDiffs.push(samples[i].timestamp - samples[i-1].timestamp);
  }

  // Calculate average sampling rate
  const avgTimeDiff = timeDiffs.reduce((sum, val) => sum + val, 0) / timeDiffs.length;
  const samplingRate = 1000 / avgTimeDiff; // Hz

  // Extract vertical acceleration component (most informative for movement type)
  const verticalAcceleration = samples.map(s => s.y);

  // Simple spectral analysis using zero-crossings and amplitude variations
  let zeroCrossings = 0;
  let prevSign = Math.sign(verticalAcceleration[0]);
  let amplitudeSum = 0;
  let dominantFrequencies: number[] = [];
  
  // Find zero crossings to estimate frequency
  for (let i = 1; i < verticalAcceleration.length; i++) {
    const currentSign = Math.sign(verticalAcceleration[i]);
    if (currentSign !== 0 && prevSign !== 0 && currentSign !== prevSign) {
      zeroCrossings++;
    }
    prevSign = currentSign !== 0 ? currentSign : prevSign;
    amplitudeSum += Math.abs(verticalAcceleration[i]);
  }

  // Calculate dominant frequency (Hz)
  const duration = (samples[samples.length-1].timestamp - samples[0].timestamp) / 1000; // seconds
  const dominantFrequency = zeroCrossings / (2 * duration); // Hz
  
  // Calculate spectral energy (simplified)
  const spectralEnergy = amplitudeSum / samples.length;
  
  // Find peaks in the frequency domain (simplified approach)
  // In a real implementation, we would use FFT (Fast Fourier Transform)
  const segments = Math.floor(samples.length / 10);
  for (let i = 0; i < segments; i++) {
    const segmentSamples = samples.slice(i * 10, (i + 1) * 10);
    if (segmentSamples.length < 5) continue;
    
    let segmentZeroCrossings = 0;
    let prevSegSign = Math.sign(segmentSamples[0].y);
    
    for (let j = 1; j < segmentSamples.length; j++) {
      const currentSign = Math.sign(segmentSamples[j].y);
      if (currentSign !== 0 && prevSegSign !== 0 && currentSign !== prevSegSign) {
        segmentZeroCrossings++;
      }
      prevSegSign = currentSign !== 0 ? currentSign : prevSegSign;
    }
    
    const segmentDuration = (segmentSamples[segmentSamples.length-1].timestamp - segmentSamples[0].timestamp) / 1000;
    if (segmentDuration > 0) {
      const segmentFreq = segmentZeroCrossings / (2 * segmentDuration);
      if (segmentFreq > 0) {
        dominantFrequencies.push(segmentFreq);
      }
    }
  }
  
  // Calculate spectral centroid (weighted average of frequencies)
  let freqSum = 0;
  let weightSum = 0;
  for (const freq of dominantFrequencies) {
    const weight = 1; // Equal weight for simplicity
    freqSum += freq * weight;
    weightSum += weight;
  }
  
  const spectralCentroid = weightSum > 0 ? freqSum / weightSum : 0;
  
  return {
    peakFrequency: dominantFrequency,
    spectralEnergy,
    dominantFrequencies: dominantFrequencies.sort((a, b) => b - a).slice(0, 3), // Top 3 frequencies
    spectralCentroid
  };
}

/**
 * Calculates how well the frequency data matches a specific movement pattern
 */
function calculatePatternMatch(
  freqData: FrequencyData, 
  patterns: typeof VEHICLE_PATTERNS | typeof WALKING_PATTERNS
): number {
  if (!freqData.peakFrequency) return 0;
  
  let totalMatch = 0;
  let totalWeight = 0;
  
  for (const pattern of patterns) {
    const { minFreq, maxFreq, minEnergy, maxEnergy, weight } = pattern;
    
    // Check if peak frequency falls within pattern range
    const freqMatch = freqData.peakFrequency >= minFreq && freqData.peakFrequency <= maxFreq
      ? 1 - Math.min(1, Math.abs(freqData.peakFrequency - (minFreq + maxFreq) / 2) / ((maxFreq - minFreq) / 2))
      : 0;
    
    // Check if energy falls within pattern range
    const energyMatch = freqData.spectralEnergy >= minEnergy && freqData.spectralEnergy <= maxEnergy
      ? 1 - Math.min(1, Math.abs(freqData.spectralEnergy - (minEnergy + maxEnergy) / 2) / ((maxEnergy - minEnergy) / 2))
      : 0;
    
    // Combined match for this pattern
    const patternMatch = (freqMatch * 0.7) + (energyMatch * 0.3);
    totalMatch += patternMatch * weight;
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? totalMatch / totalWeight : 0;
}

/**
 * Advanced movement classification using frequency domain analysis
 */
export function classifyMovement(samples: AccelerationSample[]): ClassificationResult {
  // Extract frequency domain features
  const frequencyData = analyzeFrequencyDomain(samples);
  
  // Calculate pattern matches
  const vehiclePatternMatch = calculatePatternMatch(frequencyData, VEHICLE_PATTERNS);
  const walkingPatternMatch = calculatePatternMatch(frequencyData, WALKING_PATTERNS);
  
  // Calculate confidence scores for each movement type
  let vehicleConfidence = vehiclePatternMatch;
  let walkingConfidence = walkingPatternMatch;
  let stationaryConfidence = 0;
  
  // Calculate average magnitude to detect stationary state
  const avgMagnitude = samples.reduce((sum, s) => sum + s.magnitude, 0) / samples.length;
  if (avgMagnitude < 0.3) { // Very low movement
    stationaryConfidence = 1 - Math.min(1, avgMagnitude / 0.3);
  }
  
  // Determine the most likely movement type
  let type: MovementType;
  let confidence: number;
  
  if (stationaryConfidence > 0.8) {
    type = MovementType.STATIONARY;
    confidence = stationaryConfidence;
  } else if (vehicleConfidence > walkingConfidence && vehicleConfidence > 0.6) {
    type = MovementType.VEHICLE;
    confidence = vehicleConfidence;
  } else if (walkingConfidence > 0.6) {
    type = MovementType.WALKING;
    confidence = walkingConfidence;
  } else {
    type = MovementType.UNKNOWN;
    confidence = 0.3; // Low confidence when we can't determine
  }
  
  return {
    type,
    confidence,
    details: {
      vehicleConfidence,
      walkingConfidence,
      stationaryConfidence,
      frequencySignature: frequencyData,
      patternMatches: {
        vehiclePatternMatch,
        walkingPatternMatch
      }
    }
  };
}

/**
 * Analyzes a sequence of movement classifications to improve accuracy
 * through temporal consistency
 */
export function analyzeMovementSequence(
  recentClassifications: ClassificationResult[],
  currentClassification: ClassificationResult
): ClassificationResult {
  if (recentClassifications.length < 3) {
    return currentClassification;
  }
  
  // Count occurrences of each movement type
  const typeCounts = {
    [MovementType.VEHICLE]: 0,
    [MovementType.WALKING]: 0,
    [MovementType.STATIONARY]: 0,
    [MovementType.UNKNOWN]: 0
  };
  
  // Calculate weighted counts (more recent = higher weight)
  recentClassifications.forEach((classification, index) => {
    const weight = (index + 1) / recentClassifications.length;
    typeCounts[classification.type] += weight;
  });
  
  // Add current classification with highest weight
  typeCounts[currentClassification.type] += 1;
  
  // Find the dominant movement type
  let dominantType = MovementType.UNKNOWN;
  let maxCount = 0;
  
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantType = type as MovementType;
    }
  }
  
  // If current classification differs from dominant type but dominant is strong,
  // adjust the classification for temporal consistency
  if (dominantType !== currentClassification.type && 
      typeCounts[dominantType] > (recentClassifications.length + 1) * 0.6) {
    
    // Calculate adjusted confidence
    const adjustedConfidence = Math.min(
      0.95,
      currentClassification.confidence * 0.3 + 
      (typeCounts[dominantType] / (recentClassifications.length + 1)) * 0.7
    );
    
    return {
      type: dominantType,
      confidence: adjustedConfidence,
      details: {
        ...currentClassification.details,
        // Adjust individual confidences based on temporal analysis
        vehicleConfidence: dominantType === MovementType.VEHICLE 
          ? Math.max(currentClassification.details.vehicleConfidence, adjustedConfidence)
          : currentClassification.details.vehicleConfidence * 0.7,
        walkingConfidence: dominantType === MovementType.WALKING
          ? Math.max(currentClassification.details.walkingConfidence, adjustedConfidence)
          : currentClassification.details.walkingConfidence * 0.7,
        stationaryConfidence: dominantType === MovementType.STATIONARY
          ? Math.max(currentClassification.details.stationaryConfidence, adjustedConfidence)
          : currentClassification.details.stationaryConfidence * 0.7
      }
    };
  }
  
  return currentClassification;
}