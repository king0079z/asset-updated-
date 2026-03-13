// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { isAdminOrManager } from '@/util/roleCheck';

// Type definitions for the response
interface KitchenConsumption {
  id: string;
  name: string;
  totalConsumed: number;
  totalWasted: number;
  wastePercentage: number;
  consumptionTrend: number;
  mostConsumedItems: {
    name: string;
    quantity: number;
    unit: string;
  }[];
  mostWastedItems: {
    name: string;
    quantity: number;
    unit: string;
    reason: string;
  }[];
  costData: {
    totalCost: number;
    wasteCost: number;
    savingsOpportunity: number;
  };
}

interface ConsumptionSummary {
  totalConsumed: number;
  totalWasted: number;
  overallWastePercentage: number;
  totalCost: number;
  totalWasteCost: number;
  potentialSavings: number;
  topWasteReasons: {
    reason: string;
    percentage: number;
    cost: number;
  }[];
  periodComparison: {
    currentPeriodConsumption: number;
    previousPeriodConsumption: number;
    percentageChange: number;
    currentPeriodWaste: number;
    previousPeriodWaste: number;
    wastePercentageChange: number;
  };
}

interface ConsumptionResponse {
  kitchens: KitchenConsumption[];
  summary: ConsumptionSummary;
  metadata: {
    startDate: string;
    endDate: string;
    generatedAt: string;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get the time range from query parameters (default to 30 days)
    const days = parseInt(req.query.days as string) || 30;
    
    // Calculate date ranges
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // For period comparison, calculate previous period
    const previousPeriodEndDate = new Date(startDate);
    const previousPeriodStartDate = new Date(startDate);
    previousPeriodStartDate.setDate(previousPeriodStartDate.getDate() - days);

    // Check if user is admin or manager
    const userIsAdminOrManager = await isAdminOrManager(user.id);
    
    // Check if user has access to food supply page
    const userPermissions = await prisma.user.findUnique({
      where: { id: user.id },
      select: { pageAccess: true }
    });
    
    const hasFoodSupplyAccess = userPermissions?.pageAccess && 
      (userPermissions.pageAccess['/food-supply'] === true);
    
    // Get all kitchens
    const kitchens = await prisma.kitchen.findMany();
    
    // Initialize response object
    const response: ConsumptionResponse = {
      kitchens: [],
      summary: {
        totalConsumed: 0,
        totalWasted: 0,
        overallWastePercentage: 0,
        totalCost: 0,
        totalWasteCost: 0,
        potentialSavings: 0,
        topWasteReasons: [],
        periodComparison: {
          currentPeriodConsumption: 0,
          previousPeriodConsumption: 0,
          percentageChange: 0,
          currentPeriodWaste: 0,
          previousPeriodWaste: 0,
          wastePercentageChange: 0
        }
      },
      metadata: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        generatedAt: new Date().toISOString()
      }
    };

    // Get consumption data for current period
    const consumptions = await prisma.foodConsumption.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        },
        ...(userIsAdminOrManager || hasFoodSupplyAccess ? {} : { userId: user.id })
      },
      include: {
        kitchen: {
          select: {
            id: true,
            name: true
          }
        },
        foodSupply: {
          select: {
            name: true,
            unit: true,
            pricePerUnit: true
          }
        }
      }
    });

    // Get waste data for current period
    const wasteRecords = await prisma.foodDisposal.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        ...(userIsAdminOrManager || hasFoodSupplyAccess ? {} : { userId: user.id })
      },
      include: {
        foodSupply: {
          select: {
            name: true,
            unit: true,
            pricePerUnit: true
          }
        }
      }
    });
    
    // Get expired items for current period (to include in waste calculation)
    const expiredItems = await prisma.foodSupply.findMany({
      where: {
        expirationDate: {
          gte: startDate,
          lte: endDate
        },
        ...(userIsAdminOrManager || hasFoodSupplyAccess ? {} : { userId: user.id })
      },
      select: {
        id: true,
        name: true,
        quantity: true,
        unit: true,
        pricePerUnit: true
      }
    });
    
    // Create waste records for expired items
    const expiredItemsAsWaste = expiredItems.map(item => ({
      quantity: item.quantity,
      reason: 'expired',
      foodSupply: {
        name: item.name,
        unit: item.unit,
        pricePerUnit: item.pricePerUnit
      }
    }));
    
    // Combine regular waste records with expired items
    const allWasteRecords = [...wasteRecords, ...expiredItemsAsWaste];

    // Get consumption data for previous period
    const previousConsumptions = await prisma.foodConsumption.findMany({
      where: {
        date: {
          gte: previousPeriodStartDate,
          lte: previousPeriodEndDate
        },
        ...(userIsAdminOrManager || hasFoodSupplyAccess ? {} : { userId: user.id })
      }
    });

    // Get waste data for previous period
    const previousWasteRecords = await prisma.foodDisposal.findMany({
      where: {
        createdAt: {
          gte: previousPeriodStartDate,
          lte: previousPeriodEndDate
        },
        ...(userIsAdminOrManager || hasFoodSupplyAccess ? {} : { userId: user.id })
      }
    });

    // Get expired items for previous period
    const previousExpiredItems = await prisma.foodSupply.findMany({
      where: {
        expirationDate: {
          gte: previousPeriodStartDate,
          lte: previousPeriodEndDate
        },
        ...(userIsAdminOrManager || hasFoodSupplyAccess ? {} : { userId: user.id })
      },
      select: {
        quantity: true
      }
    });
    
    // Calculate previous period totals
    const previousPeriodConsumption = previousConsumptions.reduce((sum, item) => sum + item.quantity, 0);
    const previousPeriodWaste = previousWasteRecords.reduce((sum, item) => sum + item.quantity, 0) + 
                               previousExpiredItems.reduce((sum, item) => sum + item.quantity, 0);

    // --- ENHANCED: Process data for each kitchen, including per-day and per-month breakdowns ---
    // Get all recipe usages for the period (for all kitchens)
    const recipeUsages = await prisma.recipeUsage.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        ...(userIsAdminOrManager || hasFoodSupplyAccess ? {} : { userId: user.id })
      },
      include: {
        recipe: {
          select: {
            name: true,
            isSubrecipe: true
          }
        }
      }
    });

    for (const kitchen of kitchens) {
      // Filter consumption and waste for this kitchen
      const kitchenConsumptions = consumptions.filter(c => c.kitchenId === kitchen.id);
      const kitchenRecipeUsages = recipeUsages.filter(r => r.kitchenId === kitchen.id);

      // --- Per-day breakdown with all days in range ---
      const allDayDates: string[] = [];
      const dayCursor = new Date(startDate);
      while (dayCursor <= endDate) {
        allDayDates.push(dayCursor.toISOString().slice(0, 10));
        dayCursor.setDate(dayCursor.getDate() + 1);
      }

      // Gather all unique item names/types/units for this kitchen (ingredients, recipes, subrecipes)
      const allItemMap: Record<string, { name: string; type: string; unit: string }> = {};
      kitchenConsumptions.forEach(item => {
        const key = item.foodSupply?.name || 'Unknown';
        allItemMap[`ingredient:${key}`] = {
          name: key,
          type: 'ingredient',
          unit: item.foodSupply?.unit || 'units'
        };
      });
      kitchenRecipeUsages.forEach(item => {
        const key = item.recipe?.name || 'Unknown';
        const type = item.recipe?.isSubrecipe ? 'subrecipe' : 'recipe';
        allItemMap[`${type}:${key}`] = {
          name: key,
          type,
          unit: type === 'subrecipe' ? 'subrecipe' : 'recipe'
        };
      });
      const allItemsArr = Object.values(allItemMap);

      // Build per-day breakdown, filling missing days/items with zeroes
      const ingredientByDay: Record<string, Record<string, { name: string; type: string; quantity: number; unit: string }>> = {};
      kitchenConsumptions.forEach(item => {
        const day = item.date.toISOString().slice(0, 10); // YYYY-MM-DD
        if (!ingredientByDay[day]) ingredientByDay[day] = {};
        const key = item.foodSupply?.name || 'Unknown';
        if (!ingredientByDay[day][key]) {
          ingredientByDay[day][key] = {
            name: key,
            type: 'ingredient',
            quantity: 0,
            unit: item.foodSupply?.unit || 'units'
          };
        }
        ingredientByDay[day][key].quantity += item.quantity;
      });
      const recipeByDay: Record<string, Record<string, { name: string; type: string; quantity: number; unit: string }>> = {};
      kitchenRecipeUsages.forEach(item => {
        const day = item.createdAt.toISOString().slice(0, 10);
        if (!recipeByDay[day]) recipeByDay[day] = {};
        const key = item.recipe?.name || 'Unknown';
        const type = item.recipe?.isSubrecipe ? 'subrecipe' : 'recipe';
        if (!recipeByDay[day][key]) {
          recipeByDay[day][key] = {
            name: key,
            type,
            quantity: 0,
            unit: type === 'subrecipe' ? 'subrecipe' : 'recipe'
          };
        }
        recipeByDay[day][key].quantity += item.servingsUsed || 1;
      });
      const consumptionByDay = allDayDates.map(date => {
        const itemsMap: Record<string, { name: string; type: string; quantity: number; unit: string }> = {};
        allItemsArr.forEach(item => {
          itemsMap[`${item.type}:${item.name}`] = { ...item, quantity: 0 };
        });
        Object.values(ingredientByDay[date] || {}).forEach(item => {
          itemsMap[`ingredient:${item.name}`] = { ...item };
        });
        Object.values(recipeByDay[date] || {}).forEach(item => {
          itemsMap[`${item.type}:${item.name}`] = { ...item };
        });
        return { date, items: Object.values(itemsMap) };
      });

      // --- Per-month breakdown with all months from January to now ---
      const allMonthKeys: string[] = [];
      const year = endDate.getFullYear();
      const monthStart = new Date(year, 0, 1);
      const monthEnd = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      let monthCursor = new Date(monthStart);
      while (monthCursor <= monthEnd) {
        allMonthKeys.push(monthCursor.toISOString().slice(0, 7));
        monthCursor.setMonth(monthCursor.getMonth() + 1);
      }
      const ingredientByMonth: Record<string, Record<string, { name: string; type: string; quantity: number; unit: string }>> = {};
      kitchenConsumptions.forEach(item => {
        const month = item.date.toISOString().slice(0, 7); // YYYY-MM
        if (!ingredientByMonth[month]) ingredientByMonth[month] = {};
        const key = item.foodSupply?.name || 'Unknown';
        if (!ingredientByMonth[month][key]) {
          ingredientByMonth[month][key] = {
            name: key,
            type: 'ingredient',
            quantity: 0,
            unit: item.foodSupply?.unit || 'units'
          };
        }
        ingredientByMonth[month][key].quantity += item.quantity;
      });
      const recipeByMonth: Record<string, Record<string, { name: string; type: string; quantity: number; unit: string }>> = {};
      kitchenRecipeUsages.forEach(item => {
        const month = item.createdAt.toISOString().slice(0, 7);
        if (!recipeByMonth[month]) recipeByMonth[month] = {};
        const key = item.recipe?.name || 'Unknown';
        const type = item.recipe?.isSubrecipe ? 'subrecipe' : 'recipe';
        if (!recipeByMonth[month][key]) {
          recipeByMonth[month][key] = {
            name: key,
            type,
            quantity: 0,
            unit: type === 'subrecipe' ? 'subrecipe' : 'recipe'
          };
        }
        recipeByMonth[month][key].quantity += item.servingsUsed || 1;
      });
      const consumptionByMonth = allMonthKeys.map(month => {
        const itemsMap: Record<string, { name: string; type: string; quantity: number; unit: string }> = {};
        allItemsArr.forEach(item => {
          itemsMap[`${item.type}:${item.name}`] = { ...item, quantity: 0 };
        });
        Object.values(ingredientByMonth[month] || {}).forEach(item => {
          itemsMap[`ingredient:${item.name}`] = { ...item };
        });
        Object.values(recipeByMonth[month] || {}).forEach(item => {
          itemsMap[`${item.type}:${item.name}`] = { ...item };
        });
        return { month, items: Object.values(itemsMap) };
      });

      // --- NEW: Use RecipeUsage for all financials and waste ---
      // Aggregate from RecipeUsage for this kitchen
      const totalRecipeCost = kitchenRecipeUsages.reduce((sum, ru) => sum + (ru.cost || 0), 0);
      const totalRecipeRevenue = kitchenRecipeUsages.reduce((sum, ru) => sum + (ru.sellingPrice || 0), 0);
      const totalRecipeWaste = kitchenRecipeUsages.reduce((sum, ru) => sum + (ru.waste || 0), 0);
      const totalRecipeProfit = kitchenRecipeUsages.reduce((sum, ru) => sum + (ru.profit || 0), 0);

      // For legacy fields, keep for chart/consumption breakdowns
      const totalConsumed = kitchenConsumptions.reduce((sum, item) => sum + item.quantity, 0);
      // For totalWasted, use totalRecipeWaste if available, else fallback
      const totalWasted = totalRecipeWaste;

      // Waste percentage
      let wastePercentage = 0;
      try {
        const denominator = totalConsumed + totalWasted;
        if (denominator > 0) {
          wastePercentage = (totalWasted / denominator) * 100;
          wastePercentage = isNaN(wastePercentage) || !isFinite(wastePercentage) ? 0 : wastePercentage;
          wastePercentage = Math.min(wastePercentage, 100);
        }
      } catch {
        wastePercentage = 0;
      }

      // Consumption trend: real comparison of current vs previous period for this kitchen
      const prevKitchenTotal = previousConsumptions
        .filter(c => c.kitchenId === kitchen.id)
        .reduce((sum, c) => sum + c.quantity, 0);
      let consumptionTrend = 0;
      if (prevKitchenTotal > 0) {
        consumptionTrend = ((totalConsumed - prevKitchenTotal) / prevKitchenTotal) * 100;
      } else if (totalConsumed > 0) {
        consumptionTrend = 100;
      }
      consumptionTrend = Math.round(Math.max(Math.min(consumptionTrend, 200), -100) * 10) / 10;

      // Most consumed items (ingredients, recipes, subrecipes)
      const consumptionByItem = new Map();
      kitchenConsumptions.forEach(item => {
        const key = `ingredient:${item.foodSupply?.name || 'Unknown'}`;
        const current = consumptionByItem.get(key) || { 
          name: item.foodSupply?.name || 'Unknown',
          type: 'ingredient',
          quantity: 0, 
          unit: item.foodSupply?.unit || 'units' 
        };
        consumptionByItem.set(key, {
          ...current,
          quantity: current.quantity + item.quantity
        });
      });
      kitchenRecipeUsages.forEach(item => {
        const type = item.recipe?.isSubrecipe ? 'subrecipe' : 'recipe';
        const key = `${type}:${item.recipe?.name || 'Unknown'}`;
        const current = consumptionByItem.get(key) || { 
          name: item.recipe?.name || 'Unknown',
          type,
          quantity: 0,
          unit: type === 'subrecipe' ? 'subrecipe' : 'recipe'
        };
        consumptionByItem.set(key, {
          ...current,
          quantity: current.quantity + (item.servingsUsed || 1)
        });
      });
      const mostConsumedItems = Array.from(consumptionByItem.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 3);

      // Most wasted items (from RecipeUsage waste, fallback to old logic if needed)
      // For now, keep legacy logic for display, but main waste is from totalRecipeWaste
      const mostWastedItems = [
        {
          name: 'Recipe Waste',
          quantity: Math.round(totalRecipeWaste * 10) / 10,
          unit: 'units',
          reason: 'recipe_waste'
        }
      ];

      // Calculate savings opportunity (assume 75% of waste could be saved)
      const savingsOpportunity = totalRecipeWaste * 0.75;

      // Add kitchen data to response
      response.kitchens.push({
        id: kitchen.id,
        name: kitchen.name,
        totalConsumed,
        totalWasted,
        wastePercentage,
        consumptionTrend,
        mostConsumedItems,
        mostWastedItems,
        costData: {
          totalCost: totalRecipeCost,
          wasteCost: totalRecipeWaste,
          savingsOpportunity
        },
        // --- NEW FIELDS ---
        totalRecipeCost,
        totalRecipeRevenue,
        totalRecipeWaste,
        totalRecipeProfit,
        consumptionByDay,
        consumptionByMonth
      });

      // Add to summary totals
      response.summary.totalConsumed += totalConsumed;
      response.summary.totalWasted += totalWasted;
      response.summary.totalCost += totalRecipeCost;
      response.summary.totalWasteCost += totalRecipeWaste;
      response.summary.potentialSavings += savingsOpportunity;
    }
    
    // Calculate overall waste percentage with additional safety checks
    try {
      // Ensure all values are valid numbers
      const safeTotalWasted = isNaN(response.summary.totalWasted) || !isFinite(response.summary.totalWasted) ? 0 : response.summary.totalWasted;
      const safeTotalConsumed = isNaN(response.summary.totalConsumed) || !isFinite(response.summary.totalConsumed) ? 0 : response.summary.totalConsumed;
      
      const denominator = safeTotalConsumed + safeTotalWasted;
      
      if (denominator > 0) {
        response.summary.overallWastePercentage = (safeTotalWasted / denominator) * 100;
        // Ensure the percentage is valid
        response.summary.overallWastePercentage = isNaN(response.summary.overallWastePercentage) || !isFinite(response.summary.overallWastePercentage) ? 0 : response.summary.overallWastePercentage;
        // Cap at 100% for sanity
        response.summary.overallWastePercentage = Math.min(response.summary.overallWastePercentage, 100);
      } else {
        response.summary.overallWastePercentage = 0;
      }
    } catch (calcError) {
      console.error('Error calculating overall waste percentage:', calcError);
      response.summary.overallWastePercentage = 0;
    }
    
    // Calculate period comparison with additional safety checks
    try {
      // Ensure all values are valid numbers
      const safeCurrentConsumption = isNaN(response.summary.totalConsumed) || !isFinite(response.summary.totalConsumed) ? 0 : response.summary.totalConsumed;
      const safePreviousConsumption = isNaN(previousPeriodConsumption) || !isFinite(previousPeriodConsumption) ? 0 : previousPeriodConsumption;
      const safeCurrentWaste = isNaN(response.summary.totalWasted) || !isFinite(response.summary.totalWasted) ? 0 : response.summary.totalWasted;
      const safePreviousWaste = isNaN(previousPeriodWaste) || !isFinite(previousPeriodWaste) ? 0 : previousPeriodWaste;
      
      // Set the values in the response
      response.summary.periodComparison.currentPeriodConsumption = safeCurrentConsumption;
      response.summary.periodComparison.previousPeriodConsumption = safePreviousConsumption;
      response.summary.periodComparison.currentPeriodWaste = safeCurrentWaste;
      response.summary.periodComparison.previousPeriodWaste = safePreviousWaste;
      
      // Calculate percentage change with safety checks
      if (safePreviousConsumption > 0) {
        const percentageChange = ((safeCurrentConsumption - safePreviousConsumption) / safePreviousConsumption) * 100;
        response.summary.periodComparison.percentageChange = isNaN(percentageChange) || !isFinite(percentageChange) ? 0 : percentageChange;
      } else {
        response.summary.periodComparison.percentageChange = safeCurrentConsumption > 0 ? 100 : 0; // 100% increase if previous was 0 but current is not
      }
      
      // Calculate waste percentage change with safety checks
      if (safePreviousWaste > 0) {
        const wastePercentageChange = ((safeCurrentWaste - safePreviousWaste) / safePreviousWaste) * 100;
        response.summary.periodComparison.wastePercentageChange = isNaN(wastePercentageChange) || !isFinite(wastePercentageChange) ? 0 : wastePercentageChange;
      } else {
        response.summary.periodComparison.wastePercentageChange = safeCurrentWaste > 0 ? 100 : 0; // 100% increase if previous was 0 but current is not
      }
      
      // Cap percentage changes at reasonable values for display purposes
      response.summary.periodComparison.percentageChange = Math.max(Math.min(response.summary.periodComparison.percentageChange, 1000), -100);
      response.summary.periodComparison.wastePercentageChange = Math.max(Math.min(response.summary.periodComparison.wastePercentageChange, 1000), -100);
      
    } catch (calcError) {
      console.error('Error calculating period comparison:', calcError);
      // Set default values if calculation fails
      response.summary.periodComparison.percentageChange = 0;
      response.summary.periodComparison.wastePercentageChange = 0;
    }
    
    // Calculate top waste reasons with null checks
    const wasteReasons = new Map();
    allWasteRecords.forEach(waste => {
      const reason = waste.reason || 'unknown';
      const quantity = waste.quantity || 0;
      const pricePerUnit = waste.foodSupply?.pricePerUnit || 0;
      const cost = quantity * pricePerUnit;
      
      const current = wasteReasons.get(reason) || { quantity: 0, cost: 0 };
      wasteReasons.set(reason, {
        quantity: current.quantity + quantity,
        cost: current.cost + cost
      });
    });
    
    // Prevent division by zero
    response.summary.topWasteReasons = Array.from(wasteReasons.entries())
      .map(([reason, data]) => ({
        reason,
        percentage: response.summary.totalWasted > 0 ? (data.quantity / response.summary.totalWasted) * 100 : 0,
        cost: data.cost
      }))
      .sort((a, b) => b.percentage - a.percentage);
    
    // Return only real waste data — no mock injection
    response.summary.topWasteReasons.sort((a, b) => b.percentage - a.percentage);
    
    return res.status(200).json(response);
  } catch (error) {
    // Enhanced error logging with more details
    console.error('Kitchen Consumption API Error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown error type'
    });
    
    // Return a more informative error message for debugging
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred while processing kitchen consumption data'
    });
  }
}