// @ts-nocheck
/**
 * POST /api/rfid/seed-site-operations
 *
 * Seeds demo passageways (7 sites) + inspection routes (3) + sample completions.
 * Query: ?replace=true (default) — remove prior demo rows (marker) then insert.
 *        ?replace=false — skip if demo passageways already exist.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';
import {
  SITE_OPS_DEMO_MARKER,
  deleteDemoSiteOperations,
  seedSiteOperationsDemoContent,
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
  const userId = session.user.id;

  const replace = req.query.replace !== 'false';

  try {
    if (replace) {
      await deleteDemoSiteOperations(prisma, orgId);
    } else {
      const existing = await prisma.passagewayConfig.count({
        where: { organizationId: orgId ?? undefined, notes: { contains: SITE_OPS_DEMO_MARKER } },
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
      where: { organizationId: orgId ?? undefined },
      select: { id: true, name: true },
    });
    const zoneMap: Record<string, string> = {};
    for (const z of zones) zoneMap[z.name] = z.id;

    const assets = await prisma.asset.findMany({
      where: { organizationId: orgId ?? undefined },
      take: 40,
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const assetIds = assets.map((a) => a.id);

    const out = await seedSiteOperationsDemoContent(prisma, {
      organizationId: orgId,
      userId,
      zoneMap,
      assetIds,
    });

    return res.status(200).json({
      ok: true,
      skipped: false,
      ...out,
      message: `Created ${out.passageways} passageways, ${out.routes} inspection routes, ${out.completions} completion records.`,
    });
  } catch (err) {
    console.error('[seed-site-operations]', err);
    return res.status(500).json({ error: 'Seed failed', details: String(err) });
  }
}
