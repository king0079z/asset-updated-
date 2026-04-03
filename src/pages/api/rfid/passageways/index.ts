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
  const isAdmin = roleData?.isAdmin || roleData?.role === 'ADMIN' || roleData?.role === 'MANAGER';

  if (req.method === 'GET') {
    const passageways = await prisma.passagewayConfig.findMany({
      where: { ...(orgId ? { organizationId: orgId } : {}) },
      include: { zone: { select: { id: true, name: true, building: true, floorNumber: true } } },
      orderBy: [{ siteName: 'asc' }, { updatedAt: 'desc' }],
    });
    return res.status(200).json(passageways);
  }

  if (req.method === 'POST') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { siteName, siteCode, zoneId, direction, alertOnUnauthorized, readerMacAddress, notes } = req.body;
    if (!siteName) return res.status(400).json({ error: 'siteName required' });
    const pw = await prisma.passagewayConfig.create({
      data: { siteName, siteCode, zoneId, direction: direction || 'BOTH', alertOnUnauthorized: alertOnUnauthorized !== false, readerMacAddress, notes, organizationId: orgId },
    });
    return res.status(201).json(pw);
  }

  if (req.method === 'PUT') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { id, ...data } = req.body;
    const pw = await prisma.passagewayConfig.update({ where: { id }, data });
    return res.status(200).json(pw);
  }

  if (req.method === 'DELETE') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { id } = req.body;
    await prisma.passagewayConfig.update({ where: { id }, data: { isActive: false } });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
