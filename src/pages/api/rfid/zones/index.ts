// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

// 30-second server-side cache per org
const zonesCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL  = 30_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  const orgId    = roleData?.organizationId ?? null;
  const where    = orgId ? { organizationId: orgId } : {};
  const cacheKey = `zones:${orgId ?? 'global'}`;

  if (req.method === 'GET') {
    // Cache hit
    const cached = zonesCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL && req.query.refresh !== 'true') {
      res.setHeader('Cache-Control', 'private, max-age=20, stale-while-revalidate=60');
      return res.status(200).json(cached.data);
    }

    try {
      const zones = await prisma.rFIDZone.findMany({
        where,
        select: {
          id: true, name: true, description: true,
          apMacAddress: true, apIpAddress: true, apSerialNumber: true,
          floorNumber: true, roomNumber: true, building: true,
          isRestricted: true, mapX: true, mapY: true, mapWidth: true, mapHeight: true,
          organizationId: true, createdAt: true,
          _count: { select: { tags: true, scans: true } },
          floorPlan: { select: { id: true, name: true, imageUrl: true } },
          // Limit tags per zone to prevent N+1 explosion
          tags: {
            select: {
              id: true, tagId: true, tagType: true, status: true,
              batteryLevel: true, lastSeenAt: true,
              asset: { select: { id: true, name: true, status: true } },
            },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const payload = { zones };
      zonesCache.set(cacheKey, { data: payload, ts: Date.now() });
      res.setHeader('Cache-Control', 'private, max-age=20, stale-while-revalidate=60');
      return res.status(200).json(payload);
    } catch (err) {
      console.error('[rfid/zones GET]', err);
      return res.status(500).json({ error: 'Failed to fetch zones' });
    }
  }

  if (req.method === 'POST') {
    const {
      name, description, apMacAddress, apIpAddress, apSerialNumber,
      floorNumber, roomNumber, building,
      isRestricted, floorPlanId, mapX, mapY, mapWidth, mapHeight,
    } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

    try {
      const zone = await prisma.rFIDZone.create({
        data: {
          name:           name.trim(),
          description:    description || null,
          apMacAddress:   apMacAddress?.trim().toUpperCase() || null,
          apIpAddress:    apIpAddress?.trim() || null,
          apSerialNumber: apSerialNumber?.trim() || null,
          floorNumber:    floorNumber || null,
          roomNumber:     roomNumber  || null,
          building:       building   || null,
          isRestricted:   isRestricted === true || isRestricted === 'true' || false,
          organizationId: orgId,
          ...(floorPlanId ? { floorPlanId } : {}),
          ...(mapX      != null ? { mapX: Number(mapX) }      : {}),
          ...(mapY      != null ? { mapY: Number(mapY) }      : {}),
          ...(mapWidth  != null ? { mapWidth: Number(mapWidth) }  : {}),
          ...(mapHeight != null ? { mapHeight: Number(mapHeight) } : {}),
        },
      });
      // Invalidate cache
      zonesCache.delete(cacheKey);
      return res.status(201).json({ zone });
    } catch (err) {
      console.error('[rfid/zones POST]', err);
      return res.status(500).json({ error: 'Failed to create zone' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
