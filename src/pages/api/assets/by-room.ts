import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getSessionSafe } from '@/util/supabase/require-auth';
import { getUserRoleData } from '@/util/roleCheck';

/** Match handheld `normalizeLoc` for floor/room comparison */
function normLoc(s: string | null | undefined): string {
  const t = String(s ?? '').trim().toLowerCase();
  const num = t.replace(/^0+(\d+)$/, '$1');
  return num || t;
}

/**
 * GET /api/assets/by-room?floorNumber=3&roomNumber=ADM-01
 * Returns assets whose registered floor/room match (normalized), scoped like the main assets list.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const floorQ = req.query.floorNumber;
  const roomQ = req.query.roomNumber;
  if (typeof floorQ !== 'string' || typeof roomQ !== 'string' || !floorQ.trim() || !roomQ.trim()) {
    return res.status(400).json({ error: 'floorNumber and roomNumber query params are required' });
  }

  try {
    const { user } = await getSessionSafe(req, res);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const roleData = await getUserRoleData(user.id);
    const isAdminOrManagerUser =
      roleData?.role === 'ADMIN' ||
      roleData?.role === 'MANAGER' ||
      roleData?.role === 'HANDHELD' ||
      roleData?.isAdmin === true;
    const organizationId = roleData?.organizationId ?? null;

    const nf = normLoc(floorQ);
    const nr = normLoc(roomQ);

    const assetSelect = {
      id: true,
      assetId: true,
      name: true,
      barcode: true,
      status: true,
      floorNumber: true,
      roomNumber: true,
      imageUrl: true,
    } as const;

    let assets: Awaited<ReturnType<typeof prisma.asset.findMany>> = [];

    if (roleData && (roleData.isAdmin === true || roleData.email === 'admin@example.com')) {
      assets = await prisma.asset.findMany({
        where: {},
        select: assetSelect,
        orderBy: { name: 'asc' },
        take: 8000,
      });
    } else if (isAdminOrManagerUser && organizationId) {
      assets = await prisma.asset.findMany({
        where: { organizationId },
        select: assetSelect,
        orderBy: { name: 'asc' },
        take: 8000,
      });
    } else if (user && organizationId) {
      assets = await prisma.asset.findMany({
        where: { userId: user.id, OR: [{ organizationId }, { organizationId: null }] },
        select: assetSelect,
        orderBy: { name: 'asc' },
        take: 8000,
      });
    } else if (user) {
      assets = await prisma.asset.findMany({
        where: { userId: user.id },
        select: assetSelect,
        orderBy: { name: 'asc' },
        take: 8000,
      });
    }

    const filtered = assets.filter((a) => normLoc(a.floorNumber) === nf && normLoc(a.roomNumber) === nr);

    res.setHeader('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
    return res.status(200).json(filtered);
  } catch (e) {
    console.error('by-room error:', e);
    return res.status(500).json({ error: 'Failed to load assets for room' });
  }
}
