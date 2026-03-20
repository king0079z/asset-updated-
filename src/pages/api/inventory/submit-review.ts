// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getSessionSafe } from '@/util/supabase/require-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { user } = await getSessionSafe(req, res);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const {
      floorNumber,
      roomNumber,
      sessionStartTime,
      totalScanned = 0,
      totalInSystem = 0,
      missingCount = 0,
      extraCount = 0,
      wrongLocationCount = 0,
      reasonCode,
      note,
      missingItems = [],
      wrongLocationItems = [],
      sessionDurationMs,
    } = req.body || {};

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true, name: true, email: true },
    });

    await prisma.auditLog.create({
      data: {
        action: 'INVENTORY_REVIEW_SUBMITTED',
        resourceType: 'INVENTORY',
        details: {
          floorNumber: floorNumber || null,
          roomNumber: roomNumber || null,
          sessionStartTime,
          sessionDurationMs,
          totalScanned: Number(totalScanned),
          totalInSystem: Number(totalInSystem),
          missingCount: Number(missingCount),
          extraCount: Number(extraCount),
          wrongLocationCount: Number(wrongLocationCount),
          reasonCode: reasonCode || null,
          note: note || null,
          missingItems: (missingItems || []).slice(0, 50),
          wrongLocationItems: (wrongLocationItems || []).slice(0, 50),
          submittedByName: userData?.name,
          submittedByEmail: userData?.email,
          submittedAt: new Date().toISOString(),
          organizationId: userData?.organizationId,
        },
        type: 'USER_ACTIVITY',
        severity: 'INFO',
        userId: user.id,
        organizationId: userData?.organizationId,
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('submit-review error:', error);
    return res.status(500).json({ error: 'Failed to submit review' });
  }
}
