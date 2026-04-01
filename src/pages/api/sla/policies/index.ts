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
    const policies = await prisma.sLAPolicy.findMany({
      where: { OR: [{ organizationId: orgId }, { isDefault: true }] },
      orderBy: [{ category: 'asc' }, { priority: 'asc' }],
    });
    return res.status(200).json(policies);
  }

  if (req.method === 'POST') {
    if (!roleData?.isAdmin && roleData?.role !== 'ADMIN' && roleData?.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const { name, category, priority, responseHours, resolutionHours, isDefault } = req.body;
    if (!category || !priority) return res.status(400).json({ error: 'category and priority are required' });
    const policy = await prisma.sLAPolicy.upsert({
      where: { organizationId_category_priority: { organizationId: orgId, category, priority } },
      update: { name, responseHours: responseHours || 4, resolutionHours: resolutionHours || 24, isDefault: !!isDefault },
      create: { name: name || `${category} - ${priority}`, category, priority, responseHours: responseHours || 4, resolutionHours: resolutionHours || 24, organizationId: orgId, isDefault: !!isDefault },
    });
    return res.status(200).json(policy);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    await prisma.sLAPolicy.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
