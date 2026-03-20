// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getSessionSafe } from '@/util/supabase/require-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { id: assetId } = req.query as { id: string };
  if (!assetId) return res.status(400).json({ error: 'Asset ID required' });

  try {
    const { user } = await getSessionSafe(req, res);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const u = await prisma.user.findUnique({ where: { id: user.id }, select: { organizationId: true } });
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'INVENTORY_REVIEW_SUBMITTED',
        resourceType: 'INVENTORY',
        ...(u?.organizationId ? { organizationId: u.organizationId } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    const reports = logs
      .map((log) => {
        const d = (log.details as Record<string, unknown>) || {};
        const missingItems = (d.missingItems as Array<{ id: string }>) || [];
        if (!missingItems.some((i) => i.id === assetId)) return null;
        return {
          id: log.id,
          timestamp: log.timestamp.toISOString(),
          floorNumber: d.floorNumber ?? null,
          roomNumber: d.roomNumber ?? null,
          missingCount: Number(d.missingCount) ?? 0,
        };
      })
      .filter(Boolean);

    return res.status(200).json(reports);
  } catch (error) {
    console.error('missing-reports for asset error:', error);
    return res.status(500).json({ error: 'Failed to load' });
  }
}
