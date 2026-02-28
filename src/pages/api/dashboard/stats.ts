// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from "@/util/supabase/api";

// Enhanced logging function
const logApiEvent = (message: string, data?: any) => {
  try {
    const timestamp = new Date().toISOString();
    console.info(`${timestamp} info: Path: /api/dashboard/stats ${message}`);
    if (data) {
      console.info(`${timestamp} info: Path: /api/dashboard/stats Data:`, 
        typeof data === 'object' ? JSON.stringify(data) : data);
    }
  } catch (loggingError) {
    console.error('Error in logging function:', loggingError);
    console.info('Original message:', message);
  }
};

// In-memory cache for dashboard stats
type CacheEntry = {
  data: any;
  timestamp: number;
  userId: string;
};

// Reduced cache lifetime to ensure fresher data
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache lifetime
let statsCache: CacheEntry | null = null;

// Helper function to safely convert to number
const safeNumber = (value: any, defaultValue = 0): number => {
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  logApiEvent('Dashboard stats API: Received request');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const supabase = createClient(req, res);
    // Handle potential null response from auth.getUser()
    const authResponse = await supabase.auth.getUser();
    
    if (!authResponse || !authResponse.data) {
      logApiEvent('Authentication response is null or undefined');
      return res.status(500).json({ error: 'Authentication service error - Please try again later' });
    }
    
    const { data: { user }, error } = authResponse;

    if (error || !user) {
      logApiEvent('Authentication error', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if we have valid cached data for this user
    const now = Date.now();
    if (statsCache && 
        statsCache.userId === user.id && 
        now - statsCache.timestamp < CACHE_TTL) {
      logApiEvent(`Returning cached dashboard stats for user: ${user.id}`);
      return res.status(200).json(statsCache.data);
    }

    logApiEvent(`Processing dashboard stats for user: ${user.id}`);

    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    try {
      // For the dashboard page, we always show all information without any data filtering
      logApiEvent(`Dashboard page: Showing all information without any data filtering for user: ${user.id}`);
      
      // Performance optimization: Run all database queries in parallel
      const [
        basicStats,
        foodConsumption,
        vehicleRentals,
        vehicleStats,
        assetStatsData,
        totalAssetCosts,
        disposedAssetCosts
      ] = await Promise.all([
        // Query 1: Get basic stats in a single query with Promise.all
        Promise.all([
          // For assets count, don't filter by userId
          prisma.asset.count({
            where: { status: { not: 'DISPOSED' } }
          }).catch((err) => {
            logApiEvent(`Error counting assets: ${err.message}`);
            return 0;
          }),
          // For food supply count, don't filter by userId
          prisma.foodSupply.count({}).catch((err) => {
            logApiEvent(`Error counting food supplies: ${err.message}`);
            return 0;
          }),
          // For vehicle rentals count, don't filter by userId
          prisma.vehicleRental.count({
            where: { 
              status: 'RENTED',
              endDate: { gte: today }
            }
          }).catch((err) => {
            logApiEvent(`Error counting vehicle rentals: ${err.message}`);
            return 0;
          }),
          // For low stock items count, don't filter by userId
          prisma.foodSupply.count({
            where: { quantity: { lte: 10 } }
          }).catch((err) => {
            logApiEvent(`Error counting low stock items: ${err.message}`);
            return 0;
          })
        ]),
        
        // Query 2: Get food consumption data
        prisma.foodConsumption.findMany({
          where: { date: { gte: startOfMonth } },
          include: {
            foodSupply: {
              select: {
                pricePerUnit: true
              }
            }
          },
          orderBy: {
            date: 'asc'
          },
          // Limit to recent data for better performance
          take: 100
        }).catch(error => {
          logApiEvent('Error fetching food consumption', error);
          return [];
        }),
        
        // Query 3: Get vehicle rental data
        prisma.vehicleRental.findMany({
          where: {
            OR: [
              { startDate: { gte: startOfYear } },
              { status: 'RENTED', endDate: { gte: today } }
            ]
          },
          include: {
            vehicle: {
              select: {
                make: true,
                model: true,
                status: true,
                rentalAmount: true
              }
            }
          },
          orderBy: {
            startDate: 'desc'
          },
          // Limit to recent rentals for better performance
          take: 20
        }).catch(error => {
          logApiEvent('Error fetching vehicle rentals', error);
          return [];
        }),
        
        // Query 4: Get vehicle status stats
        prisma.vehicle.groupBy({
          by: ['status'],
          _count: true
        }).catch(error => {
          logApiEvent('Error fetching vehicle stats', error);
          return [];
        }),
        
        // Query 5: Get asset status stats
        prisma.asset.groupBy({
          by: ['status'],
          _count: true
        }).catch(error => {
          logApiEvent('Error fetching asset stats', error);
          return [];
        }),
        
        // Query 6: Get total asset costs
        prisma.asset.aggregate({
          _sum: {
            purchaseAmount: true
          },
          where: { 
            status: { not: 'DISPOSED' },
            purchaseAmount: { not: null }
          }
        }).catch(error => {
          logApiEvent('Error fetching total asset costs', error);
          return { _sum: { purchaseAmount: 0 } };
        }),
        
        // Query 7: Get disposed asset costs
        prisma.asset.aggregate({
          _sum: {
            purchaseAmount: true
          },
          where: { 
            status: 'DISPOSED',
            purchaseAmount: { not: null }
          }
        }).catch(error => {
          logApiEvent('Error fetching disposed asset costs', error);
          return { _sum: { purchaseAmount: 0 } };
        })
      ]);

      // Destructure basic stats with validation
      const [totalAssets, totalFoodItems, activeVehicleRentals, lowStockItems] = basicStats.map(stat => 
        safeNumber(stat, 0)
      );

      logApiEvent('Basic stats', { totalAssets, totalFoodItems, activeVehicleRentals, lowStockItems });

      // Process food consumption data with validation
      const foodConsumptionByDate = foodConsumption.reduce((acc, item) => {
        if (!item || !item.date) return acc;
        
        try {
          const date = item.date.toISOString().split('T')[0];
          const pricePerUnit = safeNumber(item.foodSupply?.pricePerUnit, 0);
          const quantity = safeNumber(item.quantity, 0);
          const cost = quantity * pricePerUnit;
          
          if (!acc[date]) {
            acc[date] = 0;
          }
          acc[date] += cost;
        } catch (error) {
          logApiEvent('Error processing food consumption item', error);
        }
        return acc;
      }, {} as Record<string, number>);

      // Calculate rental trends by day with validation
      const rentalTrendsByDay = vehicleRentals.reduce((acc, rental) => {
        if (!rental || !rental.startDate) return acc;
        
        try {
          const date = new Date(rental.startDate).toISOString().split('T')[0];
          if (!acc[date]) {
            acc[date] = 0;
          }
          acc[date]++;
        } catch (error) {
          logApiEvent('Error processing rental trend item', error);
        }
        return acc;
      }, {} as Record<string, number>);

      // Calculate costs with proper duration handling and validation
      const calculateRentalCost = (rental: any): number => {
        if (!rental || !rental.vehicle || !rental.startDate || !rental.endDate) {
          return 0;
        }
        
        try {
          const amount = safeNumber(rental.vehicle?.rentalAmount, 0);
          const start = new Date(rental.startDate);
          const end = new Date(rental.endDate);
          
          // Validate dates
          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return 0;
          }
          
          const durationInDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
          return amount * durationInDays;
        } catch (error) {
          logApiEvent('Error calculating rental cost', error);
          return 0;
        }
      };

      const totalVehicleCost = vehicleRentals.reduce((sum, rental) => {
        const cost = calculateRentalCost(rental);
        return sum + cost;
      }, 0);

      const totalFoodCost = Object.values(foodConsumptionByDate).reduce((sum, cost) => 
        sum + safeNumber(cost, 0), 0);

      // Ensure we have arrays for chart data with validation
      const monthlyFoodCostsArray = Object.entries(foodConsumptionByDate || {}).map(([date, cost]) => ({
        date,
        cost: safeNumber(cost, 0).toFixed(2)
      }));

      const rentalTrendsArray = Object.entries(rentalTrendsByDay || {}).map(([date, count]) => ({
        startDate: date,
        _count: safeNumber(count, 0)
      }));

      // Ensure we have arrays for stats with validation
      const vehicleStatsArray = Array.isArray(vehicleStats) 
        ? vehicleStats.map(stat => ({
            status: stat.status || 'UNKNOWN',
            _count: safeNumber(stat._count, 0)
          }))
        : [];

      const assetStatsArray = Array.isArray(assetStatsData) 
        ? assetStatsData.map(stat => ({
            status: stat.status || 'UNKNOWN',
            count: safeNumber(stat._count, 0)
          }))
        : [];

      // Get asset values with validation
      const totalAssetValue = safeNumber(totalAssetCosts._sum?.purchaseAmount, 0);
      const disposedAssetValue = safeNumber(disposedAssetCosts._sum?.purchaseAmount, 0);

      logApiEvent('Asset values', { totalAssetValue, disposedAssetValue });

      // Prepare the response with safe values
      const response = {
        totalAssets: Number(totalAssets),
        totalFoodItems: Number(totalFoodItems),
        activeVehicleRentals: Number(activeVehicleRentals),
        lowStockItems: Number(lowStockItems),
        totalFoodCost: Number(safeNumber(totalFoodCost, 0)),
        totalVehicleCost: Number(safeNumber(totalVehicleCost, 0)),
        monthlyFoodCosts: monthlyFoodCostsArray,
        recentRentals: Array.isArray(vehicleRentals) 
          ? vehicleRentals.slice(0, 5).map(rental => {
              try {
                return {
                  id: rental.id || '',
                  startDate: rental.startDate ? new Date(rental.startDate).toISOString() : new Date().toISOString(),
                  endDate: rental.endDate ? new Date(rental.endDate).toISOString() : new Date().toISOString(),
                  vehicle: {
                    make: rental.vehicle?.make || '',
                    model: rental.vehicle?.model || '',
                    status: rental.vehicle?.status || '',
                    rentalAmount: Number(safeNumber(rental.vehicle?.rentalAmount, 0))
                  }
                };
              } catch (error) {
                logApiEvent('Error processing rental for response', error);
                return null;
              }
            }).filter(Boolean) // Remove any null entries
          : [],
        vehicleStats: vehicleStatsArray,
        rentalTrends: rentalTrendsArray,
        assetStats: {
          byStatus: assetStatsArray,
          totalValue: Number(totalAssetValue),
          disposedValue: Number(disposedAssetValue)
        }
      };

      // Log the final response for debugging
      logApiEvent('Final dashboard stats response prepared', {
        totalAssets: response.totalAssets,
        totalFoodItems: response.totalFoodItems,
        assetStats: {
          totalValue: response.assetStats.totalValue
        }
      });

      // Update the cache
      statsCache = {
        data: response,
        timestamp: Date.now(),
        userId: user.id
      };
      
      logApiEvent(`Successfully processed dashboard stats for user: ${user.id}`);
      return res.status(200).json(response);
    } catch (dbError) {
      logApiEvent('Database error in dashboard stats', dbError);
      // Return a simplified response with default values when DB operations fail
      return res.status(200).json({
        totalAssets: 0,
        totalFoodItems: 0,
        activeVehicleRentals: 0,
        lowStockItems: 0,
        totalFoodCost: 0,
        totalVehicleCost: 0,
        monthlyFoodCosts: [],
        recentRentals: [],
        vehicleStats: [],
        rentalTrends: [],
        assetStats: {
          byStatus: [],
          totalValue: 0,
          disposedValue: 0
        },
        error: 'Some data could not be loaded'
      });
    }
  } catch (error) {
    logApiEvent('Dashboard stats error', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}