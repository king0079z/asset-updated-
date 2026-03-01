// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { format, subMonths } from 'date-fns';

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
    // Get all food consumption records grouped by kitchen and month
    const now = new Date();
    const sixMonthsAgo = subMonths(now, 12); // Get data for the last 12 months

    // Get all kitchens
    const kitchens = await prisma.kitchen.findMany({
      select: {
        id: true,
        name: true,
        floorNumber: true
      }
    });

    // Get consumption data for all kitchens
    const consumptionData = await prisma.foodConsumption.findMany({
      where: {
        date: {
          gte: sixMonthsAgo
        }
      },
      include: {
        kitchen: {
          select: {
            id: true,
            name: true,
            floorNumber: true
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
    
    // Get recipe usage data for all kitchens
    const recipeUsageData = await prisma.recipeUsage.findMany({
      where: {
        createdAt: {
          gte: sixMonthsAgo
        }
      },
      include: {
        kitchen: {
          select: {
            id: true,
            name: true,
            floorNumber: true
          }
        },
        recipe: {
          select: {
            name: true,
            totalCost: true,
            sellingPrice: true
          }
        }
      }
    });

    // Group by month and kitchen
    const monthlyData: Record<string, Record<string, { cost: number, revenue: number, profit: number }>> = {};
    const kitchenMap: Record<string, { name: string, floorNumber: number }> = {};

    // Initialize kitchen map
    kitchens.forEach(kitchen => {
      kitchenMap[kitchen.id] = {
        name: kitchen.name,
        floorNumber: kitchen.floorNumber
      };
    });

    // Initialize monthly data structure
    const initializeMonthlyData = (month: string, kitchenId: string) => {
      if (!monthlyData[month]) {
        monthlyData[month] = {};
      }

      if (!monthlyData[month][kitchenId]) {
        monthlyData[month][kitchenId] = {
          cost: 0,
          revenue: 0,
          profit: 0
        };
      }
    };

    // Process consumption data
    consumptionData.forEach(record => {
      const month = format(new Date(record.date), 'MMM yyyy');
      const kitchenId = record.kitchenId;
      const cost = record.quantity * (record.foodSupply.pricePerUnit || 0);

      initializeMonthlyData(month, kitchenId);
      monthlyData[month][kitchenId].cost += cost;
    });
    
    // Process recipe usage data
    recipeUsageData.forEach(record => {
      const month = format(new Date(record.createdAt), 'MMM yyyy');
      const kitchenId = record.kitchenId;
      const cost = record.recipe.totalCost * record.servingsUsed;
      const revenue = record.recipe.sellingPrice * record.servingsUsed;
      const profit = revenue - cost;

      initializeMonthlyData(month, kitchenId);
      monthlyData[month][kitchenId].cost += cost;
      monthlyData[month][kitchenId].revenue += revenue;
      monthlyData[month][kitchenId].profit += profit;
    });

    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });

    // Format data for chart
    const chartData = sortedMonths.map(month => {
      const monthData: Record<string, any> = { month };
      
      // Add data for each kitchen
      Object.keys(kitchenMap).forEach(kitchenId => {
        const kitchenName = kitchenMap[kitchenId].name;
        monthData[month] = monthData[month] || {};
        monthData[month][kitchenId] = monthData[month][kitchenId] || { cost: 0, revenue: 0, profit: 0 };
        
        monthData[`${kitchenName}_cost`] = monthlyData[month]?.[kitchenId]?.cost || 0;
        monthData[`${kitchenName}_revenue`] = monthlyData[month]?.[kitchenId]?.revenue || 0;
        monthData[`${kitchenName}_profit`] = monthlyData[month]?.[kitchenId]?.profit || 0;
      });

      return monthData;
    });

    // Get total consumption by kitchen
    const kitchenTotals = Object.keys(kitchenMap).map(kitchenId => {
      const kitchenName = kitchenMap[kitchenId].name;
      const floorNumber = kitchenMap[kitchenId].floorNumber;
      
      const totals = sortedMonths.reduce((acc, month) => {
        if (monthlyData[month]?.[kitchenId]) {
          acc.cost += monthlyData[month][kitchenId].cost || 0;
          acc.revenue += monthlyData[month][kitchenId].revenue || 0;
          acc.profit += monthlyData[month][kitchenId].profit || 0;
        }
        return acc;
      }, { cost: 0, revenue: 0, profit: 0 });

      return {
        id: kitchenId,
        name: kitchenName,
        floorNumber,
        totalCost: totals.cost,
        totalRevenue: totals.revenue,
        totalProfit: totals.profit
      };
    }).sort((a, b) => b.totalCost - a.totalCost); // Sort by total cost (descending)

    // Generate AI recommendations based on profit data
    const aiRecommendations = kitchenTotals.map(kitchen => {
      const recommendations = [];
      
      // Check if kitchen has negative profit
      if (kitchen.totalProfit < 0) {
        recommendations.push(`Increase selling prices for recipes in ${kitchen.name} to improve profitability.`);
        recommendations.push(`Review ingredient costs and portion sizes in ${kitchen.name} to reduce expenses.`);
      }
      
      // Check if kitchen has low revenue compared to costs
      if (kitchen.totalRevenue > 0 && kitchen.totalProfit / kitchen.totalRevenue < 0.2) {
        recommendations.push(`Optimize menu in ${kitchen.name} to focus on higher-margin recipes.`);
      }
      
      // Add general recommendation if kitchen is profitable
      if (kitchen.totalProfit > 0) {
        recommendations.push(`Promote best-selling recipes from ${kitchen.name} to other kitchens to increase overall revenue.`);
      }
      
      return {
        kitchenId: kitchen.id,
        kitchenName: kitchen.name,
        recommendations: recommendations.length > 0 ? recommendations : [`${kitchen.name} is performing well. Continue monitoring for optimization opportunities.`]
      };
    });
  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');


    return res.status(200).json({
      months: sortedMonths,
      chartData,
      kitchenTotals,
      aiRecommendations
    });
  } catch (error) {
    console.error('Monthly Kitchen Consumption API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}