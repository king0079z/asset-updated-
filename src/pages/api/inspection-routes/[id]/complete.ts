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
  const { isOnTime, isSuccessful, notes, findings } = req.body;

  const route = await prisma.inspectionRoute.findUnique({ where: { id: id as string } });
  if (!route) return res.status(404).json({ error: 'Route not found' });

  const completion = await prisma.inspectionCompletion.create({
    data: {
      routeId: id as string,
      completedById: user.id,
      isOnTime: isOnTime !== false,
      isSuccessful: isSuccessful !== false,
      notes,
      findings,
    },
  });

  // Recalculate delivery and success rates
  const allCompletions = await prisma.inspectionCompletion.findMany({ where: { routeId: id as string } });
  const deliveryRate = (allCompletions.filter(c => c.isOnTime).length / allCompletions.length) * 100;
  const successRate = (allCompletions.filter(c => c.isSuccessful).length / allCompletions.length) * 100;
  const nextDueAt = new Date(Date.now() + route.periodDays * 86_400_000);

  await prisma.inspectionRoute.update({
    where: { id: id as string },
    data: { lastCompletedAt: new Date(), deliveryRate, successRate, nextDueAt },
  });

  return res.status(201).json({ completion, deliveryRate, successRate });
}
