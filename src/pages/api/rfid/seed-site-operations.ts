// @ts-nocheck
/**
 * POST /api/rfid/seed-site-operations
 *
 * Seeds demo passageways (7 sites) for the RFID command center.
 * Query: ?replace=true (default) — remove prior demo rows (marker) then insert.
 *        ?replace=false — skip if demo passageways already exist.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';
import {
  SITE_OPS_DEMO_MARKER,
  deleteDemoPassageways,
  orgWhereEquals,
  seedPassagewayDemoContent,
} from '@/lib/rfid/seed-site-operations-demo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  const orgId = roleData?.organizationId ?? null;

  const replace = req.query.replace !== 'false';

  try {
    if (replace) {
      await deleteDemoPassageways(prisma, orgId);
    } else {
      const existing = await prisma.passagewayConfig.count({
        where: {
          AND: [orgWhereEquals(orgId), { notes: { contains: SITE_OPS_DEMO_MARKER } }],
        },
      });
      if (existing > 0) {
        return res.status(200).json({
          ok: true,
          skipped: true,
          message: 'Demo passageways already present. Add ?replace=true to refresh.',
        });
      }
    }

    const zones = await prisma.rFIDZone.findMany({
      where: orgWhereEquals(orgId),
      select: { id: true, name: true },
    });
    const zoneMap: Record<string, string> = {};
    for (const z of zones) zoneMap[z.name] = z.id;

    const out = await seedPassagewayDemoContent(prisma, {
      organizationId: orgId,
      zoneMap,
    });

    return res.status(200).json({
      ok: true,
      skipped: false,
      ...out,
      message: `Created ${out.passageways} demo passageway configurations.`,
    });
  } catch (err: any) {
    console.error('[seed-site-operations]', err);
    const msg = err?.message ?? String(err);
    const code = err?.code;
    return res.status(500).json({ error: 'Seed failed', details: msg, code });
  }
}
