// Machine Learning Service for AI Analysis
import { enhancedClassifyMovement, enhancedAnalyzeMovementSequence } from './enhancedMovementClassifier';
import { classifyMovement, analyzeMovementSequence } from './movementClassifier';

// Export enhanced movement detection functions
export {
  enhancedClassifyMovement,
  enhancedAnalyzeMovementSequence,
  classifyMovement,
  analyzeMovementSequence
};
import { FoodConsumption, FoodSupply, Asset, VehicleRental, Kitchen, AssetHistory } from '@prisma/client';

// Types for ML predictions
export interface ConsumptionPrediction {
  predictedQuantity: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  anomalyScore: number;
  seasonalityFactor: number;
}

export interface BudgetPrediction {
  predictedAmount: number;
  confidence: number;
  upperBound: number;
  lowerBound: number;
  riskFactor: number;
}

export interface OptimizationRecommendation {
  recommendedQuantity: number;
  potentialSavings: number;
  confidence: number;
  reasonCode: string;
  implementationDifficulty: 'easy' | 'medium' | 'hard';
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  score: number;
  severity: 'low' | 'medium' | 'high';
  possibleCauses: string[];
}

/**
 * Linear Regression implementation for time series forecasting
 * This is a simple implementation that can be replaced with more sophisticated models
 */
function linearRegression(data: number[], dates: Date[]): { slope: number; intercept: number; r2: number } {
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
  
  // Calculate R-squared (coefficient of determination)
  const predictions = x.map(xi => slope * xi + intercept);
  const totalSumOfSquares = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
  const residualSumOfSquares = y.reduce((sum, yi, i) => sum + Math.pow(yi - predictions[i], 2), 0);
  const r2 = 1 - (residualSumOfSquares / totalSumOfSquares);
  
  return { slope, intercept, r2 };
}

/**
 * Moving Average implementation for smoothing time series data
 */
function movingAverage(data: number[], windowSize: number): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < windowSize - 1) {
      // Not enough data points yet, use available data
      const window = data.slice(0, i + 1);
      result.push(window.reduce((sum, val) => sum + val, 0) / window.length);
    } else {
      // Full window available
      const window = data.slice(i - windowSize + 1, i + 1);
      result.push(window.reduce((sum, val) => sum + val, 0) / windowSize);
    }
  }
  
  return result;
}

/**
 * Detect anomalies using Z-score method
 */
function detectAnomalies(data: number[], threshold = 2.0): number[] {
  // Calculate mean and standard deviation
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);
  
  // Calculate Z-scores
  return data.map(val => Math.abs((val - mean) / (stdDev || 1)) > threshold ? 1 : 0);
}

/**
 * Seasonal decomposition using moving averages
 */
function detectSeasonality(data: number[], period: number): number[] {
  if (data.length < period * 2) {
    // Not enough data for reliable seasonality detection
    return Array(data.length).fill(1);
  }
  
  // Calculate trend using moving average
  const trend = movingAverage(data, period);
  
  // Calculate seasonal component
  const seasonal: number[] = [];
  for (let i = 0; i < data.length; i++) {
    seasonal.push(trend[i] !== 0 ? data[i] / trend[i] : 1);
  }
  
  // Average seasonal factors by position in period
  const avgSeasonalFactors: number[] = Array(period).fill(0);
  const counts: number[] = Array(period).fill(0);
  
  for (let i = 0; i < data.length; i++) {
    const position = i % period;
    avgSeasonalFactors[position] += seasonal[i];
    counts[position]++;
  }
  
  for (let i = 0; i < period; i++) {
    avgSeasonalFactors[i] = counts[i] > 0 ? avgSeasonalFactors[i] / counts[i] : 1;
  }
  
  // Normalize seasonal factors
  const sum = avgSeasonalFactors.reduce((sum, val) => sum + val, 0);
  const normalizedFactors = avgSeasonalFactors.map(val => (val * period) / sum);
  
  // Apply normalized seasonal factors to the data
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    result.push(normalizedFactors[i % period]);
  }
  
  return result;
}

/**
 * Predict future consumption based on historical data
 */
export function predictConsumption(
  consumptions: (FoodConsumption & { foodSupply: FoodSupply })[], 
  daysToPredict = 30
): ConsumptionPrediction {
  // Sort consumptions by date
  const sortedConsumptions = [...consumptions].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // Extract quantities and dates
  const quantities = sortedConsumptions.map(c => c.quantity);
  const dates = sortedConsumptions.map(c => new Date(c.date));
  
  // Check if we have enough data
  if (quantities.length < 3) {
    return {
      predictedQuantity: quantities.length > 0 ? quantities[quantities.length - 1] : 0,
      confidence: 0.5,
      trend: 'stable',
      anomalyScore: 0,
      seasonalityFactor: 1
    };
  }
  
  // Perform linear regression
  const { slope, intercept, r2 } = linearRegression(quantities, dates);
  
  // Detect anomalies
  const anomalies = detectAnomalies(quantities);
  const anomalyScore = anomalies.reduce((sum, val) => sum + val, 0) / anomalies.length;
  
  // Detect seasonality (assuming weekly pattern)
  const seasonalFactors = detectSeasonality(quantities, 7);
  const lastSeasonalFactor = seasonalFactors[seasonalFactors.length - 1];
  
  // Predict future quantity
  const lastDate = dates[dates.length - 1];
  const futureDate = new Date(lastDate);
  futureDate.setDate(futureDate.getDate() + daysToPredict);
  
  const futureDays = futureDate.getTime() / (1000 * 60 * 60 * 24);
  let predictedQuantity = slope * futureDays + intercept;
  
  // Apply seasonal adjustment
  predictedQuantity *= lastSeasonalFactor;
  
  // Ensure prediction is not negative
  predictedQuantity = Math.max(0, predictedQuantity);
  
  // Determine trend
  const trend = slope > 0.01 ? 'increasing' : slope < -0.01 ? 'decreasing' : 'stable';
  
  // Calculate confidence based on R-squared and data points
  const confidence = Math.min(0.95, r2 * (1 - 1 / Math.sqrt(quantities.length)));
  
  return {
    predictedQuantity,
    confidence,
    trend,
    anomalyScore,
    seasonalityFactor: lastSeasonalFactor
  };
}

/**
 * Predict budget based on historical data
 */
import { enhancedBudgetPrediction } from './enhancedPrediction';

export function predictBudget(
  historicalAmounts: number[],
  dates: Date[],
  monthsToPredict = 1
): BudgetPrediction {
  // Use the enhanced budget prediction algorithm for improved accuracy and confidence
  return enhancedBudgetPrediction(historicalAmounts, dates, monthsToPredict);
}

/**
 * Generate optimization recommendations for food supplies
 */
export function generateOptimizationRecommendations(
  supply: FoodSupply & { consumption: FoodConsumption[] }
): OptimizationRecommendation {
  // Extract consumption data
  const consumptions = supply.consumption;
  
  // Sort consumptions by date
  const sortedConsumptions = [...consumptions].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // Extract quantities and dates
  const quantities = sortedConsumptions.map(c => c.quantity);
  const dates = sortedConsumptions.map(c => new Date(c.date));
  
  // Check if we have enough data
  if (quantities.length < 3) {
    return {
      recommendedQuantity: quantities.length > 0 ? quantities[quantities.length - 1] * 0.95 : 0,
      potentialSavings: quantities.length > 0 ? quantities[quantities.length - 1] * 0.05 * supply.pricePerUnit : 0,
      confidence: 0.5,
      reasonCode: 'insufficient_data',
      implementationDifficulty: 'medium'
    };
  }
  
  // Perform linear regression to detect trend
  const { slope, r2 } = linearRegression(quantities, dates);
  
  // Calculate average consumption
  const avgConsumption = quantities.reduce((sum, val) => sum + val, 0) / quantities.length;
  
  // Detect anomalies
  const anomalies = detectAnomalies(quantities);
  const anomalyScore = anomalies.reduce((sum, val) => sum + val, 0) / anomalies.length;
  
  // Detect seasonality
  const seasonalFactors = detectSeasonality(quantities, 7);
  const avgSeasonalFactor = seasonalFactors.reduce((sum, val) => sum + val, 0) / seasonalFactors.length;
  
  // Calculate recommended reduction based on trend and anomalies
  let recommendedReduction = 0;
  let reasonCode = '';
  let implementationDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
  
  if (slope > 0.01) {
    // Increasing trend - higher reduction
    recommendedReduction = 0.1;
    reasonCode = 'increasing_trend';
    implementationDifficulty = 'hard';
  } else if (anomalyScore > 0.2) {
    // High anomaly score - moderate reduction
    recommendedReduction = 0.08;
    reasonCode = 'consumption_spikes';
    implementationDifficulty = 'medium';
  } else if (avgSeasonalFactor > 1.1 || avgSeasonalFactor < 0.9) {
    // Strong seasonality - targeted reduction
    recommendedReduction = 0.07;
    reasonCode = 'seasonal_pattern';
    implementationDifficulty = 'medium';
  } else {
    // Stable consumption - conservative reduction
    recommendedReduction = 0.05;
    reasonCode = 'stable_consumption';
    implementationDifficulty = 'easy';
  }
  
  // Calculate recommended quantity
  const recommendedQuantity = avgConsumption * (1 - recommendedReduction);
  
  // Calculate potential savings
  const potentialSavings = (avgConsumption - recommendedQuantity) * supply.pricePerUnit;
  
  // Calculate confidence based on R-squared and data points
  const confidence = Math.min(0.95, r2 * (1 - 1 / Math.sqrt(quantities.length)));
  
  return {
    recommendedQuantity,
    potentialSavings,
    confidence,
    reasonCode,
    implementationDifficulty
  };
}

/**
 * Detect anomalies in consumption patterns
 */
export function detectConsumptionAnomalies(
  consumptions: FoodConsumption[]
): AnomalyDetectionResult {
  // Sort consumptions by date
  const sortedConsumptions = [...consumptions].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // Extract quantities
  const quantities = sortedConsumptions.map(c => c.quantity);
  
  // Check if we have enough data
  if (quantities.length < 5) {
    return {
      isAnomaly: false,
      score: 0,
      severity: 'low',
      possibleCauses: ['Insufficient data for anomaly detection']
    };
  }
  
  // Calculate mean and standard deviation
  const mean = quantities.reduce((sum, val) => sum + val, 0) / quantities.length;
  const variance = quantities.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / quantities.length;
  const stdDev = Math.sqrt(variance);
  
  // Calculate Z-scores for the last 3 data points
  const recentQuantities = quantities.slice(-3);
  const zScores = recentQuantities.map(val => Math.abs((val - mean) / (stdDev || 1)));
  
  // Calculate average Z-score for recent data
  const avgZScore = zScores.reduce((sum, val) => sum + val, 0) / zScores.length;
  
  // Determine if there's an anomaly
  const isAnomaly = avgZScore > 2.0;
  
  // Determine severity
  let severity: 'low' | 'medium' | 'high' = 'low';
  if (avgZScore > 3.0) {
    severity = 'high';
  } else if (avgZScore > 2.0) {
    severity = 'medium';
  }
  
  // Generate possible causes
  const possibleCauses: string[] = [];
  
  if (isAnomaly) {
    // Check if it's a sudden increase
    if (recentQuantities[recentQuantities.length - 1] > mean) {
      possibleCauses.push('Sudden increase in consumption');
      possibleCauses.push('Possible inventory error or special event');
    } else {
      possibleCauses.push('Sudden decrease in consumption');
      possibleCauses.push('Possible supply shortage or reduced demand');
    }
    
    // Check for seasonality
    const seasonalFactors = detectSeasonality(quantities, 7);
    if (Math.max(...seasonalFactors) / Math.min(...seasonalFactors) > 1.5) {
      possibleCauses.push('Seasonal pattern detected');
    }
  }
  
  return {
    isAnomaly,
    score: avgZScore,
    severity,
    possibleCauses: possibleCauses.length > 0 ? possibleCauses : ['No anomalies detected']
  };
}

/**
 * Generate comprehensive ML analysis for all data
 */
/**
 * Detect kitchen consumption anomalies
 */
export function detectKitchenConsumptionAnomalies(
  kitchenConsumptions: (FoodConsumption & { 
    foodSupply: FoodSupply,
    kitchen: Kitchen 
  })[],
  allConsumptions: FoodConsumption[]
): { 
  kitchenId: string, 
  kitchenName: string, 
  floorNumber: string,
  anomalyScore: number,
  severity: 'low' | 'medium' | 'high',
  details: {
    foodName: string,
    avgConsumption: number,
    kitchenConsumption: number,
    percentageAboveAvg: number,
    unit: string
  }[]
}[] {
  // Group all consumptions by food supply to calculate averages
  const consumptionsBySupply = allConsumptions.reduce((acc, consumption) => {
    const supplyId = consumption.foodSupplyId;
    if (!acc[supplyId]) {
      acc[supplyId] = [];
    }
    acc[supplyId].push(consumption);
    return acc;
  }, {} as Record<string, FoodConsumption[]>);
  
  // Calculate average consumption per food supply
  const avgConsumptionBySupply = Object.entries(consumptionsBySupply).reduce((acc, [supplyId, consumptions]) => {
    const totalQuantity = consumptions.reduce((sum, c) => sum + c.quantity, 0);
    acc[supplyId] = totalQuantity / consumptions.length;
    return acc;
  }, {} as Record<string, number>);
  
  // Group kitchen consumptions by kitchen
  const consumptionsByKitchen = kitchenConsumptions.reduce((acc, consumption) => {
    const kitchenId = consumption.kitchenId;
    if (!acc[kitchenId]) {
      acc[kitchenId] = {
        kitchenId,
        kitchenName: consumption.kitchen.name,
        floorNumber: consumption.kitchen.floorNumber,
        consumptions: []
      };
    }
    acc[kitchenId].consumptions.push(consumption);
    return acc;
  }, {} as Record<string, { 
    kitchenId: string, 
    kitchenName: string, 
    floorNumber: string,
    consumptions: (FoodConsumption & { foodSupply: FoodSupply, kitchen: Kitchen })[] 
  }>);
  
  // Detect anomalies for each kitchen
  const kitchenAnomalies = Object.values(consumptionsByKitchen)
    .map(kitchen => {
      // Group kitchen consumptions by food supply
      const kitchenConsumptionsBySupply = kitchen.consumptions.reduce((acc, consumption) => {
        const supplyId = consumption.foodSupplyId;
        if (!acc[supplyId]) {
          acc[supplyId] = {
            foodName: consumption.foodSupply.name,
            unit: consumption.foodSupply.unit,
            consumptions: []
          };
        }
        acc[supplyId].consumptions.push(consumption);
        return acc;
      }, {} as Record<string, { 
        foodName: string, 
        unit: string,
        consumptions: (FoodConsumption & { foodSupply: FoodSupply, kitchen: Kitchen })[] 
      }>);
      
      // Calculate anomalies for each food supply in this kitchen
      const anomalies = Object.entries(kitchenConsumptionsBySupply)
        .map(([supplyId, supplyData]) => {
          const avgConsumption = avgConsumptionBySupply[supplyId] || 0;
          if (avgConsumption === 0) return null;
          
          const kitchenConsumption = supplyData.consumptions.reduce((sum, c) => sum + c.quantity, 0) / 
            supplyData.consumptions.length;
          
          const percentageAboveAvg = ((kitchenConsumption - avgConsumption) / avgConsumption) * 100;
          
          // Only consider as anomaly if consumption is significantly above average
          if (percentageAboveAvg > 20) {
            return {
              foodName: supplyData.foodName,
              avgConsumption,
              kitchenConsumption,
              percentageAboveAvg,
              unit: supplyData.unit
            };
          }
          return null;
        })
        .filter(Boolean);
      
      if (anomalies.length === 0) return null;
      
      // Calculate overall anomaly score for this kitchen
      const avgPercentageAbove = anomalies.reduce((sum, a) => sum + a.percentageAboveAvg, 0) / anomalies.length;
      
      // Determine severity
      let severity: 'low' | 'medium' | 'high' = 'low';
      if (avgPercentageAbove > 50) {
        severity = 'high';
      } else if (avgPercentageAbove > 30) {
        severity = 'medium';
      }
      
      return {
        kitchenId: kitchen.kitchenId,
        kitchenName: kitchen.kitchenName,
        floorNumber: kitchen.floorNumber,
        anomalyScore: avgPercentageAbove / 100,
        severity,
        details: anomalies
      };
    })
    .filter(Boolean);
  
  return kitchenAnomalies;
}

/**
 * Analyze asset disposals
 */
export function analyzeAssetDisposals(
  assetHistory: (AssetHistory & { 
    asset: Asset 
  })[]
): {
  assetId: string,
  assetName: string,
  disposedAt: Date,
  floorNumber: string,
  roomNumber: string,
  purchaseAmount: number,
  severity: 'low' | 'medium' | 'high'
}[] {
  // Filter for disposal actions
  const disposals = assetHistory
    .filter(history => history.action === 'DISPOSED')
    .map(history => {
      const asset = history.asset;
      const details = history.details as any;
      
      // Determine severity based on purchase amount
      let severity: 'low' | 'medium' | 'high' = 'low';
      if (asset.purchaseAmount > 1000) {
        severity = 'high';
      } else if (asset.purchaseAmount > 500) {
        severity = 'medium';
      }
      
      return {
        assetId: asset.id,
        assetName: asset.name,
        disposedAt: details.disposedAt ? new Date(details.disposedAt) : history.createdAt,
        floorNumber: asset.floorNumber || 'Unknown',
        roomNumber: asset.roomNumber || 'Unknown',
        purchaseAmount: asset.purchaseAmount || 0,
        severity
      };
    });
  
  return disposals;
}

/**
 * Detect floor/room overpurchasing
 */
export function detectLocationOverpurchasing(
  assets: Asset[]
): {
  location: string,
  floorNumber: string,
  roomNumber: string,
  totalAssets: number,
  totalValue: number,
  recentPurchases: number,
  severity: 'low' | 'medium' | 'high'
}[] {
  // Group assets by floor and room
  const assetsByLocation = assets.reduce((acc, asset) => {
    const floorNumber = asset.floorNumber || 'Unknown';
    const roomNumber = asset.roomNumber || 'Unknown';
    const key = `${floorNumber}-${roomNumber}`;
    
    if (!acc[key]) {
      acc[key] = {
        floorNumber,
        roomNumber,
        assets: []
      };
    }
    
    acc[key].assets.push(asset);
    return acc;
  }, {} as Record<string, { 
    floorNumber: string, 
    roomNumber: string, 
    assets: Asset[] 
  }>);
  
  // Calculate metrics for each location
  const locationMetrics = Object.entries(assetsByLocation)
    .map(([key, location]) => {
      const totalAssets = location.assets.length;
      const totalValue = location.assets.reduce((sum, asset) => sum + (asset.purchaseAmount || 0), 0);
      
      // Count recent purchases (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentPurchases = location.assets.filter(asset => {
        return asset.createdAt >= thirtyDaysAgo;
      }).length;
      
      // Calculate average assets per location for comparison
      const avgAssetsPerLocation = assets.length / Object.keys(assetsByLocation).length;
      
      // Determine if this location has significantly more assets than average
      const assetRatio = totalAssets / avgAssetsPerLocation;
      
      // Only flag locations with above average assets and recent purchases
      if (assetRatio > 1.2 && recentPurchases > 0) {
        // Determine severity
        let severity: 'low' | 'medium' | 'high' = 'low';
        if (assetRatio > 2 && recentPurchases > 3) {
          severity = 'high';
        } else if (assetRatio > 1.5 && recentPurchases > 1) {
          severity = 'medium';
        }
        
        return {
          location: `Floor ${location.floorNumber}, Room ${location.roomNumber}`,
          floorNumber: location.floorNumber,
          roomNumber: location.roomNumber,
          totalAssets,
          totalValue,
          recentPurchases,
          severity
        };
      }
      
      return null;
    })
    .filter(Boolean);
  
  return locationMetrics;
}

import { predictVehicleRentalCosts } from './vehicleRentalPrediction';

/**
 * Generate comprehensive ML analysis for all data
 * Enhanced with improved prediction accuracy and data processing
 */
export function generateComprehensiveAnalysis(
  foodConsumptions: (FoodConsumption & { foodSupply: FoodSupply, kitchen?: Kitchen })[],
  foodSupplies: (FoodSupply & { consumption: FoodConsumption[] })[],
  vehicleRentals: any[], // Changed to any to accommodate the vehicle data structure
  assets: Asset[],
  assetHistory: (AssetHistory & { asset: Asset })[] = []
) {
  // Group consumptions by food supply
  const consumptionsBySupply = foodConsumptions.reduce((acc, consumption) => {
    const supplyId = consumption.foodSupplyId;
    if (!acc[supplyId]) {
      acc[supplyId] = [];
    }
    acc[supplyId].push(consumption);
    return acc;
  }, {} as Record<string, (FoodConsumption & { foodSupply: FoodSupply })[]>);
  
  // Generate consumption predictions for each supply
  const consumptionPredictions = Object.entries(consumptionsBySupply).map(([supplyId, consumptions]) => {
    const prediction = predictConsumption(consumptions);
    return {
      supplyId,
      prediction
    };
  });
  
  // Generate optimization recommendations
  const optimizationRecommendations = foodSupplies.map(supply => {
    const recommendation = generateOptimizationRecommendations(supply);
    return {
      supplyId: supply.id,
      supplyName: supply.name,
      category: supply.category,
      recommendation
    };
  });
  
  // Calculate monthly costs for budget prediction
  const monthlyCosts: { date: Date; amount: number }[] = [];
  const vehicleRentalCosts: { date: Date; amount: number }[] = [];
  const today = new Date();
  
  // Go back 12 months
  for (let i = 0; i < 12; i++) {
    const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
    
    // Calculate food costs for this month
    const monthFoodConsumptions = foodConsumptions.filter(c => {
      const date = new Date(c.date);
      return date >= monthStart && date <= monthEnd;
    });
    
    const foodCost = monthFoodConsumptions.reduce((sum, c) => {
      return sum + (c.quantity * c.foodSupply.pricePerUnit);
    }, 0);
    
    // Add to monthly costs
    monthlyCosts.push({
      date: monthStart,
      amount: foodCost
    });
    
    // Calculate vehicle rental costs for this month
    // For vehicle rentals, we need to calculate the total rental amount for each month
    const monthVehicleRentals = vehicleRentals.filter(rental => {
      const startDate = new Date(rental.startDate);
      const endDate = rental.endDate ? new Date(rental.endDate) : new Date();
      return (startDate <= monthEnd && endDate >= monthStart);
    });
    
    const vehicleCost = monthVehicleRentals.reduce((sum, rental) => {
      return sum + (rental.vehicle?.rentalAmount || 0);
    }, 0);
    
    // Add to vehicle rental costs
    vehicleRentalCosts.push({
      date: monthStart,
      amount: vehicleCost
    });
  }
  
  // Sort by date (oldest first)
  monthlyCosts.sort((a, b) => a.date.getTime() - b.date.getTime());
  vehicleRentalCosts.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Get current monthly vehicle rental cost (for specialized prediction)
  const currentMonthlyVehicleRentalCost = vehicleRentals.reduce((sum, rental) => {
    // Only include active rentals
    if (!rental.endDate || new Date(rental.endDate) >= today) {
      return sum + (rental.vehicle?.rentalAmount || 0);
    }
    return sum;
  }, 0);
  
  // Predict budget for next 3 months
  const budgetPredictions = [1, 3, 6].map(months => {
    // Use standard prediction for food costs
    const foodPrediction = predictBudget(
      monthlyCosts.map(c => c.amount),
      monthlyCosts.map(c => c.date),
      months
    );
    
    // Use specialized prediction for vehicle rental costs
    const vehiclePrediction = predictVehicleRentalCosts(
      vehicleRentalCosts.map(c => c.amount),
      vehicleRentalCosts.map(c => c.date),
      currentMonthlyVehicleRentalCost,
      months
    );
    
    // Combine predictions
    const combinedPrediction = {
      predictedAmount: foodPrediction.predictedAmount + vehiclePrediction.predictedAmount,
      // Use weighted average for confidence based on relative amounts
      confidence: 
        (foodPrediction.confidence * foodPrediction.predictedAmount + 
         vehiclePrediction.confidence * vehiclePrediction.predictedAmount) / 
        (foodPrediction.predictedAmount + vehiclePrediction.predictedAmount || 1),
      upperBound: foodPrediction.upperBound + vehiclePrediction.upperBound,
      lowerBound: foodPrediction.lowerBound + vehiclePrediction.lowerBound,
      riskFactor: Math.max(foodPrediction.riskFactor, vehiclePrediction.riskFactor)
    };
    
    return {
      months,
      prediction: combinedPrediction,
      // Include individual category predictions for detailed analysis
      categoryPredictions: {
        food: foodPrediction,
        vehicleRental: vehiclePrediction
      }
    };
  });
  
  // Detect anomalies in recent consumption
  const anomalyDetections = foodSupplies
    .filter(supply => supply.consumption.length > 0)
    .map(supply => {
      const anomalyResult = detectConsumptionAnomalies(supply.consumption);
      return {
        supplyId: supply.id,
        supplyName: supply.name,
        anomalyResult
      };
    })
    .filter(result => result.anomalyResult.isAnomaly);
  
  return {
    consumptionPredictions,
    optimizationRecommendations,
    budgetPredictions,
    anomalyDetections
  };
}