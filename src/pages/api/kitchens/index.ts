import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification, logUserActivity } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    switch (req.method) {
      case 'GET':
        const kitchens = await prisma.kitchen.findMany({
          include: {
            barcodes: {
              include: {
                foodSupply: true
              }
            }
          }
        });
  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');

        return res.status(200).json(kitchens);

      case 'POST':
        const { name, floorNumber, description } = req.body;
        const kitchen = await prisma.kitchen.create({
          data: {
            name,
            floorNumber,
            description
          }
        });
        
        // Create audit log for kitchen creation
        await logDataModification(
          'KITCHEN',
          kitchen.id,
          'CREATE',
          {
            name,
            floorNumber,
            description
          },
          {
            action: 'Kitchen Creation',
            kitchenName: name,
            floorNumber,
            userId: user.id,
            userEmail: user.email
          }
        );
        
        // Also log as user activity for the user activity tab
        await logUserActivity(
          'KITCHEN_CREATED',
          'KITCHEN',
          {
            kitchenId: kitchen.id,
            kitchenName: name,
            floorNumber,
            description,
            timestamp: new Date().toISOString(),
            userId: user.id,
            userEmail: user.email
          },
          kitchen.id
        );
        
        return res.status(201).json(kitchen);

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Kitchen API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}