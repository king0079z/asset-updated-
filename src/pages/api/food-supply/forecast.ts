import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers to allow requests from preview domains
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Authenticate the user
    const supabase = createClient(req, res);
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return res.status(401).json({ message: 'Authentication error', details: sessionError.message });
    }
    
    if (!session?.user) {
      return res.status(401).json({ message: 'Unauthorized - No valid session found' });
    }
    
    // Get the time range for forecasting from query parameters
    const daysToLookBack = Math.max(1, parseInt(req.query.days as string) || 30);
    const daysToForecast = Math.max(1, parseInt(req.query.forecast as string) || 7);
    
    console.log(`Generating forecast using ${daysToLookBack} days of history for ${daysToForecast} days ahead`);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToLookBack);
    
    // Fetch all data in parallel for better performance
    const [recipes, foodSupplyItems, consumptionHistory, disposalHistory] = await Promise.all([
      // Fetch all recipes with their ingredients and usage history
      prisma.recipe.findMany({
        include: {
          ingredients: {
            include: {
              foodSupply: true
            }
          },
          usages: true
        }
      }),
      
      // Fetch all food supply items
      prisma.foodSupply.findMany(),
      
      // Fetch consumption history for the specified time period
      prisma.foodConsumption.findMany({
        where: {
          createdAt: {
            gte: startDate
          }
        },
        include: {
          foodSupply: true
        }
      }),
      
      // Fetch food disposal history for the specified time period
      prisma.foodDisposal.findMany({
        where: {
          createdAt: {
            gte: startDate
          }
        },
        include: {
          foodSupply: true,
          recipe: true
        }
      })
    ]);
    
    // Calculate recipe forecasts
    const recipeForecastData = recipes.map(recipe => {
      // Find consumption records for this recipe
      const recipeUsages = recipe.usages;
      
      // Calculate when this recipe was last used
      const lastUsedDate = recipeUsages.length > 0 
        ? new Date(Math.max(...recipeUsages.map(u => new Date(u.createdAt).getTime())))
        : null;
      
      // Calculate forecast quantity based on historical usage
      const usageDays = Math.max(1, daysToLookBack); // Avoid division by zero
      const dailyUsageRate = recipeUsages.length / usageDays;
      const forecastQty = recipeUsages.length > 0 
        ? Math.max(1, Math.round(dailyUsageRate * daysToForecast))
        : 0;
      
      // Calculate cost per use based on ingredients
      let costPerUse = 0;
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        costPerUse = recipe.ingredients.reduce((total, ingredient) => {
          const ingredientCost = ingredient.quantity * (ingredient.foodSupply?.pricePerUnit || 0);
          return total + (isNaN(ingredientCost) ? 0 : ingredientCost);
        }, 0);
      }
      
      // Calculate total forecast cost
      const forecastCost = costPerUse * forecastQty;
      
      // Get linked food supplies
      const linkedFoodSupplies = recipe.ingredients
        .filter(ing => ing.foodSupply)
        .map(ing => ing.foodSupply?.name)
        .filter(Boolean) as string[];
      
      return {
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        lastUsed: lastUsedDate ? lastUsedDate.toISOString() : null,
        forecastQty,
        forecastCost,
        costPerUse,
        ingredientCount: recipe.ingredients.length,
        ingredients: recipe.ingredients.map(ing => ({
          id: ing.id,
          quantity: ing.quantity,
          foodSupply: ing.foodSupply ? {
            name: ing.foodSupply.name,
            unit: ing.foodSupply.unit,
            pricePerUnit: ing.foodSupply.pricePerUnit
          } : undefined
        })),
        linkedFoodSupplies
      };
    });
    
    // Calculate inventory forecasts
    const inventoryForecastData = foodSupplyItems.map(item => {
      // Find direct consumption records for this item
      const directConsumptions = consumptionHistory.filter(
        c => c.foodSupplyId === item.id && !c.recipeId
      );
      
      // Calculate total quantity consumed directly
      const directConsumedQty = directConsumptions.reduce(
        (sum, c) => sum + c.quantity, 0
      );
      
      // Calculate recipe-based consumption for this item
      let recipeConsumedQty = 0;
      
      // Look through all recipe usages
      recipes.forEach(recipe => {
        // Find the ingredient in this recipe that uses this food supply
        const ingredient = recipe.ingredients.find(i => i.foodSupplyId === item.id);
        
        if (ingredient) {
          // Count how many times this recipe was used
          const usageCount = recipe.usages.length;
          
          // Calculate how much of this ingredient was used through recipes
          recipeConsumedQty += ingredient.quantity * usageCount;
        }
      });
      
      // Calculate total quantity consumed
      const totalConsumedQty = directConsumedQty + recipeConsumedQty;
      
      // Calculate daily consumption rate with improved logic
      let dailyRate = 0;
      
      if (totalConsumedQty > 0) {
        // Calculate the raw daily rate
        const rawDailyRate = totalConsumedQty / daysToLookBack;
        
        // Apply a minimum meaningful rate if there's actual consumption
        dailyRate = Math.max(rawDailyRate, 0.01);
      }
      
      // Project for forecast period with improved logic
      let forecastedDemand = 0;
      
      if (dailyRate > 0) {
        // Calculate the raw forecasted demand
        forecastedDemand = dailyRate * daysToForecast;
        
        // Round to 2 decimal places for precision
        forecastedDemand = Math.round(forecastedDemand * 100) / 100;
        
        // Ensure a minimum of 1 unit if there's any consumption
        forecastedDemand = Math.max(forecastedDemand, 1);
      }
      
      // Calculate days until depletion with safeguards
      let daysUntilDepletion = 999; // Default to a high number
      
      if (dailyRate > 0) {
        daysUntilDepletion = Math.floor(item.quantity / dailyRate);
        
        // Cap at 999 days to avoid extreme values
        daysUntilDepletion = Math.min(daysUntilDepletion, 999);
      }
      
      // Calculate suggested order quantity
      const suggestedOrder = Math.max(0, forecastedDemand - item.quantity);
      
      // Calculate forecast cost
      const forecastCost = suggestedOrder * (item.pricePerUnit || 0);
      
      // Find linked recipes
      const linkedRecipes = recipes
        .filter(recipe => recipe.ingredients.some(ing => ing.foodSupplyId === item.id))
        .map(recipe => recipe.name);
      
      // Calculate waste percentage
      const wasteRecords = disposalHistory.filter(d => d.foodSupplyId === item.id);
      const totalWasted = wasteRecords.reduce((sum, d) => sum + d.quantity, 0);
      const wastePercentage = totalConsumedQty > 0 
        ? (totalWasted / (totalConsumedQty + totalWasted)) * 100 
        : 0;
      
      return {
        id: item.id,
        name: item.name,
        currentStock: item.quantity,
        unit: item.unit,
        forecastedDemand,
        suggestedOrder,
        daysUntilDepletion,
        category: item.category,
        pricePerUnit: item.pricePerUnit,
        totalCost: forecastCost,
        linkedRecipes,
        wastePercentage,
        dailyConsumptionRate: dailyRate
      };
    });
    
    // Calculate waste data with improved grouping
    const wasteByReason = disposalHistory.reduce((acc, disposal) => {
      const reason = disposal.reason || 'other';
      const cost = disposal.cost || 0;
      const quantity = disposal.quantity || 0;
      
      if (!acc[reason]) {
        acc[reason] = {
          reason,
          cost: 0,
          quantity: 0,
          percentage: 0
        };
      }
      
      acc[reason].cost += cost;
      acc[reason].quantity += quantity;
      
      return acc;
    }, {} as Record<string, { reason: string; cost: number; quantity: number; percentage: number }>);
    
    // Calculate total waste metrics
    const totalWasteCost = Object.values(wasteByReason).reduce((sum, item) => sum + item.cost, 0);
    const totalWasteQty = Object.values(wasteByReason).reduce((sum, item) => sum + item.quantity, 0);
    
    // Calculate percentages for waste data
    const wasteData = Object.values(wasteByReason).map(item => {
      item.percentage = totalWasteCost > 0 ? (item.cost / totalWasteCost) * 100 : 0;
      return item;
    });
    
    // Sort waste data by cost (descending)
    wasteData.sort((a, b) => b.cost - a.cost);
    
    // Calculate totals with safeguards against NaN or undefined values
    const totalForecastCost = inventoryForecastData.reduce((sum, item) => {
      const cost = typeof item.totalCost === 'number' && !isNaN(item.totalCost) ? item.totalCost : 0;
      return sum + cost;
    }, 0);
    
    const totalForecastQty = inventoryForecastData.reduce((sum, item) => {
      const qty = typeof item.suggestedOrder === 'number' && !isNaN(item.suggestedOrder) ? item.suggestedOrder : 0;
      return sum + qty;
    }, 0);
    
    // Sort critical items by days until depletion
    const criticalItems = [...inventoryForecastData]
      .filter(item => item.daysUntilDepletion < 14 && item.dailyConsumptionRate > 0)
      .sort((a, b) => a.daysUntilDepletion - b.daysUntilDepletion);
    
    // Return the forecast data
    return res.status(200).json({
      recipes: recipeForecastData,
      inventory: inventoryForecastData,
      criticalItems,
      wasteData,
      totals: {
        forecastCost: totalForecastCost,
        forecastQty: totalForecastQty,
        wasteCost: totalWasteCost,
        wasteQty: totalWasteQty
      },
      metadata: {
        daysAnalyzed: daysToLookBack,
        daysForecasted: daysToForecast,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Forecast API error:', error);
    return res.status(500).json({ 
      message: 'Failed to generate forecast',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}