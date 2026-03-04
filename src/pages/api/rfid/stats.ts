// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  const orgId    = roleData?.organizationId ?? null;
  const where    = orgId ? { organizationId: orgId } : {};

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalTags, activeTags, lowBattery, missing, unassigned, totalZones, scans24h] = await Promise.all([
    prisma.rFIDTag.count({ where }),
    prisma.rFIDTag.count({ where: { ...where, status: 'ACTIVE' } }),
    prisma.rFIDTag.count({ where: { ...where, status: 'LOW_BATTERY' } }),
    prisma.rFIDTag.count({ where: { ...where, status: 'MISSING' } }),
    prisma.rFIDTag.count({ where: { ...where, status: 'UNASSIGNED' } }),
    prisma.rFIDZone.count({ where }),
    prisma.rFIDScan.count({
      where: {
        tag: where,
        createdAt: { gte: since24h },
      },
    }),
  ]);

  return res.status(200).json({
    totalTags, activeTags, lowBattery, missing, unassigned, totalZones, scans24h,
  });
}
