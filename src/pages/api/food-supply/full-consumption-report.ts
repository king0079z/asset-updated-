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

  try {
    // Check if user is admin or manager
    const userIsAdminOrManager = await isAdminOrManager(user.id);
    console.log(`[Full Food Consumption API] User role check: isAdminOrManager=${userIsAdminOrManager}`);
    
    // Check if user has access to food supply page
    const userPermissions = await prisma.user.findUnique({
      where: { id: user.id },
      select: { pageAccess: true }
    });
    
    const hasFoodSupplyAccess = userPermissions?.pageAccess && 
      (userPermissions.pageAccess['/food-supply'] === true);
    
    console.log(`[Full Food Consumption API] User page access check: hasFoodSupplyAccess=${hasFoodSupplyAccess}`);
    
    // Users with food supply page access, admins, and managers can see all consumption records
    // Regular users without page access only see their own consumption records
    const consumptions = await prisma.foodConsumption.findMany({
      where: userIsAdminOrManager || hasFoodSupplyAccess ? {} : { userId: user.id },
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

    return res.status(200).json(consumptions);
  } catch (error) {
    console.error('Full Food Consumption Report API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}