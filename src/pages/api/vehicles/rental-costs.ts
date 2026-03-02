import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from "@/util/supabase/api";

// Simple in-memory cache for rental costs
interface CacheEntry {
  data: any;
  timestamp: number;
}

// Global cache object
if (!global._rentalCostsCache) {
  global._rentalCostsCache = {} as Record<string, CacheEntry>;
}

// Cache TTL in milliseconds (10 minutes)
const CACHE_TTL = 10 * 60 * 1000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { session }, error } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (error || !user) {
      console.error('Auth error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Check for force refresh query parameter
    const forceRefresh = req.query.refresh === 'true';
    
    // Create a cache key based on the current month and year
    const today = new Date();
    const cacheKey = `rental-costs-${today.getFullYear()}-${today.getMonth()}`;
    
    // Check if we have a valid cache entry
    const cachedData = global._rentalCostsCache[cacheKey];
    const now = Date.now();
    
    // Use cache if it exists, is not expired, and force refresh is not requested
    if (cachedData && (now - cachedData.timestamp < CACHE_TTL) && !forceRefresh) {
      console.log('Using cached rental costs data');
      return res.status(200).json({
        ...cachedData.data,
        fromCache: true
      });
    }
    
    console.log('Fetching vehicles for rental cost calculation');
    
    // Get all vehicles to calculate the total monthly and yearly rental costs
    const vehicles = await prisma.vehicle.findMany({
      select: {
        id: true,
        rentalAmount: true,
        status: true
      }
    });

    console.log(`Found ${vehicles.length} vehicles for expense calculation`);

    // Calculate monthly rental total based on the sum of all vehicle rental amounts
    const monthlyRentalTotal = vehicles.reduce((sum, vehicle) => {
      const amount = vehicle.rentalAmount || 0;
      return sum + amount;
    }, 0);

    const yearlyRentalTotal = monthlyRentalTotal * 12; // Yearly projection is monthly total × 12

    // Calculate maintenance costs for the current month and year
    const nowDate = new Date();
    const startOfMonth = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
    const startOfYear = new Date(nowDate.getFullYear(), 0, 1);

    // Sum maintenance costs for the current month
    const monthlyMaintenance = await prisma.vehicleMaintenance.aggregate({
      _sum: { cost: true },
      where: {
        maintenanceDate: {
          gte: startOfMonth,
          lte: nowDate
        }
      }
    });

    // Sum maintenance costs for the current year
    const yearlyMaintenance = await prisma.vehicleMaintenance.aggregate({
      _sum: { cost: true },
      where: {
        maintenanceDate: {
          gte: startOfYear,
          lte: nowDate
        }
      }
    });

    const monthlyMaintenanceTotal = Number(monthlyMaintenance._sum.cost || 0);
    const yearlyMaintenanceTotal = Number(yearlyMaintenance._sum.cost || 0);

    // Combined totals
    const monthlyTotal = monthlyRentalTotal + monthlyMaintenanceTotal;
    const yearlyTotal = yearlyRentalTotal + yearlyMaintenanceTotal;

    console.log(`Calculated monthly rental (QAR): ${monthlyRentalTotal}, monthly maintenance (QAR): ${monthlyMaintenanceTotal}, total: ${monthlyTotal}`);
    console.log(`Calculated yearly rental (QAR): ${yearlyRentalTotal}, yearly maintenance (QAR): ${yearlyMaintenanceTotal}, total: ${yearlyTotal}`);

    // Prepare response data
    const responseData = {
      monthlyRentalTotal: Number(monthlyRentalTotal.toFixed(2)),
      yearlyRentalTotal: Number(yearlyRentalTotal.toFixed(2)),
      monthlyMaintenanceTotal: Number(monthlyMaintenanceTotal.toFixed(2)),
      yearlyMaintenanceTotal: Number(yearlyMaintenanceTotal.toFixed(2)),
      monthlyTotal: Number(monthlyTotal.toFixed(2)),
      yearlyTotal: Number(yearlyTotal.toFixed(2)),
      isPotentialExpense: false,
      currency: 'QAR',
      fromCache: false
    };

    // Store in cache
    global._rentalCostsCache[cacheKey] = {
      data: responseData,
      timestamp: now
    };

    res.setHeader('Cache-Control', 'private, max-age=120, stale-while-revalidate=60');
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching rental costs:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch rental costs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}