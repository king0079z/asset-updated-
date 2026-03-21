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
      correctInRoomItems = [],
      extraItems = [],
      sessionDurationMs,
      rosterNotReadCount = 0,
    } = req.body || {};

    const missing = Number(missingCount) || 0;

    // Get submitting user's details
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true, name: true, email: true, role: true },
    });

    // ── 1. Persist audit log ─────────────────────────────────────────────────
    let auditLogId: string | null = null;
    try {
      const safeJson = (val: unknown) => {
        try { return JSON.parse(JSON.stringify(val ?? null)); } catch { return null; }
      };

      const audit = await prisma.auditLog.create({
        data: {
          action: 'INVENTORY_REVIEW_SUBMITTED',
          resourceType: 'INVENTORY',
          details: {
            floorNumber: floorNumber || null,
            roomNumber: roomNumber || null,
            sessionStartTime: sessionStartTime || null,
            sessionDurationMs: sessionDurationMs || null,
            totalScanned: Number(totalScanned) || 0,
            totalInSystem: Number(totalInSystem) || 0,
            missingCount: missing,
            extraCount: Number(extraCount) || 0,
            wrongLocationCount: Number(wrongLocationCount) || 0,
            rosterNotReadCount: Number(rosterNotReadCount) || 0,
            reasonCode: reasonCode || null,
            note: note || null,
            missingItems: safeJson((missingItems || []).slice(0, 100)),
            wrongLocationItems: safeJson((wrongLocationItems || []).slice(0, 50)),
            correctInRoomItems: safeJson((correctInRoomItems || []).slice(0, 100)),
            extraItems: safeJson((extraItems || []).slice(0, 50)),
            submittedByName: userData?.name || null,
            submittedByEmail: userData?.email || null,
            submittedAt: new Date().toISOString(),
            organizationId: userData?.organizationId || null,
          },
          type: 'USER_ACTIVITY',
          severity: missing > 0 ? 'WARNING' : 'INFO',
          userId: user.id,
          // Only set organizationId if it exists in Organization table
          ...(userData?.organizationId ? { organizationId: userData.organizationId } : {}),
        },
      });
      auditLogId = audit.id;
    } catch (auditErr) {
      console.error('[submit-review] auditLog.create failed:', auditErr);
      // Continue — don't fail the whole request because of audit log
    }

    // ── 2. Send notification to manager(s) in the org (best-effort) ─────────
    if (missing > 0 && userData?.organizationId) {
      try {
        // Find all MANAGER and ADMIN users in the same org to notify
        const managers = await prisma.user.findMany({
          where: {
            organizationId: userData.organizationId,
            role: { in: ['MANAGER', 'ADMIN'] },
          },
          select: { id: true },
          take: 10,
        });

        const locationLabel = [floorNumber, roomNumber].filter(Boolean).join(', ') || 'the scanned location';
        const title = `Missing items — ${locationLabel}`;
        const message = `${userData.name || userData.email || 'Staff'} completed an RFID inventory count at ${locationLabel}. ${missing} item(s) registered to this room were not detected. Review the report.`;

        if (managers.length > 0) {
          await prisma.notification.createMany({
            data: managers.map((m) => ({
              userId: m.id,
              type: 'INVENTORY_MISSING_ITEMS',
              title,
              message,
            })),
            skipDuplicates: true,
          });
        }
      } catch (notifErr) {
        // Notification failure must NOT break the API response
        console.error('[submit-review] notification.createMany failed:', notifErr);
      }
    }

    return res.status(200).json({ success: true, auditLogId });
  } catch (error) {
    console.error('[submit-review] unhandled error:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'Failed to submit review' });
  }
}
