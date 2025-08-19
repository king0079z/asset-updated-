import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { fetchWithErrorHandling } from '@/util/apiErrorHandler';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { kitchenId } = req.query;
    
    if (!kitchenId || typeof kitchenId !== 'string') {
      return res.status(400).json({ error: 'Kitchen ID is required' });
    }

    // Get the user from Supabase auth
    const supabase = createClient({ req, res });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // First, check if the kitchen exists
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
    }).catch(error => {
      console.error('Error finding kitchen:', error);
      return null;
    });

    if (!kitchen) {
      return res.status(404).json({ error: 'Kitchen not found', reasons: [] });
    }

    // Fetch waste data from the database for this kitchen
    // We need to find all food disposals where the related food supply belongs to this kitchen
    const wasteData = await prisma.foodDisposal.groupBy({
      by: ['reason'],
      where: {
        foodSupply: {
          kitchenId: kitchenId,
        }
      },
      _sum: {
        quantity: true,
      },
    }).catch(error => {
      console.error('Error in waste reasons groupBy query:', error);
      // Return empty array on error to prevent API failure
      return [];
    });

    // If no waste data is found, return empty array with totalWaste of 0
    if (!wasteData || wasteData.length === 0) {
      return res.status(200).json({ reasons: [], totalWaste: 0 });
    }

    // Calculate total waste - ensure we're handling null/undefined values
    const totalWaste = wasteData.reduce((sum, item) => {
      return sum + (item._sum && item._sum.quantity !== null ? item._sum.quantity : 0);
    }, 0);

    // Calculate percentages - with additional null checks
    const reasons = wasteData.map(item => ({
      reason: item.reason || 'Unknown',
      percentage: totalWaste > 0 && item._sum && item._sum.quantity !== null
        ? Math.round((item._sum.quantity || 0) / totalWaste * 100) 
        : 0,
      // Include the raw quantity for additional context
      quantity: item._sum && item._sum.quantity !== null ? item._sum.quantity : 0
    }));

    // Sort by percentage (highest first)
    reasons.sort((a, b) => b.percentage - a.percentage);

    return res.status(200).json({ reasons, totalWaste });
  } catch (error) {
    console.error('Error fetching waste reasons:', error);
    // Return a more detailed error message
    return res.status(500).json({ 
      error: 'Failed to fetch waste reasons', 
      message: error instanceof Error ? error.message : 'Unknown error',
      reasons: [] // Return empty reasons array to prevent UI breakage
    });
  }
}