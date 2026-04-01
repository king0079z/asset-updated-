// @ts-nocheck
/**
 * GET /api/sla/monitor
 * Called by Vercel Cron every 5 minutes. Checks SLA breaches and triggers escalations.
 * Protected by CRON_SECRET env var.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { checkSLABreaches } from '@/lib/sla/slaEngine';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const incoming = req.headers.authorization?.replace('Bearer ', '') || req.query.secret;
    if (incoming !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const result = await checkSLABreaches();
    return res.status(200).json({ ok: true, ...result, ts: new Date().toISOString() });
  } catch (err: any) {
    console.error('[SLA Monitor] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
