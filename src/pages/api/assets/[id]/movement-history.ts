import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getSessionSafe } from '@/util/supabase/require-auth';
import { getUserRoleData } from '@/util/roleCheck';

/**
 * Movement history for an asset — used by handheld reconciliation and asset pages.
 * Access: same organization as asset, or asset owner, or ADMIN / MANAGER / HANDHELD / isAdmin.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid asset ID' });
  }

  try {
    const { user } = await getSessionSafe(req, res);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [asset, roleData] = await Promise.all([
      prisma.asset.findUnique({
        where: { id },
        select: { id: true, userId: true, organizationId: true },
      }),
      getUserRoleData(user.id),
    ]);

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const orgId = roleData?.organizationId ?? null;
    const role = roleData?.role ?? '';
    const isElevated =
      roleData?.isAdmin === true ||
      role === 'ADMIN' ||
      role === 'MANAGER' ||
      role === 'HANDHELD';

    const sameOrg = !!(orgId && asset.organizationId && asset.organizationId === orgId);
    const isOwner = asset.userId === user.id;

    if (!isElevated && !sameOrg && !isOwner) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const movements = await prisma.assetMovement.findMany({
      where: { assetId: id },
      orderBy: { movedAt: 'desc' },
      take: 100,
      include: {
        asset: {
          select: { name: true },
        },
      },
    });

    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    return res.status(200).json(movements);
  } catch (error) {
    console.error('Error fetching asset movement history:', error);
    return res.status(500).json({
      error: 'Failed to fetch movement history',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
