// @ts-nocheck
/**
 * GET /api/rfid/locations
 *
 * Returns current zone/location of every RFID-tagged asset.
 * Used by the live tracking map.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  const orgId    = roleData?.organizationId ?? null;

  const tags = await prisma.rFIDTag.findMany({
    where: {
      ...(orgId ? { organizationId: orgId } : {}),
      NOT: { status: 'UNASSIGNED' },
    },
    include: {
      asset: {
        select: { id: true, name: true, type: true, status: true, imageUrl: true },
      },
      lastZone: true,
    },
    orderBy: { lastSeenAt: 'desc' },
  });

  // Fetch recent scan history per tag (last 24 hours) for movement trail
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentScans = await prisma.rFIDScan.findMany({
    where: {
      tag: orgId ? { organizationId: orgId } : {},
      createdAt: { gte: since },
    },
    include: { zone: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  // Group scan history by tagId
  const historyByTag: Record<string, any[]> = {};
  for (const s of recentScans) {
    if (!historyByTag[s.tagId]) historyByTag[s.tagId] = [];
    if (historyByTag[s.tagId].length < 20) {
      historyByTag[s.tagId].push({
        zone:      s.zone?.name ?? 'Unknown',
        rssi:      s.rssi,
        timestamp: s.createdAt,
      });
    }
  }

  const locations = tags.map(tag => ({
    tagId:       tag.id,
    tagMac:      tag.tagId,
    tagType:     tag.tagType,
    status:      tag.status,
    batteryLevel: tag.batteryLevel,
    lastRssi:    tag.lastRssi,
    lastSeenAt:  tag.lastSeenAt,
    asset:       tag.asset,
    zone:        tag.lastZone,
    trail:       historyByTag[tag.id] ?? [],
  }));

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ locations, total: locations.length });
}
