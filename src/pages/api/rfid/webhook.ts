// @ts-nocheck
/**
 * POST /api/rfid/webhook
 *
 * Huawei AirEngine BLE/RFID scan data ingestion endpoint.
 *
 * Supported payload formats:
 *  1. Huawei iMaster NCE / AirEngine IoT report format
 *  2. Generic flat BLE scan (for testing / other integrations)
 *
 * Huawei AirEngine configuration:
 *   iMaster NCE → IoT Service → BLE Data Push → URL: https://yourdomain/api/rfid/webhook
 *   Authentication: set RFID_WEBHOOK_SECRET env var and pass as ?secret=xxx
 *
 * Huawei payload example:
 * {
 *   "messageId": "abc123",
 *   "timestamp": 1704067200000,
 *   "apMac": "AC:CE:8D:12:34:56",
 *   "apSn": "SN123456",
 *   "scanData": [
 *     { "mac": "AA:BB:CC:DD:EE:FF", "rssi": -65, "payload": "0201060303...", "timestamp": 1704067200100 }
 *   ]
 * }
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

// Optional: protect the webhook with a shared secret
const WEBHOOK_SECRET = process.env.RFID_WEBHOOK_SECRET?.trim();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Optional secret validation
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

    // ── Normalise payload to a flat list of scan events ─────────────────────
    const scanEvents = normaliseScanPayload(body);

    for (const event of scanEvents) {
      const { tagMac, apMac, rssi, batteryRaw, rawPayload, timestamp } = event;
      if (!tagMac) continue;

      const normalisedMac = tagMac.toUpperCase().replace(/[^0-9A-F:]/g, '');

      // Find the matching tag (exact MAC)
      const tag = await prisma.rFIDTag.findUnique({ where: { tagId: normalisedMac } });
      if (!tag) { skipped.push(normalisedMac); continue; }

      // Find zone by AP MAC address
      const zone = apMac
        ? await prisma.rFIDZone.findFirst({
            where: { apMacAddress: apMac.toUpperCase() },
          })
        : null;

      // Determine battery level from raw BLE payload if not directly provided
      const batteryLevel = batteryRaw != null
        ? Math.round(Math.min(100, Math.max(0, batteryRaw)))
        : parseBatteryFromPayload(rawPayload);

      const now = timestamp ? new Date(timestamp) : new Date();

      // Write scan record
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

      // Update tag with latest state
      await prisma.rFIDTag.update({
        where: { id: tag.id },
        data: {
          lastSeenAt:   now,
          lastRssi:     rssi   ?? tag.lastRssi,
          lastZoneId:   zone?.id ?? tag.lastZoneId,
          batteryLevel: batteryLevel ?? tag.batteryLevel,
          status:       determinTagStatus(batteryLevel ?? tag.batteryLevel),
          updatedAt:    now,
        },
      });

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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalise various Huawei / generic payload formats into a flat array */
function normaliseScanPayload(body: any): Array<{
  tagMac: string; apMac?: string; rssi?: number;
  batteryRaw?: number; rawPayload?: string; timestamp?: number;
}> {
  // Huawei AirEngine IoT report format
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

  // Huawei snakeCase variant
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

  // Flat generic single-scan format
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

/** Parse battery percentage from raw BLE advertisement hex payload (common format) */
function parseBatteryFromPayload(payload?: string | null): number | null {
  if (!payload) return null;
  try {
    // Many BLE tag vendors encode battery in the last byte of the manufacturer data
    // This is a common heuristic — adjust per vendor spec
    const hex = payload.replace(/\s/g, '');
    if (hex.length < 2) return null;
    const lastByte = parseInt(hex.slice(-2), 16);
    // Values 0-100 are likely battery percentage; ignore if out of range
    return lastByte >= 0 && lastByte <= 100 ? lastByte : null;
  } catch {
    return null;
  }
}

function determinTagStatus(battery: number | null | undefined): string {
  if (battery == null) return 'ACTIVE';
  if (battery <= 10)   return 'LOW_BATTERY';
  return 'ACTIVE';
}
