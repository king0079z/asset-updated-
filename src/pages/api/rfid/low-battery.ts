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

  const threshold = Number(req.query.threshold) || 20;

  const tags = await prisma.rFIDTag.findMany({
    where: {
      batteryLevel: { lte: threshold, not: null },
      status: { not: 'INACTIVE' },
      ...(orgId ? { organizationId: orgId } : {}),
    },
    include: {
      asset: { select: { id: true, name: true, assetId: true } },
      lastZone: { select: { name: true } },
    },
    orderBy: { batteryLevel: 'asc' },
    take: 200,
  });

  return res.status(200).json({ threshold, count: tags.length, tags });
}
