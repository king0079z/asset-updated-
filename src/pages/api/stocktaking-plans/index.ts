// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;
  const roleData = await getUserRoleData(user.id);
  const orgId = roleData?.organizationId || null;

  if (req.method === 'GET') {
    const plans = await prisma.stocktakingPlan.findMany({
      where: { ...(orgId ? { organizationId: orgId } : {}) },
      include: { executor: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return res.status(200).json(plans);
  }

  if (req.method === 'POST') {
    const { type, name, description, scope, executorId, scheduledAt } = req.body;
    const plan = await prisma.stocktakingPlan.create({
      data: {
        type: type || 'FULL',
        name: name || `${type || 'FULL'} Stocktaking ${new Date().toLocaleDateString()}`,
        description,
        scope,
        executorId: executorId || user.id,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        organizationId: orgId,
      },
    });
    return res.status(201).json(plan);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
