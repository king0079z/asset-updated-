import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

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
    console.log('Food Disposals API - Request query:', req.query);
    
    // Get query parameters
    const { foodSupplyId, recipeId, startDate, endDate, limit = '50' } = req.query;
    
    // Build filter conditions
    const where: any = {};

    // NEW: Filter by kitchenId if provided
    const { kitchenId } = req.query;
    if (kitchenId && kitchenId !== '') {
      where.kitchenId = kitchenId as string;
      console.log(`Filtering by kitchenId: ${kitchenId}`);
    }

    if (foodSupplyId && foodSupplyId !== '') {
      where.foodSupplyId = foodSupplyId as string;
      console.log(`Filtering by foodSupplyId: ${foodSupplyId}`);
    }

    if (recipeId && recipeId !== '') {
      where.recipeId = recipeId as string;
      console.log(`Filtering by recipeId: ${recipeId}`);
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
      console.log(`Filtering by date range: ${startDate} to ${endDate}`);
    } else if (startDate) {
      where.createdAt = {
        gte: new Date(startDate as string)
      };
      console.log(`Filtering by start date: ${startDate}`);
    } else if (endDate) {
      where.createdAt = {
        lte: new Date(endDate as string)
      };
      console.log(`Filtering by end date: ${endDate}`);
    }
    
    // Get disposals with pagination
    const disposals = await prisma.foodDisposal.findMany({
      where,
      include: {
        foodSupply: {
          select: {
            id: true,
            name: true,
            unit: true,
            category: true
          }
        },
        user: {
          select: {
            id: true,
            email: true
          }
        },
        recipe: {
          select: {
            id: true,
            name: true,
            servings: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: parseInt(limit as string)
    });
    
    console.log(`Found ${disposals.length} waste records`);
    
    // Validate each record has required fields
    const validatedDisposals = disposals.map(record => {
      // Ensure foodSupply exists
      if (!record.foodSupply) {
        console.error(`Record ${record.id} is missing foodSupply data`);
        return {
          ...record,
          foodSupply: {
            id: 'unknown',
            name: 'Unknown Item',
            unit: 'units',
            category: 'other'
          }
        };
      }
      return record;
    });
    
    // Get total waste cost
    const totalWasteCost = await prisma.foodDisposal.aggregate({
      where,
      _sum: {
        cost: true
      }
    });
    
    console.log(`Total waste cost: ${totalWasteCost._sum.cost || 0}`);
    
    // Get waste by reason
    const wasteByReason = await prisma.foodDisposal.groupBy({
      by: ['reason'],
      where,
      _sum: {
        cost: true,
        quantity: true
      }
    });

    // Get waste by source
    const wasteBySource = await prisma.foodDisposal.groupBy({
      by: ['source'],
      where,
      _sum: {
        cost: true,
        quantity: true
      }
    });

    // --- NEW: Waste by Category ---
    // Define mapping for the three waste categories
    const categoryMap = {
      ingredientWaste: ['ingredient_waste', 'waste_percentage', 'ingredient_loss'],
      servingWaste: ['serving_waste', 'overproduction', 'leftover'],
      expirationWaste: ['expired', 'expiration', 'expiry']
    };

    // Helper to check if a reason belongs to a category
    function isReasonInCategory(reason: string, category: string) {
      return categoryMap[category as keyof typeof categoryMap].some((r) =>
        reason?.toLowerCase().includes(r)
      );
    }

    // Aggregate waste by category
    const wasteByCategory = {
      ingredientWaste: wasteByReason.filter(r => isReasonInCategory(r.reason, 'ingredientWaste')),
      servingWaste: wasteByReason.filter(r => isReasonInCategory(r.reason, 'servingWaste')),
      expirationWaste: wasteByReason.filter(r => isReasonInCategory(r.reason, 'expirationWaste')),
    };

    // --- NEW: Waste by Category per Month (for chart/forecast) ---
    // Get all records for the last 12 months for monthly aggregation
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const monthlyDisposals = await prisma.foodDisposal.findMany({
      where: {
        ...where,
        createdAt: {
          gte: startOfYear
        }
      },
      select: {
        id: true,
        reason: true,
        cost: true,
        quantity: true,
        createdAt: true
      }
    });

    // --- NEW: Waste by Category per Day (for chart) ---
    // Get all records for the last 60 days for daily aggregation
    const startOf60Days = new Date(now);
    startOf60Days.setDate(now.getDate() - 59);
    const dailyDisposals = await prisma.foodDisposal.findMany({
      where: {
        ...where,
        createdAt: {
          gte: startOf60Days
        }
      },
      select: {
        id: true,
        reason: true,
        cost: true,
        quantity: true,
        createdAt: true
      }
    });

    // Helper to get YYYY-MM string
    function getMonthKey(date: Date) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    // Helper to get YYYY-MM-DD string
    function getDayKey(date: Date) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    // Build monthly aggregation for each category
    function aggregateMonthly(disposals: any[], category: keyof typeof categoryMap) {
      const monthly: Record<string, { cost: number; quantity: number }> = {};
      for (const d of disposals) {
        if (isReasonInCategory(d.reason, category)) {
          const month = getMonthKey(new Date(d.createdAt));
          if (!monthly[month]) monthly[month] = { cost: 0, quantity: 0 };
          monthly[month].cost += Number(d.cost) || 0;
          monthly[month].quantity += Number(d.quantity) || 0;
        }
      }
      // Convert to array sorted by month
      return Object.entries(monthly)
        .map(([month, v]) => ({ month, ...v }))
        .sort((a, b) => a.month.localeCompare(b.month));
    }

    // Build daily aggregation for each category
    function aggregateDaily(disposals: any[], category: keyof typeof categoryMap) {
      const daily: Record<string, { cost: number; quantity: number }> = {};
      for (const d of disposals) {
        if (isReasonInCategory(d.reason, category)) {
          const day = getDayKey(new Date(d.createdAt));
          if (!daily[day]) daily[day] = { cost: 0, quantity: 0 };
          daily[day].cost += Number(d.cost) || 0;
          daily[day].quantity += Number(d.quantity) || 0;
        }
      }
      // Convert to array sorted by day
      return Object.entries(daily)
        .map(([day, v]) => ({ day, ...v }))
        .sort((a, b) => a.day.localeCompare(b.day));
    }

    const wasteByCategoryMonthly = {
      ingredientWaste: aggregateMonthly(monthlyDisposals, 'ingredientWaste'),
      servingWaste: aggregateMonthly(monthlyDisposals, 'servingWaste'),
      expirationWaste: aggregateMonthly(monthlyDisposals, 'expirationWaste'),
    };

    const wasteByCategoryDaily = {
      ingredientWaste: aggregateDaily(dailyDisposals, 'ingredientWaste'),
      servingWaste: aggregateDaily(dailyDisposals, 'servingWaste'),
      expirationWaste: aggregateDaily(dailyDisposals, 'expirationWaste'),
    };

    // --- NEW: AI Forecast for next 3 months (simple linear forecast as placeholder) ---
    function forecastNextMonths(monthlyData: { month: string; cost: number }[], months = 3) {
      // Use average of last 3 months as forecast (replace with ML later)
      const last3 = monthlyData.slice(-3);
      const avg = last3.length > 0 ? last3.reduce((sum, d) => sum + d.cost, 0) / last3.length : 0;
      const lastMonth = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].month : getMonthKey(now);
      const [year, m] = lastMonth.split('-').map(Number);
      const forecast: { month: string; cost: number }[] = [];
      for (let i = 1; i <= months; i++) {
        let nextMonth = m + i;
        let nextYear = year;
        if (nextMonth > 12) {
          nextYear += Math.floor((nextMonth - 1) / 12);
          nextMonth = ((nextMonth - 1) % 12) + 1;
        }
        forecast.push({
          month: `${nextYear}-${String(nextMonth).padStart(2, '0')}`,
          cost: Math.round(avg * 100) / 100
        });
      }
      return forecast;
    }

    const forecast = {
      ingredientWaste: forecastNextMonths(wasteByCategoryMonthly.ingredientWaste),
      servingWaste: forecastNextMonths(wasteByCategoryMonthly.servingWaste),
      expirationWaste: forecastNextMonths(wasteByCategoryMonthly.expirationWaste),
    };
  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');


    return res.status(200).json({
      disposals: validatedDisposals,
      totalWasteCost: totalWasteCost._sum.cost || 0,
      wasteByReason,
      wasteBySource,
      wasteByCategory,
      wasteByCategoryMonthly,
      wasteByCategoryDaily, // NEW: daily waste data
      forecast
    });
  } catch (error) {
    console.error('Food Disposals API Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error' 
    });
  }
}