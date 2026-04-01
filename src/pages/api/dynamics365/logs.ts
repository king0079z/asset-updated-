// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const roleData = await getUserRoleData(auth.user.id);
  const orgId = roleData?.organizationId || null;

  const { status, entityType, take } = req.query;
  const logs = await prisma.d365SyncLog.findMany({
    where: {
      ...(orgId ? { organizationId: orgId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(entityType ? { entityType: entityType as string } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(take) || 100, 500),
  });

  return res.status(200).json(logs);
}
