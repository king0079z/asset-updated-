// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

/* ─────────────────────────────────────────────────────────────────────────────
 * Demo Seed API  –  POST /api/demo/seed
 * Creates a full realistic dataset for "Meridian Technologies Group" HQ demo.
 * All data is scoped to the currently-authenticated user's organization.
 * ───────────────────────────────────────────────────────────────────────────── */

const DEMO_MARKER = 'DEMO_MTG_2026'; // tag on every created record's notes field

// ── Isometric grid positions for zones (col 0-2, row 0-1 per floor) ──────────
const ZONE_DEFS = [
  // ── Floor 1 — Operations ──────────────────────────────────────────────────
  { floor: '1', col: 0, row: 0, name: 'Main Reception',    restricted: false, ap: 'B8:27:EB:F1:00:01', desc: 'Public entrance, visitor management and front desk' },
  { floor: '1', col: 1, row: 0, name: 'IT Operations',     restricted: false, ap: 'B8:27:EB:F1:00:02', desc: 'Network operations center and IT helpdesk' },
  { floor: '1', col: 2, row: 0, name: 'Help Desk',         restricted: false, ap: 'B8:27:EB:F1:00:03', desc: 'End-user support and hardware staging area' },
  { floor: '1', col: 0, row: 1, name: 'Server Room',       restricted: true,  ap: 'B8:27:EB:F1:00:04', desc: 'RESTRICTED — Primary data center and server infrastructure' },
  { floor: '1', col: 1, row: 1, name: 'Printer Hub',       restricted: false, ap: 'B8:27:EB:F1:00:05', desc: 'Centralized print and document management area' },
  { floor: '1', col: 2, row: 1, name: 'Storage Room',      restricted: false, ap: 'B8:27:EB:F1:00:06', desc: 'Hardware storage, spares and supplies inventory' },
  // ── Floor 2 — Executive ───────────────────────────────────────────────────
  { floor: '2', col: 0, row: 0, name: 'Executive Lobby',   restricted: false, ap: 'B8:27:EB:F2:00:01', desc: 'Executive floor reception and waiting area' },
  { floor: '2', col: 1, row: 0, name: 'Boardroom',         restricted: false, ap: 'B8:27:EB:F2:00:02', desc: 'Main conference room for board and client meetings' },
  { floor: '2', col: 2, row: 0, name: 'Finance Dept',      restricted: false, ap: 'B8:27:EB:F2:00:03', desc: 'Finance, accounting and procurement division' },
  { floor: '2', col: 0, row: 1, name: 'CEO Office',        restricted: true,  ap: 'B8:27:EB:F2:00:04', desc: 'RESTRICTED — Chief Executive Officer private office' },
  { floor: '2', col: 1, row: 1, name: 'HR Department',     restricted: false, ap: 'B8:27:EB:F2:00:05', desc: 'Human resources, talent acquisition and training' },
  { floor: '2', col: 2, row: 1, name: 'Legal & Compliance',restricted: false, ap: 'B8:27:EB:F2:00:06', desc: 'Legal counsel and regulatory compliance team' },
  // ── Floor 3 — Engineering ─────────────────────────────────────────────────
  { floor: '3', col: 0, row: 0, name: 'Dev Lab Alpha',     restricted: false, ap: 'B8:27:EB:F3:00:01', desc: 'Primary software engineering and development lab' },
  { floor: '3', col: 1, row: 0, name: 'Dev Lab Beta',      restricted: false, ap: 'B8:27:EB:F3:00:02', desc: 'Backend services and infrastructure engineering' },
  { floor: '3', col: 2, row: 0, name: 'QA Testing',        restricted: false, ap: 'B8:27:EB:F3:00:03', desc: 'Quality assurance, automated testing and staging' },
  { floor: '3', col: 0, row: 1, name: 'Design Studio',     restricted: false, ap: 'B8:27:EB:F3:00:04', desc: 'UX/UI design, prototyping and creative studio' },
  { floor: '3', col: 1, row: 1, name: 'Open Workspace',    restricted: false, ap: 'B8:27:EB:F3:00:05', desc: 'Collaborative open-plan engineering workspace' },
  { floor: '3', col: 2, row: 1, name: 'Innovation Lab',    restricted: false, ap: 'B8:27:EB:F3:00:06', desc: 'R&D lab for emerging tech, IoT and AI prototypes' },
];

// ── Asset + RFID tag definitions ──────────────────────────────────────────────
const ASSET_DEFS = [
  // Floor 1
  { name: 'Huawei AirEngine AP — Rack 01',  type: 'EQUIPMENT',   zone: 'IT Operations',   status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 95, rssi: -55, mac: 'AA:11:22:33:01:01', man: 'Huawei', model: 'AirEngine 6776-58TI', amount: 3800 },
  { name: 'Cisco Catalyst 24-Port Switch',   type: 'EQUIPMENT',   zone: 'IT Operations',   status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 88, rssi: -62, mac: 'AA:11:22:33:01:02', man: 'Cisco',  model: 'Catalyst 2960-X',    amount: 2200 },
  { name: 'Dell PowerEdge R750 Server A',    type: 'EQUIPMENT',   zone: 'Server Room',     status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 91, rssi: -58, mac: 'AA:11:22:33:01:03', man: 'Dell',   model: 'PowerEdge R750',     amount: 12500 },
  { name: 'Dell PowerEdge R750 Server B',    type: 'EQUIPMENT',   zone: 'Server Room',     status: 'ACTIVE',      tagStatus: 'MISSING',     bat: null, rssi: null, mac: 'AA:11:22:33:01:04', man: 'Dell', model: 'PowerEdge R750',     amount: 12500 },
  { name: 'APC Smart-UPS 3000VA',            type: 'EQUIPMENT',   zone: 'Server Room',     status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 78, rssi: -70, mac: 'AA:11:22:33:01:05', man: 'APC',   model: 'Smart-UPS SRT3000',  amount: 1850 },
  { name: 'HP LaserJet Enterprise M507',     type: 'EQUIPMENT',   zone: 'Printer Hub',     status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 82, rssi: -65, mac: 'AA:11:22:33:01:06', man: 'HP',    model: 'LaserJet M507',      amount: 950 },
  { name: 'Canon imageRUNNER Advance A3',    type: 'EQUIPMENT',   zone: 'Printer Hub',     status: 'ACTIVE',      tagStatus: 'LOW_BATTERY', bat: 14, rssi: -71, mac: 'AA:11:22:33:01:07', man: 'Canon', model: 'iR Advance DX 4751i',amount: 1650 },
  { name: 'Logitech Rally Conference Cam',   type: 'ELECTRONICS', zone: 'Main Reception',  status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 90, rssi: -60, mac: 'AA:11:22:33:01:08', man: 'Logitech', model: 'Rally Camera',    amount: 1200 },
  { name: 'Dell UltraSharp 27" Monitor',     type: 'ELECTRONICS', zone: 'Help Desk',       status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 95, rssi: -63, mac: 'AA:11:22:33:01:09', man: 'Dell',   model: 'U2722D',            amount: 650 },
  { name: 'HP EliteDesk 800 G9 Desktop',     type: 'ELECTRONICS', zone: 'Help Desk',       status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 88, rssi: -67, mac: 'AA:11:22:33:01:10', man: 'HP',    model: 'EliteDesk 800 G9',   amount: 1400 },
  // Floor 2
  { name: 'Apple MacBook Pro 16" (CEO)',     type: 'ELECTRONICS', zone: 'CEO Office',      status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 85, rssi: -57, mac: 'AA:11:22:33:02:01', man: 'Apple', model: 'MacBook Pro M3 Max', amount: 4200 },
  { name: 'Apple iPhone 15 Pro Max',         type: 'ELECTRONICS', zone: 'CEO Office',      status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 92, rssi: -53, mac: 'AA:11:22:33:02:02', man: 'Apple', model: 'iPhone 15 Pro Max',  amount: 1300 },
  { name: 'Epson EB-L1200U Laser Projector', type: 'EQUIPMENT',   zone: 'Boardroom',       status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 88, rssi: -61, mac: 'AA:11:22:33:02:03', man: 'Epson', model: 'EB-L1200U',          amount: 3100 },
  { name: 'Samsung QLED 75" Smart TV',       type: 'ELECTRONICS', zone: 'Boardroom',       status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 97, rssi: -59, mac: 'AA:11:22:33:02:04', man: 'Samsung', model: 'QN75QN900C',       amount: 2800 },
  { name: 'Microsoft Surface Pro 9',         type: 'ELECTRONICS', zone: 'Executive Lobby', status: 'ACTIVE',      tagStatus: 'MISSING',     bat: null, rssi: null, mac: 'AA:11:22:33:02:05', man: 'Microsoft', model: 'Surface Pro 9', amount: 1700 },
  { name: 'Lenovo ThinkPad X1 Carbon',       type: 'ELECTRONICS', zone: 'Finance Dept',    status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 76, rssi: -66, mac: 'AA:11:22:33:02:06', man: 'Lenovo', model: 'ThinkPad X1 Carbon', amount: 2100 },
  { name: 'Dell Latitude 5540 Laptop',       type: 'ELECTRONICS', zone: 'Finance Dept',    status: 'ACTIVE',      tagStatus: 'LOW_BATTERY', bat: 11, rssi: -74, mac: 'AA:11:22:33:02:07', man: 'Dell',   model: 'Latitude 5540',      amount: 1350 },
  { name: 'HP EliteBook 860 G10',            type: 'ELECTRONICS', zone: 'HR Department',   status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 84, rssi: -63, mac: 'AA:11:22:33:02:08', man: 'HP',    model: 'EliteBook 860 G10',  amount: 1550 },
  { name: 'Sony Bravia 55" Display',         type: 'ELECTRONICS', zone: 'Executive Lobby', status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 91, rssi: -60, mac: 'AA:11:22:33:02:09', man: 'Sony',  model: 'Bravia XR-55A95L',   amount: 2400 },
  { name: 'Apple iPad Pro 12.9" (Legal)',    type: 'ELECTRONICS', zone: 'Legal & Compliance', status: 'ACTIVE',   tagStatus: 'ACTIVE',      bat: 79, rssi: -65, mac: 'AA:11:22:33:02:10', man: 'Apple', model: 'iPad Pro M2',        amount: 1100 },
  // Floor 3
  { name: 'Apple MacBook Pro 14" — Dev 01', type: 'ELECTRONICS', zone: 'Dev Lab Alpha',   status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 93, rssi: -56, mac: 'AA:11:22:33:03:01', man: 'Apple', model: 'MacBook Pro M3',     amount: 2800 },
  { name: 'Apple MacBook Pro 14" — Dev 02', type: 'ELECTRONICS', zone: 'Dev Lab Alpha',   status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 87, rssi: -59, mac: 'AA:11:22:33:03:02', man: 'Apple', model: 'MacBook Pro M3',     amount: 2800 },
  { name: 'Apple MacBook Pro 14" — Dev 03', type: 'ELECTRONICS', zone: 'Dev Lab Beta',    status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 81, rssi: -62, mac: 'AA:11:22:33:03:03', man: 'Apple', model: 'MacBook Pro M3',     amount: 2800 },
  { name: 'Dell XPS 15 9530 — Dev 04',      type: 'ELECTRONICS', zone: 'Dev Lab Beta',    status: 'ACTIVE',      tagStatus: 'LOW_BATTERY', bat: 9,  rssi: -77, mac: 'AA:11:22:33:03:04', man: 'Dell',   model: 'XPS 15 9530',        amount: 2200 },
  { name: 'Apple iPad Pro 12.9" — QA 01',   type: 'ELECTRONICS', zone: 'QA Testing',      status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 88, rssi: -61, mac: 'AA:11:22:33:03:05', man: 'Apple', model: 'iPad Pro M2',        amount: 1100 },
  { name: 'Apple iPad Pro 12.9" — QA 02',   type: 'ELECTRONICS', zone: 'QA Testing',      status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 72, rssi: -68, mac: 'AA:11:22:33:03:06', man: 'Apple', model: 'iPad Pro M2',        amount: 1100 },
  { name: 'Apple iMac 27" Retina 5K',       type: 'ELECTRONICS', zone: 'Design Studio',   status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 96, rssi: -54, mac: 'AA:11:22:33:03:07', man: 'Apple', model: 'iMac 5K',            amount: 3500 },
  { name: 'Wacom Cintiq Pro 32" Tablet',    type: 'EQUIPMENT',   zone: 'Design Studio',   status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 89, rssi: -60, mac: 'AA:11:22:33:03:08', man: 'Wacom', model: 'Cintiq Pro 32',      amount: 3200 },
  { name: 'Microsoft Surface Hub 2S 85"',   type: 'ELECTRONICS', zone: 'Open Workspace',  status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 94, rssi: -57, mac: 'AA:11:22:33:03:09', man: 'Microsoft', model: 'Surface Hub 2S', amount: 8900 },
  { name: 'Huawei AirEngine AP — Floor 3',  type: 'EQUIPMENT',   zone: 'Innovation Lab',  status: 'ACTIVE',      tagStatus: 'ACTIVE',      bat: 91, rssi: -58, mac: 'AA:11:22:33:03:10', man: 'Huawei', model: 'AirEngine 6761-21T', amount: 2100 },
];

// ── Alert rules ───────────────────────────────────────────────────────────────
const ALERT_RULES = [
  { type: 'LOW_BATTERY',    name: 'Low Battery Alert',         config: { batteryThreshold: 20 } },
  { type: 'MISSING',        name: 'Missing Asset Alert',       config: { thresholdMinutes: 60 } },
  { type: 'RESTRICTED_ZONE',name: 'Restricted Zone Entry',     config: {} },
  { type: 'ZONE_BREACH',    name: 'After-Hours Zone Breach',   config: {} },
];

function randomPast(minMinutes: number, maxMinutes: number) {
  return new Date(Date.now() - (Math.random() * (maxMinutes - minMinutes) + minMinutes) * 60_000);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'DELETE') {
    // Wipe demo data only
    const supabase = createClient(req, res);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });
    const roleData = await getUserRoleData(session.user.id);
    const orgId = roleData?.organizationId;

    const tags = await prisma.rFIDTag.findMany({ where: { organizationId: orgId, notes: { contains: DEMO_MARKER } }, select: { id: true } });
    const tagIds = tags.map(t => t.id);
    await prisma.rFIDAlert.deleteMany({ where: { organizationId: orgId } });
    await prisma.rFIDScan.deleteMany({ where: { tagId: { in: tagIds } } });
    await prisma.rFIDTag.deleteMany({ where: { id: { in: tagIds } } });
    const assets = await prisma.asset.findMany({ where: { organizationId: orgId, description: { contains: DEMO_MARKER } }, select: { id: true } });
    await prisma.asset.deleteMany({ where: { id: { in: assets.map(a => a.id) } } });
    await prisma.rFIDZone.deleteMany({ where: { organizationId: orgId, description: { contains: DEMO_MARKER } } });
    await prisma.rFIDAlertRule.deleteMany({ where: { organizationId: orgId } });
    await prisma.floorPlan.deleteMany({ where: { organizationId: orgId } });

    return res.status(200).json({ message: 'Demo data wiped successfully' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST or DELETE only' });

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  const orgId    = roleData?.organizationId ?? null;
  const userId   = session.user.id;

  // ── Guard: check if already seeded ─────────────────────────────────────────
  const existing = await prisma.rFIDZone.count({ where: { organizationId: orgId, description: { contains: DEMO_MARKER } } });
  if (existing > 0) return res.status(409).json({ error: 'Demo data already seeded. DELETE first to re-seed.' });

  // ── 1. Create floor plans ───────────────────────────────────────────────────
  const floorPlans = await Promise.all([
    prisma.floorPlan.create({ data: { name: 'Ground Floor — Operations', building: 'MTG HQ', floorNumber: 1, imageUrl: '', imageWidth: 1200, imageHeight: 800, organizationId: orgId } }),
    prisma.floorPlan.create({ data: { name: 'Level 2 — Executive',       building: 'MTG HQ', floorNumber: 2, imageUrl: '', imageWidth: 1200, imageHeight: 800, organizationId: orgId } }),
    prisma.floorPlan.create({ data: { name: 'Level 3 — Engineering',     building: 'MTG HQ', floorNumber: 3, imageUrl: '', imageWidth: 1200, imageHeight: 800, organizationId: orgId } }),
  ]);
  const fpByFloor: Record<string, string> = { '1': floorPlans[0].id, '2': floorPlans[1].id, '3': floorPlans[2].id };

  // ── 2. Create zones ─────────────────────────────────────────────────────────
  const zoneMap: Record<string, string> = {}; // name → id
  for (const z of ZONE_DEFS) {
    const zone = await prisma.rFIDZone.create({
      data: {
        name: z.name,
        description: `${z.desc} [${DEMO_MARKER}]`,
        apMacAddress: z.ap,
        floorNumber: z.floor,
        building: 'MTG HQ',
        roomNumber: `${z.floor}-${String.fromCharCode(65 + z.col)}${z.row + 1}`,
        isRestricted: z.restricted,
        floorPlanId: fpByFloor[z.floor],
        mapX: z.col,
        mapY: z.row,
        mapWidth: 1,
        mapHeight: 1,
        organizationId: orgId,
      },
    });
    zoneMap[z.name] = zone.id;
  }

  // ── 3. Create assets + RFID tags ────────────────────────────────────────────
  const tagIds: string[] = [];
  const assetTagPairs: Array<{ tagId: string; zoneId: string | null; status: string; bat: number | null; rssi: number | null; mac: string }> = [];

  for (const a of ASSET_DEFS) {
    const zoneDef = ZONE_DEFS.find(z => z.name === a.zone);
    const zoneId  = zoneMap[a.zone] ?? null;

    const asset = await prisma.asset.create({
      data: {
        name: a.name,
        description: `Meridian Technologies Group — ${a.zone} [${DEMO_MARKER}]`,
        type: a.type,
        status: a.status,
        purchaseAmount: a.amount,
        purchaseDate: new Date(Date.now() - Math.random() * 730 * 86400_000),
        floorNumber: zoneDef?.floor ?? null,
        roomNumber: zoneDef ? `${zoneDef.floor}-${String.fromCharCode(65 + zoneDef.col)}${zoneDef.row + 1}` : null,
        organizationId: orgId,
        userId,
      },
    });

    const tag = await prisma.rFIDTag.create({
      data: {
        tagId: a.mac,
        tagType: 'BLE',
        assetId: asset.id,
        status: a.tagStatus,
        batteryLevel: a.bat,
        lastRssi: a.rssi,
        lastSeenAt: a.tagStatus === 'MISSING' ? randomPast(90, 180) : randomPast(1, 15),
        lastZoneId: a.tagStatus === 'MISSING' ? null : zoneId,
        manufacturer: a.man,
        model: a.model,
        notes: DEMO_MARKER,
        organizationId: orgId,
      },
    });
    tagIds.push(tag.id);
    assetTagPairs.push({ tagId: tag.id, zoneId, status: a.tagStatus, bat: a.bat, rssi: a.rssi, mac: a.mac });
  }

  // ── 4. Generate realistic scan history ──────────────────────────────────────
  const scanInserts: any[] = [];
  for (const { tagId, zoneId, status } of assetTagPairs) {
    if (status === 'MISSING' || !zoneId) continue;
    const scanCount = Math.floor(Math.random() * 12) + 6;
    for (let i = 0; i < scanCount; i++) {
      scanInserts.push({
        tagId,
        zoneId,
        rssi: Math.floor(Math.random() * 30) - 85,
        batteryRaw: Math.floor(Math.random() * 40) + 60,
        createdAt: randomPast(i * 3, i * 3 + 60),
      });
    }
  }
  await prisma.rFIDScan.createMany({ data: scanInserts });

  // ── 5. Create alert rules ────────────────────────────────────────────────────
  const ruleMap: Record<string, string> = {};
  for (const r of ALERT_RULES) {
    const rule = await prisma.rFIDAlertRule.create({
      data: { type: r.type, name: r.name, enabled: true, config: r.config, organizationId: orgId },
    });
    ruleMap[r.type] = rule.id;
  }

  // ── 6. Create active alerts ──────────────────────────────────────────────────
  const lowBatTags = assetTagPairs.filter(t => t.status === 'LOW_BATTERY');
  const missingTags = assetTagPairs.filter(t => t.status === 'MISSING');

  for (const t of lowBatTags) {
    const assetDef = ASSET_DEFS[assetTagPairs.indexOf(t)];
    await prisma.rFIDAlert.create({ data: {
      ruleId: ruleMap['LOW_BATTERY'], tagId: t.tagId,
      assetName: assetDef.name, zoneName: assetDef.zone,
      message: `Battery level critically low (${t.bat}%) on "${assetDef.name}" — immediate replacement needed.`,
      severity: 'CRITICAL', organizationId: orgId, createdAt: randomPast(5, 30),
    }});
  }
  for (const t of missingTags) {
    const assetDef = ASSET_DEFS[assetTagPairs.indexOf(t)];
    await prisma.rFIDAlert.create({ data: {
      ruleId: ruleMap['MISSING'], tagId: t.tagId,
      assetName: assetDef.name, zoneName: assetDef.zone,
      message: `Asset "${assetDef.name}" has not been detected for over 90 minutes. Last seen in ${assetDef.zone}.`,
      severity: 'WARNING', organizationId: orgId, createdAt: randomPast(90, 180),
    }});
  }
  // CEO Office restricted zone alert
  const ceoTags = assetTagPairs.filter((_, i) => ['CEO Office'].includes(ASSET_DEFS[i]?.zone));
  if (ceoTags.length && ruleMap['RESTRICTED_ZONE']) {
    await prisma.rFIDAlert.create({ data: {
      ruleId: ruleMap['RESTRICTED_ZONE'], tagId: ceoTags[0].tagId,
      assetName: 'Apple MacBook Pro 16" (CEO)', zoneName: 'CEO Office',
      message: 'Restricted zone access: asset detected in CEO Office (restricted area). Access logged.',
      severity: 'INFO', organizationId: orgId, createdAt: randomPast(10, 20),
    }});
  }

  return res.status(201).json({
    message: '✅ Demo data seeded successfully for Meridian Technologies Group',
    summary: {
      floorPlans: 3,
      zones: ZONE_DEFS.length,
      assets: ASSET_DEFS.length,
      rfidTags: ASSET_DEFS.length,
      scans: scanInserts.length,
      alertRules: ALERT_RULES.length,
    },
  });
}
