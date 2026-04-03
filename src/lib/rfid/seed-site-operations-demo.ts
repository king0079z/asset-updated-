// @ts-nocheck
/**
 * Demo passageways (7 sites) + inspection routes for RFID command center.
 * Marked with SITE_OPS_DEMO_MARKER for safe replace.
 */
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

export const SITE_OPS_DEMO_MARKER = 'DEMO:RFID_SITE_OPS';

/** Prisma strips `undefined` in where — use explicit null vs string so we never match all rows. */
export function orgWhereEquals(organizationId: string | null) {
  return organizationId === null ? { organizationId: null } : { organizationId };
}

function asJsonIds(ids: string[]): Prisma.InputJsonValue {
  return ids as unknown as Prisma.InputJsonValue;
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000);
}

/** Remove only demo-marked rows (safe for orgs with real data). */
export async function deleteDemoSiteOperations(prisma: PrismaClient, organizationId: string | null) {
  const orgEq = orgWhereEquals(organizationId);
  const routes = await prisma.inspectionRoute.findMany({
    where: {
      AND: [
        orgEq,
        { description: { contains: SITE_OPS_DEMO_MARKER } },
      ],
    },
    select: { id: true },
  });
  const routeIds = routes.map((r) => r.id);
  if (routeIds.length) {
    await prisma.inspectionCompletion.deleteMany({ where: { routeId: { in: routeIds } } });
    await prisma.inspectionRoute.deleteMany({ where: { id: { in: routeIds } } });
  }
  await prisma.passagewayConfig.deleteMany({
    where: {
      AND: [
        orgEq,
        { notes: { contains: SITE_OPS_DEMO_MARKER } },
      ],
    },
  });
}

/** Full org wipe for RFID seed-demo clear (not only demo marker). */
export async function deleteAllSiteOperationsForOrg(prisma: PrismaClient, organizationId: string | null) {
  const orgEq = orgWhereEquals(organizationId);
  const routes = await prisma.inspectionRoute.findMany({
    where: orgEq,
    select: { id: true },
  });
  const routeIds = routes.map((r) => r.id);
  if (routeIds.length) {
    await prisma.inspectionCompletion.deleteMany({ where: { routeId: { in: routeIds } } });
    await prisma.inspectionRoute.deleteMany({ where: { id: { in: routeIds } } });
  }
  await prisma.passagewayConfig.deleteMany({ where: orgEq });
}

const PASSAGEWAY_DEF = [
  { siteName: 'HQ - Main Building', siteCode: 'HQ-G1-01', direction: 'BOTH' as const, zoneKey: 'Emergency Reception', readerMac: 'DE:MO:01:AA:BB:01' },
  { siteName: 'Site A - Warehouse', siteCode: 'SIT-A-WH-01', direction: 'ENTRY' as const, zoneKey: 'Medical Supplies Store', readerMac: 'DE:MO:01:AA:BB:02' },
  { siteName: 'Site B - Operations', siteCode: 'SIT-B-OP-01', direction: 'EXIT' as const, zoneKey: 'Trauma Bay A', readerMac: 'DE:MO:01:AA:BB:03' },
  { siteName: 'Site C - Medical', siteCode: 'SIT-C-MED-01', direction: 'BOTH' as const, zoneKey: 'ICU Unit A', readerMac: 'DE:MO:01:AA:BB:04' },
  { siteName: 'Site D - Logistics', siteCode: 'SIT-D-LOG-01', direction: 'ENTRY' as const, zoneKey: 'Pharmacy Store', readerMac: 'DE:MO:01:AA:BB:05' },
  { siteName: 'Site E - Admin', siteCode: 'SIT-E-ADM-01', direction: 'EXIT' as const, zoneKey: 'Administration Office', readerMac: 'DE:MO:01:AA:BB:06' },
  { siteName: 'Site F - Field Base', siteCode: 'SIT-F-FB-01', direction: 'BOTH' as const, zoneKey: 'Nursing Station', readerMac: 'DE:MO:01:AA:BB:07' },
];

export async function seedSiteOperationsDemoContent(
  prisma: PrismaClient,
  {
    organizationId,
    userId,
    zoneMap,
    assetIds,
  }: {
    organizationId: string | null;
    userId: string;
    zoneMap: Record<string, string>;
    assetIds: string[];
  },
) {
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  const completionUserId = actor?.id ?? null;

  const markerNote = `${SITE_OPS_DEMO_MARKER} Demo gate reader - replace anytime from RFID hub`;
  const desc = (line: string) => `${SITE_OPS_DEMO_MARKER} ${line}`;

  let passageways = 0;
  for (const p of PASSAGEWAY_DEF) {
    await prisma.passagewayConfig.create({
      data: {
        siteName: p.siteName,
        siteCode: p.siteCode,
        zoneId: zoneMap[p.zoneKey] ?? null,
        direction: p.direction,
        alertOnUnauthorized: true,
        readerMacAddress: p.readerMac,
        notes: markerNote,
        organizationId,
        isActive: true,
      },
    });
    passageways++;
  }

  const a = assetIds;
  const slice = (from: number, to: number) => a.slice(from, to);

  const route1 = await prisma.inspectionRoute.create({
    data: {
      name: 'Weekly critical-care RFID verification',
      description: desc('Handheld sweep of ICU, recovery, and OR linked assets'),
      assetIds: slice(0, 8).length ? slice(0, 8) : [],
      periodDays: 7,
      assignedToId: completionUserId ?? undefined,
      organizationId,
      nextDueAt: new Date(Date.now() + 2 * 86_400_000),
      lastCompletedAt: daysAgo(3),
      deliveryRate: 91.7,
      successRate: 100,
      isActive: true,
    },
  });

  let completions = 0;
  if (completionUserId) {
    await prisma.inspectionCompletion.createMany({
      data: [
        { routeId: route1.id, completedById: completionUserId, completedAt: daysAgo(17), isOnTime: true, isSuccessful: true },
        { routeId: route1.id, completedById: completionUserId, completedAt: daysAgo(10), isOnTime: true, isSuccessful: true },
        { routeId: route1.id, completedById: completionUserId, completedAt: daysAgo(3), isOnTime: false, isSuccessful: true },
      ],
    });
    completions += 3;
  }

  const route2 = await prisma.inspectionRoute.create({
    data: {
      name: 'Monthly warehouse & ward audit',
      description: desc('Verify tags in supply areas, wards, and nursing stations'),
      assetIds: asJsonIds(slice(8, 18).length ? slice(8, 18) : slice(0, Math.min(6, a.length))),
      periodDays: 30,
      assignedToId: completionUserId ?? undefined,
      organizationId,
      nextDueAt: daysAgo(2),
      lastCompletedAt: daysAgo(32),
      deliveryRate: 88,
      successRate: 94,
      isActive: true,
    },
  });

  if (completionUserId) {
    await prisma.inspectionCompletion.createMany({
      data: [
        { routeId: route2.id, completedById: completionUserId, completedAt: daysAgo(62), isOnTime: true, isSuccessful: true },
        { routeId: route2.id, completedById: completionUserId, completedAt: daysAgo(32), isOnTime: true, isSuccessful: false, notes: 'One asset temporarily off-site' },
      ],
    });
    completions += 2;
  }

  await prisma.inspectionRoute.create({
    data: {
      name: 'Quarterly full portfolio RFID attestation',
      description: desc('Cross-site sample verification for compliance reporting'),
      assetIds: asJsonIds(slice(18, 28).length ? slice(18, 28) : a.slice(0, Math.min(10, a.length))),
      periodDays: 90,
      assignedToId: completionUserId ?? undefined,
      organizationId,
      nextDueAt: new Date(Date.now() + 45 * 86_400_000),
      lastCompletedAt: daysAgo(40),
      deliveryRate: 100,
      successRate: 98,
      isActive: true,
    },
  });

  return {
    passageways,
    routes: 3,
    completions,
  };
}
