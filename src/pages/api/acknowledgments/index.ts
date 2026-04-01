// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;

  if (req.method === 'POST') {
    const { assetId, signature, policyVersion, notes } = req.body;
    if (!assetId) return res.status(400).json({ error: 'assetId is required' });

    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket?.remoteAddress || null;

    const ack = await prisma.assetAcknowledgment.create({
      data: {
        assetId,
        userId: user.id,
        ipAddress,
        signature: signature || null,
        policyVersion,
        notes,
      },
    });

    return res.status(201).json(ack);
  }

  if (req.method === 'GET') {
    const { assetId } = req.query;
    const acks = await prisma.assetAcknowledgment.findMany({
      where: {
        userId: user.id,
        ...(assetId ? { assetId: assetId as string } : {}),
      },
      include: { asset: { select: { name: true, assetId: true } } },
      orderBy: { acknowledgedAt: 'desc' },
    });
    return res.status(200).json(acks);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
