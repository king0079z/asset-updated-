// @ts-nocheck
/**
 * GET /api/rfid/dashboard
 *
 * PERFORMANCE-CRITICAL: replaces 3 separate API calls (tags + zones + stats)
 * with ONE request:
 *   ✓ Single Supabase auth verification (was 3× before)
 *   ✓ Single getUserRoleData() DB query (was 3×)
 *   ✓ All data queries run in parallel
 *   ✓ 15-second server-side in-memory cache per org
 *   ✓ stale-while-revalidate HTTP header so browsers serve cached data instantly
 *
 * Returns: { tags, zones, stats }
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

const CACHE_TTL = 15_000; // 15 seconds
const TAGS_TAKE = 500;
const ZONES_TAKE = 100;
const TIMEOUT_MS = 12_000; // 12s — avoid Vercel/client abort
const cache = new Map<string, { data: any; ts: number }>();

function runWithTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('RFID_DASHBOARD_TIMEOUT')), ms)),
  ]);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  const orgId    = roleData?.organizationId ?? null;
  const where    = orgId ? { organizationId: orgId } : {};

  const cacheKey = `dash:${orgId ?? 'global'}`;
  const cached   = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL && req.query.refresh !== 'true') {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
    return res.status(200).json(cached.data);
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const query = Promise.all([
    prisma.rFIDTag.findMany({
      where,
      select: {
        id: true, tagId: true, tagType: true, status: true,
        batteryLevel: true, lastRssi: true, lastSeenAt: true,
        manufacturer: true, model: true, notes: true, organizationId: true,
        asset: {
          select: {
            id: true, name: true, type: true, status: true,
            imageUrl: true, floorNumber: true, roomNumber: true,
          },
        },
        lastZone: {
          select: { id: true, name: true, floorNumber: true, roomNumber: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: TAGS_TAKE,
    }),

    prisma.rFIDZone.findMany({
      where,
      select: {
        id: true, name: true, description: true,
        apMacAddress: true, apIpAddress: true, apSerialNumber: true,
        floorNumber: true, roomNumber: true, building: true, isRestricted: true,
        floorPlanId: true,
        floorPlan: { select: { id: true, name: true, imageUrl: true } },
        _count: { select: { tags: true, scans: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: ZONES_TAKE,
    }),

    // Status counts via groupBy — single query replaces 5 separate count()s
    prisma.rFIDTag.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),

    // 24h scan count
    prisma.rFIDScan.count({
      where: { tag: where, createdAt: { gte: since24h } },
    }),

    prisma.rFIDAlert.count({
      where: { ...where, resolvedAt: null },
    }),
  ]);

  let tags: Awaited<ReturnType<typeof prisma.rFIDTag.findMany>>;
  let zones: Awaited<ReturnType<typeof prisma.rFIDZone.findMany>>;
  let statusCounts: Awaited<ReturnType<typeof prisma.rFIDTag.groupBy>>;
  let scans24h: number;
  let unresolvedAlerts: number;
  try {
    const result = await runWithTimeout(query, TIMEOUT_MS);
    [tags, zones, statusCounts, scans24h, unresolvedAlerts] = result;
  } catch (err) {
    if (err instanceof Error && err.message === 'RFID_DASHBOARD_TIMEOUT') {
      return res.status(408).json({ error: 'Request timeout', message: 'RFID dashboard took too long; try again or use filters.' });
    }
    throw err;
  }

  const countByStatus = Object.fromEntries(
    statusCounts.map(g => [g.status, g._count._all])
  );
  const totalTags  = statusCounts.reduce((s, g) => s + g._count._all, 0);
  const stats = {
    totalTags,
    activeTags:  countByStatus['ACTIVE']      ?? 0,
    lowBattery:  countByStatus['LOW_BATTERY'] ?? 0,
    missing:     countByStatus['MISSING']     ?? 0,
    unassigned:  countByStatus['UNASSIGNED']  ?? 0,
    inactive:    countByStatus['INACTIVE']    ?? 0,
    totalZones:  zones.length,
    scans24h,
  };

  const data = { tags, zones, stats: { ...stats, unresolvedAlerts } };

  // ── Cache store ───────────────────────────────────────────────────────────────
  cache.set(cacheKey, { data, ts: Date.now() });

  res.setHeader('X-Cache', 'MISS');
  res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
  return res.status(200).json(data);
}
