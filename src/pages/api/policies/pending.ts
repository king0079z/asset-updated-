// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;
  const roleData = await getUserRoleData(user.id);
  const orgId = roleData?.organizationId || null;

  // Get all active policies for this org
  const allPolicies = await prisma.policyDocument.findMany({
    where: {
      isActive: true,
      requiresAcceptance: true,
      OR: [{ organizationId: orgId }, { organizationId: null }],
    },
    select: { id: true },
  });

  // Find accepted ones
  const accepted = await prisma.policyAcceptance.findMany({
    where: { userId: user.id, policyId: { in: allPolicies.map(p => p.id) } },
    select: { policyId: true },
  });
  const acceptedIds = new Set(accepted.map(a => a.policyId));

  const pendingIds = allPolicies.filter(p => !acceptedIds.has(p.id)).map(p => p.id);

  if (pendingIds.length === 0) return res.status(200).json([]);

  const pending = await prisma.policyDocument.findMany({
    where: { id: { in: pendingIds } },
  });

  return res.status(200).json(pending);
}
