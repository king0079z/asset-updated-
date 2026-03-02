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
      const { kitchenId, locationId, status } = req.query;

      let resolvedLocationId = locationId as string | undefined;
      if (kitchenId && !resolvedLocationId) {
        const kitchen = await prisma.kitchen.findUnique({
          where: { id: kitchenId as string },
          select: { locationId: true }
        });
        resolvedLocationId = kitchen?.locationId ?? undefined;
      }

      const orders = await prisma.purchaseOrder.findMany({
        where: {
          ...(resolvedLocationId ? { locationId: resolvedLocationId } : {}),
          ...(status ? { status: status as string } : {}),
        },
        include: {
          vendor: { select: { id: true, name: true } },
          orderedBy: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              foodSupply: { select: { id: true, name: true, unit: true, pricePerUnit: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.status(200).json(orders);
    }

    if (req.method === 'POST') {
      const { kitchenId, vendorId, items, notes, expectedDeliveryDate } = req.body;

      if (!vendorId || !items || items.length === 0) {
        return res.status(400).json({ error: 'vendorId and at least one item are required' });
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
        return res.status(400).json({ error: 'Kitchen must be linked to a Location before creating purchase orders.' });
      }

      const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
      if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

      const order = await prisma.purchaseOrder.create({
        data: {
          locationId,
          vendorId,
          orderedById: user.id,
          status: 'PENDING',
          notes: notes ?? null,
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
          items: {
            create: items.map((item: any) => ({
              foodSupplyId: item.foodSupplyId,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice ?? 0),
              batchNumber: item.batchNumber ?? null,
              expirationDate: new Date(item.expirationDate ?? Date.now() + 1000 * 60 * 60 * 24 * 365),
            }))
          }
        },
        include: {
          vendor: { select: { id: true, name: true } },
          items: {
            include: {
              foodSupply: { select: { id: true, name: true, unit: true } }
            }
          }
        }
      });

      return res.status(201).json(order);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Purchase Orders API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
