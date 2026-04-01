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

  if (req.method === 'GET') {
    const rules = await prisma.escalationRule.findMany({
      where: { OR: [{ organizationId: orgId }, { organizationId: null }] },
      orderBy: { level: 'asc' },
    });
    return res.status(200).json(rules);
  }

  if (req.method === 'POST') {
    if (!roleData?.isAdmin && roleData?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const { name, level, delayMinutes, targetRole, targetUserId, enabled } = req.body;
    const rule = await prisma.escalationRule.create({
      data: { name, level: level || 1, delayMinutes: delayMinutes || 60, targetRole, targetUserId, enabled: enabled !== false, organizationId: orgId },
    });
    return res.status(201).json(rule);
  }

  if (req.method === 'PUT') {
    const { id, ...data } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const rule = await prisma.escalationRule.update({ where: { id }, data });
    return res.status(200).json(rule);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    await prisma.escalationRule.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
