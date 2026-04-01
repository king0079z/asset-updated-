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
    const policies = await prisma.policyDocument.findMany({
      where: { OR: [{ organizationId: orgId }, { organizationId: null }], isActive: true },
      include: {
        _count: { select: { acceptances: true } },
      },
      orderBy: { effectiveDate: 'desc' },
    });
    return res.status(200).json(policies);
  }

  if (req.method === 'POST') {
    if (!isAdmin) return res.status(403).json({ error: 'Insufficient permissions' });
    const { title, content, version, effectiveDate, requiresAcceptance } = req.body;
    const policy = await prisma.policyDocument.create({
      data: { title, content, version: version || '1.0', effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(), requiresAcceptance: requiresAcceptance !== false, organizationId: orgId },
    });
    return res.status(201).json(policy);
  }

  if (req.method === 'PUT') {
    if (!isAdmin) return res.status(403).json({ error: 'Insufficient permissions' });
    const { id, ...data } = req.body;
    const policy = await prisma.policyDocument.update({ where: { id }, data });
    return res.status(200).json(policy);
  }

  res.setHeader('Allow', 'GET, POST, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
}
