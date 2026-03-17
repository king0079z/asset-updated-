/**
 * Lightweight auth check for Outlook add-in.
 * GET with Authorization: Bearer <token> — returns 200 if valid, 401 otherwise.
 * Use this instead of GET /api/tickets to avoid slow ticket list fetch on every task pane load.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const auth = await requireAuth(req, res);
  if (!auth) return;
  return res.status(200).json({ ok: true, userId: auth.user.id });
}
