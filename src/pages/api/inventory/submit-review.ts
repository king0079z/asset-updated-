// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getSessionSafe } from '@/util/supabase/require-auth';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

async function handleSubmitReview(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Auth ─────────────────────────────────────────────────────────────────
  let user: { id: string } | null = null;
  try {
    const session = await getSessionSafe(req, res);
    user = session?.user ?? null;
  } catch (authErr) {
    console.error('[submit-review] getSessionSafe failed:', authErr);
    return res.status(401).json({ error: 'Auth error' });
  }
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: Record<string, any> = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
  } catch {
    body = {};
  }

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
  } = body;

  const missing = Number(missingCount) || 0;

  // ── Get user data ─────────────────────────────────────────────────────────
  let userData: { organizationId: string | null; name: string | null; email: string | null; role: string } | null = null;
  try {
    userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true, name: true, email: true, role: true },
    });
  } catch (userErr) {
    console.error('[submit-review] user.findUnique failed:', userErr);
    // Non-fatal — continue without user data
  }

  // Safe JSON serialiser: strips undefined/non-serialisable values
  const safeJson = (val: unknown): unknown => {
    try {
      return JSON.parse(JSON.stringify(val ?? null));
    } catch {
      return null;
    }
  };

  // ── 1. Persist audit log ─────────────────────────────────────────────────
  let auditLogId: string | null = null;
  try {
    const audit = await prisma.auditLog.create({
      data: {
        action: 'INVENTORY_REVIEW_SUBMITTED',
        resourceType: 'INVENTORY',
        details: safeJson({
          floorNumber: floorNumber ?? null,
          roomNumber: roomNumber ?? null,
          sessionStartTime: sessionStartTime ?? null,
          sessionDurationMs: sessionDurationMs ?? null,
          totalScanned: Number(totalScanned) || 0,
          totalInSystem: Number(totalInSystem) || 0,
          missingCount: missing,
          extraCount: Number(extraCount) || 0,
          wrongLocationCount: Number(wrongLocationCount) || 0,
          rosterNotReadCount: Number(rosterNotReadCount) || 0,
          reasonCode: reasonCode ?? null,
          note: note ?? null,
          missingItems: (Array.isArray(missingItems) ? missingItems : []).slice(0, 100),
          wrongLocationItems: (Array.isArray(wrongLocationItems) ? wrongLocationItems : []).slice(0, 50),
          correctInRoomItems: (Array.isArray(correctInRoomItems) ? correctInRoomItems : []).slice(0, 100),
          extraItems: (Array.isArray(extraItems) ? extraItems : []).slice(0, 50),
          submittedByName: userData?.name ?? null,
          // Always store email — fall back to Supabase session email if Prisma lookup failed
          submittedByEmail: userData?.email ?? (user as any)?.email ?? null,
          submittedAt: new Date().toISOString(),
        }),
        type: 'USER_ACTIVITY',
        severity: missing > 0 ? 'WARNING' : 'INFO',
        userId: user.id,
        // Store email directly on the log so future queries can use it without a user lookup
        userEmail: userData?.email ?? (user as any)?.email ?? null,
      },
    });
    auditLogId = audit.id;
  } catch (auditErr) {
    // Log but don't fail the request
    console.error('[submit-review] auditLog.create failed:', String(auditErr));
  }

  // ── 2. Notify managers (best-effort) ────────────────────────────────────
  if (missing > 0 && userData?.organizationId) {
    try {
      const managers = await prisma.user.findMany({
        where: {
          organizationId: userData.organizationId,
          role: { in: ['MANAGER', 'ADMIN'] },
        },
        select: { id: true },
        take: 10,
      });

      if (managers.length > 0) {
        const locationLabel = [floorNumber, roomNumber].filter(Boolean).join(', ') || 'the scanned location';
        const staffLabel = userData.name || userData.email || 'Staff';
        await prisma.notification.createMany({
          data: managers.map((m) => ({
            userId: m.id,
            type: 'INVENTORY_MISSING_ITEMS',
            title: `Missing items — ${locationLabel}`,
            message: `${staffLabel} completed an RFID count at ${locationLabel}. ${missing} item(s) were not detected. Review the report.`,
          })),
          skipDuplicates: true,
        });
      }
    } catch (notifErr) {
      console.error('[submit-review] notification failed:', String(notifErr));
    }
  }

  // Always return success — report submission is best-effort server-side
  return res.status(200).json({ success: true, auditLogId });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await handleSubmitReview(req, res);
  } catch (fatal) {
    console.error('[submit-review] fatal unhandled error:', fatal instanceof Error ? fatal.message : String(fatal));
    if (!res.headersSent) {
      res.setHeader('X-Submit-Error', String(fatal instanceof Error ? fatal.message : fatal).slice(0, 200));
      return res.status(200).json({ success: false, error: 'submission logged locally only' });
    }
  }
}
