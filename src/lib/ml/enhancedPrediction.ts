// Enhanced ML prediction algorithms for improved accuracy and confidence
import { BudgetPrediction } from './index';

/**
 * Enhanced budget prediction with improved accuracy and confidence
 * This implementation uses a more sophisticated approach to time series forecasting
 * with exponential smoothing, outlier detection, and improved confidence interval calculation
 * 
 * The algorithm has been enhanced to provide more accurate predictions by:
 * 1. Using exponential smoothing to reduce noise in the data
 * 2. Detecting and removing outliers using modified Z-score method
 * 3. Applying seasonal adjustments based on detected patterns
 * 4. Using t-distribution for more accurate confidence intervals
 * 5. Calculating prediction variance based on data quality
 */
export function enhancedBudgetPrediction(
  historicalAmounts: number[],
  dates: Date[],
  monthsToPredict = 1
): BudgetPrediction {
  // Check if we have enough data
  if (historicalAmounts.length < 3) {
    return {
      predictedAmount: historicalAmounts.length > 0 ? historicalAmounts[historicalAmounts.length - 1] : 0,
      confidence: 0.5,
      upperBound: historicalAmounts.length > 0 ? historicalAmounts[historicalAmounts.length - 1] * 1.2 : 0,
      lowerBound: historicalAmounts.length > 0 ? historicalAmounts[historicalAmounts.length - 1] * 0.8 : 0,
      riskFactor: 0.5
    };
  }
  
  // Apply exponential smoothing to reduce noise in the data
  const smoothedAmounts = exponentialSmoothing(historicalAmounts, 0.3);
  
  // Perform enhanced linear regression with outlier removal
  const { slope, intercept, r2, adjustedR2, outlierIndices } = enhancedLinearRegression(smoothedAmounts, dates);
  
  // Predict future amount
  const lastDate = dates[dates.length - 1];
  const futureDate = new Date(lastDate);
  futureDate.setMonth(futureDate.getMonth() + monthsToPredict);
  
  const futureDays = futureDate.getTime() / (1000 * 60 * 60 * 24);
  const predictedAmount = Math.max(0, slope * futureDays + intercept);
  
  // Calculate improved confidence based on adjusted R-squared and data quality
  const dataQualityFactor = 1 - (outlierIndices.length / historicalAmounts.length);
  const baseConfidence = Math.min(0.98, adjustedR2 * (1 - 1 / Math.sqrt(historicalAmounts.length - outlierIndices.length)));
  const confidence = baseConfidence * dataQualityFactor;
  
  // Calculate improved standard error for prediction intervals
  const filteredAmounts = historicalAmounts.filter((_, i) => !outlierIndices.includes(i));
  const filteredDates = dates.filter((_, i) => !outlierIndices.includes(i));
  
  const meanX = filteredDates.map(d => d.getTime() / (1000 * 60 * 60 * 24))
    .reduce((sum, val) => sum + val, 0) / filteredDates.length;
  
  const predictions = filteredDates.map(d => {
    const days = d.getTime() / (1000 * 60 * 60 * 24);
    return slope * days + intercept;
  });
  
  const residuals = filteredAmounts.map((val, i) => val - predictions[i]);
  const residualSumOfSquares = residuals.reduce((sum, val) => sum + Math.pow(val, 2), 0);
  const standardError = Math.sqrt(residualSumOfSquares / (filteredAmounts.length - 2));
  
  // Calculate improved prediction interval with t-distribution
  const futureDaysNormalized = futureDays - meanX;
  const sumSquaredDeviations = filteredDates.map(d => d.getTime() / (1000 * 60 * 60 * 24))
    .reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0);
  
  const predictionVariance = standardError * Math.sqrt(1 + 1/filteredAmounts.length + 
    Math.pow(futureDaysNormalized, 2) / sumSquaredDeviations);
  
  // Use t-distribution critical value for more accurate confidence intervals
  // For 95% confidence with degrees of freedom = n-2
  const degreesOfFreedom = filteredAmounts.length - 2;
  const tCritical = getTCriticalValue(degreesOfFreedom);
  
  const marginOfError = tCritical * predictionVariance;
  
  // Apply seasonal adjustment if detected
  const seasonalFactor = detectSeasonality(historicalAmounts);
  const adjustedPrediction = predictedAmount * seasonalFactor;
  
  const upperBound = adjustedPrediction + marginOfError;
  const lowerBound = Math.max(0, adjustedPrediction - marginOfError);
  
  // Calculate improved risk factor based on volatility, trend, and data quality
  const volatility = standardError / (filteredAmounts.reduce((sum, val) => sum + val, 0) / filteredAmounts.length);
  const trendDirection = slope > 0 ? 1 : -1;
  const riskFactor = 0.5 + (volatility * 0.5 * trendDirection) * dataQualityFactor;
  
  return {
    predictedAmount: adjustedPrediction,
    confidence,
    upperBound,
    lowerBound,
    riskFactor: Math.max(0, Math.min(1, riskFactor))
  };
}

/**
 * Enhanced linear regression with outlier detection and removal
 */
function enhancedLinearRegression(data: number[], dates: Date[]): { 
  slope: number; 
  intercept: number; 
  r2: number; 
  adjustedR2: number;
  outlierIndices: number[];
} {
  // Convert dates to numeric values (days since epoch)
  const x = dates.map(d => d.getTime() / (1000 * 60 * 60 * 24));
  const y = data;
  
  const n = x.length;
  
  // Calculate means
  const meanX = x.reduce((sum, val) => sum + val, 0) / n;
  const meanY = y.reduce((sum, val) => sum + val, 0) / n;
  
  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (x[i] - meanX) * (y[i] - meanY);
    denominator += Math.pow(x[i] - meanX, 2);
  }
  
  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;
  
  // Calculate predictions and residuals
  const predictions = x.map(xi => slope * xi + intercept);
  const residuals = y.map((yi, i) => yi - predictions[i]);
  
  // Calculate residual standard deviation for outlier detection
  const residualMean = residuals.reduce((sum, val) => sum + val, 0) / n;
  const residualVariance = residuals.reduce((sum, val) => sum + Math.pow(val - residualMean, 2), 0) / n;
  const residualStdDev = Math.sqrt(residualVariance);
  
  // Detect outliers using modified Z-score method (more robust than standard Z-score)
  const outlierIndices: number[] = [];
  const medianResidual = median(residuals.map(Math.abs));
  
  for (let i = 0; i < n; i++) {
    // Modified Z-score = 0.6745 * (residual - median) / MAD
    // MAD = median absolute deviation
    const modifiedZScore = 0.6745 * Math.abs(residuals[i]) / (medianResidual || 1);
    
    // Consider as outlier if modified Z-score > 3.5
    if (modifiedZScore > 3.5) {
      outlierIndices.push(i);
    }
  }
  
  // Recalculate regression without outliers if outliers were found
  if (outlierIndices.length > 0 && outlierIndices.length < n / 2) {
    const filteredX = x.filter((_, i) => !outlierIndices.includes(i));
    const filteredY = y.filter((_, i) => !outlierIndices.includes(i));
    
    const filteredN = filteredX.length;
    const filteredMeanX = filteredX.reduce((sum, val) => sum + val, 0) / filteredN;
    const filteredMeanY = filteredY.reduce((sum, val) => sum + val, 0) / filteredN;
    
    let filteredNumerator = 0;
    let filteredDenominator = 0;
    
    for (let i = 0; i < filteredN; i++) {
      filteredNumerator += (filteredX[i] - filteredMeanX) * (filteredY[i] - filteredMeanY);
      filteredDenominator += Math.pow(filteredX[i] - filteredMeanX, 2);
    }
    
    const filteredSlope = filteredDenominator !== 0 ? filteredNumerator / filteredDenominator : 0;
    const filteredIntercept = filteredMeanY - filteredSlope * filteredMeanX;
    
    // Recalculate R-squared with filtered data
    const filteredPredictions = filteredX.map(xi => filteredSlope * xi + filteredIntercept);
    const filteredTotalSumOfSquares = filteredY.reduce((sum, yi) => sum + Math.pow(yi - filteredMeanY, 2), 0);
    const filteredResidualSumOfSquares = filteredY.reduce((sum, yi, i) => sum + Math.pow(yi - filteredPredictions[i], 2), 0);
    const filteredR2 = 1 - (filteredResidualSumOfSquares / filteredTotalSumOfSquares);
    
    // Calculate adjusted R-squared
    const adjustedR2 = 1 - ((1 - filteredR2) * (filteredN - 1) / (filteredN - 2));
    
    return { 
      slope: filteredSlope, 
      intercept: filteredIntercept, 
      r2: filteredR2,
      adjustedR2,
      outlierIndices 
    };
  }
  
  // Calculate R-squared (coefficient of determination)
  const totalSumOfSquares = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
  const residualSumOfSquares = y.reduce((sum, yi, i) => sum + Math.pow(yi - predictions[i], 2), 0);
  const r2 = 1 - (residualSumOfSquares / totalSumOfSquares);
  
  // Calculate adjusted R-squared
  const adjustedR2 = 1 - ((1 - r2) * (n - 1) / (n - 2));
  
  return { slope, intercept, r2, adjustedR2, outlierIndices };
}

/**
 * Exponential smoothing to reduce noise in time series data
 */
function exponentialSmoothing(data: number[], alpha: number): number[] {
  if (data.length <= 1) return [...data];
  
  const smoothed: number[] = [data[0]];
  
  for (let i = 1; i < data.length; i++) {
    smoothed.push(alpha * data[i] + (1 - alpha) * smoothed[i - 1]);
  }
  
  return smoothed;
}

/**
 * Calculate median of an array
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  
  return sorted[middle];
}

/**
 * Detect seasonality in time series data
 * Returns a seasonal adjustment factor for the prediction period
 */
function detectSeasonality(data: number[]): number {
  if (data.length < 6) return 1.0; // Not enough data for seasonality detection
  
  // Try to detect monthly seasonality (assuming data points are monthly)
  const monthlyPatterns: number[] = [];
  
  // Calculate average value for each month position
  for (let i = 0; i < 12; i++) {
    const monthValues = data.filter((_, index) => index % 12 === i);
    if (monthValues.length > 0) {
      const avgValue = monthValues.reduce((sum, val) => sum + val, 0) / monthValues.length;
      monthlyPatterns.push(avgValue);
    }
  }
  
  if (monthlyPatterns.length < 2) return 1.0;
  
  // Calculate overall average
  const overallAvg = data.reduce((sum, val) => sum + val, 0) / data.length;
  
  // Calculate seasonal indices
  const seasonalIndices = monthlyPatterns.map(val => val / overallAvg);
  
  // Determine if there's significant seasonality
  const maxIndex = Math.max(...seasonalIndices);
  const minIndex = Math.min(...seasonalIndices);
  
  const seasonalityStrength = maxIndex / minIndex;
  
  // If there's significant seasonality, return the seasonal factor for the next month
  if (seasonalityStrength > 1.1) {
    const nextMonthIndex = data.length % 12;
    return seasonalIndices[nextMonthIndex] || 1.0;
  }
  
  return 1.0; // No significant seasonality detected
}

/**
 * Get t-distribution critical value for given degrees of freedom
 * This is an approximation for 95% confidence interval
 */
function getTCriticalValue(degreesOfFreedom: number): number {
  // Approximation of t-distribution critical values for 95% confidence
  if (degreesOfFreedom <= 1) return 12.71;
  if (degreesOfFreedom <= 2) return 4.30;
  if (degreesOfFreedom <= 3) return 3.18;
  if (degreesOfFreedom <= 4) return 2.78;
  if (degreesOfFreedom <= 5) return 2.57;
  if (degreesOfFreedom <= 6) return 2.45;
  if (degreesOfFreedom <= 7) return 2.36;
  if (degreesOfFreedom <= 8) return 2.31;
  if (degreesOfFreedom <= 9) return 2.26;
  if (degreesOfFreedom <= 10) return 2.23;
  if (degreesOfFreedom <= 15) return 2.13;
  if (degreesOfFreedom <= 20) return 2.09;
  if (degreesOfFreedom <= 30) return 2.04;
  if (degreesOfFreedom <= 60) return 2.00;
  if (degreesOfFreedom <= 120) return 1.98;
  return 1.96; // Approaches z-score for large degrees of freedom
}