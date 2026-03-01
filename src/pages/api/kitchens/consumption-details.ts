// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { format, parseISO, getMonth, getYear } from 'date-fns';

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
    // Get kitchenId from query parameters
    const { kitchenId } = req.query;

    // Use the provided kitchenId without fallbacks to other kitchens
    const targetKitchenId = kitchenId as string;
    
    if (!targetKitchenId || targetKitchenId === 'undefined' || targetKitchenId === 'null') {
      return res.status(400).json({ 
        error: 'Kitchen ID is required',
        message: 'Please provide a valid kitchen ID',
        received: targetKitchenId
      });
    }

    // Get kitchen details
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: targetKitchenId }
    });

    if (!kitchen) {
      return res.status(404).json({ error: 'Kitchen not found' });
    }

    // Get consumption data for the kitchen
    const consumptions = await prisma.foodConsumption.findMany({
      where: {
        kitchenId: targetKitchenId
      },
      orderBy: {
        date: 'desc'
      },
      include: {
        foodSupply: {
          select: {
            id: true,
            name: true,
            unit: true,
            category: true,
            pricePerUnit: true
          },
        },
        user: {
          select: {
            email: true
          }
        }
      },
    });

    // Group consumptions by food supply
    const groupedConsumptions = consumptions.reduce((acc, curr) => {
      const key = curr.foodSupply.id;
      if (!acc[key]) {
        acc[key] = {
          id: curr.foodSupply.id,
          name: curr.foodSupply.name,
          unit: curr.foodSupply.unit,
          category: curr.foodSupply.category,
          totalQuantity: 0,
          consumptions: [],
          monthlyConsumption: {} as Record<string, number>
        };
      }
      
      // Add to total quantity
      acc[key].totalQuantity += curr.quantity;
      
      // Add to consumptions list
      acc[key].consumptions.push({
        id: curr.id,
        quantity: curr.quantity,
        date: curr.date,
        user: curr.user.email,
        notes: curr.notes
      });
      
      // Add to monthly consumption data
      const date = new Date(curr.date);
      const monthYear = format(date, 'MMM yyyy');
      
      if (!acc[key].monthlyConsumption[monthYear]) {
        acc[key].monthlyConsumption[monthYear] = 0;
      }
      acc[key].monthlyConsumption[monthYear] += curr.quantity;
      
      return acc;
    }, {} as Record<string, any>);

    // Get all unique months from the data
    const allMonths = new Set<string>();
    
    Object.values(groupedConsumptions).forEach((item: any) => {
      Object.keys(item.monthlyConsumption).forEach(month => {
        allMonths.add(month);
      });
    });
    
    // Sort months chronologically
    const sortedMonths = Array.from(allMonths).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    });
    
    // Prepare data for each food type by month
    const foodItems = Object.values(groupedConsumptions);
    
    // Create monthly consumption data by food type
    const monthlyConsumptionByFoodType = foodItems.map(item => {
      return {
        name: item.name,
        unit: item.unit,
        data: sortedMonths.map(month => item.monthlyConsumption[month] || 0)
      };
    });
    
    // Calculate total monthly consumption across all items (for reference)
    const totalMonthlyConsumption = sortedMonths.map(month => {
      return foodItems.reduce((total, item) => {
        return total + (item.monthlyConsumption[month] || 0);
      }, 0);
    });

    // Get waste data for this kitchen's food supplies
    const wasteData = await prisma.foodDisposal.findMany({
      where: {
        kitchenId: targetKitchenId, // Direct filter by kitchenId
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

    // Group waste by food supply and calculate cost
    const groupedWaste = wasteData.reduce((acc, curr) => {
      const key = curr.foodSupplyId;
      if (!acc[key]) {
        acc[key] = {
          id: curr.foodSupplyId,
          name: curr.foodSupply.name,
          unit: curr.foodSupply.unit,
          pricePerUnit: curr.foodSupply.pricePerUnit || 0,
          totalWasted: 0,
          totalWastedCost: 0,
          wasteReasons: {} as Record<string, { quantity: number; cost: number }>,
        };
      }

      // Add to total wasted (quantity and cost)
      acc[key].totalWasted += curr.quantity;
      acc[key].totalWastedCost += curr.quantity * (curr.foodSupply.pricePerUnit || 0);

      // Add to waste reasons (quantity and cost)
      const reason = curr.reason || 'Unknown';
      if (!acc[key].wasteReasons[reason]) {
        acc[key].wasteReasons[reason] = { quantity: 0, cost: 0 };
      }
      acc[key].wasteReasons[reason].quantity += curr.quantity;
      acc[key].wasteReasons[reason].cost += curr.quantity * (curr.foodSupply.pricePerUnit || 0);

      return acc;
    }, {} as Record<string, any>);

    // Calculate waste percentage for each food supply
    Object.values(groupedWaste).forEach((item: any) => {
      const consumption = groupedConsumptions[item.id];
      if (consumption) {
        item.wastePercentage = (item.totalWasted / (consumption.totalQuantity + item.totalWasted)) * 100;
      } else {
        item.wastePercentage = 0;
      }
    });

    // Format waste reasons for each item (include cost)
    Object.values(groupedWaste).forEach((item: any) => {
      const formattedReasons = [];
      for (const [reason, { quantity, cost }] of Object.entries(item.wasteReasons)) {
        formattedReasons.push({
          reason,
          quantity,
          cost,
          percentage: (quantity as number / item.totalWasted) * 100
        });
      }
      item.wasteReasons = formattedReasons;
    });

    // Calculate total waste and average waste percentage
    const totalWaste = Object.values(groupedWaste).reduce((sum, item: any) => sum + item.totalWasted, 0);
    const totalWasteCost = Object.values(groupedWaste).reduce((sum, item: any) => sum + item.totalWastedCost, 0);
    const avgWastePercentage = Object.values(groupedWaste).length > 0 
      ? Object.values(groupedWaste).reduce((sum, item: any) => sum + item.wastePercentage, 0) / Object.values(groupedWaste).length
      : 0;

    // Calculate waste by reason (cost)
    let wasteByExpiration = 0, wasteByIngredient = 0, wasteByExpirationCost = 0, wasteByIngredientCost = 0;
    Object.values(groupedWaste).forEach((item: any) => {
      for (const reason of item.wasteReasons) {
        if (reason.reason?.toLowerCase().includes("expire")) {
          wasteByExpiration += reason.quantity;
          wasteByExpirationCost += reason.cost;
        } else {
          wasteByIngredient += reason.quantity;
          wasteByIngredientCost += reason.cost;
        }
      }
    });

    // Fetch all recipe usages for this kitchen, including recipe details
    const recipeUsages = await prisma.recipeUsage.findMany({
      where: { kitchenId: targetKitchenId },
      select: {
        recipeId: true,
        servingsUsed: true,
        cost: true,
        sellingPrice: true,
        profit: true,
        waste: true,
        createdAt: true,
        recipe: {
          select: {
            id: true,
            name: true,
          }
        }
      },
    });

    // Sum up cost, sellingPrice, and profit from all recipe usages
    const totalRecipeCost = recipeUsages.reduce((sum, ru) => sum + (ru.cost || 0), 0);
    const totalRecipeSellingPrice = recipeUsages.reduce((sum, ru) => sum + (ru.sellingPrice || 0), 0);
    const totalRecipeProfit = recipeUsages.reduce((sum, ru) => sum + (ru.profit || 0), 0);

    // Group recipe usages by recipeId for per-recipe breakdown
    const recipeMap: Record<string, {
      recipeId: string;
      recipeName: string;
      totalServings: number;
      totalCost: number;
      totalSellingPrice: number;
      totalProfit: number;
      totalWaste: number;
      usages: any[];
    }> = {};

    for (const ru of recipeUsages) {
      const id = ru.recipeId;
      if (!id) continue;
      if (!recipeMap[id]) {
        recipeMap[id] = {
          recipeId: id,
          recipeName: ru.recipe?.name || "Unknown",
          totalServings: 0,
          totalCost: 0,
          totalSellingPrice: 0,
          totalProfit: 0,
          totalWaste: 0,
          usages: [],
        };
      }
      recipeMap[id].totalServings += ru.servingsUsed || 0;
      recipeMap[id].totalCost += ru.cost || 0;
      recipeMap[id].totalSellingPrice += ru.sellingPrice || 0;
      recipeMap[id].totalProfit += ru.profit || 0;
      recipeMap[id].totalWaste += ru.waste || 0;
      recipeMap[id].usages.push({
        servings: ru.servingsUsed,
        cost: ru.cost,
        sellingPrice: ru.sellingPrice,
        profit: ru.profit,
        waste: ru.waste,
        createdAt: ru.createdAt,
      });
    }

    // Prepare recipes array for response
    const recipes = Object.values(recipeMap).map(r => ({
      recipeId: r.recipeId,
      recipeName: r.recipeName,
      totalServings: r.totalServings,
      totalCost: r.totalCost,
      totalSellingPrice: r.totalSellingPrice,
      totalProfit: r.totalProfit,
      totalWaste: r.totalWaste,
      usages: r.usages,
    }));

    // Format the response with default empty values for new kitchens
    const response = {
      kitchen: {
        id: kitchen.id,
        name: kitchen.name
      },
      items: Object.values(groupedConsumptions),
      monthlyConsumption: {
        labels: sortedMonths.length > 0 ? sortedMonths : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        totalData: sortedMonths.length > 0 ? totalMonthlyConsumption : [0, 0, 0, 0, 0, 0],
        byFoodType: monthlyConsumptionByFoodType.length > 0 ? monthlyConsumptionByFoodType : []
      },
      waste: {
        items: Object.values(groupedWaste),
        totalWaste,
        totalWasteCost,
        avgWastePercentage,
        wasteByExpiration,
        wasteByExpirationCost,
        wasteByIngredient,
        wasteByIngredientCost,
      },
      // Add per-recipe consumption details
      recipes,
      // Format data for AI analysis component
      totalConsumption: foodItems.reduce((sum, item) => sum + item.totalQuantity, 0),
      totalWaste,
      totalWasteCost,
      wasteByExpiration,
      wasteByExpirationCost,
      wasteByIngredient,
      wasteByIngredientCost,
      totalCost: totalRecipeCost,
      totalSellingPrice: totalRecipeSellingPrice,
      totalProfit: totalRecipeProfit,
      kitchenEfficiency: totalWaste > 0 ? Math.round(100 - avgWastePercentage) : 100, // Default to 100% if no waste
      topWastedItems: Object.values(groupedWaste)
        .sort((a: any, b: any) => b.totalWasted - a.totalWasted)
        .slice(0, 3)
        .map((item: any) => ({
          name: item.name,
          amount: `${item.totalWasted.toFixed(1)}${item.unit}`,
          percentage: Math.round(item.wastePercentage)
        })),
      consumptionTrends: sortedMonths.length > 0 ? 
        sortedMonths.map((month, index) => ({
          month,
          value: totalMonthlyConsumption[index]
        })) : 
        [
          { month: 'Jan', value: 0 },
          { month: 'Feb', value: 0 },
          { month: 'Mar', value: 0 },
          { month: 'Apr', value: 0 },
          { month: 'May', value: 0 },
          { month: 'Jun', value: 0 }
        ],
      recommendations: foodItems.length > 0 ? [
        'Optimize inventory levels based on consumption patterns',
        'Review storage procedures for frequently wasted items',
        'Consider adjusting ordering quantities for seasonal items'
      ] : [
        'Start recording consumption data to receive personalized recommendations',
        'Set up inventory tracking for this kitchen',
        'Establish baseline consumption patterns for future analysis'
      ],
      anomalies: []
    };

    // Add anomalies if there are significant changes in consumption
    if (sortedMonths.length >= 2) {
      const lastMonthIndex = sortedMonths.length - 1;
      const prevMonthIndex = sortedMonths.length - 2;
      
      monthlyConsumptionByFoodType.forEach(item => {
        const lastMonthValue = item.data[lastMonthIndex];
        const prevMonthValue = item.data[prevMonthIndex];
        
        if (prevMonthValue > 0) {
          const changePercent = ((lastMonthValue - prevMonthValue) / prevMonthValue) * 100;
          
          if (Math.abs(changePercent) > 25) {
            response.anomalies.push({
              item: item.name,
              issue: `Consumption ${changePercent > 0 ? 'increased' : 'decreased'} by ${Math.abs(Math.round(changePercent))}% this month`,
              impact: Math.abs(changePercent) > 50 ? 'High' : 'Medium'
            });
          }
        }
      });
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Kitchen Consumption Details API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}