import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { isAdminOrManager } from "@/util/roleCheck";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // For the dashboard, we always show all information without any data filtering
    console.info(`[Food Supply Total Consumed API] Showing all consumption data for dashboard`);

    // Get total consumed amount in money for all users
    const consumptionStats = await prisma.foodConsumption.findMany({
      select: {
        quantity: true,
        foodSupply: {
          select: {
            pricePerUnit: true
          }
        }
      }
    });

    const totalConsumed = consumptionStats.reduce((sum, record) => {
      return sum + (record.quantity * (record.foodSupply.pricePerUnit || 0));
    }, 0);

    return res.status(200).json({ totalConsumed });
  } catch (error) {
    console.error('Error getting total consumed amount:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}