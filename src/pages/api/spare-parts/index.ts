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
    const { search, lowStock } = req.query;
    const parts = await prisma.sparePart.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        ...(search ? { OR: [{ name: { contains: search as string, mode: 'insensitive' } }, { partNumber: { contains: search as string, mode: 'insensitive' } }] } : {}),
        ...(lowStock === '1' ? { quantity: { lte: prisma.sparePart.fields.reorderLevel } } : {}),
      },
      include: { vendor: { select: { id: true, name: true } }, _count: { select: { usages: true } } },
      orderBy: { name: 'asc' },
      take: 200,
    });
    // Filter lowStock in JS since Prisma doesn't support field-to-field comparison
    const result = lowStock === '1' ? parts.filter(p => p.quantity <= p.reorderLevel) : parts;
    return res.status(200).json(result);
  }

  if (req.method === 'POST') {
    const { name, partNumber, description, quantity, unitCost, reorderLevel, unit, assetType, vendorId, location } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const part = await prisma.sparePart.create({
      data: { name, partNumber, description, quantity: quantity || 0, unitCost: unitCost || 0, reorderLevel: reorderLevel || 5, unit: unit || 'pcs', assetType, vendorId, location, organizationId: orgId },
    });
    return res.status(201).json(part);
  }

  if (req.method === 'PUT') {
    const { id, ...data } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const part = await prisma.sparePart.update({ where: { id }, data });
    return res.status(200).json(part);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    await prisma.sparePart.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
