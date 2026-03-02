import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { format, subMonths } from 'date-fns';

// Type definitions for the response
interface ConsumptionData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
  }[];
}

interface WasteData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string[];
    borderColor: string[];
  }[];
}

interface Insight {
  id: string;
  type: 'positive' | 'negative' | 'neutral' | 'suggestion';
  title: string;
  description: string;
  impact?: 'high' | 'medium' | 'low';
  actionable: boolean;
  action?: string;
}

interface KitchenAnalysis {
  consumptionTrend: ConsumptionData;
  wasteTrend: WasteData;
  costAnalysis: {
    totalCost: number;
    wasteCost: number;
    savingsOpportunity: number;
    costTrend: number;
  };
  insights: Insight[];
  topItems: {
    mostConsumed: {
      name: string;
      quantity: number;
      unit: string;
      trend: number;
    }[];
    mostWasted: {
      name: string;
      quantity: number;
      unit: string;
      reason: string;
    }[];
  };
  recommendations: {
    inventoryOptimization: string[];
    wasteReduction: string[];
    costSaving: string[];
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
    const { kitchenId, allKitchens } = req.query;

    if (!kitchenId) {
      return res.status(400).json({ 
        error: 'Kitchen ID is required',
        message: 'Please provide a valid kitchen ID to analyze consumption data'
      });
    }

    // Check if user has access to this kitchen
    const kitchenAssignment = await prisma.kitchenAssignment.findFirst({
      where: {
        kitchenId: kitchenId as string,
        userId: user.id
      }
    });

    const isAdmin = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true, role: true }
    });

    // If user is not admin and doesn't have assignment to this kitchen, return error
    if (!isAdmin?.isAdmin && isAdmin?.role !== 'MANAGER' && !kitchenAssignment) {
      return res.status(403).json({ error: 'You do not have access to this kitchen' });
    }

    // Get kitchen details
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId as string }
    });

    if (!kitchen) {
      return res.status(404).json({ error: 'Kitchen not found' });
    }

    // If allKitchens is true and user is admin or manager, we'll still use the provided kitchenId
    // for data fetching, but we'll note in the response that this is an aggregated analysis
    const isAllKitchensView = allKitchens === 'true';

    // Get consumption data for the last 6 months
    const sixMonthsAgo = subMonths(new Date(), 6);
    
    // Get consumption data
    const consumptionData = await prisma.foodConsumption.findMany({
      where: {
        kitchenId: kitchenId as string,
        date: {
          gte: sixMonthsAgo
        }
      },
      include: {
        foodSupply: {
          select: {
            name: true,
            unit: true,
            pricePerUnit: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Get waste data
    const wasteData = await prisma.foodDisposal.findMany({
      where: {
        createdAt: {
          gte: sixMonthsAgo
        },
        foodSupply: {
          consumption: {
            some: {
              kitchenId: kitchenId as string
            }
          }
        }
      },
      include: {
        foodSupply: {
          select: {
            name: true,
            unit: true,
            pricePerUnit: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Get recipe usage data
    const recipeUsageData = await prisma.recipeUsage.findMany({
      where: {
        kitchenId: kitchenId as string,
        createdAt: {
          gte: sixMonthsAgo
        }
      },
      include: {
        recipe: {
          include: {
            ingredients: {
              include: {
                foodSupply: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Process data to generate analysis
    // Group consumption by month
    const consumptionByMonth: Record<string, number> = {};
    const costByMonth: Record<string, number> = {};
    
    consumptionData.forEach(item => {
      const month = format(new Date(item.date), 'MMM yyyy');
      if (!consumptionByMonth[month]) {
        consumptionByMonth[month] = 0;
        costByMonth[month] = 0;
      }
      consumptionByMonth[month] += item.quantity;
      costByMonth[month] += item.quantity * (item.foodSupply.pricePerUnit || 0);
    });

    // Group waste by reason
    const wasteByReason: Record<string, number> = {};
    let totalWasteCost = 0;
    
    wasteData.forEach(item => {
      const reason = item.reason || 'unknown';
      if (!wasteByReason[reason]) {
        wasteByReason[reason] = 0;
      }
      wasteByReason[reason] += item.quantity;
      totalWasteCost += item.quantity * (item.foodSupply.pricePerUnit || 0);
    });

    // Get most consumed items
    const consumptionByItem: Record<string, { quantity: number; unit: string; trend: number }> = {};
    
    consumptionData.forEach(item => {
      const name = item.foodSupply.name;
      if (!consumptionByItem[name]) {
        consumptionByItem[name] = { quantity: 0, unit: item.foodSupply.unit, trend: 0 };
      }
      consumptionByItem[name].quantity += item.quantity;
    });

    // Calculate real per-item trends: compare last 3 months vs prior 3 months
    const threeMonthsAgo = subMonths(new Date(), 3);
    const recentItemQty: Record<string, number> = {};
    const olderItemQty: Record<string, number> = {};
    consumptionData.forEach(item => {
      const name = item.foodSupply.name;
      if (new Date(item.date) >= threeMonthsAgo) {
        recentItemQty[name] = (recentItemQty[name] || 0) + item.quantity;
      } else {
        olderItemQty[name] = (olderItemQty[name] || 0) + item.quantity;
      }
    });
    Object.keys(consumptionByItem).forEach(key => {
      const recent = recentItemQty[key] || 0;
      const older = olderItemQty[key] || 0;
      let trend = 0;
      if (older > 0) {
        trend = ((recent - older) / older) * 100;
      } else if (recent > 0) {
        trend = 100;
      }
      consumptionByItem[key].trend = Math.round(Math.max(Math.min(trend, 200), -100) * 10) / 10;
    });

    // Get most wasted items
    const wasteByItem: Record<string, { quantity: number; unit: string; reason: string }> = {};
    
    wasteData.forEach(item => {
      const name = item.foodSupply.name;
      if (!wasteByItem[name]) {
        wasteByItem[name] = { 
          quantity: 0, 
          unit: item.foodSupply.unit, 
          reason: item.reason || 'unknown' 
        };
      }
      wasteByItem[name].quantity += item.quantity;
    });

    // Prepare consumption trend data
    const months = Object.keys(consumptionByMonth).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });

    const consumptionTrend: ConsumptionData = {
      labels: months,
      datasets: [
        {
          label: 'Consumption',
          data: months.map(month => consumptionByMonth[month] || 0),
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
        }
      ]
    };

    // Prepare waste trend data
    const wasteReasons = Object.keys(wasteByReason);
    const wasteTrend: WasteData = {
      labels: wasteReasons,
      datasets: [
        {
          label: 'Waste by Reason',
          data: wasteReasons.map(reason => wasteByReason[reason] || 0),
          backgroundColor: [
            'rgba(255, 99, 132, 0.2)',
            'rgba(255, 159, 64, 0.2)',
            'rgba(255, 205, 86, 0.2)',
            'rgba(54, 162, 235, 0.2)',
            'rgba(153, 102, 255, 0.2)',
            'rgba(201, 203, 207, 0.2)'
          ],
          borderColor: [
            'rgb(255, 99, 132)',
            'rgb(255, 159, 64)',
            'rgb(255, 205, 86)',
            'rgb(54, 162, 235)',
            'rgb(153, 102, 255)',
            'rgb(201, 203, 207)'
          ],
        }
      ]
    };

    // Calculate total cost and cost trend
    const totalCost = Object.values(costByMonth).reduce((sum, cost) => sum + cost, 0);
    
    // Calculate cost trend (comparing last month to previous month)
    let costTrend = 0;
    if (months.length >= 2) {
      const lastMonth = months[months.length - 1];
      const previousMonth = months[months.length - 2];
      const lastMonthCost = costByMonth[lastMonth] || 0;
      const previousMonthCost = costByMonth[previousMonth] || 0;
      
      if (previousMonthCost > 0) {
        costTrend = ((lastMonthCost - previousMonthCost) / previousMonthCost) * 100;
      }
    }

    // Calculate savings opportunity (assume 75% of waste could be saved)
    const savingsOpportunity = totalWasteCost * 0.75;

    // Generate insights based on the data
    const insights: Insight[] = [];
    
    // Add consumption trend insight
    if (months.length >= 2) {
      const lastMonth = months[months.length - 1];
      const previousMonth = months[months.length - 2];
      const lastMonthConsumption = consumptionByMonth[lastMonth] || 0;
      const previousMonthConsumption = consumptionByMonth[previousMonth] || 0;
      
      if (lastMonthConsumption > previousMonthConsumption * 1.1) {
        // Consumption increased by more than 10%
        insights.push({
          id: '1',
          type: 'negative',
          title: 'Consumption Increased Significantly',
          description: `Consumption in ${lastMonth} increased by ${Math.round(((lastMonthConsumption - previousMonthConsumption) / previousMonthConsumption) * 100)}% compared to ${previousMonth}. Consider reviewing kitchen operations for potential inefficiencies.`,
          impact: 'medium',
          actionable: true,
          action: 'Review Kitchen Operations'
        });
      } else if (lastMonthConsumption < previousMonthConsumption * 0.9) {
        // Consumption decreased by more than 10%
        insights.push({
          id: '1',
          type: 'positive',
          title: 'Consumption Efficiency Improved',
          description: `Consumption in ${lastMonth} decreased by ${Math.round(((previousMonthConsumption - lastMonthConsumption) / previousMonthConsumption) * 100)}% compared to ${previousMonth}. Continue with current efficiency measures.`,
          impact: 'high',
          actionable: false
        });
      }
    }

    // Add waste insight
    if (Object.keys(wasteByReason).length > 0) {
      const topWasteReason = Object.entries(wasteByReason)
        .sort((a, b) => b[1] - a[1])[0];
      
      insights.push({
        id: '2',
        type: 'negative',
        title: `High Waste Due to ${topWasteReason[0]}`,
        description: `${Math.round((topWasteReason[1] / Object.values(wasteByReason).reduce((sum, val) => sum + val, 0)) * 100)}% of waste is due to ${topWasteReason[0]}. Addressing this issue could significantly reduce waste costs.`,
        impact: 'medium',
        actionable: true,
        action: `Reduce ${topWasteReason[0]} Waste`
      });
    }

    // Add cost insight
    if (costTrend > 10) {
      insights.push({
        id: '3',
        type: 'negative',
        title: 'Costs Increasing Rapidly',
        description: `Food costs have increased by ${Math.round(costTrend)}% compared to the previous month. Review purchasing practices and menu planning.`,
        impact: 'high',
        actionable: true,
        action: 'Review Purchasing Practices'
      });
    } else if (costTrend < -10) {
      insights.push({
        id: '3',
        type: 'positive',
        title: 'Cost Efficiency Improved',
        description: `Food costs have decreased by ${Math.round(Math.abs(costTrend))}% compared to the previous month. Continue with current cost-saving measures.`,
        impact: 'high',
        actionable: false
      });
    }

    // Add seasonal insight
    insights.push({
      id: '4',
      type: 'neutral',
      title: 'Seasonal Menu Impact',
      description: 'Consider adjusting menu items based on seasonal availability to reduce costs and improve freshness.',
      impact: 'low',
      actionable: true,
      action: 'Review Seasonal Menu Options'
    });

    // Generate data-driven recommendations based on actual kitchen metrics
    const topConsumedNames = Object.entries(consumptionByItem)
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .slice(0, 2)
      .map(([name]) => name);
    const topWastedNames = Object.entries(wasteByItem)
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .slice(0, 2)
      .map(([name]) => name);
    const topWasteReasonEntry = Object.entries(wasteByReason).sort((a, b) => b[1] - a[1])[0];
    const topWasteReason = topWasteReasonEntry ? topWasteReasonEntry[0] : null;
    const wasteRatio = totalCost > 0 ? (totalWasteCost / totalCost) * 100 : 0;
    const recommendations = {
      inventoryOptimization: [
        topConsumedNames.length > 0
          ? `${topConsumedNames.join(' and ')} are your highest-consumption items — ensure stock levels support at least 2 weeks of usage.`
          : 'Track consumption patterns over the next month to identify high-velocity items for priority stocking.',
        'Apply FIFO (first-in, first-out) rotation especially for perishables to cut expiry waste.',
        costTrend > 10
          ? `Costs rose ${Math.round(costTrend)}% last month — review order quantities and supplier pricing for frequently used items.`
          : 'Review order frequencies monthly and adjust quantities based on 30-day rolling consumption averages.'
      ],
      wasteReduction: [
        topWastedNames.length > 0
          ? `${topWastedNames.join(' and ')} account for the most waste — schedule them into meals earlier in the week.`
          : 'Log disposal reasons consistently so patterns can be identified and addressed.',
        topWasteReason === 'expired'
          ? 'Expiry is the leading waste cause — order smaller, more frequent batches for perishables.'
          : topWasteReason === 'overproduction'
          ? 'Overproduction is driving waste — align batch sizes more closely with daily demand forecasts.'
          : 'Train kitchen staff on proper storage temperatures and container sealing to extend shelf life.',
        wasteRatio > 15
          ? `Waste is ${Math.round(wasteRatio)}% of total cost — consider running a weekly waste audit to identify the biggest opportunities.`
          : 'Repurpose excess pre-cut ingredients into staff meals or specials before they expire.'
      ],
      costSaving: [
        topConsumedNames.length > 0
          ? `Negotiate volume discounts for ${topConsumedNames[0]} — it is your most-consumed ingredient.`
          : 'Request quarterly pricing reviews from your primary suppliers for your top 5 ingredients.',
        'Compare vendor quotes for items where multiple suppliers are available.',
        costTrend > 5
          ? 'Costs are trending up — standardise portion sizes in all recipes to prevent over-use of expensive ingredients.'
          : 'Maintain current cost controls and review menu pricing quarterly against ingredient cost movements.'
      ]
    };

    // Prepare the final analysis object
    const analysis: KitchenAnalysis = {
      consumptionTrend,
      wasteTrend,
      costAnalysis: {
        totalCost,
        wasteCost: totalWasteCost,
        savingsOpportunity,
        costTrend
      },
      insights,
      topItems: {
        mostConsumed: Object.entries(consumptionByItem)
          .sort((a, b) => b[1].quantity - a[1].quantity)
          .slice(0, 3)
          .map(([name, data]) => ({
            name,
            quantity: data.quantity,
            unit: data.unit,
            trend: data.trend
          })),
        mostWasted: Object.entries(wasteByItem)
          .sort((a, b) => b[1].quantity - a[1].quantity)
          .slice(0, 3)
          .map(([name, data]) => ({
            name,
            quantity: data.quantity,
            unit: data.unit,
            reason: data.reason
          }))
      },
      recommendations
    };

    // Add metadata to indicate if this is an all-kitchens view
    const responseData = {
      ...analysis,
      metadata: {
        isAllKitchensView: isAllKitchensView,
        baseKitchenId: kitchenId,
        baseKitchenName: kitchen.name
      }
    };

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Kitchen AI Analysis API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}