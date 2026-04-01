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
    const configs = await prisma.workflowConfig.findMany({
      where: { OR: [{ organizationId: orgId }, { organizationId: null }] },
      orderBy: { ticketCategory: 'asc' },
    });
    return res.status(200).json(configs);
  }

  if (req.method === 'POST') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { ticketCategory, statuses, customFields, autoRoutingRules } = req.body;
    const config = await prisma.workflowConfig.upsert({
      where: { organizationId_ticketCategory: { organizationId: orgId, ticketCategory } },
      update: { statuses, customFields, autoRoutingRules },
      create: { organizationId: orgId, ticketCategory, statuses: statuses || [], customFields, autoRoutingRules },
    });
    return res.status(200).json(config);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
