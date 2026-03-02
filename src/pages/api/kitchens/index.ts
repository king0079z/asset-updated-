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
    // Resolve calling user's organization for scoping
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true }
    });
    const orgId = userRecord?.organizationId ?? null;

    switch (req.method) {
      case 'GET':
        const kitchens = await prisma.kitchen.findMany({
          where: orgId ? { OR: [{ organizationId: orgId }, { organizationId: null }] } : {},
          select: {
            id: true,
            name: true,
            floorNumber: true,
            description: true,
            createdAt: true,
            updatedAt: true,
            barcodes: {
              select: { id: true }
            },
          },
          orderBy: { name: 'asc' },
        });
        res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
        return res.status(200).json(kitchens);

      case 'POST':
        const { name, floorNumber, description } = req.body;

        // Enforce subscription kitchen limit
        if (orgId) {
          const subscription = await prisma.subscription.findUnique({
            where: { organizationId: orgId },
            select: { maxKitchens: true }
          });
          if (subscription) {
            const kitchenCount = await prisma.kitchen.count({ where: { organizationId: orgId } });
            if (kitchenCount >= subscription.maxKitchens) {
              return res.status(403).json({
                error: `Kitchen limit reached. Your plan allows up to ${subscription.maxKitchens} kitchen${subscription.maxKitchens !== 1 ? 's' : ''}.`
              });
            }
          }
        }

        const kitchen = await prisma.kitchen.create({
          data: {
            name,
            floorNumber,
            description,
            ...(orgId ? { organizationId: orgId } : {})
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