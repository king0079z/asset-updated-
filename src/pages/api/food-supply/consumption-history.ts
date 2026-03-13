import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { isAdminOrManager } from '@/util/roleCheck';

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

  const { foodSupplyId, kitchenId } = req.query;
  
  // Build filter based on provided parameters
  let filter: any = {};
  
  // Add foodSupplyId filter if provided
  if (foodSupplyId) {
    filter.foodSupplyId = foodSupplyId as string;
  }
  
  // Add kitchenId filter if provided - only for foodConsumption, not for foodDisposal
  const kitchenFilter = kitchenId ? { kitchenId: kitchenId as string } : {};

  try {
    // Check if user is admin or manager
    const userIsAdminOrManager = await isAdminOrManager(user.id);
    console.log(`[Food Consumption API] User role check: isAdminOrManager=${userIsAdminOrManager}`);
    
    // Check if user has access to food supply page
    const userPermissions = await prisma.user.findUnique({
      where: { id: user.id },
      select: { pageAccess: true }
    });
    
    const hasFoodSupplyAccess = userPermissions?.pageAccess && 
      (userPermissions.pageAccess['/food-supply'] === true);
    
    console.log(`[Food Consumption API] User page access check: hasFoodSupplyAccess=${hasFoodSupplyAccess}`);
    
    // Users with food supply page access, admins, and managers can see all consumption records
    // Regular users without page access only see their own consumption records
    const consumptions = await prisma.foodConsumption.findMany({
      where: {
        ...filter,
        ...kitchenFilter,
        ...(userIsAdminOrManager || hasFoodSupplyAccess ? {} : { userId: user.id })
      },
      orderBy: {
        date: 'desc',
      },
      include: {
        kitchen: {
          select: {
            name: true,
            floorNumber: true,
          },
        },
        foodSupply: {
          select: {
            name: true,
            unit: true,
            pricePerUnit: true,
          },
        },
        user: {
          select: {
            email: true
          }
        }
      },
    });

    // Get waste records for the same food supply and/or kitchen
    const wasteRecords = await prisma.foodDisposal.findMany({
      where: {
        ...filter,
        ...kitchenFilter, // Apply the same kitchen filter to waste records
        ...(userIsAdminOrManager || hasFoodSupplyAccess ? {} : { userId: user.id })
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        foodSupply: {
          select: {
            name: true,
            unit: true,
            pricePerUnit: true,
          },
        },
        user: {
          select: {
            email: true
          }
        },
        recipe: {
          select: {
            name: true
          }
        }
      },
    });

    // Transform waste records to match consumption format for unified display
    const transformedWasteRecords = wasteRecords.map(waste => ({
      id: waste.id,
      foodSupplyId: waste.foodSupplyId,
      quantity: waste.quantity,
      date: waste.createdAt,
      isWaste: true, // Flag to identify waste records
      reason: waste.reason,
      source: waste.source,
      recipeId: waste.recipeId,
      recipeName: waste.recipe?.name,
      kitchen: {
        name: waste.source === 'recipe' ? 'Recipe Waste' : 'Direct Waste',
        floorNumber: '-'
      },
      foodSupply: waste.foodSupply,
      user: waste.user,
      notes: waste.notes || ''
    }));

    // Combine consumption and waste records and sort by date
    const combinedRecords = [...consumptions, ...transformedWasteRecords].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');


    return res.status(200).json(combinedRecords);
  } catch (error) {
    console.error('Food Consumption History API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}