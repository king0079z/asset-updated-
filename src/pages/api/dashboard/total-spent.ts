// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from "@/util/supabase/api";

// In-memory cache for total spent data
type CacheEntry = {
  data: any;
  timestamp: number;
  userId: string;
  includeMonthly: boolean;
};

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache lifetime
let totalSpentCache: CacheEntry | null = null;

// Enhanced logging function
const logApiEvent = (message: string, data?: any) => {
  try {
    const timestamp = new Date().toISOString();
    console.info(`${timestamp} info: Path: /api/dashboard/total-spent ${message}`);
    if (data) {
      console.info(`${timestamp} info: Path: /api/dashboard/total-spent Data:`, 
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
    const includeMonthly = req.query.includeMonthly === 'true';
    const supabase = createClient(req, res);
    const { data: { session }, error } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (error || !user) {
      logApiEvent('Authentication error', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if we have valid cached data for this user and query parameters
    const now = Date.now();
    if (totalSpentCache && 
        totalSpentCache.userId === user.id && 
        totalSpentCache.includeMonthly === includeMonthly &&
        now - totalSpentCache.timestamp < CACHE_TTL) {
      logApiEvent(`Returning cached total-spent data for user: ${user.id}`);
      return res.status(200).json(totalSpentCache.data);
    }

    logApiEvent(`Processing total-spent data for user: ${user.id}`);

    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59);
    
    // For the dashboard page, we always show all information without any data filtering
    logApiEvent(`Dashboard total-spent: Showing all information without any data filtering for user: ${user.id}`);
    
    // Run all database queries in parallel for better performance
    const [foodConsumption, assetsPurchased, vehicles, vehicleMaintenances] = await Promise.all([
      // 1. Get food consumption within the current year
      prisma.foodConsumption.findMany({
        where: {
          date: { 
            gte: startOfYear,
            lte: today
          }
        },
        include: {
          foodSupply: {
            select: {
              pricePerUnit: true
            }
          }
        },
        // Limit to a reasonable number for better performance
        take: 1000
      }).catch(error => {
        logApiEvent('Error fetching food consumption', error);
        return [];
      }),

      // 2. Get assets purchased during the current year
      prisma.asset.findMany({
        where: {
          createdAt: {
            gte: startOfYear,
            lte: today
          },
          purchaseAmount: { not: null }
        },
        select: {
          purchaseAmount: true,
          createdAt: true
        },
        // Limit to a reasonable number for better performance
        take: 500
      }).catch(error => {
        logApiEvent('Error fetching assets purchased', error);
        return [];
      }),

      // 3. Get vehicle rentals for the current year
      prisma.vehicleRental.findMany({
        where: {
          startDate: { 
            gte: startOfYear,
            lte: today
          }
        },
        include: {
          vehicle: {
            select: {
              rentalAmount: true
            }
          }
        }
      }).catch(error => {
        logApiEvent('Error fetching vehicle rentals', error);
        return [];
      }),

      // 4. Get vehicle maintenance for the current year
      prisma.vehicleMaintenance.findMany({
        where: {
          maintenanceDate: {
            gte: startOfYear,
            lte: today
          }
        },
        select: {
          cost: true,
          maintenanceDate: true
        }
      }).catch(error => {
        logApiEvent('Error fetching vehicle maintenance', error);
        return [];
      })
    ]);

    logApiEvent(`Found ${vehicles.length} vehicle rentals for cost calculation`);

    // Process food consumption data
    const totalFoodConsumption = foodConsumption.reduce((sum, item) => {
      const pricePerUnit = item.foodSupply?.pricePerUnit || 0;
      const cost = (Number(item.quantity) || 0) * Number(pricePerUnit);
      return sum + cost;
    }, 0);

    // Process assets purchased data
    const totalAssetsPurchased = assetsPurchased.reduce((sum, asset) => {
      return sum + (Number(asset.purchaseAmount) || 0);
    }, 0);

    // Calculate vehicle rental costs based on actual rentals
    const totalVehicleRentalCosts = vehicles.reduce((sum, rental) => {
      const rentalAmount = Number(rental.vehicle?.rentalAmount || 0);
      
      // Calculate rental duration
      let startDate = new Date(rental.startDate);
      let endDate = rental.endDate ? new Date(rental.endDate) : today;
      
      // If start date is before this year, use start of year
      if (startDate < startOfYear) {
        startDate = startOfYear;
      }
      
      // If end date is after today, use today
      if (endDate > today) {
        endDate = today;
      }
      
      // Calculate days rented within this year
      const daysRented = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Calculate cost for this rental
      const rentalCost = (rentalAmount / 30) * daysRented; // Assuming monthly rate divided by 30 days
      
      logApiEvent(`Rental cost calculation: Amount: ${rentalAmount}, Days: ${daysRented}, Cost: ${rentalCost}`);
      return sum + rentalCost;
    }, 0);

    logApiEvent(`Calculated vehicle rental costs based on actual rentals: ${totalVehicleRentalCosts}`);

    // Calculate vehicle maintenance costs for the year
    const totalVehicleMaintenanceCosts = vehicleMaintenances.reduce((sum, m) => sum + (Number(m.cost) || 0), 0);

    // Calculate the total amount spent (now includes maintenance)
    const totalAmountSpent = totalFoodConsumption + totalAssetsPurchased + totalVehicleRentalCosts + totalVehicleMaintenanceCosts;

    // Prepare the response
    const response: any = {
      totalAmountSpent: Number(totalAmountSpent.toFixed(2)),
      breakdown: {
        foodConsumption: Number(totalFoodConsumption.toFixed(2)),
        assetsPurchased: Number(totalAssetsPurchased.toFixed(2)),
        vehicleRentalCosts: Number(totalVehicleRentalCosts.toFixed(2)),
        vehicleMaintenanceCosts: Number(totalVehicleMaintenanceCosts.toFixed(2)),
        vehicleTotal: Number((totalVehicleRentalCosts + totalVehicleMaintenanceCosts).toFixed(2))
      }
    };

    // If monthly data is requested, calculate monthly breakdowns
    if (includeMonthly) {
      logApiEvent('Calculating monthly breakdowns');
      
      // Create an array of months in the current year up to the current month
      const currentMonth = today.getMonth() + 1;
      const monthlyData = Array.from({ length: currentMonth }, (_, i) => {
        const monthIndex = i;
        const monthStart = new Date(today.getFullYear(), monthIndex, 1);
        const monthEnd = new Date(today.getFullYear(), monthIndex + 1, 0, 23, 59, 59);
        const monthName = monthStart.toLocaleString('default', { month: 'long' });
        
        // Calculate food consumption for this month
        const monthFoodConsumption = foodConsumption
          .filter(item => {
            const date = new Date(item.date);
            return date >= monthStart && date <= monthEnd;
          })
          .reduce((sum, item) => {
            const pricePerUnit = item.foodSupply?.pricePerUnit || 0;
            const cost = (Number(item.quantity) || 0) * Number(pricePerUnit);
            return sum + cost;
          }, 0);
        
        // Calculate assets purchased for this month
        const monthAssetsPurchased = assetsPurchased
          .filter(asset => {
            const date = new Date(asset.createdAt);
            return date >= monthStart && date <= monthEnd;
          })
          .reduce((sum, asset) => {
            return sum + (Number(asset.purchaseAmount) || 0);
          }, 0);
        
        // Calculate vehicle rental costs for this month
        const monthVehicleRentalCosts = vehicles.reduce((sum, rental) => {
          const rentalAmount = Number(rental.vehicle?.rentalAmount || 0);
          
          // Get rental start and end dates
          let startDate = new Date(rental.startDate);
          let endDate = rental.endDate ? new Date(rental.endDate) : today;
          
          // Check if rental overlaps with this month
          if (startDate <= monthEnd && endDate >= monthStart) {
            // Adjust dates to only count days within this month
            const rentalStartInMonth = startDate < monthStart ? monthStart : startDate;
            const rentalEndInMonth = endDate > monthEnd ? monthEnd : endDate;
            
            // Calculate days rented within this month
            const daysRented = Math.max(1, Math.ceil((rentalEndInMonth.getTime() - rentalStartInMonth.getTime()) / (1000 * 60 * 60 * 24)));
            
            // Calculate cost for this rental in this month
            const rentalCost = (rentalAmount / 30) * daysRented; // Assuming monthly rate divided by 30 days
            return sum + rentalCost;
          }
          
          return sum;
        }, 0);

        // Calculate vehicle maintenance costs for this month
        const monthVehicleMaintenanceCosts = vehicleMaintenances
          .filter(m => {
            const date = new Date(m.maintenanceDate);
            return date >= monthStart && date <= monthEnd;
          })
          .reduce((sum, m) => sum + (Number(m.cost) || 0), 0);

        // Calculate total for this month
        const monthTotal = monthFoodConsumption + monthAssetsPurchased + monthVehicleRentalCosts + monthVehicleMaintenanceCosts;
        
        return {
          month: monthName,
          year: today.getFullYear(),
          foodConsumption: Number(monthFoodConsumption.toFixed(2)),
          assetsPurchased: Number(monthAssetsPurchased.toFixed(2)),
          vehicleRentalCosts: Number(monthVehicleRentalCosts.toFixed(2)),
          vehicleMaintenanceCosts: Number(monthVehicleMaintenanceCosts.toFixed(2)),
          vehicleTotal: Number((monthVehicleRentalCosts + monthVehicleMaintenanceCosts).toFixed(2)),
          total: Number(monthTotal.toFixed(2))
        };
      });
      
      logApiEvent(`Generated monthly data for ${monthlyData.length} months`);
      response.monthlyData = monthlyData;
    }

    // Update the cache
    totalSpentCache = {
      data: response,
      timestamp: Date.now(),
      userId: user.id,
      includeMonthly
    };

    logApiEvent(`Successfully processed total-spent data for user: ${user.id}`);
    return res.status(200).json(response);
  } catch (error) {
    logApiEvent('Error calculating total amount spent', error);
    return res.status(500).json({ 
      error: 'Failed to calculate total amount spent',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}