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
      const { kitchenId } = req.query;

      let locationId: string | undefined;
      if (kitchenId) {
        const kitchen = await prisma.kitchen.findUnique({
          where: { id: kitchenId as string },
          select: { locationId: true }
        });
        locationId = kitchen?.locationId ?? undefined;
      }

      const transfers = await prisma.stockTransfer.findMany({
        where: locationId
          ? { OR: [{ fromLocationId: locationId }, { toLocationId: locationId }] }
          : {},
        include: {
          fromLocation: { select: { id: true, name: true } },
          toLocation: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              foodSupply: { select: { id: true, name: true, unit: true } }
            }
          }
        },
        orderBy: { requestedAt: 'desc' }
      });

      return res.status(200).json(transfers);
    }

    if (req.method === 'POST') {
      const { fromKitchenId, toKitchenId, items, notes } = req.body;

      if (!fromKitchenId || !toKitchenId || !items || items.length === 0) {
        return res.status(400).json({ error: 'fromKitchenId, toKitchenId, and items are required' });
      }
      if (fromKitchenId === toKitchenId) {
        return res.status(400).json({ error: 'Source and destination kitchens must be different' });
      }

      // Resolve locationIds from kitchen IDs
      const [fromKitchen, toKitchen] = await Promise.all([
        prisma.kitchen.findUnique({ where: { id: fromKitchenId }, select: { locationId: true, name: true } }),
        prisma.kitchen.findUnique({ where: { id: toKitchenId }, select: { locationId: true, name: true } }),
      ]);

      if (!fromKitchen?.locationId || !toKitchen?.locationId) {
        return res.status(400).json({
          error: 'Both kitchens must be linked to a Location before creating stock transfers.'
        });
      }

      // Validate sufficient stock for each transfer item
      const stockChecks = await Promise.all(
        items.map((item: any) =>
          prisma.kitchenFoodSupply.findFirst({
            where: { kitchenId: fromKitchenId, foodSupplyId: item.foodSupplyId },
            select: { quantity: true, foodSupply: { select: { name: true } } }
          })
        )
      );

      const insufficient = items.filter((item: any, i: number) => {
        const stock = stockChecks[i];
        return !stock || stock.quantity < Number(item.quantity);
      });

      if (insufficient.length > 0 && !req.body.force) {
        return res.status(400).json({
          error: 'Insufficient stock for some items',
          insufficientItems: insufficient.map((item: any, i: number) => ({
            foodSupplyId: item.foodSupplyId,
            requested: item.quantity,
            available: stockChecks[i]?.quantity ?? 0,
          }))
        });
      }

      // Execute transfer in transaction
      const transfer = await prisma.$transaction(async (tx) => {
        const newTransfer = await tx.stockTransfer.create({
          data: {
            fromLocationId: fromKitchen.locationId,
            toLocationId: toKitchen.locationId,
            requestedById: user.id,
            status: 'PENDING',
            notes: notes ?? null,
            requestedAt: new Date(),
            items: {
              create: items.map((item: any) => ({
                foodSupplyId: item.foodSupplyId,
                quantity: Number(item.quantity),
                batchNumber: item.batchNumber ?? null,
                expirationDate: new Date(item.expirationDate ?? Date.now() + 1000 * 60 * 60 * 24 * 365),
              }))
            }
          },
          include: {
            fromLocation: { select: { id: true, name: true } },
            toLocation: { select: { id: true, name: true } },
            items: { include: { foodSupply: { select: { id: true, name: true, unit: true } } } }
          }
        });

        // Deduct from source kitchen inventory, add to destination
        for (const item of items) {
          const qty = Number(item.quantity);
          await tx.kitchenFoodSupply.updateMany({
            where: { kitchenId: fromKitchenId, foodSupplyId: item.foodSupplyId },
            data: { quantity: { decrement: qty } }
          });
          await tx.kitchenFoodSupply.upsert({
            where: { kitchenId_foodSupplyId: { kitchenId: toKitchenId, foodSupplyId: item.foodSupplyId } },
            update: { quantity: { increment: qty } },
            create: {
              kitchenId: toKitchenId,
              foodSupplyId: item.foodSupplyId,
              quantity: qty,
              expirationDate: new Date(item.expirationDate ?? Date.now() + 1000 * 60 * 60 * 24 * 365),
            }
          });
          // Also update global FoodSupply quantity (net zero but records movement)
        }

        return newTransfer;
      });

      return res.status(201).json(transfer);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Stock Transfers API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
