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
    const routes = await prisma.inspectionRoute.findMany({
      where: { isActive: true, ...(orgId ? { organizationId: orgId } : {}) },
      include: {
        assignedTo: { select: { email: true } },
        completions: { orderBy: { completedAt: 'desc' }, take: 5 },
      },
      orderBy: { name: 'asc' },
    });
    return res.status(200).json(routes);
  }

  if (req.method === 'POST') {
    const { name, description, assetIds, periodDays, assignedToId } = req.body;
    const idsJson = Array.isArray(assetIds) ? assetIds : [];
    const nextDueAt = new Date(Date.now() + (periodDays || 30) * 86_400_000);
    const route = await prisma.inspectionRoute.create({
      data: {
        name,
        description,
        assetIds: idsJson,
        periodDays: periodDays || 30,
        assignedToId: assignedToId || user.id,
        organizationId: orgId,
        nextDueAt,
      },
    });
    return res.status(201).json(route);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
