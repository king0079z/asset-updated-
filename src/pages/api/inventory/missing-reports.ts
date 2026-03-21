// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getSessionSafe } from '@/util/supabase/require-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { user } = await getSessionSafe(req, res);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true },
    });

    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'INVENTORY_REVIEW_SUBMITTED',
        resourceType: 'INVENTORY',
        ...(userData?.organizationId ? { organizationId: userData.organizationId } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    const reports = logs
      .map((log) => {
        const d = (log.details as Record<string, unknown>) || {};
        const missingCount = Number(d.missingCount) || 0;
        const wrongN = Number(d.wrongLocationCount) || 0;
        const extraN = Number(d.extraCount) || 0;
        const wrongItems = (d.wrongLocationItems as Array<{ id: string; name?: string; systemFloor?: string; systemRoom?: string }>) || [];
        const extraItems = (d.extraItems as Array<{ id: string; name?: string; barcode?: string; floorNumber?: string; roomNumber?: string }>) || [];
        const correctItems =
          (d.correctInRoomItems as Array<{ id: string; name?: string; barcode?: string; floorNumber?: string; roomNumber?: string }>) || [];
        const hasContent =
          missingCount > 0 ||
          wrongN > 0 ||
          extraN > 0 ||
          wrongItems.length > 0 ||
          extraItems.length > 0 ||
          correctItems.length > 0;
        if (!hasContent) return null;
        return {
          id: log.id,
          timestamp: log.timestamp.toISOString(),
          floorNumber: d.floorNumber ?? null,
          roomNumber: d.roomNumber ?? null,
          missingCount,
          wrongLocationCount: wrongN,
          extraCount: extraN,
          totalScanned: d.totalScanned ?? 0,
          totalInSystem: d.totalInSystem ?? 0,
          submittedByName: d.submittedByName ?? null,
          submittedAt: d.submittedAt ?? null,
          missingItems: (d.missingItems as Array<{ id: string; name?: string; barcode?: string; floorNumber?: string; roomNumber?: string }>) || [],
          wrongLocationItems: wrongItems,
          correctInRoomItems: correctItems,
          extraItems,
        };
      })
      .filter(Boolean);

    return res.status(200).json(reports);
  } catch (error) {
    console.error('missing-reports error:', error);
    return res.status(500).json({ error: 'Failed to load reports' });
  }
}
