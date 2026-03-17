// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/util/supabase/require-auth';
import { 
  generateComprehensiveAnalysis, 
  detectKitchenConsumptionAnomalies,
  analyzeAssetDisposals,
  detectLocationOverpurchasing
} from '@/lib/ml';
import { logError } from '@/lib/errorLogger';
import { ErrorSeverity } from "@prisma/client";

// ── Server-side result cache ────────────────────────────────────────────────
// ML computation is expensive (multiple Prisma queries + model runs).
// Cache per user for 5 minutes; per-user in-flight map deduplicates concurrent
// requests for the SAME user without leaking data between different users.
const ML_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const mlCache = new Map<string, { data: any; ts: number }>();
const mlInFlightMap = new Map<string, Promise<any>>(); // keyed by user cache key

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.info('Path: /api/ai-analysis/ml-predictions Starting ML predictions generation');
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { user } = auth;
    console.info(`Path: /api/ai-analysis/ml-predictions Processing ML predictions for user: ${user.id}`);

    // ── Server-side cache check (per user — avoids recomputing on every request) ──
    const cacheKey = `ml_${user.id}`;
    const cached = mlCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < ML_CACHE_TTL) {
      console.info('Path: /api/ai-analysis/ml-predictions Returning cached ML result');
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.status(200).json(cached.data);
    }

    // If THIS USER's request is already computing, wait for it (deduplicate per user).
    const existingFlight = mlInFlightMap.get(cacheKey);
    if (existingFlight) {
      console.info('Path: /api/ai-analysis/ml-predictions Waiting for in-flight ML computation (same user)');
      try {
        const data = await existingFlight;
        res.setHeader('Cache-Control', 'private, max-age=300');
        return res.status(200).json(data);
      } catch {
        // In-flight failed — fall through to recompute
      }
    }

    // Get current date and calculate date ranges
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31);

    const since = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const TAKE = 1000; // Lower limit for faster first load; cache makes repeat loads instant

    // Wrap the whole computation so concurrent requests for the SAME user share one Promise.
    const computation = (async () => {
    try {
      console.info('Path: /api/ai-analysis/ml-predictions Fetching data for ML analysis');

      // Get the user's organization for scoping (safe fallback to null)
      let organizationId: string | null = null;
      try {
        const orgRecord = await prisma.user.findUnique({ where: { id: user.id }, select: { organizationId: true } });
        organizationId = orgRecord?.organizationId ?? null;
      } catch { /* non-critical */ }

      const orgFilter = organizationId ? { organizationId } : {};
      const userFilter = { userId: user.id };

      const [foodConsumptions, foodSupplies, vehicleRentals, assets, kitchenConsumptions, assetHistoryRecords] = await Promise.all([
        prisma.foodConsumption.findMany({
          where: { date: { gte: since }, ...orgFilter },
          include: { foodSupply: true },
          take: TAKE,
        }),
        prisma.foodSupply.findMany({
          where: { ...orgFilter },
          include: {
            consumption: {
              where: { date: { gte: since } },
              take: 500,
            }
          },
          take: TAKE,
        }),
        prisma.vehicleRental.findMany({
          where: { startDate: { gte: since }, ...orgFilter },
          include: { vehicle: true },
          take: 500,
        }),
        prisma.asset.findMany({ where: { ...orgFilter }, take: TAKE }),
        prisma.foodConsumption.findMany({
          where: { date: { gte: since }, ...orgFilter },
          include: { foodSupply: true, kitchen: true },
          take: TAKE,
        }),
        prisma.assetHistory.findMany({
          where: { action: 'DISPOSED', createdAt: { gte: since } },
          include: { asset: { select: { id: true, name: true, purchaseAmount: true, floorNumber: true, roomNumber: true, organizationId: true } } },
          take: 500,
        })
      ]);

      console.info(`Path: /api/ai-analysis/ml-predictions Retrieved data: ${foodConsumptions.length} food consumptions, ${foodSupplies.length} food supplies, ${assets.length} assets`);

      // Generate comprehensive ML analysis
      const mlAnalysis = generateComprehensiveAnalysis(
        foodConsumptions,
        foodSupplies,
        vehicleRentals,
        assets,
        assetHistoryRecords
      );

      console.info('Path: /api/ai-analysis/ml-predictions Generated comprehensive ML analysis');
      
      // Log confidence levels of budget predictions
      if (mlAnalysis.budgetPredictions && mlAnalysis.budgetPredictions.length > 0) {
        const avgConfidence = mlAnalysis.budgetPredictions.reduce(
          (sum, pred) => sum + pred.prediction.confidence, 0
        ) / mlAnalysis.budgetPredictions.length;
        
        console.info(`Path: /api/ai-analysis/ml-predictions Budget prediction average confidence: ${(avgConfidence * 100).toFixed(2)}%`);
        
        mlAnalysis.budgetPredictions.forEach(pred => {
          console.info(`Path: /api/ai-analysis/ml-predictions ${pred.months}-month prediction confidence: ${(pred.prediction.confidence * 100).toFixed(2)}%`);
        });
      }

      // Generate kitchen consumption anomalies
      const kitchenAnomalies = detectKitchenConsumptionAnomalies(
        kitchenConsumptions,
        foodConsumptions
      );

      // Analyze asset disposals
      const assetDisposals = analyzeAssetDisposals(assetHistoryRecords);

      // Detect location overpurchasing
      const locationOverpurchasing = detectLocationOverpurchasing(assets);

      console.info(`Path: /api/ai-analysis/ml-predictions Detected ${kitchenAnomalies.length} kitchen anomalies, ${assetDisposals.length} asset disposals, ${locationOverpurchasing.length} location overpurchasing cases`);

      // Generate additional insights based on ML analysis
      const insights = generateInsightsFromMLAnalysis(
        mlAnalysis,
        kitchenAnomalies,
        assetDisposals,
        locationOverpurchasing
      );

      console.info('Path: /api/ai-analysis/ml-predictions Successfully generated ML predictions and insights');

      const result = { mlAnalysis, insights };
      // Store in server-side cache and release in-flight lock
      mlCache.set(cacheKey, { data: result, ts: Date.now() });
      mlInFlightMap.delete(cacheKey);
      return result;
    } catch (dataError) {
      mlInFlightMap.delete(cacheKey);
      console.error('Error fetching or processing data for ML predictions:', dataError);
      await logError({
        message: 'Failed to process data for ML predictions',
        error: dataError instanceof Error ? dataError.message : 'Unknown data processing error',
        context: { userId: user.id, endpoint: '/api/ai-analysis/ml-predictions', timestamp: new Date().toISOString() },
        severity: ErrorSeverity.HIGH
      });
      throw dataError; // rethrow so the outer catch can respond
    }
    })(); // end computation IIFE

    mlInFlightMap.set(cacheKey, computation);

    const ML_TIMEOUT_MS = 9_000; // Under Vercel 10s limit
    let result: any;
    try {
      result = await Promise.race([
        computation,
        new Promise((_, rej) => setTimeout(() => rej(new Error('ML computation timeout')), ML_TIMEOUT_MS))
      ]);
    } catch (timeoutOrError) {
      mlInFlightMap.delete(cacheKey);
      // Use the sentinel "computing" marker that AiAlerts.tsx detects for graceful retry
      const fallback = {
        mlAnalysis: { consumptionPredictions: [], optimizationRecommendations: [], budgetPredictions: [], anomalyDetections: [] },
        _computing: true, // extra flag for client detection
        insights: {
          summary: { title: 'ML Analysis', description: 'Analysis is taking longer than expected.', keyPoints: ['Refresh to try again.'] },
          predictions: { title: 'Predictions', description: '', items: [] },
          optimizations: { title: 'Optimizations', description: '', items: [] },
          anomalies: { title: 'Anomalies', description: '', items: [] },
          budget: { title: 'Budget', description: '', predictions: [] },
          kitchenAnomalies: { title: 'Kitchen Anomalies', description: '', items: [] },
          assetDisposals: { title: 'Asset Disposals', description: '', items: [] },
          locationOverpurchasing: { title: 'Location Overpurchasing', description: '', items: [] }
        }
      };
      res.setHeader('Cache-Control', 'no-store'); // don't cache timeouts
      return res.status(200).json(fallback);
    }
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).json(result);

  } catch (error) {
    console.error('Error generating ML predictions:', error);
    try {
      await logError({
        message: 'Failed to generate ML predictions',
        context: {
          endpoint: '/api/ai-analysis/ml-predictions',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        },
        severity: ErrorSeverity.HIGH
      });
    } catch (_) { /* avoid 500 from logging failure */ }
    // Return 200 with computing sentinel so the client shows a graceful retry state
    const fallback = {
      mlAnalysis: { consumptionPredictions: [], optimizationRecommendations: [], budgetPredictions: [], anomalyDetections: [] },
      _computing: true,
      insights: {
        summary: { title: 'ML Analysis', description: 'Analysis is temporarily unavailable.', keyPoints: ['Try again in a moment.'] },
        predictions: { title: 'Predictions', description: '', items: [] },
        optimizations: { title: 'Optimizations', description: '', items: [] },
        anomalies: { title: 'Anomalies', description: '', items: [] },
        budget: { title: 'Budget', description: '', predictions: [] },
        kitchenAnomalies: { title: 'Kitchen Anomalies', description: '', items: [] },
        assetDisposals: { title: 'Asset Disposals', description: '', items: [] },
        locationOverpurchasing: { title: 'Location Overpurchasing', description: '', items: [] }
      }
    };
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(fallback);
  }
}

/**
 * Generate human-readable insights from ML analysis
 */
function generateInsightsFromMLAnalysis(
  mlAnalysis: any,
  kitchenAnomalies: any[] = [],
  assetDisposals: any[] = [],
  locationOverpurchasing: any[] = []
) {
  const { 
    consumptionPredictions, 
    optimizationRecommendations, 
    budgetPredictions, 
    anomalyDetections 
  } = mlAnalysis;
  
  const insights = {
    summary: {
      title: 'ML Analysis Summary',
      description: 'Machine learning-powered insights based on your historical data',
      keyPoints: [] as string[]
    },
    predictions: {
      title: 'Consumption Predictions',
      description: 'ML-based predictions for future consumption patterns',
      items: [] as any[]
    },
    optimizations: {
      title: 'Smart Optimization Opportunities',
      description: 'Data-driven recommendations for quantity optimization',
      items: [] as any[]
    },
    anomalies: {
      title: 'Detected Anomalies',
      description: 'Unusual patterns detected in your consumption data',
      items: [] as any[]
    },
    budget: {
      title: 'Budget Forecasting',
      description: 'ML-powered budget predictions with confidence intervals',
      predictions: [] as any[]
    },
    kitchenAnomalies: {
      title: 'Kitchen Consumption Anomalies',
      description: 'Kitchens with unusually high consumption patterns',
      items: [] as any[]
    },
    assetDisposals: {
      title: 'Recent Asset Disposals',
      description: 'Recently disposed assets that may require attention',
      items: [] as any[]
    },
    locationOverpurchasing: {
      title: 'Location Overpurchasing',
      description: 'Locations with unusually high asset acquisition rates',
      items: [] as any[]
    }
  };
  
  // Generate summary key points
  if (optimizationRecommendations.length > 0) {
    const totalSavings = optimizationRecommendations.reduce(
      (sum, item) => sum + item.recommendation.potentialSavings * 12, 0
    );
    
    insights.summary.keyPoints.push(
      `Potential annual savings of $${totalSavings.toFixed(2)} identified through ML-powered quantity optimization`
    );
  }
  
  if (budgetPredictions.length > 0) {
    const nextMonthPrediction = budgetPredictions.find(p => p.months === 1);
    if (nextMonthPrediction) {
      insights.summary.keyPoints.push(
        `Next month's budget is predicted to be $${nextMonthPrediction.prediction.predictedAmount.toFixed(2)} with ${(nextMonthPrediction.prediction.confidence * 100).toFixed(0)}% confidence`
      );
    }
  }
  
  if (anomalyDetections.length > 0) {
    insights.summary.keyPoints.push(
      `${anomalyDetections.length} anomalies detected in your consumption patterns that require attention`
    );
  }
  
  // Add default summary if no specific insights
  if (insights.summary.keyPoints.length === 0) {
    insights.summary.keyPoints.push(
      'Machine learning analysis shows stable consumption patterns with no significant anomalies'
    );
  }
  
  // Process consumption predictions
  consumptionPredictions.forEach(prediction => {
    insights.predictions.items.push({
      id: prediction.supplyId,
      predictedQuantity: prediction.prediction.predictedQuantity.toFixed(2),
      confidence: (prediction.prediction.confidence * 100).toFixed(0) + '%',
      trend: prediction.prediction.trend,
      seasonalityFactor: prediction.prediction.seasonalityFactor.toFixed(2)
    });
  });
  
  // Process optimization recommendations
  optimizationRecommendations
    .filter(rec => rec.recommendation.potentialSavings > 0)
    .sort((a, b) => b.recommendation.potentialSavings - a.recommendation.potentialSavings)
    .slice(0, 5) // Top 5 recommendations
    .forEach(rec => {
      insights.optimizations.items.push({
        id: rec.supplyId,
        name: rec.supplyName,
        category: rec.category,
        currentUsage: rec.recommendation.recommendedQuantity / (1 - 0.05), // Approximate current usage
        recommendedUsage: rec.recommendation.recommendedQuantity,
        monthlySavings: rec.recommendation.potentialSavings,
        yearlySavings: rec.recommendation.potentialSavings * 12,
        confidence: (rec.recommendation.confidence * 100).toFixed(0) + '%',
        difficulty: rec.recommendation.implementationDifficulty,
        reason: getReasonDescription(rec.recommendation.reasonCode)
      });
    });
  
  // Process anomaly detections
  anomalyDetections.forEach(anomaly => {
    insights.anomalies.items.push({
      id: anomaly.supplyId,
      name: anomaly.supplyName,
      severity: anomaly.anomalyResult.severity,
      score: anomaly.anomalyResult.score.toFixed(2),
      causes: anomaly.anomalyResult.possibleCauses
    });
  });
  
  // Process budget predictions
  budgetPredictions.forEach(prediction => {
    insights.budget.predictions.push({
      months: prediction.months,
      amount: prediction.prediction.predictedAmount.toFixed(2),
      confidence: (prediction.prediction.confidence * 100).toFixed(0) + '%',
      upperBound: prediction.prediction.upperBound.toFixed(2),
      lowerBound: prediction.prediction.lowerBound.toFixed(2),
      riskFactor: (prediction.prediction.riskFactor * 100).toFixed(0) + '%'
    });
  });
  
  // Process kitchen consumption anomalies
  kitchenAnomalies.forEach(anomaly => {
    insights.kitchenAnomalies.items.push({
      id: anomaly.kitchenId,
      name: anomaly.kitchenName,
      floorNumber: anomaly.floorNumber,
      severity: anomaly.severity,
      anomalyScore: anomaly.anomalyScore.toFixed(2),
      details: anomaly.details.map(detail => ({
        foodName: detail.foodName,
        avgConsumption: typeof detail.avgConsumption === 'number' ? detail.avgConsumption : parseFloat(detail.avgConsumption),
        kitchenConsumption: typeof detail.kitchenConsumption === 'number' ? detail.kitchenConsumption : parseFloat(detail.kitchenConsumption),
        percentageAboveAvg: typeof detail.percentageAboveAvg === 'number' ? detail.percentageAboveAvg.toFixed(0) + '%' : detail.percentageAboveAvg,
        unit: detail.unit
      }))
    });
    
    // Add to summary key points if high severity
    if (anomaly.severity === 'high') {
      insights.summary.keyPoints.push(
        `Kitchen "${anomaly.kitchenName}" on Floor ${anomaly.floorNumber} has unusually high consumption patterns that require attention`
      );
    }
  });
  
  // Process asset disposals
  assetDisposals.forEach(disposal => {
    insights.assetDisposals.items.push({
      id: disposal.assetId,
      name: disposal.assetName,
      disposedAt: disposal.disposedAt,
      floorNumber: disposal.floorNumber,
      roomNumber: disposal.roomNumber,
      purchaseAmount: disposal.purchaseAmount.toFixed(2),
      severity: disposal.severity
    });
    
    // Add to summary key points if high value asset
    if (disposal.severity === 'high') {
      insights.summary.keyPoints.push(
        `High-value asset "${disposal.assetName}" ($${disposal.purchaseAmount.toFixed(2)}) was disposed from Floor ${disposal.floorNumber}, Room ${disposal.roomNumber}`
      );
    }
  });
  
  // Process location overpurchasing
  locationOverpurchasing.forEach(location => {
    insights.locationOverpurchasing.items.push({
      location: location.location,
      floorNumber: location.floorNumber,
      roomNumber: location.roomNumber,
      totalAssets: location.totalAssets,
      totalValue: location.totalValue.toFixed(2),
      recentPurchases: location.recentPurchases,
      severity: location.severity
    });
    
    // Add to summary key points if high severity
    if (location.severity === 'high') {
      insights.summary.keyPoints.push(
        `${location.location} has acquired ${location.recentPurchases} new assets recently, suggesting potential overpurchasing`
      );
    }
  });
  
  return insights;
}

/**
 * Get human-readable description for optimization reason codes
 */
function getReasonDescription(reasonCode: string): string {
  switch (reasonCode) {
    case 'increasing_trend':
      return 'Consumption is increasing rapidly, suggesting potential waste or inefficiency';
    case 'consumption_spikes':
      return 'Irregular consumption spikes detected, indicating potential inventory management issues';
    case 'seasonal_pattern':
      return 'Seasonal consumption pattern identified, allowing for targeted quantity adjustments';
    case 'stable_consumption':
      return 'Stable consumption pattern with opportunity for modest optimization';
    case 'insufficient_data':
      return 'Limited historical data available, conservative optimization recommended';
    default:
      return 'Optimization opportunity based on consumption analysis';
  }
}