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

  const borrow = await prisma.assetBorrow.findUnique({ where: { id: id as string }, include: { asset: true } });
  if (!borrow) return res.status(404).json({ error: 'Borrow record not found' });

  const updated = await prisma.assetBorrow.update({
    where: { id: id as string },
    data: { returnedAt: new Date(), status: 'RETURNED' },
  });

  await prisma.asset.update({ where: { id: borrow.assetId }, data: { status: 'RETURNED' } });

  await prisma.assetHistory.create({
    data: {
      assetId: borrow.assetId,
      action: 'UNASSIGNED',
      details: { borrowId: borrow.id, returnedAt: new Date().toISOString() },
      userId: user.id,
    },
  });

  return res.status(200).json(updated);
}
