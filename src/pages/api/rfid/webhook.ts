// @ts-nocheck
/**
 * POST /api/rfid/webhook
 *
 * Huawei AirEngine BLE/RFID scan data ingestion endpoint.
 * After processing each tag, runs the alert rules engine.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

const WEBHOOK_SECRET = process.env.RFID_WEBHOOK_SECRET?.trim();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (WEBHOOK_SECRET) {
    const incoming = req.query.secret || req.headers['x-rfid-secret'];
    if (incoming !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
  }

  const body = req.body;
  if (!body) return res.status(400).json({ error: 'Empty body' });

  try {
    const processed: string[] = [];
    const skipped:   string[] = [];

    const scanEvents = normaliseScanPayload(body);

    for (const event of scanEvents) {
      const { tagMac, apMac, rssi, batteryRaw, rawPayload, timestamp } = event;
      if (!tagMac) continue;

      const normalisedMac = tagMac.toUpperCase().replace(/[^0-9A-F:]/g, '');

      const tag = await prisma.rFIDTag.findUnique({ where: { tagId: normalisedMac } });
      if (!tag) { skipped.push(normalisedMac); continue; }

      const zone = apMac
        ? await prisma.rFIDZone.findFirst({
            where: { apMacAddress: apMac.toUpperCase() },
          })
        : null;

      const batteryLevel = batteryRaw != null
        ? Math.round(Math.min(100, Math.max(0, batteryRaw)))
        : parseBatteryFromPayload(rawPayload);

      const now = timestamp ? new Date(timestamp) : new Date();

      await prisma.rFIDScan.create({
        data: {
          tagId:      tag.id,
          zoneId:     zone?.id ?? null,
          apMac:      apMac   ?? null,
          rssi:       rssi    ?? null,
          batteryRaw: batteryRaw ?? null,
          rawPayload: rawPayload ?? null,
          rawData:    body,
          createdAt:  now,
        },
      });

      const updatedTag = await prisma.rFIDTag.update({
        where: { id: tag.id },
        data: {
          lastSeenAt:   now,
          lastRssi:     rssi   ?? tag.lastRssi,
          lastZoneId:   zone?.id ?? tag.lastZoneId,
          batteryLevel: batteryLevel ?? tag.batteryLevel,
          status:       determineTagStatus(batteryLevel ?? tag.batteryLevel),
          updatedAt:    now,
        },
      });

      // Run the alert rules engine after each scan
      try {
        await checkAlertRules(updatedTag, zone);
      } catch (ruleErr) {
        console.error('[RFID webhook] Alert rules error:', ruleErr);
      }

      processed.push(normalisedMac);
    }

    return res.status(200).json({
      success:   true,
      processed: processed.length,
      skipped:   skipped.length,
      detail:    { processed, skipped },
    });
  } catch (err) {
    console.error('[RFID webhook]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Alert Rules Engine ────────────────────────────────────────────────────────

async function checkAlertRules(tag: any, zone: any) {
  const orgId = tag.organizationId ?? null;

  const rules = await prisma.rFIDAlertRule.findMany({
    where: { enabled: true, ...(orgId ? { organizationId: orgId } : {}) },
  });

  for (const rule of rules) {
    const config = (rule.config as any) ?? {};

    if (rule.type === 'RESTRICTED_ZONE' && zone?.isRestricted) {
      await createAlertIfNew(rule, tag, zone, 'CRITICAL',
        `Asset "${tag.asset?.name ?? tag.tagId}" entered restricted zone "${zone.name}"`);
    }

    if (rule.type === 'ZONE_BREACH' && config.zoneId && zone?.id && zone.id !== config.zoneId) {
      await createAlertIfNew(rule, tag, zone, 'WARNING',
        `Asset "${tag.asset?.name ?? tag.tagId}" detected outside its assigned zone in "${zone.name}"`);
    }

    if (rule.type === 'LOW_BATTERY') {
      const threshold = config.batteryThreshold ?? 20;
      const battery = tag.batteryLevel ?? 100;
      if (battery <= threshold) {
        await createAlertIfNew(rule, tag, zone, 'INFO',
          `Asset "${tag.asset?.name ?? tag.tagId}" has low battery: ${battery}%`);
      }
    }
  }
}

async function createAlertIfNew(rule: any, tag: any, zone: any, severity: string, message: string) {
  // Avoid duplicate unresolved alerts for same rule + tag
  const existing = await prisma.rFIDAlert.findFirst({
    where: { ruleId: rule.id, tagId: tag.id, resolvedAt: null },
  });
  if (existing) return;

  await prisma.rFIDAlert.create({
    data: {
      ruleId:    rule.id,
      tagId:     tag.id,
      assetId:   tag.assetId ?? null,
      assetName: null,
      zoneName:  zone?.name ?? null,
      message,
      severity,
      organizationId: tag.organizationId ?? null,
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseScanPayload(body: any): Array<{
  tagMac: string; apMac?: string; rssi?: number;
  batteryRaw?: number; rawPayload?: string; timestamp?: number;
}> {
  if (body.scanData && Array.isArray(body.scanData)) {
    return body.scanData.map((s: any) => ({
      tagMac:     s.mac || s.tagMac || s.deviceMac,
      apMac:      body.apMac || body.ap_mac,
      rssi:       typeof s.rssi === 'number' ? s.rssi : undefined,
      batteryRaw: s.battery ?? s.batteryLevel,
      rawPayload: s.payload || s.rawData,
      timestamp:  s.timestamp ?? body.timestamp,
    }));
  }

  if (body.scan_data && Array.isArray(body.scan_data)) {
    return body.scan_data.map((s: any) => ({
      tagMac:     s.mac || s.tag_mac,
      apMac:      body.ap_mac || body.apMac,
      rssi:       typeof s.rssi === 'number' ? s.rssi : undefined,
      batteryRaw: s.battery,
      rawPayload: s.payload,
      timestamp:  s.timestamp ?? body.timestamp,
    }));
  }

  if (body.mac || body.tagMac || body.tagId) {
    return [{
      tagMac:     body.mac || body.tagMac || body.tagId,
      apMac:      body.apMac || body.ap_mac,
      rssi:       body.rssi,
      batteryRaw: body.battery ?? body.batteryLevel,
      rawPayload: body.payload,
      timestamp:  body.timestamp,
    }];
  }

  return [];
}

function parseBatteryFromPayload(payload?: string | null): number | null {
  if (!payload) return null;
  try {
    const hex = payload.replace(/\s/g, '');
    if (hex.length < 2) return null;
    const lastByte = parseInt(hex.slice(-2), 16);
    return lastByte >= 0 && lastByte <= 100 ? lastByte : null;
  } catch {
    return null;
  }
}

function determineTagStatus(battery: number | null | undefined): string {
  if (battery == null) return 'ACTIVE';
  if (battery <= 10)   return 'LOW_BATTERY';
  return 'ACTIVE';
}
