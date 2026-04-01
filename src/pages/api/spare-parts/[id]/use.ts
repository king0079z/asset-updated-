// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;
  const { id } = req.query;
  const { ticketId, assetId, quantity, notes } = req.body;

  if (!quantity || quantity <= 0) return res.status(400).json({ error: 'quantity must be > 0' });

  const part = await prisma.sparePart.findUnique({ where: { id: id as string } });
  if (!part) return res.status(404).json({ error: 'Spare part not found' });
  if (part.quantity < quantity) return res.status(409).json({ error: `Insufficient stock. Available: ${part.quantity}` });

  const [usage] = await prisma.$transaction([
    prisma.sparePartUsage.create({
      data: { sparePartId: id as string, ticketId, assetId, quantity, userId: user.id, notes },
    }),
    prisma.sparePart.update({
      where: { id: id as string },
      data: { quantity: { decrement: quantity } },
    }),
  ]);

  return res.status(201).json(usage);
}
