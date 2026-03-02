import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

// Enhanced logging function
const logApiEvent = (message: string, data?: any) => {
  try {
    const timestamp = new Date().toISOString();
    console.info(`${timestamp} info: Path: /api/kitchens/financial-metrics ${message}`);
    if (data) {
      console.info(`${timestamp} info: Path: /api/kitchens/financial-metrics Data:`, 
        typeof data === 'object' ? JSON.stringify(data) : data);
    }
  } catch (loggingError) {
    console.error('Error in logging function:', loggingError);
    console.info('Original message:', message);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { kitchenId } = req.query;
    
    if (!kitchenId || typeof kitchenId !== 'string') {
      return res.status(400).json({ error: 'Kitchen ID is required' });
    }

    // Get the user from Supabase auth
    const supabase = createClient(req, res);
    const { data: { session }, error: userError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    logApiEvent(`Processing financial metrics for kitchen: ${kitchenId}`);

    // First, check if the kitchen exists
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
    }).catch(error => {
      console.error('Error finding kitchen:', error);
      return null;
    });

    if (!kitchen) {
      return res.status(404).json({ error: 'Kitchen not found' });
    }

    // Get all food supplies for this kitchen
    const foodSupplies = await prisma.foodSupply.findMany({
      where: {
        kitchenId: kitchenId,
      },
      select: {
        id: true,
        quantity: true,
        pricePerUnit: true,
        totalWasted: true,
      }
    });

    // Get consumption data for this kitchen
    const consumptionData = await prisma.foodConsumption.findMany({
      where: {
        kitchenId: kitchenId,
      },
      include: {
        foodSupply: {
          select: {
            pricePerUnit: true,
          }
        }
      }
    });

    // Calculate total consumed value with additional safety checks
    const totalConsumed = consumptionData.reduce((sum, record) => {
      try {
        const pricePerUnit = record.foodSupply?.pricePerUnit || 0;
        const quantity = record.quantity || 0;
        return sum + (quantity * pricePerUnit);
      } catch (calcError) {
        console.error('Error calculating consumption value for record:', calcError);
        return sum;
      }
    }, 0);

    // Calculate total cost (value) of all food supplies PLUS the consumed food
    // This ensures that food consumption is considered as cost
    const inventoryCost = foodSupplies.reduce((sum, item) => {
      try {
        const quantity = item.quantity || 0;
        const pricePerUnit = item.pricePerUnit || 0;
        return sum + (quantity * pricePerUnit);
      } catch (calcError) {
        console.error('Error calculating inventory cost for item:', calcError);
        return sum;
      }
    }, 0);
    
    // Total cost is the sum of current inventory value plus all consumed food value
    const totalCost = inventoryCost + totalConsumed;
    
    logApiEvent(`Calculated costs: Inventory: ${inventoryCost}, Consumed: ${totalConsumed}, Total: ${totalCost}`);

    // Get waste data for this kitchen
    const wasteData = await prisma.foodDisposal.findMany({
      where: {
        foodSupply: {
          kitchenId: kitchenId,
        }
      },
      include: {
        foodSupply: {
          select: {
            pricePerUnit: true,
          }
        }
      }
    });

    // Calculate total waste value with additional safety checks
    const totalWaste = wasteData.reduce((sum, record) => {
      try {
        const pricePerUnit = record.foodSupply?.pricePerUnit || 0;
        const quantity = record.quantity || 0;
        return sum + (quantity * pricePerUnit);
      } catch (calcError) {
        console.error('Error calculating waste value for record:', calcError);
        return sum;
      }
    }, 0);

    // Profit is calculated below from actual recipe selling prices, not a hardcoded markup

    // Get recipe usage data for this kitchen
    const recipeUsages = await prisma.recipeUsage.findMany({
      where: {
        kitchenId: kitchenId,
      },
      include: {
        recipe: {
          select: {
            sellingPrice: true,
            totalCost: true,
          }
        }
      }
    });

    // Calculate total recipe selling price with additional safety checks
    const totalRecipeSellingPrice = recipeUsages.reduce((sum, usage) => {
      try {
        const sellingPrice = usage.recipe?.sellingPrice || 0;
        const servings = usage.servingsUsed || 0;
        return sum + (sellingPrice * servings);
      } catch (calcError) {
        console.error('Error calculating recipe selling price for usage:', calcError);
        return sum;
      }
    }, 0);

    // Calculate total profit using the formula: total profit = total recipes selling price - total waste - total cost
    // Ensure all values are numbers and not NaN
    const safeRecipeSellingPrice = isNaN(totalRecipeSellingPrice) ? 0 : totalRecipeSellingPrice;
    const safeWaste = isNaN(totalWaste) ? 0 : totalWaste;
    const safeCost = isNaN(totalCost) ? 0 : totalCost;
    
    const totalProfit = safeRecipeSellingPrice - safeWaste - safeCost;
    
    logApiEvent(`Calculated profit: Recipe Selling Price: ${safeRecipeSellingPrice}, Waste: ${safeWaste}, Cost: ${safeCost}, Total Profit: ${totalProfit}`);
    
    // Add detailed logging for kitchen ID
    logApiEvent(`Kitchen ID: ${kitchenId}, Total Profit: ${totalProfit}, Recipe Selling Price: ${safeRecipeSellingPrice}, Waste: ${safeWaste}, Cost: ${safeCost}`);

    // Get monthly data
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Monthly consumption
    const monthlyConsumption = await prisma.foodConsumption.findMany({
      where: {
        kitchenId: kitchenId,
        date: { gte: startOfMonth }
      },
      include: {
        foodSupply: {
          select: {
            pricePerUnit: true
          }
        }
      }
    });

    const monthlyConsumedValue = monthlyConsumption.reduce((sum, record) => {
      try {
        const pricePerUnit = record.foodSupply?.pricePerUnit || 0;
        const quantity = record.quantity || 0;
        return sum + (quantity * pricePerUnit);
      } catch (calcError) {
        console.error('Error calculating monthly consumption value for record:', calcError);
        return sum;
      }
    }, 0);

    // Monthly waste
    const monthlyWaste = await prisma.foodDisposal.findMany({
      where: {
        foodSupply: {
          kitchenId: kitchenId,
        },
        createdAt: { gte: startOfMonth }
      },
      include: {
        foodSupply: {
          select: {
            pricePerUnit: true,
          }
        }
      }
    });

    const monthlyWasteValue = monthlyWaste.reduce((sum, record) => {
      try {
        const pricePerUnit = record.foodSupply?.pricePerUnit || 0;
        const quantity = record.quantity || 0;
        return sum + (quantity * pricePerUnit);
      } catch (calcError) {
        console.error('Error calculating monthly waste value for record:', calcError);
        return sum;
      }
    }, 0);

    // Monthly recipe usage
    const monthlyRecipeUsages = await prisma.recipeUsage.findMany({
      where: {
        kitchenId: kitchenId,
        createdAt: { gte: startOfMonth }
      },
      include: {
        recipe: {
          select: {
            sellingPrice: true,
            totalCost: true,
          }
        }
      }
    });

    // Calculate monthly recipe selling price with additional safety checks
    const monthlyRecipeSellingPrice = monthlyRecipeUsages.reduce((sum, usage) => {
      try {
        const sellingPrice = usage.recipe?.sellingPrice || 0;
        const servings = usage.servingsUsed || 0;
        return sum + (sellingPrice * servings);
      } catch (calcError) {
        console.error('Error calculating monthly recipe selling price for usage:', calcError);
        return sum;
      }
    }, 0);

    // Calculate monthly profit using the same formula: total recipes selling price - total waste - total cost
    // Ensure all values are numbers and not NaN
    const safeMonthlyRecipeSellingPrice = isNaN(monthlyRecipeSellingPrice) ? 0 : monthlyRecipeSellingPrice;
    const safeMonthlyWasteValue = isNaN(monthlyWasteValue) ? 0 : monthlyWasteValue;
    const safeMonthlyConsumedValue = isNaN(monthlyConsumedValue) ? 0 : monthlyConsumedValue;
    
    const monthlyTotalProfit = safeMonthlyRecipeSellingPrice - safeMonthlyWasteValue - safeMonthlyConsumedValue;
    
    logApiEvent(`Calculated monthly profit: Recipe Selling Price: ${safeMonthlyRecipeSellingPrice}, Waste: ${safeMonthlyWasteValue}, Cost: ${safeMonthlyConsumedValue}, Total Profit: ${monthlyTotalProfit}`);

    // Format all values to 2 decimal places and ensure they're valid numbers
    const formatNumber = (num: number) => {
      if (isNaN(num) || !isFinite(num)) return 0;
      return Number(num.toFixed(2));
    };
    
    // Calculate percentages safely
    const calculatePercentage = (value: number, total: number) => {
      if (total <= 0 || isNaN(value) || isNaN(total) || !isFinite(value) || !isFinite(total)) {
        return 0;
      }
      const percentage = (value / total) * 100;
      return Number(percentage.toFixed(1));
    };
    
    const response = {
      totalCost: formatNumber(safeCost),
      totalWaste: formatNumber(safeWaste),
      totalProfit: formatNumber(totalProfit),
      totalRecipeSellingPrice: formatNumber(safeRecipeSellingPrice),
      monthlyConsumedValue: formatNumber(safeMonthlyConsumedValue),
      monthlyWasteValue: formatNumber(safeMonthlyWasteValue),
      monthlyTotalProfit: formatNumber(monthlyTotalProfit),
      monthlyRecipeSellingPrice: formatNumber(safeMonthlyRecipeSellingPrice),
      wastePercentage: calculatePercentage(safeWaste, safeCost),
      profitMargin: calculatePercentage(totalProfit, safeRecipeSellingPrice)
    };

    // Log the calculated metrics for debugging
    console.log(`Kitchen ${kitchenId} metrics:`, {
      totalCost,
      totalWaste,
      totalProfit,
      monthlyConsumedValue,
      monthlyWasteValue,
      monthlyTotalProfit,
      wastePercentage: response.wastePercentage,
      profitMargin: response.profitMargin
    });

    logApiEvent(`Calculated financial metrics for kitchen ${kitchenId}`, response);
  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');


    return res.status(200).json(response);
  } catch (error) {
    logApiEvent('Error fetching kitchen financial metrics', error);
    return res.status(500).json({ 
      error: 'Failed to fetch kitchen financial metrics', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}