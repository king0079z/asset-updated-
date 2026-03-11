import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from "@/util/supabase/api";

// ── Server-side result cache (5 min TTL) ────────────────────────────────────
const AI_CACHE_TTL = 5 * 60 * 1000;
const aiCache = new Map<string, { data: any; ts: number }>();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.info('Path: /api/ai-analysis');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { session }, error } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (error || !user) {
      console.error('Auth error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ── Cache check (scoped per user) ────────────────────────────────────────
    const cacheKey = `ai_${user.id}`;
    const cached = aiCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < AI_CACHE_TTL) {
      console.info('Path: /api/ai-analysis Returning cached result');
      res.setHeader('Cache-Control', 'private, max-age=180');
      return res.status(200).json(cached.data);
    }

    // Get current date and calculate date ranges
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31);
    
    // Previous periods for comparison
    const startOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const startOfPrevYear = new Date(today.getFullYear() - 1, 0, 1);
    const endOfPrevYear = new Date(today.getFullYear() - 1, 11, 31);

    // ── Lookup user's organizationId for org-scoped queries ─────────────────
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true },
    });
    const organizationId = userRecord?.organizationId ?? null;

    // ── Single parallel block: all queries fire at once ──────────────────────
    const [
      foodConsumptionCurrentMonth,
      foodConsumptionPrevMonth,
      foodConsumptionCurrentYear,
      foodConsumptionPrevYear,
      kitchenConsumption,
      foodCategories,
      allKitchens,
      vehicles,
      totalAssets,
      assetsByType,
      assetValueByType,
      disposedAssets,
      foodSupplies,
    ] = await Promise.all([
      // Narrow kitchen select to avoid circular relation expansion
      prisma.foodConsumption.findMany({
        where: { userId: user.id, date: { gte: startOfMonth, lte: endOfMonth } },
        select: {
          quantity: true,
          kitchenId: true,
          foodSupply: { select: { pricePerUnit: true } },
          kitchen: { select: { id: true, name: true } },
        },
      }),
      prisma.foodConsumption.findMany({
        where: { userId: user.id, date: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
        select: { quantity: true, foodSupply: { select: { pricePerUnit: true } } },
      }),
      prisma.foodConsumption.findMany({
        where: { userId: user.id, date: { gte: startOfYear, lte: endOfYear } },
        select: { quantity: true, foodSupply: { select: { pricePerUnit: true } } },
      }),
      prisma.foodConsumption.findMany({
        where: { userId: user.id, date: { gte: startOfPrevYear, lte: endOfPrevYear } },
        select: { quantity: true, foodSupply: { select: { pricePerUnit: true } } },
      }),
      prisma.foodConsumption.groupBy({
        by: ['kitchenId'],
        where: { userId: user.id, date: { gte: startOfYear, lte: endOfYear } },
        _sum: { quantity: true },
      }),
      prisma.foodSupply.groupBy({
        by: ['category'],
        where: { userId: user.id },
        _count: true,
        _sum: { pricePerUnit: true },
      }),
      // Scope kitchens to organization if available
      prisma.kitchen.findMany({
        where: organizationId ? { organizationId } : {},
        select: { id: true, name: true },
        take: 100,
      }),
      // Scope vehicles to organization
      prisma.vehicle.findMany({
        where: organizationId ? { organizationId } : {},
        select: { id: true, rentalAmount: true, status: true, type: true },
        take: 500,
      }),
      prisma.asset.count({ where: { userId: user.id } }),
      prisma.asset.groupBy({
        by: ['type'],
        where: { userId: user.id },
        _count: true,
      }),
      prisma.asset.groupBy({
        by: ['type'],
        where: { userId: user.id },
        _sum: { purchaseAmount: true },
      }),
      prisma.asset.findMany({
        where: { userId: user.id, status: 'DISPOSED', disposedAt: { gte: startOfYear, lte: endOfYear } },
        select: { id: true, name: true, purchaseAmount: true, disposedAt: true },
      }),
      prisma.foodSupply.findMany({
        where: { userId: user.id },
        select: {
          id: true, name: true, category: true, pricePerUnit: true, unit: true,
          consumption: {
            where: { date: { gte: startOfYear, lte: endOfYear } },
            select: { quantity: true, date: true },
          },
        },
        take: 200,
      }),
    ]);
    // ─────────────────────────────────────────────────────────────────────────

    // Calculate food consumption costs
    const calculateConsumptionCost = (consumptions) =>
      consumptions.reduce((total, item) => total + (item.quantity * (item.foodSupply?.pricePerUnit ?? 0)), 0);

    const currentMonthFoodCost = calculateConsumptionCost(foodConsumptionCurrentMonth);
    const prevMonthFoodCost    = calculateConsumptionCost(foodConsumptionPrevMonth);
    const currentYearFoodCost  = calculateConsumptionCost(foodConsumptionCurrentYear);
    const prevYearFoodCost     = calculateConsumptionCost(foodConsumptionPrevYear);

    const kitchenMap = new Map(allKitchens.map(k => [k.id, k.name]));
    const kitchenConsumptionWithNames = kitchenConsumption.map(k => ({
      kitchenId: k.kitchenId,
      kitchenName: kitchenMap.get(k.kitchenId) ?? 'Unknown Kitchen',
      totalQuantity: k._sum.quantity,
    }));

    // Asset value
    const totalAssetValue = assetValueByType.reduce((total, item) => total + (item._sum.purchaseAmount || 0), 0);

    // Vehicle rental costs
    const currentMonthRentalCost = vehicles.reduce((sum, v) => sum + v.rentalAmount, 0);
    const yearlyRentalCost       = currentMonthRentalCost * 12;
    const currentYearRentalCost  = yearlyRentalCost;
    const prevMonthRentalCost    = currentMonthRentalCost * 0.95;
    const rentalCostByType       = vehicles.reduce((acc, v) => {
      const type = v.type || 'UNKNOWN';
      acc[type] = (acc[type] || 0) + v.rentalAmount;
      return acc;
    }, {});

    // Forecasts
    const monthsElapsedSoFar  = today.getMonth() + 1;
    const monthlyFoodAverage  = currentYearFoodCost / monthsElapsedSoFar;
    const foodForecastMonthly = monthlyFoodAverage;
    const foodForecastYearly  = monthlyFoodAverage * 12;
    const foodTrendPercentage = prevMonthFoodCost > 0
      ? ((currentMonthFoodCost - prevMonthFoodCost) / prevMonthFoodCost) * 100 : 0;

    const monthlyRentalAverage  = currentYearRentalCost / monthsElapsedSoFar;
    const rentalForecastMonthly = monthlyRentalAverage;
    const rentalForecastYearly  = monthlyRentalAverage * 12;
    const rentalTrendPercentage = prevMonthRentalCost > 0
      ? ((currentMonthRentalCost - prevMonthRentalCost) / prevMonthRentalCost) * 100 : 0;

    const totalMonthlyForecast = foodForecastMonthly + rentalForecastMonthly;
    const totalYearlyForecast  = foodForecastYearly + rentalForecastYearly;
    
    // Calculate optimization recommendations for food supplies
    const foodOptimizationData = foodSupplies.map(supply => {
      // Calculate total consumption for this supply
      const totalConsumed = supply.consumption.reduce((sum, consumption) => sum + consumption.quantity, 0);
      
      // Calculate average monthly consumption
      const monthsElapsed = today.getMonth() + 1;
      const avgMonthlyConsumption = totalConsumed / monthsElapsed;
      
      // Calculate optimal monthly quantity (based on usage patterns)
      // If consumption is increasing, we recommend a slight reduction
      // If consumption is stable or decreasing, we maintain or slightly reduce
      const consumptionTrend = supply.consumption.length >= 2 
        ? (supply.consumption[supply.consumption.length - 1].quantity - supply.consumption[0].quantity) / supply.consumption[0].quantity 
        : 0;
      
      let recommendedReduction = 0;
      let optimizationReason = '';
      
      if (consumptionTrend > 0.1) {
        // Consumption is increasing significantly
        recommendedReduction = 0.1; // Recommend 10% reduction
        optimizationReason = 'Increasing consumption trend';
      } else if (avgMonthlyConsumption > 0 && supply.consumption.length > 3) {
        // We have enough data to make a recommendation
        recommendedReduction = 0.05; // Recommend 5% reduction
        optimizationReason = 'Optimization based on usage patterns';
      }
      
      const recommendedMonthlyQty = avgMonthlyConsumption * (1 - recommendedReduction);
      const potentialMonthlySavings = (avgMonthlyConsumption - recommendedMonthlyQty) * supply.pricePerUnit;
      
      return {
        id: supply.id,
        name: supply.name,
        category: supply.category,
        currentMonthlyUsage: avgMonthlyConsumption,
        recommendedMonthlyUsage: recommendedMonthlyQty,
        potentialMonthlySavings,
        potentialYearlySavings: potentialMonthlySavings * 12,
        optimizationReason,
        pricePerUnit: supply.pricePerUnit,
        unit: supply.unit
      };
    })
    // Filter to only include items with meaningful optimization potential
    .filter(item => item.potentialMonthlySavings > 0)
    // Sort by potential savings (highest first)
    .sort((a, b) => b.potentialYearlySavings - a.potentialYearlySavings);
    
    // Calculate total potential savings
    const totalPotentialMonthlySavings = foodOptimizationData.reduce(
      (sum, item) => sum + item.potentialMonthlySavings, 0
    );
    const totalPotentialYearlySavings = totalPotentialMonthlySavings * 12;
    
    // Multi-year forecasting (5 years)
    const inflationRate = 0.03; // Assuming 3% annual inflation
    const costReductionRate = -0.02; // Assuming 2% cost reduction from optimizations
    
    // Calculate combined rate (inflation minus optimization)
    const yearlyGrowthRate = inflationRate + costReductionRate;
    
    // Generate 5-year forecast
    const multiYearForecast = Array.from({ length: 5 }, (_, i) => {
      const year = today.getFullYear() + i + 1;
      // Compound growth formula: FV = PV * (1 + r)^n
      const forecastAmount = totalYearlyForecast * Math.pow(1 + yearlyGrowthRate, i + 1);
      
      return {
        year,
        amount: Number(forecastAmount.toFixed(2)),
        foodAmount: Number((foodForecastYearly * Math.pow(1 + yearlyGrowthRate, i + 1)).toFixed(2)),
        vehicleAmount: Number((rentalForecastYearly * Math.pow(1 + yearlyGrowthRate, i + 1)).toFixed(2))
      };
    });
    
    // Generate recommendations
    const recommendations = [];
    
    // Food recommendations
    if (foodTrendPercentage > 10) {
      recommendations.push({
        category: 'Food Supply',
        severity: 'high',
        message: 'Food consumption costs have increased significantly compared to last month. Consider reviewing kitchen usage patterns and implementing portion control measures.'
      });
    }
    
    // Find the kitchen with highest consumption
    if (kitchenConsumptionWithNames.length > 0) {
      const highestConsumptionKitchen = [...kitchenConsumptionWithNames].sort((a, b) => b.totalQuantity - a.totalQuantity)[0];
      recommendations.push({
        category: 'Kitchen Management',
        severity: 'medium',
        message: `${highestConsumptionKitchen.kitchenName} has the highest consumption rate. Consider auditing this kitchen's usage patterns.`
      });
    }
    
    // Vehicle rental recommendations
    if (rentalTrendPercentage > 15) {
      recommendations.push({
        category: 'Vehicle Rentals',
        severity: 'high',
        message: 'Vehicle rental costs have increased significantly. Consider negotiating better rates with vendors or optimizing vehicle usage schedules.'
      });
    }
    
    // Asset recommendations
    if (disposedAssets.length > 0) {
      const disposedValue = disposedAssets.reduce((total, asset) => total + (asset.purchaseAmount || 0), 0);
      if (disposedValue > totalAssetValue * 0.1) {
        recommendations.push({
          category: 'Asset Management',
          severity: 'medium',
          message: 'A significant value of assets has been disposed this year. Consider implementing better maintenance procedures to extend asset lifespans.'
        });
      }
    }
    
    // General budget recommendation
    recommendations.push({
      category: 'Budget Planning',
      severity: 'info',
      message: `Based on current trends, prepare a monthly budget of approximately $${totalMonthlyForecast.toFixed(2)} for food and vehicle expenses combined.`
    });

    const responsePayload = {
      food: {
        currentMonthCost: Number(currentMonthFoodCost.toFixed(2)),
        prevMonthCost: Number(prevMonthFoodCost.toFixed(2)),
        currentYearCost: Number(currentYearFoodCost.toFixed(2)),
        prevYearCost: Number(prevYearFoodCost.toFixed(2)),
        trendPercentage: Number(foodTrendPercentage.toFixed(2)),
        kitchenConsumption: kitchenConsumptionWithNames,
        categories: foodCategories,
        forecast: {
          monthly: Number(foodForecastMonthly.toFixed(2)),
          yearly: Number(foodForecastYearly.toFixed(2))
        },
        optimization: {
          items: foodOptimizationData.map(item => ({
            id: item.id,
            name: item.name,
            category: item.category,
            currentMonthlyUsage: Number(item.currentMonthlyUsage.toFixed(2)),
            recommendedMonthlyUsage: Number(item.recommendedMonthlyUsage.toFixed(2)),
            potentialMonthlySavings: Number(item.potentialMonthlySavings.toFixed(2)),
            potentialYearlySavings: Number(item.potentialYearlySavings.toFixed(2)),
            optimizationReason: item.optimizationReason,
            pricePerUnit: Number(item.pricePerUnit),
            unit: item.unit
          })),
          totalMonthlySavings: Number(totalPotentialMonthlySavings.toFixed(2)),
          totalYearlySavings: Number(totalPotentialYearlySavings.toFixed(2))
        }
      },
      assets: {
        totalCount: totalAssets,
        byType: assetsByType,
        totalValue: Number(totalAssetValue.toFixed(2)),
        valueByType: assetValueByType,
        disposedAssets: disposedAssets
      },
      vehicles: {
        currentMonthCost: Number(currentMonthRentalCost.toFixed(2)),
        prevMonthCost: Number(prevMonthRentalCost.toFixed(2)),
        currentYearCost: Number(currentYearRentalCost.toFixed(2)),
        costByType: rentalCostByType,
        trendPercentage: Number(rentalTrendPercentage.toFixed(2)),
        forecast: {
          monthly: Number(rentalForecastMonthly.toFixed(2)),
          yearly: Number(rentalForecastYearly.toFixed(2))
        }
      },
      forecast: {
        monthly: Number(totalMonthlyForecast.toFixed(2)),
        yearly: Number(totalYearlyForecast.toFixed(2)),
        multiYear: multiYearForecast,
        currentYear: today.getFullYear()
      },
      recommendations: recommendations,
      insightMetrics: {
        foodTrend: {
          value: Number(foodTrendPercentage.toFixed(2)),
          status: foodTrendPercentage > 5 ? 'negative' : foodTrendPercentage < -5 ? 'positive' : 'neutral'
        },
        vehicleTrend: {
          value: Number(rentalTrendPercentage.toFixed(2)),
          status: rentalTrendPercentage > 5 ? 'negative' : rentalTrendPercentage < -5 ? 'positive' : 'neutral'
        },
        assetUtilization: {
          value: (disposedAssets.length > 0 && totalAssets > 0)
            ? Math.max(0, Math.round((1 - (disposedAssets.length / totalAssets)) * 100))
            : 100,
          status: totalAssets > 0 && disposedAssets.length > totalAssets * 0.1 ? 'negative' : 'positive'
        },
        budgetEfficiency: {
          value: (currentYearFoodCost + currentYearRentalCost) > 0
            ? Number(((totalYearlyForecast / (currentYearFoodCost + currentYearRentalCost)) * 100).toFixed(2))
            : 100,
          status: 'neutral'
        }
      }
    };

    aiCache.set(cacheKey, { data: responsePayload, ts: Date.now() });
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=60');
    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Error generating AI analysis:', error);
    return res.status(500).json({ 
      error: 'Failed to generate AI analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}