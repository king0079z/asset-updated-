import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getSession();

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid recipe ID' });
  }

  if (req.method === 'GET') {
    try {
      // Per-kitchen usage, cost, waste, selling price, profit
      const usagesByKitchen = await prisma.recipeUsage.groupBy({
        by: ['kitchenId'],
        where: { recipeId: id },
        _count: { id: true },
        _sum: {
          cost: true,
          waste: true,
          sellingPrice: true,
          profit: true,
        }
      });

      // Per-kitchen waste (ingredient_waste or all waste for this recipe)
      const wasteByKitchen = await prisma.foodDisposal.groupBy({
        by: ['kitchenId'],
        where: { recipeId: id },
        _sum: { quantity: true }
      });

      // Get kitchen names
      const kitchenIds = [
        ...new Set([
          ...usagesByKitchen.map(u => u.kitchenId),
          ...wasteByKitchen.map(w => w.kitchenId)
        ])
      ].filter(Boolean);

      let kitchens: { id: string, name: string }[] = [];
      if (kitchenIds.length > 0) {
        kitchens = await prisma.kitchen.findMany({
          where: { id: { in: kitchenIds as string[] } },
          select: { id: true, name: true }
        });
      }

      // Build breakdown
      const kitchenBreakdown = kitchenIds.map(kid => {
        const kitchen = kitchens.find(k => k.id === kid);
        const usage = usagesByKitchen.find(u => u.kitchenId === kid);
        const waste = wasteByKitchen.find(w => w.kitchenId === kid);
        return {
          kitchenId: kid,
          kitchenName: kitchen ? kitchen.name : 'Unknown',
          usageCount: usage?._count?.id || 0,
          totalCost: usage?._sum?.cost || 0,
          totalWaste: usage?._sum?.waste || 0,
          totalSellingPrice: usage?._sum?.sellingPrice || 0,
          totalProfit: usage?._sum?.profit || 0,
          ingredientWaste: waste?._sum?.quantity || 0
        };
      });

      return res.status(200).json({ kitchenBreakdown });
    } catch (error) {
      console.error('Error fetching kitchen breakdown:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}