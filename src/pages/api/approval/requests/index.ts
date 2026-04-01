// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;

  if (req.method === 'GET') {
    const { entityId, entityType, pendingFor } = req.query;

    const requests = await prisma.approvalRequest.findMany({
      where: {
        ...(entityId ? { entityId: entityId as string } : {}),
        ...(entityType ? { entityType: entityType as any } : {}),
        ...(pendingFor === 'me'
          ? { status: 'PENDING', steps: { some: { assignedToId: user.id, status: 'PENDING' } } }
          : {}),
      },
      include: {
        chain: { select: { name: true, entityType: true } },
        requestedBy: { select: { email: true } },
        steps: {
          include: { assignedTo: { select: { email: true } } },
          orderBy: { stepOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.status(200).json(requests);
  }

  if (req.method === 'POST') {
    const { chainId, entityId, entityType, notes } = req.body;
    const { initiateApproval } = await import('@/lib/approval/approvalEngine');
    const requestId = await initiateApproval({
      chainId, entityId, entityType,
      requestedById: user.id,
      organizationId: null,
      notes,
    });
    return res.status(201).json({ requestId });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
