import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

// Enhanced logging function
const logApiEvent = (message: string, data?: any) => {
  try {
    const timestamp = new Date().toISOString();
    console.info(`${timestamp} info: Path: /api/food-supply/expenses ${message}`);
    if (data) {
      if (typeof data === 'object') {
        try {
          // Handle circular references in objects
          const seen = new WeakSet();
          const safeData = JSON.stringify(data, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) {
                return '[Circular Reference]';
              }
              seen.add(value);
            }
            return value;
          });
          console.info(`${timestamp} info: Path: /api/food-supply/expenses Data: ${safeData}`);
        } catch (jsonError) {
          console.info(`${timestamp} info: Path: /api/food-supply/expenses Data: [Object that couldn't be stringified]`);
        }
      } else {
        console.info(`${timestamp} info: Path: /api/food-supply/expenses Data: ${data}`);
      }
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
    // Wrap Supabase client creation in try-catch to handle potential errors
    let user;
    try {
      const supabase = createClient(req, res);
      // Handle potential null response from auth.getUser()
      const authResponse = await supabase.auth.getUser();
      
      if (!authResponse || !authResponse.data) {
        logApiEvent('Authentication response is null or undefined');
        return res.status(200).json({ 
          monthlyTotal: 0,
          yearlyTotal: 0,
          totalFoodItems: 0,
          lowStockItems: 0,
          totalValue: 0,
          totalConsumed: 0,
          stockLevel: 0,
          topSupplies: [],
          message: 'Authentication service error - Using default values'
        });
      }
      
      const { data, error: authError } = authResponse;
      user = data?.user;

      if (authError || !user) {
        logApiEvent('Authentication error', authError);
        return res.status(200).json({ 
          monthlyTotal: 0,
          yearlyTotal: 0,
          totalFoodItems: 0,
          lowStockItems: 0,
          totalValue: 0,
          totalConsumed: 0,
          stockLevel: 0,
          topSupplies: [],
          message: 'Authentication error - Using default values'
        });
      }
    } catch (authError) {
      logApiEvent('Unexpected authentication error', authError);
      return res.status(200).json({ 
        monthlyTotal: 0,
        yearlyTotal: 0,
        totalFoodItems: 0,
        lowStockItems: 0,
        totalValue: 0,
        totalConsumed: 0,
        stockLevel: 0,
        topSupplies: [],
        message: 'Authentication service error - Using default values'
      });
    }

    logApiEvent(`Processing food expenses for user: ${user.id}`);

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    try {
      // Get monthly food consumption
      const monthlyConsumption = await prisma.foodConsumption.findMany({
        where: {
          userId: user.id,
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

      // Get yearly food consumption
      const yearlyConsumption = await prisma.foodConsumption.findMany({
        where: {
          userId: user.id,
          date: { gte: startOfYear }
        },
        include: {
          foodSupply: {
            select: {
              pricePerUnit: true
            }
          }
        }
      });

      // Calculate monthly total with safe access
      const monthlyTotal = monthlyConsumption.reduce((sum, record) => {
        const pricePerUnit = record.foodSupply?.pricePerUnit || 0;
        return sum + (record.quantity * pricePerUnit);
      }, 0);

      // Calculate yearly total with safe access
      const yearlyTotal = yearlyConsumption.reduce((sum, record) => {
        const pricePerUnit = record.foodSupply?.pricePerUnit || 0;
        return sum + (record.quantity * pricePerUnit);
      }, 0);

      // Get total food items and low stock items
      const [totalFoodItems, lowStockItems] = await Promise.all([
        prisma.foodSupply.count({
          where: { userId: user.id }
        }),
        prisma.foodSupply.count({
          where: {
            userId: user.id,
            quantity: { lte: 10 }
          }
        })
      ]);

      // Get total value of all food supply items
      const foodSupplies = await prisma.foodSupply.findMany({
        where: {
          userId: user.id
        },
        select: {
          quantity: true,
          pricePerUnit: true
        }
      });

      const totalValue = foodSupplies.reduce((sum, item) => {
        return sum + (item.quantity * (item.pricePerUnit || 0));
      }, 0);

      // Get total consumed value with safe access
      const consumptionStats = await prisma.foodConsumption.findMany({
        where: {
          userId: user.id
        },
        include: {
          foodSupply: {
            select: {
              pricePerUnit: true
            }
          }
        }
      });

      const totalConsumed = consumptionStats.reduce((sum, record) => {
        const pricePerUnit = record.foodSupply?.pricePerUnit || 0;
        return sum + (record.quantity * pricePerUnit);
      }, 0);

      // Get top food supplies by value
      const topFoodSupplies = await prisma.foodSupply.findMany({
        where: {
          userId: user.id
        },
        select: {
          id: true,
          name: true,
          quantity: true,
          unit: true,
          expirationDate: true,
          pricePerUnit: true,
          consumption: {
            select: {
              quantity: true
            }
          }
        },
        orderBy: {
          pricePerUnit: 'desc'
        },
        take: 3
      });

      // Calculate total and consumed quantities for each food supply
      const topSuppliesWithDetails = topFoodSupplies.map(supply => {
        const totalConsumed = supply.consumption.reduce((sum, record) => sum + record.quantity, 0);
        const remainingQuantity = supply.quantity;
        const totalQuantity = remainingQuantity + totalConsumed;
        const consumedPercentage = totalQuantity > 0 ? (totalConsumed / totalQuantity) * 100 : 0;
        
        return {
          id: supply.id,
          name: supply.name,
          quantity: supply.quantity,
          unit: supply.unit,
          expirationDate: supply.expirationDate,
          pricePerUnit: supply.pricePerUnit || 0,
          totalValue: supply.quantity * (supply.pricePerUnit || 0),
          consumedQuantity: totalConsumed,
          remainingQuantity,
          consumedPercentage
        };
      });

      logApiEvent(`Calculated food expenses: monthly=${monthlyTotal}, yearly=${yearlyTotal}, totalValue=${totalValue}`);

      return res.status(200).json({
        monthlyTotal: Number(monthlyTotal.toFixed(2)),
        yearlyTotal: Number(yearlyTotal.toFixed(2)),
        totalFoodItems,
        lowStockItems,
        totalValue: Number(totalValue.toFixed(2)),
        totalConsumed: Number(totalConsumed.toFixed(2)),
        stockLevel: totalValue > 0 ? 100 : 0,
        topSupplies: topSuppliesWithDetails
      });
    } catch (dbError) {
      logApiEvent('Database error in food expenses calculation', dbError);
      return res.status(500).json({ 
        message: 'Error calculating food expenses',
        error: dbError instanceof Error ? dbError.message : 'Unknown database error'
      });
    }
  } catch (error) {
    logApiEvent('Error getting food expenses', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}