// @ts-nocheck
/**
 * Demo passageways (7 sites) for RFID command center.
 * Marked with PASSAGEWAY_DEMO_MARKER for safe replace.
 * (Inspection routes removed — use Handheld Audit for field inspection workflows.)
 */
import type { PrismaClient } from '@prisma/client';

export const SITE_OPS_DEMO_MARKER = 'DEMO:RFID_SITE_OPS';

/** Prisma strips `undefined` in where — use explicit null vs string so we never match all rows. */
export function orgWhereEquals(organizationId: string | null) {
  return organizationId === null ? { organizationId: null } : { organizationId };
}

/** Remove only demo-marked passageways (safe for orgs with real data). */
export async function deleteDemoPassageways(prisma: PrismaClient, organizationId: string | null) {
  const orgEq = orgWhereEquals(organizationId);
  await prisma.passagewayConfig.deleteMany({
    where: {
      AND: [orgEq, { notes: { contains: SITE_OPS_DEMO_MARKER } }],
    },
  });
}

/** Full org wipe of passageways for RFID seed-demo clear. */
export async function deleteAllPassagewaysForOrg(prisma: PrismaClient, organizationId: string | null) {
  await prisma.passagewayConfig.deleteMany({ where: orgWhereEquals(organizationId) });
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

export async function seedPassagewayDemoContent(
  prisma: PrismaClient,
  {
    organizationId,
    zoneMap,
  }: {
    organizationId: string | null;
    zoneMap: Record<string, string>;
  },
) {
  const markerNote = `${SITE_OPS_DEMO_MARKER} Demo gate reader - replace anytime from RFID hub`;

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

  return { passageways };
}
