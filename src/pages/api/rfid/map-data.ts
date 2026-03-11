// @ts-nocheck
/**
 * GET /api/rfid/map-data
 *
 * FAST combined endpoint — returns floor plans + zones + asset locations in ONE
 * database round-trip set instead of 3 separate API calls.
 *
 * Server-side in-memory cache: 20 seconds per org (dramatically reduces latency
 * when the user switches between 2D/3D views).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

const CACHE_TTL = 20_000; // 20 seconds
const cache = new Map<string, { data: any; ts: number }>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  const orgId    = roleData?.organizationId ?? null;

  // ── Cache hit ─────────────────────────────────────────────────────────────────
  const cacheKey = `map:${orgId ?? 'global'}`;
  const cached   = cache.get(cacheKey);

  if (cached && Date.now() - cached.ts < CACHE_TTL && req.query.refresh !== 'true') {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(cached.data);
  }

  // ── Parallel DB fetch (3 queries, no scan trail — that was costing ~500ms) ───
  const orgFilter = orgId ? { organizationId: orgId } : {};

  const [floorPlans, zones, tags] = await Promise.all([
    prisma.floorPlan.findMany({
      where: orgFilter,
      orderBy: { floorNumber: 'asc' },
    }),
    prisma.rFIDZone.findMany({
      where: orgFilter,
      select: {
        id: true, name: true, description: true,
        floorPlanId: true, floorNumber: true, roomNumber: true,
        mapX: true, mapY: true, mapWidth: true, mapHeight: true,
        isRestricted: true, apMacAddress: true,
        _count: { select: { tags: true, scans: true } },
      },
    }),
    prisma.rFIDTag.findMany({
      where: { ...orgFilter, NOT: { status: 'UNASSIGNED' } },
      select: {
        id: true, tagId: true, tagType: true, status: true,
        batteryLevel: true, lastRssi: true, lastSeenAt: true,
        manufacturer: true, model: true,
        asset: { select: { id: true, name: true, type: true, status: true } },
        lastZone: {
          select: {
            id: true, name: true,
            mapX: true, mapY: true, mapWidth: true, mapHeight: true,
            floorPlanId: true, isRestricted: true,
          },
        },
      },
      orderBy: { lastSeenAt: 'desc' },
    }),
  ]);

  const locations = tags.map(t => ({
    tagId:       t.id,
    tagMac:      t.tagId,
    tagType:     t.tagType,
    status:      t.status,
    batteryLevel: t.batteryLevel,
    lastRssi:    t.lastRssi,
    lastSeenAt:  t.lastSeenAt,
    manufacturer: t.manufacturer,
    model:       t.model,
    asset:       t.asset,
    zone:        t.lastZone,
  }));

  // ── Stats summary ─────────────────────────────────────────────────────────────
  const stats = {
    total:      locations.length,
    active:     locations.filter(l => l.status === 'ACTIVE').length,
    lowBattery: locations.filter(l => l.status === 'LOW_BATTERY').length,
    missing:    locations.filter(l => l.status === 'MISSING').length,
    inactive:   locations.filter(l => l.status === 'INACTIVE').length,
  };

  const data = { floorPlans, zones, locations, stats };

  // ── Cache store ───────────────────────────────────────────────────────────────
  cache.set(cacheKey, { data, ts: Date.now() });

  res.setHeader('X-Cache', 'MISS');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(data);
}
