// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/util/supabase/require-auth';

/**
 * GET /api/audit/report-status?id=<auditLogId>
 * Returns the current status of a submitted inventory report for the handheld status tracker.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authResult = await requireAuth(req, res);
  if (!authResult) return;

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    const log = await prisma.auditLog.findFirst({
      where: { id, action: 'INVENTORY_REVIEW_SUBMITTED' },
      select: { id: true, verified: true, verifiedAt: true },
    });

    if (!log) return res.status(404).json({ error: 'Report not found' });

    const tickets = await prisma.ticket.findMany({
      where: { description: { contains: id } },
      select: { id: true, status: true },
    });

    const state = log.verified ? 'completed' : tickets.length > 0 ? 'tickets' : 'reviewing';

    return res.status(200).json({
      state,
      ticketCount: tickets.length,
      completedAt: log.verifiedAt?.toISOString() || null,
    });
  } catch (err: any) {
    console.error('[audit/report-status]', err?.message);
    return res.status(500).json({ error: 'Failed to check report status' });
  }
}
