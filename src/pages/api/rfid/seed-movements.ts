// @ts-nocheck
/**
 * POST /api/rfid/seed-movements
 *
 * Generates realistic zone-to-zone movement demo data for existing RFID tags.
 * Creates scans that show assets moving between zones over the last 24 hours,
 * including some exit zone detections for enterprise exit alert testing.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

function hoursAgo(h: number, jitterMin = 0) {
  return new Date(Date.now() - h * 3_600_000 - jitterMin * 60_000 * Math.random());
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

    const roleData = await getUserRoleData(session.user.id);
    const orgId = roleData?.organizationId ?? null;
    const orgFilter = orgId ? { organizationId: orgId } : {};

    // Fetch existing tags and zones
    const [tags, zones] = await Promise.all([
      prisma.rFIDTag.findMany({
        where: orgFilter,
        select: { id: true, tagId: true, lastRssi: true, batteryLevel: true, assetId: true },
        take: 50,
      }),
      prisma.rFIDZone.findMany({
        where: orgFilter,
        select: { id: true, name: true, apMacAddress: true, isExitZone: true, floorNumber: true },
        take: 30,
      }),
    ]);

    if (tags.length === 0) {
      return res.status(400).json({
        error: 'No RFID tags found. Please run "Load Demo Data" on the RFID page first.',
      });
    }
    if (zones.length < 2) {
      return res.status(400).json({
        error: 'Need at least 2 zones to generate movement data. Please add more zones or load demo data.',
      });
    }

    // Optionally clear old movement scans
    const clearMovements = req.query.clear === 'true';

    // Build movement scan data for each tag
    // Each tag follows a different movement pattern across zones
    const scanBatch: any[] = [];
    let totalMovements = 0;

    // Movement patterns: hour offsets per zone segment
    const PATTERNS = [
      // Pattern A: Morning office → meeting room → cafeteria → office
      { segments: [
        { startH: 24, endH: 16, zoneIdx: 0 },
        { startH: 16, endH: 14, zoneIdx: 1 },
        { startH: 14, endH: 13, zoneIdx: 2 },
        { startH: 13, endH: 0,  zoneIdx: 0 },
      ]},
      // Pattern B: Server room → IT room → server room
      { segments: [
        { startH: 24, endH: 18, zoneIdx: 1 },
        { startH: 18, endH: 12, zoneIdx: 2 },
        { startH: 12, endH: 6,  zoneIdx: 1 },
        { startH: 6,  endH: 0,  zoneIdx: 2 },
      ]},
      // Pattern C: Main floor → exit zone → main floor (enterprise exit simulation)
      { segments: [
        { startH: 24, endH: 20, zoneIdx: 0 },
        { startH: 20, endH: 18, zoneIdx: 1 },
        // Goes to exit zone (if available)
        { startH: 18, endH: 15, zoneIdx: 'EXIT' },
        { startH: 15, endH: 8,  zoneIdx: 2 },
        { startH: 8,  endH: 0,  zoneIdx: 0 },
      ]},
      // Pattern D: Multi-floor movement
      { segments: [
        { startH: 24, endH: 20, zoneIdx: 0 },
        { startH: 20, endH: 16, zoneIdx: 3 },
        { startH: 16, endH: 12, zoneIdx: 1 },
        { startH: 12, endH: 8,  zoneIdx: 2 },
        { startH: 8,  endH: 4,  zoneIdx: 3 },
        { startH: 4,  endH: 0,  zoneIdx: 0 },
      ]},
      // Pattern E: Stationary (only one zone)
      { segments: [
        { startH: 24, endH: 0, zoneIdx: 0 },
      ]},
      // Pattern F: Restricted zone entry (for alert demo)
      { segments: [
        { startH: 24, endH: 18, zoneIdx: 0 },
        { startH: 18, endH: 14, zoneIdx: 1 },
        { startH: 14, endH: 12, zoneIdx: 'RESTRICTED' },
        { startH: 12, endH: 0,  zoneIdx: 0 },
      ]},
    ];

    // Find exit and restricted zones for the exit/restricted patterns
    const exitZone = zones.find(z => z.isExitZone);
    const restrictedZone = zones.find(z => (z as any).isRestricted);

    // Process each tag with a movement pattern
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const pattern = PATTERNS[i % PATTERNS.length];
      const baseRssi = tag.lastRssi ?? -65;
      const battery = tag.batteryLevel ?? 80;

      for (const segment of pattern.segments) {
        // Determine which zone to use for this segment
        let zone: typeof zones[0] | null = null;
        if (segment.zoneIdx === 'EXIT') {
          zone = exitZone ?? zones[i % zones.length];
        } else if (segment.zoneIdx === 'RESTRICTED') {
          zone = restrictedZone ?? zones[(i + 1) % zones.length];
        } else {
          zone = zones[(i + (segment.zoneIdx as number)) % zones.length];
        }

        if (!zone) continue;

        // Create 3-6 scans per segment (to make it look like continuous detection)
        const segmentDuration = segment.startH - segment.endH; // hours
        const scanCount = Math.max(2, Math.min(8, Math.round(segmentDuration * 1.5)));
        const interval = segmentDuration / scanCount;

        for (let s = 0; s < scanCount; s++) {
          const hoursFromNow = segment.endH + interval * (scanCount - 1 - s);
          const jitter = (Math.random() - 0.5) * interval * 0.3;
          scanBatch.push({
            tagId: tag.id,
            zoneId: zone.id,
            apMac: zone.apMacAddress ?? null,
            rssi: baseRssi + Math.round((Math.random() - 0.5) * 10),
            batteryRaw: Math.max(5, battery - Math.round(s * 0.1)),
            rawPayload: null,
            rawData: { source: 'demo-movement', pattern: i % PATTERNS.length },
            createdAt: hoursAgo(Math.max(0, hoursFromNow + jitter), 0),
          });
        }
        totalMovements++;
      }

      // Update the tag's lastZone to the most recent zone
      const lastSegment = pattern.segments[pattern.segments.length - 1];
      let lastZone: typeof zones[0] | null = null;
      if (lastSegment.zoneIdx === 'EXIT') lastZone = exitZone ?? zones[i % zones.length];
      else if (lastSegment.zoneIdx === 'RESTRICTED') lastZone = restrictedZone ?? zones[(i + 1) % zones.length];
      else lastZone = zones[(i + (lastSegment.zoneIdx as number)) % zones.length];

      if (lastZone) {
        await prisma.rFIDTag.update({
          where: { id: tag.id },
          data: {
            lastZoneId: lastZone.id,
            lastSeenAt: new Date(Date.now() - lastSegment.endH * 3_600_000),
          },
        });
      }
    }

    // Insert all scans in one batch
    await prisma.rFIDScan.createMany({ data: scanBatch });

    // Create an exit alert if there are exit zones and tags near them
    if (exitZone) {
      const exitTags = tags.filter((_, i) => i % PATTERNS.length === 2); // Pattern C tags
      for (const tag of exitTags) {
        // Ensure there's an exit alert rule
        let exitRule = await prisma.rFIDAlertRule.findFirst({
          where: { type: 'ENTERPRISE_EXIT', ...(orgId ? { organizationId: orgId } : {}) },
        });
        if (!exitRule) {
          exitRule = await prisma.rFIDAlertRule.create({
            data: {
              type: 'ENTERPRISE_EXIT',
              name: 'Enterprise Exit Detection',
              enabled: true,
              config: {},
              organizationId: orgId,
            },
          });
        }
        // Create alert
        const existing = await prisma.rFIDAlert.findFirst({
          where: { ruleId: exitRule.id, tagId: tag.id, resolvedAt: null },
        });
        if (!existing) {
          await prisma.rFIDAlert.create({
            data: {
              ruleId: exitRule.id,
              tagId: tag.id,
              assetId: tag.assetId ?? null,
              message: `Asset detected at exit zone "${exitZone.name}" — verify authorized removal`,
              severity: 'CRITICAL',
              zoneName: exitZone.name,
              organizationId: orgId,
            },
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      scansCreated: scanBatch.length,
      tagsProcessed: tags.length,
      zonesUsed: zones.length,
      movementSegments: totalMovements,
      message: `Generated ${scanBatch.length} movement scans across ${tags.length} tags showing zone transitions over 24 hours.`,
    });
  } catch (err) {
    console.error('[rfid/seed-movements]', err);
    return res.status(500).json({ error: 'Internal server error', detail: String(err) });
  }
}
