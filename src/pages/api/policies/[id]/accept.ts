// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;
  const { id } = req.query;

  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress || null;

  const acceptance = await prisma.policyAcceptance.upsert({
    where: { policyId_userId: { policyId: id as string, userId: user.id } },
    update: { acceptedAt: new Date(), ipAddress },
    create: { policyId: id as string, userId: user.id, acceptedAt: new Date(), ipAddress },
  });

  return res.status(200).json(acceptance);
}
