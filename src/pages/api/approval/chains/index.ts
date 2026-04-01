// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;
  const roleData = await getUserRoleData(user.id);
  const orgId = roleData?.organizationId || null;
  const isAdmin = roleData?.isAdmin || roleData?.role === 'ADMIN';

  if (req.method === 'GET') {
    const chains = await prisma.approvalChain.findMany({
      where: { OR: [{ organizationId: orgId }, { organizationId: null }] },
      include: { _count: { select: { requests: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(chains);
  }

  if (req.method === 'POST') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { name, description, entityType, steps } = req.body;
    const chain = await prisma.approvalChain.create({
      data: { name, description, entityType, steps: steps || [], organizationId: orgId },
    });
    return res.status(201).json(chain);
  }

  if (req.method === 'PUT') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { id, ...data } = req.body;
    const chain = await prisma.approvalChain.update({ where: { id }, data });
    return res.status(200).json(chain);
  }

  res.setHeader('Allow', 'GET, POST, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
}
