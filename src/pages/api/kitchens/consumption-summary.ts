import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { startOfDay, subDays, format, startOfMonth, subMonths } from 'date-fns';

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
    // Parse query parameters
    const { 
      days = '30', 
      includeDetails = 'false', 
      includeTrends = 'false' 
    } = req.query;
    
    const daysCount = parseInt(days as string, 10);
    const shouldIncludeDetails = includeDetails === 'true';
    const shouldIncludeTrends = includeTrends === 'true';
    
    // Calculate date ranges
    const endDate = new Date();
    const startDate = startOfDay(subDays(endDate, daysCount));
    const previousStartDate = startOfDay(subDays(startDate, daysCount));
    
    // Get all kitchens
    const kitchens = await prisma.kitchen.findMany({
      select: { id: true, name: true, createdAt: true }
    });

    // For each kitchen, get comprehensive stats
    const kitchenSummaries = await Promise.all(
      kitchens.map(async (kitchen) => {
        // Get consumptions for current period
        const consumptions = await prisma.foodConsumption.findMany({
          where: { 
            kitchenId: kitchen.id,
            date: { gte: startDate, lte: endDate }
          },
          include: {
            foodSupply: { 
              select: { 
                id: true, 
                name: true, 
                unit: true, 
                category: true, 
                pricePerUnit: true 
              } 
            }
          }
        });

        // Get recipe usages for current period
        const recipeUsages = await prisma.recipeUsage.findMany({
          where: { 
            kitchenId: kitchen.id,
            createdAt: { gte: startDate, lte: endDate }
          },
          include: {
            recipe: { 
              select: { 
                id: true, 
                name: true, 
                isSubrecipe: true, 
                totalCost: true,
                sellingPrice: true,
                ingredients: {
                  select: {
                    id: true,
                    foodSupplyId: true,
                    quantity: true
                  }
                }
              } 
            }
          }
        });

        // Get waste data for current period
        const wasteData = await prisma.foodDisposal.findMany({
          where: {
            OR: [
              { 
                kitchenId: kitchen.id,
                createdAt: { gte: startDate, lte: endDate }
              },
              {
                kitchenId: null,
                foodSupply: { kitchenId: kitchen.id },
                createdAt: { gte: startDate, lte: endDate }
              }
            ]
          },
          include: {
            foodSupply: { 
              select: { 
                id: true, 
                name: true, 
                unit: true, 
                pricePerUnit: true 
              } 
            }
          }
        });

        // Calculate consumption metrics
        const totalConsumption = consumptions.reduce((sum, c) => sum + c.quantity, 0);
        const totalConsumptionCost = consumptions.reduce((sum, c) => 
          sum + (c.quantity * (c.foodSupply.pricePerUnit || 0)), 0
        );

        // Calculate recipe metrics using new RecipeUsage fields
        const totalRecipeUsages = recipeUsages.reduce((sum, r) => sum + r.servingsUsed, 0);
        const totalRecipeCost = recipeUsages.reduce((sum, r) => sum + (r.cost || 0), 0);
        const totalRecipeRevenue = recipeUsages.reduce((sum, r) => sum + (r.sellingPrice || 0), 0);
        const totalRecipeWaste = recipeUsages.reduce((sum, r) => sum + (r.waste || 0), 0);
        const totalRecipeProfit = recipeUsages.reduce((sum, r) => sum + (r.profit || 0), 0);

        // Calculate waste metrics
        const totalWaste = wasteData.reduce((sum, w) => sum + w.quantity, 0);
        const totalWasteCost = wasteData.reduce((sum, w) => 
          sum + (w.quantity * (w.foodSupply.pricePerUnit || 0)), 0
        );

        const expirationWaste = wasteData
          .filter(w => w.reason === "expiration")
          .reduce((sum, w) => sum + w.quantity, 0);

        const ingredientWaste = wasteData
          .filter(w => w.reason === "ingredient_waste")
          .reduce((sum, w) => sum + w.quantity, 0);

        // Calculate total ingredient used in recipes for this kitchen and period
        // Map: foodSupplyId -> total used in recipes
        const ingredientUsageFromRecipes: Record<string, number> = {};
        for (const usage of recipeUsages) {
          const servingsUsed = usage.servingsUsed || 0;
          if (usage.recipe && usage.recipe.ingredients) {
            for (const ingredient of usage.recipe.ingredients) {
              if (!ingredient.foodSupplyId) continue;
              if (!ingredientUsageFromRecipes[ingredient.foodSupplyId]) {
                ingredientUsageFromRecipes[ingredient.foodSupplyId] = 0;
              }
              ingredientUsageFromRecipes[ingredient.foodSupplyId] += (ingredient.quantity || 0) * servingsUsed;
            }
          }
        }

        // Calculate total direct ingredient consumption for this kitchen and period
        // Map: foodSupplyId -> total consumed directly
        const ingredientUsageDirect: Record<string, number> = {};
        for (const c of consumptions) {
          if (!c.foodSupply?.id) continue;
          if (!ingredientUsageDirect[c.foodSupply.id]) {
            ingredientUsageDirect[c.foodSupply.id] = 0;
          }
          ingredientUsageDirect[c.foodSupply.id] += c.quantity || 0;
        }

        // Sum total ingredient used (recipes + direct)
        let totalIngredientUsed = 0;
        for (const foodSupplyId of new Set([
          ...Object.keys(ingredientUsageFromRecipes),
          ...Object.keys(ingredientUsageDirect)
        ])) {
          totalIngredientUsed += (ingredientUsageFromRecipes[foodSupplyId] || 0) + (ingredientUsageDirect[foodSupplyId] || 0);
        }

        // Calculate ingredient waste percent
        const ingredientWastePercent = totalIngredientUsed > 0 ? (ingredientWaste / totalIngredientUsed) * 100 : 0;

        // Calculate efficiency
        const totalActivity = totalConsumption + totalWaste + totalRecipeUsages;
        const wastePercent = totalActivity > 0 ? (totalWaste / totalActivity) * 100 : 0;
        const kitchenEfficiency = Math.max(0, Math.min(100, 100 - wastePercent));

        // Calculate financial metrics using only new recipe-based analytics
        const totalCost = totalRecipeCost;
        const wasteCost = totalRecipeWaste;
        const profitMargin = totalRecipeRevenue > 0 ? 
          (totalRecipeProfit / totalRecipeRevenue) * 100 : 0;

        // Group consumptions for top items
        const groupedConsumptions = consumptions.reduce((acc, curr) => {
          const key = curr.foodSupply.id;
          if (!acc[key]) {
            acc[key] = {
              id: curr.foodSupply.id,
              name: curr.foodSupply.name,
              unit: curr.foodSupply.unit,
              category: curr.foodSupply.category,
              totalQuantity: 0,
              totalCost: 0,
              type: 'ingredient' as const
            };
          }
          acc[key].totalQuantity += curr.quantity;
          acc[key].totalCost += curr.quantity * (curr.foodSupply.pricePerUnit || 0);
          return acc;
        }, {} as Record<string, any>);

        // Group recipe usages for top items
        const groupedRecipes = recipeUsages.reduce((acc, curr) => {
          const key = curr.recipe.id;
          if (!acc[key]) {
            acc[key] = {
              id: curr.recipe.id,
              name: curr.recipe.name,
              unit: 'servings',
              totalQuantity: 0,
              totalCost: 0,
              type: curr.recipe.isSubrecipe ? 'subrecipe' as const : 'recipe' as const
            };
          }
          acc[key].totalQuantity += curr.servingsUsed;
          acc[key].totalCost += curr.servingsUsed * (curr.recipe.totalCost || 0);
          return acc;
        }, {} as Record<string, any>);

        // Combine and get top consumed items
        const allConsumedItems = [
          ...Object.values(groupedConsumptions),
          ...Object.values(groupedRecipes)
        ];

        const topConsumedItems = allConsumedItems
          .sort((a: any, b: any) => b.totalQuantity - a.totalQuantity)
          .slice(0, 5)
          .map((item: any) => ({
            name: item.name,
            amount: `${item.totalQuantity.toFixed(1)} ${item.unit}`,
            type: item.type,
            cost: item.totalCost
          }));

        // Group waste for top wasted items
        const groupedWaste = wasteData.reduce((acc, curr) => {
          const key = curr.foodSupplyId;
          if (!acc[key]) {
            acc[key] = {
              id: curr.foodSupplyId,
              name: curr.foodSupply.name,
              unit: curr.foodSupply.unit,
              totalWasted: 0,
              totalCost: 0,
              reasons: new Set()
            };
          }
          acc[key].totalWasted += curr.quantity;
          acc[key].totalCost += curr.quantity * (curr.foodSupply.pricePerUnit || 0);
          acc[key].reasons.add(curr.reason);
          return acc;
        }, {} as Record<string, any>);

        const topWastedItems = Object.values(groupedWaste)
          .sort((a: any, b: any) => b.totalWasted - a.totalWasted)
          .slice(0, 5)
          .map((item: any) => ({
            name: item.name,
            amount: `${item.totalWasted.toFixed(1)} ${item.unit}`,
            reason: Array.from(item.reasons).join(', '),
            cost: item.totalCost
          }));

        // Calculate trends if requested
        let consumptionTrend = 0;
        let wasteTrend = 0;

        if (shouldIncludeTrends) {
          // Get previous period data for trend calculation
          const previousConsumptions = await prisma.foodConsumption.findMany({
            where: { 
              kitchenId: kitchen.id,
              date: { gte: previousStartDate, lt: startDate }
            }
          });

          const previousWaste = await prisma.foodDisposal.findMany({
            where: {
              OR: [
                { 
                  kitchenId: kitchen.id,
                  createdAt: { gte: previousStartDate, lt: startDate }
                },
                {
                  kitchenId: null,
                  foodSupply: { kitchenId: kitchen.id },
                  createdAt: { gte: previousStartDate, lt: startDate }
                }
              ]
            }
          });

          const previousTotalConsumption = previousConsumptions.reduce((sum, c) => sum + c.quantity, 0);
          const previousTotalWaste = previousWaste.reduce((sum, w) => sum + w.quantity, 0);

          consumptionTrend = previousTotalConsumption > 0 ? 
            ((totalConsumption - previousTotalConsumption) / previousTotalConsumption) * 100 : 0;
          wasteTrend = previousTotalWaste > 0 ? 
            ((totalWaste - previousTotalWaste) / previousTotalWaste) * 100 : 0;
        }

        // Generate alerts
        const alerts = [];
        if (kitchenEfficiency < 60) {
          alerts.push({
            type: 'error' as const,
            message: 'Kitchen efficiency is critically low',
            priority: 'high' as const
          });
        }
        if (wasteTrend > 20) {
          alerts.push({
            type: 'warning' as const,
            message: 'Waste has increased significantly',
            priority: 'medium' as const
          });
        }
        if (totalWasteCost > totalConsumptionCost * 0.3) {
          alerts.push({
            type: 'warning' as const,
            message: 'Waste cost is high relative to consumption',
            priority: 'medium' as const
          });
        }

        // Monthly data for charts (if details requested)
        let monthlyData = {
          consumption: [] as number[],
          waste: [] as number[],
          labels: [] as string[]
        };

        if (shouldIncludeDetails) {
          // Generate monthly data for the last 6 months
          const months = [];
          for (let i = 5; i >= 0; i--) {
            const monthStart = startOfMonth(subMonths(endDate, i));
            const monthEnd = startOfMonth(subMonths(endDate, i - 1));
            
            const monthConsumptions = await prisma.foodConsumption.findMany({
              where: { 
                kitchenId: kitchen.id,
                date: { gte: monthStart, lt: monthEnd }
              }
            });

            const monthWaste = await prisma.foodDisposal.findMany({
              where: {
                OR: [
                  { 
                    kitchenId: kitchen.id,
                    createdAt: { gte: monthStart, lt: monthEnd }
                  },
                  {
                    kitchenId: null,
                    foodSupply: { kitchenId: kitchen.id },
                    createdAt: { gte: monthStart, lt: monthEnd }
                  }
                ]
              }
            });

            months.push({
              label: format(monthStart, 'MMM yyyy'),
              consumption: monthConsumptions.reduce((sum, c) => sum + c.quantity, 0),
              waste: monthWaste.reduce((sum, w) => sum + w.quantity, 0)
            });
          }

          monthlyData = {
            labels: months.map(m => m.label),
            consumption: months.map(m => m.consumption),
            waste: months.map(m => m.waste)
          };
        }

        return {
          id: kitchen.id,
          name: kitchen.name,
          totalConsumption,
          totalWaste,
          expirationWaste,
          ingredientWaste,
          ingredientWastePercent,
          kitchenEfficiency,
          totalCost,
          wasteCost,
          profitMargin,
          totalRecipeCost,
          totalRecipeRevenue,
          totalRecipeWaste,
          totalRecipeProfit,
          consumptionTrend,
          wasteTrend,
          topConsumedItems,
          topWastedItems,
          monthlyData,
          alerts,
          lastUpdated: new Date().toISOString()
        };
      })
    );

    // Calculate summary statistics
    const summary = {
      totalKitchens: kitchens.length,
      totalConsumption: kitchenSummaries.reduce((sum, k) => sum + k.totalConsumption, 0),
      totalWaste: kitchenSummaries.reduce((sum, k) => sum + k.totalWaste, 0),
      averageEfficiency: kitchens.length > 0 ? 
        kitchenSummaries.reduce((sum, k) => sum + k.kitchenEfficiency, 0) / kitchens.length : 0,
      totalCost: kitchenSummaries.reduce((sum, k) => sum + (k.totalRecipeCost ?? 0), 0),
      totalWasteCost: kitchenSummaries.reduce((sum, k) => sum + (k.totalRecipeWaste ?? 0), 0),
      potentialSavings: kitchenSummaries.reduce((sum, k) => sum + ((k.totalRecipeWaste ?? 0) * 0.7), 0)
    };

    // Determine data freshness
    const now = new Date();
    const lastDataPoint = Math.max(
      ...kitchenSummaries.map(k => new Date(k.lastUpdated).getTime())
    );
    const hoursSinceLastUpdate = (now.getTime() - lastDataPoint) / (1000 * 60 * 60);
    
    let dataFreshness: 'fresh' | 'stale' | 'outdated' = 'fresh';
    if (hoursSinceLastUpdate > 24) dataFreshness = 'outdated';
    else if (hoursSinceLastUpdate > 6) dataFreshness = 'stale';

    const response = {
      kitchens: kitchenSummaries,
      summary,
      metadata: {
        dateRange: `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`,
        generatedAt: new Date().toISOString(),
        dataFreshness
      }
    };
  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');


    return res.status(200).json(response);
  } catch (error) {
    console.error('Kitchen Consumption Summary API Error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}