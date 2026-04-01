// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { id } = req.query;

  if (req.method === 'GET') {
    const plan = await prisma.stocktakingPlan.findUnique({
      where: { id: id as string },
      include: { executor: { select: { email: true } } },
    });
    if (!plan) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json(plan);
  }

  if (req.method === 'PUT') {
    const { status, startedAt, completedAt, summaryReport, ...rest } = req.body;
    const data: any = { ...rest };
    if (status) data.status = status;
    if (startedAt) data.startedAt = new Date(startedAt);
    if (completedAt) data.completedAt = new Date(completedAt);
    if (summaryReport) data.summaryReport = summaryReport;
    const plan = await prisma.stocktakingPlan.update({ where: { id: id as string }, data });
    return res.status(200).json(plan);
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
}
