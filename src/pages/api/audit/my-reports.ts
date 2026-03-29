// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/util/supabase/require-auth';

/**
 * GET /api/audit/my-reports
 * Returns all inventory reports submitted by the authenticated user
 * with live status (reviewing / tickets / completed) and ticket counts.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authResult = await requireAuth(req, res);
  if (!authResult) return;
  const { user } = authResult;

  try {
    // Fetch this user's inventory audit logs (most recent first, last 30)
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'INVENTORY_REVIEW_SUBMITTED',
        OR: [
          { userId: user.id },
          { userEmail: user.email },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        createdAt: true,
        details: true,
        verified: true,
        verifiedAt: true,
        userEmail: true,
      },
    });

    if (!logs.length) return res.status(200).json({ reports: [] });

    // Enrich each report with ticket counts (parallel queries)
    const reports = await Promise.all(
      logs.map(async (log) => {
        const [tickets] = await Promise.all([
          prisma.ticket.findMany({
            where: { description: { contains: log.id } },
            select: { id: true, status: true },
          }),
        ]);

        let details: Record<string, any> = {};
        try {
          details = typeof log.details === 'string'
            ? JSON.parse(log.details || '{}')
            : (log.details ?? {});
        } catch {}

        const state = log.verified
          ? 'completed'
          : tickets.length > 0
          ? 'tickets'
          : 'reviewing';

        return {
          id: log.id,
          submittedAt: log.createdAt.toISOString(),
          floor: details?.floorNumber ?? details?.floor ?? '',
          room: details?.roomNumber ?? details?.room ?? '',
          totalScanned: details?.totalScanned ?? 0,
          missingCount: details?.missingCount ?? 0,
          extraCount: details?.extraCount ?? 0,
          state,
          ticketCount: tickets.length,
          completedAt: log.verifiedAt?.toISOString() ?? null,
        };
      })
    );

    return res.status(200).json({ reports });
  } catch (err: any) {
    console.error('[audit/my-reports]', err?.message);
    return res.status(500).json({ error: 'Failed to fetch reports' });
  }
}
