/**
 * World-Class Movement Classifier
 * ─────────────────────────────────────────────────────────────────────────────
 * Key algorithm improvements over the previous version:
 *
 * 1. AUTOCORRELATION – the gold standard for step detection.
 *    Walking produces a strong periodic signal at ~500-600 ms (1.7-2.0 Hz).
 *    Vehicle vibration has NO consistent autocorrelation peak in that range.
 *
 * 2. JERK ANALYSIS – walking produces sharp, impulsive jerk spikes at heel-
 *    strike; vehicle travel produces smoother, lower-jerk acceleration.
 *
 * 3. GPS SPEED INTEGRATION – if GPS speed >15 km/h the device is in a vehicle;
 *    if <5 km/h it cannot be moving at vehicle speed.
 *
 * 4. BALANCED BIAS – the old code had 7+ walking-boost multipliers that caused
 *    smooth vehicle travel to be misclassified as walking. All asymmetric boosts
 *    have been replaced with neutral, evidence-based scoring.
 *
 * 5. GRAVITY-CORRECTED MAGNITUDE – because phones are held at different angles
 *    we estimate and remove the static gravity component before analysis.
 */

import { MovementType } from '@/hooks/useMovementTypeDetection';

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface AccelerationSample {
  magnitude: number;
  timestamp: number;
  x: number;
  y: number;
  z: number;
}

export interface FrequencyData {
  peakFrequency: number | null;
  spectralEnergy: number;
  dominantFrequencies: number[];
  spectralCentroid: number;
  walkingSignature?: number;
  vehicleSignature?: number;
}

export interface ClassificationResult {
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

/* ─── Constants ────────────────────────────────────────────────────────────── */

// Walking step period range (seconds): 0.35 s (fast) – 0.80 s (slow)
const STEP_LAG_MIN_MS = 350;
const STEP_LAG_MAX_MS = 800;

// Speed thresholds (km/h)
const VEHICLE_SPEED_KMH = 15;   // above this → definitely vehicle
const WALKING_SPEED_KMH = 5;    // below this → definitely NOT vehicle

/* ─── Helper: remove gravity (low-pass) ───────────────────────────────────── */
function removeDCBias(values: number[]): number[] {
  if (values.length === 0) return values;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return values.map(v => v - mean);
}

/* ─── Helper: clamp to [0,1] ──────────────────────────────────────────────── */
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/* ─── Helper: autocorrelation at a specific lag (index) ──────────────────── */
function autocorrelationAtLag(signal: number[], lag: number): number {
  const n = signal.length - lag;
  if (n <= 0) return 0;
  let num = 0, d1 = 0, d2 = 0;
  for (let i = 0; i < n; i++) {
    num += signal[i] * signal[i + lag];
    d1  += signal[i] * signal[i];
    d2  += signal[i + lag] * signal[i + lag];
  }
  const denom = Math.sqrt(d1 * d2);
  return denom > 0 ? num / denom : 0;
}

/* ─── Helper: peak autocorrelation in step-cadence range ────────────────────
 *  Scans all lags corresponding to 350–800 ms (typical step period) and
 *  returns the maximum normalised autocorrelation found.
 *  Strong peak (>0.35) ⇒ periodic signal ⇒ walking.
 */
function peakAutocorrelationInStepRange(
  signal: number[],
  samples: AccelerationSample[]
): number {
  if (samples.length < 20) return 0;

  const totalDurationMs = samples[samples.length - 1].timestamp - samples[0].timestamp;
  const samplesPerMs = samples.length / totalDurationMs;

  const lagMin = Math.round(STEP_LAG_MIN_MS * samplesPerMs);
  const lagMax = Math.round(STEP_LAG_MAX_MS * samplesPerMs);

  if (lagMin >= lagMax || lagMax >= signal.length) return 0;

  let maxAC = 0;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    const ac = autocorrelationAtLag(signal, lag);
    if (ac > maxAC) maxAC = ac;
  }
  return maxAC;
}

/* ─── Helper: mean jerk magnitude ───────────────────────────────────────────
 *  Jerk = d(acceleration)/dt.  Walking produces impulsive jerk at heel-strike
 *  (high average |jerk|).  Vehicle travel is smoother (lower average |jerk|).
 *
 *  We normalise by the average dynamic magnitude so the score is scale-
 *  invariant.  Returns a value in [0, ∞]; values >1 are strongly impulsive.
 */
function meanNormalisedJerk(
  magnitudes: number[],
  samples: AccelerationSample[]
): number {
  if (samples.length < 4) return 0;
  let jerkSum = 0, count = 0;
  for (let i = 1; i < magnitudes.length; i++) {
    const dt = (samples[i].timestamp - samples[i - 1].timestamp) / 1000; // s
    if (dt <= 0) continue;
    jerkSum += Math.abs(magnitudes[i] - magnitudes[i - 1]) / dt;
    count++;
  }
  const avgMag = magnitudes.reduce((s, v) => s + v, 0) / magnitudes.length;
  return count > 0 && avgMag > 0 ? (jerkSum / count) / (avgMag + 1e-6) : 0;
}

/* ─── Helper: step regularity via zero-crossing period consistency ──────────
 *  Measures how consistent the time between upward zero-crossings is.
 *  CV (coefficient of variation) <0.25 ⇒ very regular ⇒ walking.
 */
function stepRegularityScore(
  signal: number[],
  samples: AccelerationSample[]
): number {
  if (signal.length < 15) return 0;
  const crossingTimes: number[] = [];
  let prevSign = Math.sign(signal[0]);
  for (let i = 1; i < signal.length; i++) {
    const s = Math.sign(signal[i]);
    if (s > 0 && prevSign <= 0) {
      crossingTimes.push(samples[i].timestamp);
    }
    if (s !== 0) prevSign = s;
  }
  if (crossingTimes.length < 3) return 0;
  const intervals: number[] = [];
  for (let i = 1; i < crossingTimes.length; i++) {
    const dt = crossingTimes[i] - crossingTimes[i - 1];
    // Only accept intervals in walking cadence range (350–1000 ms)
    if (dt >= STEP_LAG_MIN_MS && dt <= 1000) intervals.push(dt);
  }
  if (intervals.length < 2) return 0;
  const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
  const variance = intervals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / intervals.length;
  const cv = Math.sqrt(variance) / mean;
  // CV 0 = perfect regularity → 1.0; CV 0.5 = semi-regular → 0.0
  return clamp01(1 - cv / 0.5);
}

/* ─── Helper: horizontal dominance ──────────────────────────────────────────
 *  Vehicle: phone often faces forward, so driving acceleration appears on x/z.
 *  Walking: vertical (y) dominates (gravity axis).
 *  Returns fraction of energy in horizontal axes vs total.
 */
function horizontalDominanceScore(samples: AccelerationSample[]): number {
  let hSum = 0, vSum = 0;
  for (const s of samples) {
    hSum += Math.abs(s.x) + Math.abs(s.z);
    vSum += Math.abs(s.y);
  }
  const total = hSum + vSum;
  return total > 0 ? hSum / total : 0.5;
}

/* ─── Helper: frequency domain (zero-crossing based) ─────────────────────── */
export function analyzeFrequencyDomain(samples: AccelerationSample[]): FrequencyData {
  if (samples.length < 10) {
    return { peakFrequency: null, spectralEnergy: 0, dominantFrequencies: [], spectralCentroid: 0 };
  }

  const duration = (samples[samples.length - 1].timestamp - samples[0].timestamp) / 1000;
  if (duration <= 0) return { peakFrequency: null, spectralEnergy: 0, dominantFrequencies: [], spectralCentroid: 0 };

  const y = removeDCBias(samples.map(s => s.y));
  const x = removeDCBias(samples.map(s => s.x));

  // Zero-crossing count → frequency estimate for each axis
  const countCrossings = (sig: number[]) => {
    let c = 0, prev = Math.sign(sig[0]);
    for (let i = 1; i < sig.length; i++) {
      const cur = Math.sign(sig[i]);
      if (cur !== 0 && prev !== 0 && cur !== prev) c++;
      if (cur !== 0) prev = cur;
    }
    return c;
  };

  const vertFreq  = countCrossings(y) / (2 * duration);
  const horizFreq = countCrossings(x) / (2 * duration);
  const peakFreq  = Math.max(vertFreq, horizFreq);

  const avgMag = samples.reduce((s, v) => s + v.magnitude, 0) / samples.length;
  const varMag = samples.reduce((s, v) => s + Math.pow(v.magnitude - avgMag, 2), 0) / samples.length;
  const spectralEnergy = avgMag * (1 + Math.sqrt(varMag));

  return {
    peakFrequency: peakFreq,
    spectralEnergy,
    dominantFrequencies: [vertFreq, horizFreq].filter(f => f > 0.05),
    spectralCentroid: (vertFreq + horizFreq) / 2,
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
 * Main classifier
 * ══════════════════════════════════════════════════════════════════════════════ */

/**
 * Classify movement type from accelerometer samples.
 * @param samples  Raw accelerometer samples (25–40 Hz for best results)
 * @param gpsSpeedKmh  Optional GPS speed in km/h.  Pass undefined if unavailable.
 */
export function enhancedClassifyMovement(
  samples: AccelerationSample[],
  gpsSpeedKmh?: number
): ClassificationResult {

  const emptyFreq: FrequencyData = {
    peakFrequency: null, spectralEnergy: 0, dominantFrequencies: [], spectralCentroid: 0,
  };

  if (samples.length < 10) {
    return {
      type: MovementType.UNKNOWN, confidence: 0.3,
      details: {
        vehicleConfidence: 0, walkingConfidence: 0, stationaryConfidence: 0,
        frequencySignature: emptyFreq, patternMatches: { vehiclePatternMatch: 0, walkingPatternMatch: 0 },
      },
    };
  }

  /* ── 0. GPS speed override ─────────────────────────────────────────────── */
  if (gpsSpeedKmh !== undefined) {
    if (gpsSpeedKmh >= VEHICLE_SPEED_KMH) {
      // Definitely in a vehicle
      const conf = clamp01(0.85 + (gpsSpeedKmh - VEHICLE_SPEED_KMH) / 100);
      return {
        type: MovementType.VEHICLE, confidence: conf,
        details: {
          vehicleConfidence: conf, walkingConfidence: 0.05, stationaryConfidence: 0.02,
          frequencySignature: emptyFreq,
          patternMatches: { vehiclePatternMatch: conf, walkingPatternMatch: 0.05 },
          diagnostics: { autocorrelation: 0, jerkScore: 0, stepRegularity: 0, horizontalDominance: 0.6, avgDynMagnitude: 0, gpsSpeedKmh },
        },
      };
    }
    if (gpsSpeedKmh < WALKING_SPEED_KMH) {
      // Cannot be in a moving vehicle — only decide walking vs stationary below
    }
  }

  /* ── 1. Compute dynamic magnitude (gravity-removed) ────────────────────── */
  // Estimate gravity by taking a low-pass (running mean over all samples)
  const allMag = samples.map(s => s.magnitude);
  const dynMag: number[] = [];
  // Use the median magnitude as our best gravity estimate
  const sortedMag = [...allMag].sort((a, b) => a - b);
  const medianMag = sortedMag[Math.floor(sortedMag.length / 2)];
  // Dynamic magnitude = deviation from "rest" level
  for (const m of allMag) dynMag.push(Math.abs(m - medianMag));

  const avgDynMagnitude = dynMag.reduce((s, v) => s + v, 0) / dynMag.length;

  /* ── 2. Stationary check ─────────────────────────────────────────────────
   * Very low dynamic magnitude AND low variance → stationary.            */
  const dynVariance = dynMag.reduce((s, v) => s + Math.pow(v - avgDynMagnitude, 2), 0) / dynMag.length;
  const dynStdDev   = Math.sqrt(dynVariance);

  if (avgDynMagnitude < 0.12 && dynStdDev < 0.08) {
    const stConf = clamp01(1 - avgDynMagnitude / 0.12);
    return {
      type: MovementType.STATIONARY, confidence: stConf,
      details: {
        vehicleConfidence: 0.05, walkingConfidence: 0.05, stationaryConfidence: stConf,
        frequencySignature: analyzeFrequencyDomain(samples),
        patternMatches: { vehiclePatternMatch: 0.05, walkingPatternMatch: 0.05 },
        diagnostics: { autocorrelation: 0, jerkScore: 0, stepRegularity: 0, horizontalDominance: 0, avgDynMagnitude },
      },
    };
  }

  /* ── 3. Compute discriminating features ─────────────────────────────────── */

  // 3a. Gravity-corrected vertical signal
  const yDC = removeDCBias(samples.map(s => s.y));

  // 3b. Autocorrelation of vertical signal in step-cadence range
  //     Strong peak → WALKING.  Absent or weak → vehicle/unknown.
  const autoCorr = peakAutocorrelationInStepRange(yDC, samples);

  // 3c. Step regularity via zero-crossing period consistency
  const stepReg = stepRegularityScore(yDC, samples);

  // 3d. Mean normalised jerk
  //     Walking: high (impulsive heel strikes).  Vehicle: low (smooth road).
  const rawJerk = meanNormalisedJerk(dynMag, samples);
  // Typical walking jerk score ~2–6; vehicle ~0.3–1.5
  // Normalise to [0,1] with saturation at 6
  const jerkScore = clamp01(rawJerk / 6);

  // 3e. Horizontal dominance
  const horizDom = horizontalDominanceScore(samples);

  // 3f. Frequency domain
  const freqData = analyzeFrequencyDomain(samples);

  /* ── 4. Score walking & vehicle ──────────────────────────────────────────── */

  /**
   * WALKING score components (equally weighted, each in [0,1]):
   *  - Autocorrelation at step cadence (MOST IMPORTANT)
   *  - Step regularity (zero-crossing consistency)
   *  - Jerk score (impulsive impacts)
   *  - Vertical dominance (y-axis energy)
   *  - Frequency in 1.2–2.5 Hz range
   *
   * VEHICLE score components:
   *  - Low autocorrelation (no regular steps)
   *  - Low jerk (smooth travel)
   *  - Horizontal dominance (forward/lateral acceleration)
   *  - Low frequency (<1.2 Hz) with consistent vibration
   *  - (GPS speed handled in step 0)
   */

  // Walking sub-scores
  const wAuto   = clamp01(autoCorr / 0.4);          // 0.4+ autocorr = strong walking signal
  const wStep   = stepReg;
  const wJerk   = jerkScore;                         // high jerk = walking
  const wVertDom = clamp01(1 - horizDom) * 1.2;     // vertical dominance
  const wFreq   = freqData.peakFrequency !== null
    ? (freqData.peakFrequency >= 1.2 && freqData.peakFrequency <= 2.5
        ? clamp01(1 - Math.pow(Math.abs(freqData.peakFrequency - 1.8) / 1.3, 2))
        : freqData.peakFrequency > 0.8 && freqData.peakFrequency < 3.2 ? 0.4 : 0)
    : 0;

  const walkingScore = clamp01(
    wAuto   * 0.35 +  // autocorrelation is the strongest signal
    wStep   * 0.25 +  // step regularity
    wJerk   * 0.20 +  // jerk (impulsiveness)
    clamp01(wVertDom) * 0.12 +
    wFreq   * 0.08
  );

  // Vehicle sub-scores
  const vNoAuto   = clamp01(1 - autoCorr / 0.25);   // absence of step autocorrelation
  const vNoJerk   = clamp01(1 - rawJerk / 2.5);     // smooth travel
  const vHorizDom = horizDom;                         // horizontal axis dominant
  const vLowFreq  = freqData.peakFrequency !== null
    ? (freqData.peakFrequency < 1.0
        ? clamp01(1 - freqData.peakFrequency / 1.0)
        : 0)
    : 0.3;

  // Sustained vibration consistency (low coefficient of variation in magnitude)
  const vConsistency = avgDynMagnitude > 0.05
    ? clamp01(1 - dynStdDev / (avgDynMagnitude + 1e-6) / 1.5)
    : 0;

  const vehicleScore = clamp01(
    vNoAuto    * 0.30 +
    vNoJerk    * 0.25 +
    vHorizDom  * 0.20 +
    vConsistency * 0.15 +
    vLowFreq   * 0.10
  );

  /* ── 5. GPS speed partial boost (below vehicle threshold) ──────────────── */
  let walkingConf  = walkingScore;
  let vehicleConf  = vehicleScore;

  if (gpsSpeedKmh !== undefined) {
    if (gpsSpeedKmh < WALKING_SPEED_KMH) {
      // Can't be in a vehicle at <5 km/h
      vehicleConf *= 0.2;
      walkingConf = Math.max(walkingConf, 0.4);
    } else if (gpsSpeedKmh < VEHICLE_SPEED_KMH) {
      // Ambiguous range (5–15 km/h): slight vehicle boost proportional to speed
      const speedFrac = (gpsSpeedKmh - WALKING_SPEED_KMH) / (VEHICLE_SPEED_KMH - WALKING_SPEED_KMH);
      vehicleConf = Math.max(vehicleConf, vehicleConf * (1 + speedFrac * 0.4));
    }
  }

  /* ── 6. Stationary check with dynamic magnitude ─────────────────────────── */
  const stationaryConf = avgDynMagnitude < 0.3
    ? clamp01((0.3 - avgDynMagnitude) / 0.3 * 0.9)
    : 0;

  // If stationaryConf is high, suppress both walking and vehicle
  if (stationaryConf > 0.6) {
    walkingConf  *= (1 - stationaryConf);
    vehicleConf  *= (1 - stationaryConf);
  }

  /* ── 7. Final decision ────────────────────────────────────────────────────
   *  Use a clear hierarchy:
   *  1. Stationary (if very confident)
   *  2. Walking (if autocorrelation OR step regularity clearly present)
   *  3. Vehicle (if autocorrelation clearly absent and other signals match)
   *  4. Unknown
   */
  let finalType: MovementType;
  let finalConf: number;

  if (stationaryConf > 0.7 && stationaryConf > walkingConf && stationaryConf > vehicleConf) {
    finalType = MovementType.STATIONARY;
    finalConf = stationaryConf;
  } else if (walkingConf >= vehicleConf && walkingConf > 0.45) {
    finalType = MovementType.WALKING;
    finalConf = walkingConf;
  } else if (vehicleConf >= walkingConf && vehicleConf > 0.45) {
    finalType = MovementType.VEHICLE;
    finalConf = vehicleConf;
  } else if (walkingConf > 0.3 || vehicleConf > 0.3) {
    // Both low but one is marginally higher
    finalType = walkingConf >= vehicleConf ? MovementType.WALKING : MovementType.VEHICLE;
    finalConf = Math.max(walkingConf, vehicleConf);
  } else {
    finalType = MovementType.UNKNOWN;
    finalConf = 0.3;
  }

  finalConf = clamp01(finalConf);

  return {
    type: finalType,
    confidence: finalConf,
    details: {
      vehicleConfidence: vehicleConf,
      walkingConfidence: walkingConf,
      stationaryConfidence: stationaryConf,
      frequencySignature: { ...freqData, walkingSignature: walkingScore, vehicleSignature: vehicleScore },
      patternMatches: { vehiclePatternMatch: vehicleConf, walkingPatternMatch: walkingConf },
      diagnostics: {
        autocorrelation: autoCorr,
        jerkScore,
        stepRegularity: stepReg,
        horizontalDominance: horizDom,
        avgDynMagnitude,
        gpsSpeedKmh,
      },
    },
  };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Temporal smoothing
 * ──────────────────────────────────────────────────────────────────────────────
 * Simple majority-weighted smoothing.  The current reading has the highest
 * weight; older readings decay exponentially.  No more asymmetric walking
 * boosts — vehicle detection is now trusted equally.
 */
export function enhancedAnalyzeMovementSequence(
  history: ClassificationResult[],
  current: ClassificationResult
): ClassificationResult {
  if (history.length < 2) return current;

  const typeCounts: Record<string, number> = {
    [MovementType.VEHICLE]: 0,
    [MovementType.WALKING]: 0,
    [MovementType.STATIONARY]: 0,
    [MovementType.UNKNOWN]: 0,
  };

  // Weight historical classifications (most recent = higher weight)
  history.forEach((c, i) => {
    const posFromEnd = history.length - 1 - i;
    const timeWeight = Math.pow(0.6, posFromEnd); // exponential decay
    typeCounts[c.type] += timeWeight * c.confidence;
  });

  // Current classification gets double weight
  typeCounts[current.type] += 2 * current.confidence;

  // Find dominant type
  const total = Object.values(typeCounts).reduce((s, v) => s + v, 0);
  let dominantType = current.type;
  let maxCount = -1;
  for (const [t, c] of Object.entries(typeCounts)) {
    if (c > maxCount) { maxCount = c; dominantType = t as MovementType; }
  }

  const dominanceRatio = total > 0 ? typeCounts[dominantType] / total : 0;

  // Don't override a high-confidence current classification unless dominance is clear
  if (current.confidence > 0.75 && dominantType !== current.type && dominanceRatio < 0.70) {
    return current;
  }

  // Smooth confidence toward the dominant type
  const smoothedConf = clamp01(current.confidence * 0.6 + dominanceRatio * 0.4);

  return {
    type: dominantType,
    confidence: smoothedConf,
    details: {
      ...current.details,
      vehicleConfidence: dominantType === MovementType.VEHICLE
        ? Math.max(current.details.vehicleConfidence, smoothedConf)
        : current.details.vehicleConfidence * 0.5,
      walkingConfidence: dominantType === MovementType.WALKING
        ? Math.max(current.details.walkingConfidence, smoothedConf)
        : current.details.walkingConfidence * 0.5,
      stationaryConfidence: dominantType === MovementType.STATIONARY
        ? Math.max(current.details.stationaryConfidence, smoothedConf)
        : current.details.stationaryConfidence * 0.5,
    },
  };
}
