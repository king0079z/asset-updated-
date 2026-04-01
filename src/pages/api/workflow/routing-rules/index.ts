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
    const rules = await prisma.routingRule.findMany({
      where: { OR: [{ organizationId: orgId }, { organizationId: null }], isActive: true },
      orderBy: { priority_order: 'asc' },
    });
    return res.status(200).json(rules);
  }

  if (req.method === 'POST') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { category, priority, assetType, assignToRole, assignToUserId, teamName, priority_order } = req.body;
    const rule = await prisma.routingRule.create({
      data: { organizationId: orgId, category, priority, assetType, assignToRole, assignToUserId, teamName, priority_order: priority_order || 0 },
    });
    return res.status(201).json(rule);
  }

  if (req.method === 'PUT') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { id, ...data } = req.body;
    const rule = await prisma.routingRule.update({ where: { id }, data });
    return res.status(200).json(rule);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    await prisma.routingRule.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
