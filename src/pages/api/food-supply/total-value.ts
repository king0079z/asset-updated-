import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

// Enhanced logging function
const logApiEvent = (message: string, data?: any) => {
  try {
    const timestamp = new Date().toISOString();
    console.info(`${timestamp} info: Path: /api/food-supply/total-value ${message}`);
    if (data) {
      console.info(`${timestamp} info: Path: /api/food-supply/total-value Data:`, 
        typeof data === 'object' ? JSON.stringify(data) : data);
    }
  } catch (loggingError) {
    console.error('Error in logging function:', loggingError);
    console.info('Original message:', message);
  }
};

// In-memory cache for total value data
type CacheEntry = {
  data: any;
  timestamp: number;
  userId: string;
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache lifetime
let totalValueCache: CacheEntry | null = null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (authError || !user) {
      logApiEvent('Authentication error', authError);
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Check if we have valid cached data for this user
    const now = Date.now();
    if (totalValueCache && 
        totalValueCache.userId === user.id && 
        now - totalValueCache.timestamp < CACHE_TTL) {
      logApiEvent(`Returning cached total value data for user: ${user.id}`);
      return res.status(200).json(totalValueCache.data);
    }

    logApiEvent(`Processing total food supply value for user: ${user.id}`);

    // For the dashboard, we always show all information without any data filtering
    logApiEvent(`Showing all food supply data for dashboard without filtering`);
    
    // Get all food supply items without filtering by userId
    const foodSupplies = await prisma.foodSupply.findMany({
      select: {
        quantity: true,
        pricePerUnit: true
      }
    });

    logApiEvent(`Found ${foodSupplies.length} food supply items`);

    // Calculate total value of all food supply items with proper validation
    const totalValue = foodSupplies.reduce((sum, item) => {
      // Ensure quantity and pricePerUnit are valid numbers
      const quantity = typeof item.quantity === 'number' ? item.quantity : 
                      Number(item.quantity) || 0;
      
      const pricePerUnit = typeof item.pricePerUnit === 'number' ? item.pricePerUnit : 
                          Number(item.pricePerUnit) || 0;
      
      // Calculate item value and add to sum
      const itemValue = quantity * pricePerUnit;
      
      // Log any suspicious values for debugging
      if (itemValue > 10000) {
        logApiEvent(`High value item detected: quantity=${quantity}, price=${pricePerUnit}, value=${itemValue}`);
      }
      
      return sum + itemValue;
    }, 0);

    // Format the total value to 2 decimal places
    const formattedTotalValue = Number(totalValue.toFixed(2));
    
    logApiEvent(`Calculated total food supply value: ${formattedTotalValue}`);

    // Prepare the response
    const response = { totalValue: formattedTotalValue };
    
    // Update the cache
    totalValueCache = {
      data: response,
      timestamp: Date.now(),
      userId: user.id
    };

    res.setHeader('Cache-Control', 'private, max-age=120, stale-while-revalidate=60');
    return res.status(200).json(response);
  } catch (error) {
    logApiEvent('Error getting total food supply value', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}