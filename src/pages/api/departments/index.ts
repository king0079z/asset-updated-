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
    const departments = await prisma.department.findMany({
      where: {
        isActive: true,
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
      include: { _count: { select: { assets: true } } },
      orderBy: { name: 'asc' },
    });
    return res.status(200).json(departments);
  }

  if (req.method === 'POST') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin or Manager only' });
    const { name, code, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Department name is required' });
    const dept = await prisma.department.upsert({
      where: { organizationId_name: { organizationId: orgId, name: name.trim() } },
      update: { code, description, isActive: true },
      create: { name: name.trim(), code, description, organizationId: orgId },
    });
    return res.status(201).json(dept);
  }

  if (req.method === 'PUT') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin or Manager only' });
    const { id, name, code, description, isActive } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const dept = await prisma.department.update({
      where: { id },
      data: { name, code, description, ...(isActive !== undefined ? { isActive } : {}) },
    });
    return res.status(200).json(dept);
  }

  if (req.method === 'DELETE') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin or Manager only' });
    const { id } = req.body;
    // Soft delete — keep data integrity
    await prisma.department.update({ where: { id }, data: { isActive: false } });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
