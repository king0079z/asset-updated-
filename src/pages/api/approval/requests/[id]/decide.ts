// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import { processDecision } from '@/lib/approval/approvalEngine';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;
  const { id } = req.query;
  const { stepId, decision, comment } = req.body;

  if (!stepId || !decision) return res.status(400).json({ error: 'stepId and decision are required' });
  if (!['APPROVED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: 'decision must be APPROVED or REJECTED' });

  const result = await processDecision({
    requestId: id as string,
    stepId,
    decision,
    comment,
    userId: user.id,
  });

  return res.status(200).json({ result });
}
