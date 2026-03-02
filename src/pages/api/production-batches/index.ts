// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const { kitchenId, locationId } = req.query;

      // Resolve locationId from kitchenId if needed
      let resolvedLocationId = locationId as string | undefined;
      if (kitchenId && !resolvedLocationId) {
        const kitchen = await prisma.kitchen.findUnique({
          where: { id: kitchenId as string },
          select: { locationId: true }
        });
        resolvedLocationId = kitchen?.locationId ?? undefined;
      }

      const batches = await prisma.productionBatch.findMany({
        where: resolvedLocationId ? { locationId: resolvedLocationId } : {},
        include: {
          recipe: {
            select: { id: true, name: true, servings: true, totalCost: true, costPerServing: true }
          }
        },
        orderBy: { scheduledDate: 'desc' }
      });

      return res.status(200).json(batches);
    }

    if (req.method === 'POST') {
      const { kitchenId, recipeId, quantity, scheduledDate, notes } = req.body;

      if (!recipeId || !quantity || !scheduledDate) {
        return res.status(400).json({ error: 'recipeId, quantity, and scheduledDate are required' });
      }

      // Resolve locationId from kitchenId
      let locationId: string | null = null;
      if (kitchenId) {
        const kitchen = await prisma.kitchen.findUnique({
          where: { id: kitchenId },
          select: { locationId: true }
        });
        locationId = kitchen?.locationId ?? null;
      }

      if (!locationId) {
        return res.status(400).json({ error: 'Kitchen must be linked to a Location before creating production batches. Assign a location to the kitchen first.' });
      }

      const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true, name: true } });
      if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

      const batch = await prisma.productionBatch.create({
        data: {
          locationId,
          recipeId,
          quantity: Number(quantity),
          scheduledDate: new Date(scheduledDate),
          notes: notes ?? null,
          status: 'PLANNED',
          createdById: user.id,
        },
        include: {
          recipe: { select: { id: true, name: true, servings: true, costPerServing: true } }
        }
      });

      return res.status(201).json(batch);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Production Batches API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
