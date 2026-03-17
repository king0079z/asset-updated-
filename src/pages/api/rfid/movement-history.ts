// @ts-nocheck
/**
 * GET /api/rfid/movement-history
 *
 * Derives zone-to-zone movement events from RFIDScan records.
 * A movement event is created each time a tag transitions between zones.
 *
 * Query params:
 *   assetId  - filter to a specific asset (optional)
 *   tagId    - filter to a specific tag (optional)
 *   hours    - look-back window in hours (default: 24, max: 168)
 *   limit    - max events returned (default: 200)
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

const CACHE_TTL = 30_000; // 30s
const cache = new Map<string, { data: any; ts: number }>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Auth — soft (returns org-scoped data if authenticated)
    let orgId: string | null = null;
    try {
      const supabase = createClient(req, res);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const u = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { organizationId: true },
        });
        orgId = u?.organizationId ?? null;
      }
    } catch { /* non-critical */ }

    const assetId = req.query.assetId as string | undefined;
    const tagIdFilter = req.query.tagId as string | undefined;
    const hours = Math.min(168, Math.max(1, parseInt((req.query.hours as string) || '24')));
    const limit = Math.min(500, Math.max(10, parseInt((req.query.limit as string) || '200')));

    const cacheKey = `mv_${orgId ?? 'g'}_${assetId ?? ''}_${tagIdFilter ?? ''}_${hours}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=15');
      return res.status(200).json(cached.data);
    }

    const since = new Date(Date.now() - hours * 3_600_000);
    const orgFilter = orgId ? { organizationId: orgId } : {};

    // ── 1. Fetch relevant tags ────────────────────────────────────────────────
    const tagWhere: any = { ...orgFilter };
    if (assetId) tagWhere.assetId = assetId;
    if (tagIdFilter) tagWhere.id = tagIdFilter;

    const tags = await prisma.rFIDTag.findMany({
      where: tagWhere,
      select: {
        id: true,
        tagId: true,
        status: true,
        batteryLevel: true,
        lastSeenAt: true,
        lastZoneId: true,
        asset: {
          select: { id: true, name: true, type: true, status: true, assetId: true, imageUrl: true },
        },
        lastZone: {
          select: { id: true, name: true, floorNumber: true, building: true, isExitZone: true, isRestricted: true },
        },
      },
    });

    if (tags.length === 0) {
      return res.status(200).json({
        movements: [], exitEvents: [], exitedAssets: [],
        summary: { totalMovements: 0, exitEvents: 0, assetsCurrentlyOutside: 0, timeRange: `${hours}h` },
        meta: { generatedAt: new Date().toISOString(), hours },
      });
    }

    const tagIds = tags.map(t => t.id);
    const tagMap = new Map(tags.map(t => [t.id, t]));

    // ── 2. Fetch scans in window ──────────────────────────────────────────────
    const scans = await prisma.rFIDScan.findMany({
      where: {
        tagId: { in: tagIds },
        createdAt: { gte: since },
      },
      select: {
        id: true,
        tagId: true,
        zoneId: true,
        rssi: true,
        batteryRaw: true,
        createdAt: true,
        zone: {
          select: {
            id: true, name: true, floorNumber: true, roomNumber: true,
            building: true, isExitZone: true, isRestricted: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 10_000,
    });

    // ── 3. Detect zone transitions per tag ───────────────────────────────────
    const scansByTag = new Map<string, typeof scans>();
    for (const s of scans) {
      if (!scansByTag.has(s.tagId)) scansByTag.set(s.tagId, []);
      scansByTag.get(s.tagId)!.push(s);
    }

    const movements: any[] = [];

    for (const [tagId, tagScans] of scansByTag) {
      const tag = tagMap.get(tagId);
      if (!tag) continue;

      let prevZoneId: string | null = '__init__'; // sentinel to detect first scan
      let prevZone: any = null;
      let enteredAt: Date | null = null;

      for (const scan of tagScans) {
        const curZoneId = scan.zoneId ?? null;

        if (curZoneId !== prevZoneId) {
          const ts = scan.createdAt;
          const durationSec = enteredAt
            ? Math.round((ts.getTime() - enteredAt.getTime()) / 1000)
            : 0;

          const eventType =
            prevZoneId === '__init__'
              ? scan.zone?.isExitZone
                ? 'EXIT_ZONE_DETECTED'
                : 'ZONE_ENTRY'
              : scan.zone?.isExitZone
              ? 'ENTERPRISE_EXIT'
              : curZoneId === null
              ? 'SIGNAL_LOST'
              : 'ZONE_MOVE';

          movements.push({
            id: `${tagId}_${ts.getTime()}`,
            eventType,
            severity:
              eventType === 'ENTERPRISE_EXIT' ? 'CRITICAL'
              : eventType === 'EXIT_ZONE_DETECTED' ? 'WARNING'
              : scan.zone?.isRestricted ? 'WARNING'
              : 'INFO',
            tagId,
            tagMac: tag.tagId,
            assetId: tag.asset?.id ?? null,
            assetName: tag.asset?.name ?? tag.tagId,
            assetType: tag.asset?.type ?? null,
            assetImageUrl: tag.asset?.imageUrl ?? null,
            fromZoneId: prevZoneId === '__init__' ? null : prevZoneId,
            fromZoneName: prevZone?.name ?? null,
            fromZoneFloor: prevZone?.floorNumber ?? null,
            toZoneId: curZoneId,
            toZoneName: scan.zone?.name ?? null,
            toZoneFloor: scan.zone?.floorNumber ?? null,
            toZoneBuilding: scan.zone?.building ?? null,
            toZoneIsExit: scan.zone?.isExitZone ?? false,
            toZoneIsRestricted: scan.zone?.isRestricted ?? false,
            durationInPreviousZone: durationSec,
            rssi: scan.rssi ?? null,
            battery: scan.batteryRaw ?? null,
            timestamp: ts.toISOString(),
          });

          prevZoneId = curZoneId;
          prevZone = scan.zone ?? null;
          enteredAt = ts;
        }
      }
    }

    // Sort newest-first
    movements.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // ── 4. Exit events ────────────────────────────────────────────────────────
    const exitEvents = movements.filter(
      m => m.eventType === 'ENTERPRISE_EXIT' || m.eventType === 'EXIT_ZONE_DETECTED',
    );

    // ── 5. Currently-outside assets ───────────────────────────────────────────
    // An asset is "outside" if its last known zone is an exit zone
    // and it hasn't been seen inside in the last 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60_000);
    const exitedAssets = tags
      .filter(t => t.lastZone?.isExitZone && t.lastSeenAt)
      .map(t => ({
        tagId: t.tagId,
        assetId: t.asset?.id ?? null,
        assetName: t.asset?.name ?? t.tagId,
        assetType: t.asset?.type ?? null,
        assetImageUrl: t.asset?.imageUrl ?? null,
        lastSeenAt: t.lastSeenAt,
        lastZone: t.lastZone,
        batteryLevel: t.batteryLevel,
        status: t.status,
        minutesOutside: t.lastSeenAt
          ? Math.round((Date.now() - new Date(t.lastSeenAt).getTime()) / 60_000)
          : null,
      }));

    // ── 6. AI Insights ────────────────────────────────────────────────────────
    const aiInsights = generateMovementInsights(movements, tags, exitedAssets, hours);

    // ── 7. Movement stats per asset ───────────────────────────────────────────
    const assetMovementCounts = new Map<string, number>();
    for (const m of movements) {
      const key = m.assetId ?? m.tagId;
      assetMovementCounts.set(key, (assetMovementCounts.get(key) ?? 0) + 1);
    }
    const mostActiveAssets = [...assetMovementCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => {
        const tag = tags.find(t => (t.asset?.id ?? t.tagId) === key);
        return {
          assetId: tag?.asset?.id ?? null,
          assetName: tag?.asset?.name ?? key,
          movements: count,
        };
      });

    const result = {
      movements: movements.slice(0, limit),
      exitEvents: exitEvents.slice(0, 50),
      exitedAssets,
      aiInsights,
      mostActiveAssets,
      summary: {
        totalMovements: movements.length,
        exitEvents: exitEvents.length,
        assetsCurrentlyOutside: exitedAssets.length,
        totalScans: scans.length,
        timeRange: `${hours}h`,
        trackedAssets: tags.filter(t => t.asset).length,
      },
      meta: { generatedAt: new Date().toISOString(), hours, cached: false },
    };

    cache.set(cacheKey, { data: result, ts: Date.now() });
    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=15');
    return res.status(200).json(result);
  } catch (err) {
    console.error('[RFID movement-history]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── AI Insights Generator ─────────────────────────────────────────────────────
function generateMovementInsights(
  movements: any[],
  tags: any[],
  exitedAssets: any[],
  hours: number,
): any[] {
  const insights: any[] = [];

  // 1. Exit alert
  if (exitedAssets.length > 0) {
    insights.push({
      id: 'exit-alert',
      severity: 'critical',
      title: `${exitedAssets.length} Asset${exitedAssets.length > 1 ? 's' : ''} Outside Premises`,
      message: `${exitedAssets.map(a => a.assetName).slice(0, 3).join(', ')}${exitedAssets.length > 3 ? ` and ${exitedAssets.length - 3} more` : ''} detected at exit zones. Verify authorized removal.`,
      icon: 'exit',
    });
  }

  // 2. High movement frequency
  const highMoverThreshold = 10;
  const exitCount = movements.filter(m => m.eventType === 'ENTERPRISE_EXIT').length;
  if (exitCount >= 3) {
    insights.push({
      id: 'frequent-exits',
      severity: 'warning',
      title: `${exitCount} Exit Events in ${hours}h`,
      message: `Unusually high number of assets detected at exit zones. Review building security logs.`,
      icon: 'warning',
    });
  }

  // 3. Restricted zone entries
  const restrictedEntries = movements.filter(m => m.toZoneIsRestricted);
  if (restrictedEntries.length > 0) {
    const uniqueAssets = [...new Set(restrictedEntries.map(m => m.assetName))];
    insights.push({
      id: 'restricted-zone',
      severity: 'warning',
      title: `${restrictedEntries.length} Restricted Zone ${restrictedEntries.length === 1 ? 'Entry' : 'Entries'}`,
      message: `${uniqueAssets.slice(0, 2).join(', ')}${uniqueAssets.length > 2 ? ` and ${uniqueAssets.length - 2} more` : ''} entered restricted zones.`,
      icon: 'restricted',
    });
  }

  // 4. Missing assets (no scan in last 30min but was active before)
  const thirtyMinAgo = new Date(Date.now() - 30 * 60_000);
  const missingNow = tags.filter(
    t => t.lastSeenAt && new Date(t.lastSeenAt) < thirtyMinAgo && t.status !== 'INACTIVE',
  );
  if (missingNow.length > 0) {
    insights.push({
      id: 'missing-assets',
      severity: missingNow.length >= 3 ? 'critical' : 'warning',
      title: `${missingNow.length} Asset${missingNow.length > 1 ? 's' : ''} Not Detected (30+ min)`,
      message: `${missingNow.map(t => t.asset?.name ?? t.tagId).slice(0, 3).join(', ')} may be out of range, powered off, or removed.`,
      icon: 'missing',
    });
  }

  // 5. Low battery
  const lowBat = tags.filter(t => t.batteryLevel != null && t.batteryLevel <= 20);
  if (lowBat.length > 0) {
    insights.push({
      id: 'low-battery',
      severity: 'info',
      title: `${lowBat.length} Tag${lowBat.length > 1 ? 's' : ''} Low Battery`,
      message: `Replace batteries on: ${lowBat.map(t => t.asset?.name ?? t.tagId).slice(0, 3).join(', ')}${lowBat.length > 3 ? ` +${lowBat.length - 3} more` : ''}.`,
      icon: 'battery',
    });
  }

  // 6. Normal state
  if (insights.length === 0) {
    insights.push({
      id: 'all-clear',
      severity: 'success',
      title: 'All Assets Accounted For',
      message: `${tags.filter(t => t.asset).length} tracked assets — no exit events, restricted zone breaches, or missing assets detected in the last ${hours}h.`,
      icon: 'ok',
    });
  }

  return insights;
}
