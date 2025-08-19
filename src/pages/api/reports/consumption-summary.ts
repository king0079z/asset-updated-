import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Supabase client for authentication
    const supabase = createClient(req, res);
    
    // Get user session
    const { data: { session } } = await supabase.auth.getSession();
    
    // Check if user is authenticated
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get current date
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const oneYearAgo = new Date(currentDate);
    oneYearAgo.setFullYear(currentYear - 1);

    // Fetch asset data
    const assets = await prisma.asset.findMany({
      where: {
        createdAt: {
          gte: oneYearAgo
        }
      },
      select: {
        id: true,
        purchaseAmount: true,
        createdAt: true
      }
    });

    // Fetch food supply consumption data (direct consumption)
    const foodConsumption = await prisma.foodConsumption.findMany({
      where: {
        createdAt: {
          gte: oneYearAgo
        }
      },
      select: {
        id: true,
        quantity: true,
        createdAt: true,
        foodSupply: {
          select: {
            pricePerUnit: true
          }
        }
      }
    });

    // Fetch recipe usage data (servings, cost, waste)
    const recipeUsages = await prisma.recipeUsage.findMany({
      where: {
        createdAt: {
          gte: oneYearAgo
        }
      },
      select: {
        id: true,
        cost: true,
        waste: true,
        createdAt: true
      }
    });

    // Fetch vehicle rental costs
    const vehicles = await prisma.vehicle.findMany({
      select: {
        id: true,
        rentalAmount: true,
        createdAt: true
      }
    });

    // Calculate total spent for assets
    const assetTotalSpent = assets.reduce((total, asset) => {
      return total + (asset.purchaseAmount || 0);
    }, 0);

    // Calculate total spent for food (direct consumption)
    const directFoodConsumptionCost = foodConsumption.reduce((total, consumption) => {
      const price = consumption.foodSupply?.pricePerUnit || 0;
      const quantity = consumption.quantity || 0;
      return total + (price * quantity);
    }, 0);

    // Calculate total spent for food (recipe usage)
    const recipeUsageCost = recipeUsages.reduce((total, usage) => total + (usage.cost || 0), 0);

    // Calculate total waste for food (recipe usage)
    const recipeUsageWaste = recipeUsages.reduce((total, usage) => total + (usage.waste || 0), 0);

    // Calculate total spent for food (all sources)
    const foodTotalSpent = directFoodConsumptionCost + recipeUsageCost;

    // Calculate total spent for vehicles (annual rental costs)
    const vehicleTotalSpent = vehicles.reduce((total, vehicle) => {
      return total + (vehicle.rentalAmount || 0) * 12; // Monthly rental * 12 for annual
    }, 0);

    // Group asset purchases by month
    const assetMonthlyData = groupByMonth(assets, (asset) => asset.purchaseAmount || 0);
    
    // Group food consumption by month (direct consumption)
    const foodMonthlyDataDirect = groupByMonth(foodConsumption, (consumption) => {
      const price = consumption.foodSupply?.pricePerUnit || 0;
      const quantity = consumption.quantity || 0;
      return price * quantity;
    });

    // Group recipe usage by month (cost)
    const foodMonthlyDataRecipe = groupByMonth(recipeUsages, (usage) => usage.cost || 0);

    // Merge monthly data for food (direct + recipe usage)
    const foodMonthlyDataMap: Record<string, number> = {};
    foodMonthlyDataDirect.forEach(item => {
      foodMonthlyDataMap[item.month] = (foodMonthlyDataMap[item.month] || 0) + item.amount;
    });
    foodMonthlyDataRecipe.forEach(item => {
      foodMonthlyDataMap[item.month] = (foodMonthlyDataMap[item.month] || 0) + item.amount;
    });
    const foodMonthlyData = Object.entries(foodMonthlyDataMap).map(([month, amount]) => ({
      month,
      amount
    }));
    
    // Group vehicle costs by month (divide annual by 12 for monthly)
    const vehicleMonthlyData = vehicles.map(vehicle => {
      const monthlyRental = (vehicle.rentalAmount || 0);
      return {
        month: new Date().toISOString().substring(0, 7), // Current month
        amount: monthlyRental
      };
    });

    // Calculate monthly averages
    const assetMonthlyAverage = calculateMonthlyAverage(assetMonthlyData);
    const foodMonthlyAverage = calculateMonthlyAverage(foodMonthlyData);
    const vehicleMonthlyAverage = vehicles.reduce((total, vehicle) => {
      return total + (vehicle.rentalAmount || 0);
    }, 0);

    // Calculate yearly projections
    const assetYearlyProjection = assetMonthlyAverage * 12;
    const foodYearlyProjection = foodMonthlyAverage * 12;
    const vehicleYearlyProjection = vehicleMonthlyAverage * 12;

    // Calculate waste percent for food
    const foodWastePercent = foodTotalSpent > 0 ? (recipeUsageWaste / foodTotalSpent) * 100 : 0;

    // Calculate growth rates based on historical data
    const assetGrowthRate = calculateGrowthRate(assetMonthlyData, 5); // 5% default if not enough data
    const foodGrowthRate = calculateGrowthRate(foodMonthlyData, 8); // 8% default if not enough data
    const vehicleGrowthRate = 3; // Assuming 3% annual growth for vehicles

    // Calculate forecasts for next 3 years
    const assetForecasts = calculateForecasts(assetYearlyProjection, assetGrowthRate);
    const foodForecasts = calculateForecasts(foodYearlyProjection, foodGrowthRate);
    const vehicleForecasts = calculateForecasts(vehicleYearlyProjection, vehicleGrowthRate);

    // Prepare response data
    const consumptionData = [
      {
        category: "Assets",
        totalSpent: assetTotalSpent,
        monthlyAverage: assetMonthlyAverage,
        yearlyProjection: assetYearlyProjection,
        nextYearForecast: assetForecasts.nextYear,
        twoYearForecast: assetForecasts.twoYears,
        threeYearForecast: assetForecasts.threeYears,
        monthlyData: assetMonthlyData
      },
      {
        category: "Food",
        totalSpent: foodTotalSpent,
        monthlyAverage: foodMonthlyAverage,
        yearlyProjection: foodYearlyProjection,
        nextYearForecast: foodForecasts.nextYear,
        twoYearForecast: foodForecasts.twoYears,
        threeYearForecast: foodForecasts.threeYears,
        monthlyData: foodMonthlyData,
        totalWaste: recipeUsageWaste,
        wastePercent: foodWastePercent
      },
      {
        category: "Vehicles",
        totalSpent: vehicleTotalSpent,
        monthlyAverage: vehicleMonthlyAverage,
        yearlyProjection: vehicleYearlyProjection,
        nextYearForecast: vehicleForecasts.nextYear,
        twoYearForecast: vehicleForecasts.twoYears,
        threeYearForecast: vehicleForecasts.threeYears,
        monthlyData: vehicleMonthlyData
      }
    ];

    return res.status(200).json(consumptionData);
  } catch (error) {
    console.error('Error generating consumption summary:', error);
    return res.status(500).json({ error: 'Failed to generate consumption summary' });
  }
}

// Helper function to group data by month
function groupByMonth<T>(items: T[], valueExtractor: (item: T) => number): { month: string; amount: number }[] {
  const monthlyData: Record<string, number> = {};
  
  items.forEach(item => {
    const createdAt = (item as any).createdAt;
    if (!createdAt) return;
    
    const date = new Date(createdAt);
    const monthKey = date.toISOString().substring(0, 7); // YYYY-MM format
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = 0;
    }
    
    monthlyData[monthKey] += valueExtractor(item);
  });
  
  // Convert to array format
  return Object.entries(monthlyData).map(([month, amount]) => ({
    month,
    amount
  }));
}

// Helper function to calculate monthly average
function calculateMonthlyAverage(monthlyData: { month: string; amount: number }[]): number {
  if (monthlyData.length === 0) return 0;
  
  const totalAmount = monthlyData.reduce((sum, data) => sum + data.amount, 0);
  return totalAmount / monthlyData.length;
}

// Helper function to calculate growth rate based on historical data
function calculateGrowthRate(monthlyData: { month: string; amount: number }[], defaultRate: number): number {
  if (monthlyData.length < 3) return defaultRate;
  
  // Sort data by month
  const sortedData = [...monthlyData].sort((a, b) => a.month.localeCompare(b.month));
  
  // Calculate average growth rate over available months
  let totalGrowthRate = 0;
  let growthRateCount = 0;
  
  for (let i = 1; i < sortedData.length; i++) {
    const prevAmount = sortedData[i-1].amount;
    const currentAmount = sortedData[i].amount;
    
    if (prevAmount > 0) {
      const monthlyGrowthRate = ((currentAmount - prevAmount) / prevAmount) * 100;
      totalGrowthRate += monthlyGrowthRate;
      growthRateCount++;
    }
  }
  
  // Calculate average monthly growth rate
  const avgMonthlyGrowthRate = growthRateCount > 0 ? totalGrowthRate / growthRateCount : defaultRate;
  
  // Convert to annual growth rate (compound)
  const annualGrowthRate = Math.pow(1 + (avgMonthlyGrowthRate / 100), 12) - 1;
  
  // Cap growth rate between 1% and 20% to avoid unrealistic forecasts
  return Math.max(1, Math.min(20, annualGrowthRate * 100));
}

// Helper function to calculate forecasts for next 3 years
function calculateForecasts(yearlyProjection: number, growthRate: number): { 
  nextYear: number; 
  twoYears: number; 
  threeYears: number; 
} {
  const growthFactor = 1 + (growthRate / 100);
  
  return {
    nextYear: yearlyProjection * growthFactor,
    twoYears: yearlyProjection * Math.pow(growthFactor, 2),
    threeYears: yearlyProjection * Math.pow(growthFactor, 3)
  };
}