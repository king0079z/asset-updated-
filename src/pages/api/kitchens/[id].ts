// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Kitchen ID is required' });
  }

  // Only admins/managers may edit or delete kitchens
  const userRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true, role: true, organizationId: true }
  });
  const isPrivileged = userRecord?.isAdmin || userRecord?.role === 'MANAGER';

  if (!isPrivileged && (req.method === 'PUT' || req.method === 'DELETE')) {
    return res.status(403).json({ error: 'Only admins and managers can edit or delete kitchens.' });
  }

  try {
    // GET — fetch single kitchen with stats
    if (req.method === 'GET') {
      const kitchen = await prisma.kitchen.findUnique({
        where: { id },
        include: {
          barcodes: { select: { id: true } },
          assignments: {
            include: {
              user: { select: { id: true, name: true, email: true, role: true } }
            }
          },
          _count: {
            select: {
              foodSupplies: true,
              consumption: true,
              recipeUsages: true,
            }
          }
        }
      });
      if (!kitchen) return res.status(404).json({ error: 'Kitchen not found' });
      return res.status(200).json(kitchen);
    }

    // PUT — update kitchen name, floor, description
    if (req.method === 'PUT') {
      const { name, floorNumber, description, locationId } = req.body;

      if (!name) return res.status(400).json({ error: 'Kitchen name is required' });

      const existing = await prisma.kitchen.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Kitchen not found' });

      const updated = await prisma.kitchen.update({
        where: { id },
        data: {
          name,
          ...(floorNumber !== undefined ? { floorNumber } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(locationId !== undefined ? { locationId } : {}),
        }
      });

      await logDataModification('KITCHEN', id, 'UPDATE',
        { name, floorNumber, description },
        { action: 'Kitchen Update', kitchenName: name, userId: user.id, userEmail: user.email }
      );

      return res.status(200).json(updated);
    }

    // DELETE — remove kitchen (guards against deletion if it has active consumptions)
    if (req.method === 'DELETE') {
      const { force } = req.query;

      const existing = await prisma.kitchen.findUnique({
        where: { id },
        include: {
          _count: { select: { consumption: true, recipeUsages: true, foodSupplies: true } }
        }
      });
      if (!existing) return res.status(404).json({ error: 'Kitchen not found' });

      const hasData = existing._count.consumption > 0 || existing._count.recipeUsages > 0;
      if (hasData && force !== 'true') {
        return res.status(409).json({
          error: 'Kitchen has consumption history.',
          message: `This kitchen has ${existing._count.consumption} consumption records and ${existing._count.recipeUsages} recipe usages. Pass ?force=true to delete anyway.`,
          counts: existing._count
        });
      }

      // Remove related records before deletion
      await prisma.$transaction([
        prisma.kitchenAssignment.deleteMany({ where: { kitchenId: id } }),
        prisma.kitchenBarcode.deleteMany({ where: { kitchenId: id } }),
        prisma.kitchenFoodSupply.deleteMany({ where: { kitchenId: id } }),
        prisma.kitchen.delete({ where: { id } }),
      ]);

      await logDataModification('KITCHEN', id, 'DELETE',
        { kitchenName: existing.name },
        { action: 'Kitchen Deletion', kitchenName: existing.name, userId: user.id, userEmail: user.email }
      );

      return res.status(200).json({ success: true, message: `Kitchen "${existing.name}" deleted.` });
    }

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Kitchen [id] API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
