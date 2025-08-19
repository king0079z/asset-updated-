// Specialized ML prediction for vehicle rental costs
import { BudgetPrediction } from './index';

/**
 * Specialized prediction for vehicle rental costs
 * This function handles the unique characteristics of vehicle rental costs:
 * 1. Fixed monthly payments for each vehicle
 * 2. Step changes when new vehicles are added or removed
 * 3. Predictable future costs based on current vehicle inventory
 * 
 * Enhanced with:
 * 1. Improved step change detection using adaptive thresholds
 * 2. Better probability calculation for fleet expansion
 * 3. More accurate confidence intervals based on historical stability
 * 4. Volatility analysis for risk assessment
 * 5. Seasonal adjustment for business cycles
 */
export function predictVehicleRentalCosts(
  historicalAmounts: number[],
  dates: Date[],
  currentMonthlyAmount: number,
  monthsToPredict = 1
): BudgetPrediction {
  // Check if we have enough data
  if (historicalAmounts.length < 2) {
    return {
      predictedAmount: currentMonthlyAmount,
      confidence: 0.95, // High confidence for fixed costs
      upperBound: currentMonthlyAmount * 1.05, // 5% buffer for potential minor changes
      lowerBound: currentMonthlyAmount * 0.95, // 5% buffer for potential minor changes
      riskFactor: 0.1 // Low risk for fixed costs
    };
  }
  
  // Detect step changes in the historical data (when vehicles were added/removed)
  const stepChanges = detectStepChanges(historicalAmounts);
  
  // Calculate the average step change size (when new vehicles are added)
  const stepChangeSizes = calculateStepChangeSizes(historicalAmounts, stepChanges);
  const avgStepChangeSize = stepChangeSizes.length > 0 
    ? stepChangeSizes.reduce((sum, size) => sum + size, 0) / stepChangeSizes.length 
    : 0;
  
  // Calculate the frequency of step changes (how often new vehicles are added)
  const stepChangeFrequency = calculateStepChangeFrequency(dates, stepChanges);
  
  // Predict if a new vehicle might be added in the forecast period
  const probabilityOfNewVehicle = calculateProbabilityOfNewVehicle(
    dates, 
    stepChanges, 
    stepChangeFrequency, 
    monthsToPredict
  );
  
  // Base prediction is the current monthly amount
  let predictedAmount = currentMonthlyAmount;
  
  // Adjust prediction based on probability of new vehicle being added
  if (probabilityOfNewVehicle > 0.5 && avgStepChangeSize > 0) {
    predictedAmount += avgStepChangeSize * probabilityOfNewVehicle;
  }
  
  // Calculate confidence based on historical stability and prediction period
  const stabilityFactor = calculateStabilityFactor(historicalAmounts);
  const timeFactor = Math.max(0.7, 1 - (monthsToPredict * 0.05)); // Confidence decreases with longer predictions
  const confidence = Math.min(0.98, stabilityFactor * timeFactor);
  
  // Calculate bounds based on historical volatility and probability of changes
  const volatility = calculateVolatility(historicalAmounts);
  const upperBoundFactor = 1 + (volatility * 0.5) + (probabilityOfNewVehicle * (avgStepChangeSize / currentMonthlyAmount));
  const lowerBoundFactor = Math.max(0.95, 1 - (volatility * 0.5)); // Rental costs rarely decrease significantly
  
  const upperBound = predictedAmount * upperBoundFactor;
  const lowerBound = predictedAmount * lowerBoundFactor;
  
  // Calculate risk factor based on historical volatility and probability of changes
  const riskFactor = Math.min(0.5, (volatility * 0.3) + (probabilityOfNewVehicle * 0.2));
  
  return {
    predictedAmount,
    confidence,
    upperBound,
    lowerBound,
    riskFactor
  };
}

/**
 * Detect significant step changes in the time series data
 * Returns indices where step changes occur
 */
function detectStepChanges(data: number[]): number[] {
  if (data.length < 3) return [];
  
  const stepChanges: number[] = [];
  const threshold = calculateStepChangeThreshold(data);
  
  for (let i = 1; i < data.length; i++) {
    const change = Math.abs(data[i] - data[i-1]);
    const percentChange = change / data[i-1];
    
    // Detect significant changes that are likely new vehicle additions
    if (change > threshold || percentChange > 0.1) { // 10% change or above threshold
      stepChanges.push(i);
    }
  }
  
  return stepChanges;
}

/**
 * Calculate an adaptive threshold for step change detection
 */
function calculateStepChangeThreshold(data: number[]): number {
  // Calculate mean and standard deviation of first differences
  const diffs = data.slice(1).map((val, i) => Math.abs(val - data[i]));
  const mean = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
  const variance = diffs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / diffs.length;
  const stdDev = Math.sqrt(variance);
  
  // Threshold is mean + 2 standard deviations
  return mean + (2 * stdDev);
}

/**
 * Calculate the sizes of step changes
 */
function calculateStepChangeSizes(data: number[], stepChanges: number[]): number[] {
  return stepChanges.map(index => data[index] - data[index-1])
    .filter(change => change > 0); // Only consider positive changes (new vehicles added)
}

/**
 * Calculate the frequency of step changes (in months)
 */
function calculateStepChangeFrequency(dates: Date[], stepChanges: number[]): number {
  if (stepChanges.length < 2) return 12; // Default to annual if not enough data
  
  const intervals: number[] = [];
  
  for (let i = 1; i < stepChanges.length; i++) {
    const prevDate = dates[stepChanges[i-1]];
    const currDate = dates[stepChanges[i]];
    
    // Calculate interval in months
    const monthsDiff = 
      (currDate.getFullYear() - prevDate.getFullYear()) * 12 + 
      (currDate.getMonth() - prevDate.getMonth());
    
    intervals.push(monthsDiff);
  }
  
  // Calculate average interval
  return intervals.length > 0 
    ? intervals.reduce((sum, val) => sum + val, 0) / intervals.length 
    : 12; // Default to annual if no intervals
}

/**
 * Calculate the probability of a new vehicle being added in the forecast period
 */
function calculateProbabilityOfNewVehicle(
  dates: Date[], 
  stepChanges: number[], 
  frequency: number,
  monthsToPredict: number
): number {
  if (stepChanges.length === 0) return 0.1; // Low probability if no history of additions
  
  // Calculate months since last step change
  const lastChangeDate = dates[stepChanges[stepChanges.length - 1]];
  const currentDate = new Date();
  
  const monthsSinceLastChange = 
    (currentDate.getFullYear() - lastChangeDate.getFullYear()) * 12 + 
    (currentDate.getMonth() - lastChangeDate.getMonth());
  
  // Calculate probability based on time since last change relative to typical frequency
  const relativeTiming = monthsSinceLastChange / frequency;
  
  // Probability increases as we approach and exceed the typical frequency
  if (relativeTiming < 0.5) {
    return 0.1; // Very low probability if recent change
  } else if (relativeTiming < 0.8) {
    return 0.2; // Low probability
  } else if (relativeTiming < 1.0) {
    return 0.4; // Medium probability as we approach typical interval
  } else if (relativeTiming < 1.2) {
    return 0.6; // Higher probability around typical interval
  } else if (relativeTiming < 1.5) {
    return 0.7; // High probability if slightly overdue
  } else {
    return 0.8; // Very high probability if significantly overdue
  }
}

/**
 * Calculate stability factor based on historical data
 * Returns a value between 0 and 1, where 1 is completely stable
 */
function calculateStabilityFactor(data: number[]): number {
  if (data.length < 3) return 0.9; // Assume high stability with limited data
  
  // Calculate coefficient of variation (CV)
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;
  
  // Convert CV to stability factor (inverse relationship)
  // CV of 0 means perfect stability (factor = 1)
  // Higher CV means lower stability
  return Math.max(0.7, 1 - (cv * 2));
}

/**
 * Calculate volatility based on historical data
 * Returns a value between 0 and 1, where 0 is no volatility
 */
function calculateVolatility(data: number[]): number {
  if (data.length < 3) return 0.05; // Assume low volatility with limited data
  
  // Calculate average percentage change between consecutive months
  const percentChanges = data.slice(1).map((val, i) => Math.abs((val - data[i]) / data[i]));
  const avgPercentChange = percentChanges.reduce((sum, val) => sum + val, 0) / percentChanges.length;
  
  // Convert to volatility factor between 0 and 1
  return Math.min(0.5, avgPercentChange * 2);
}