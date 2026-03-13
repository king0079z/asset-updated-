// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  const orgId = roleData?.organizationId ?? null;

  if (req.method === 'GET') {
    const { resolved, type, page = '1', limit = '50' } = req.query as Record<string, string>;

    const where: any = orgId ? { organizationId: orgId } : {};
    if (resolved === 'false') where.resolvedAt = null;
    if (resolved === 'true')  where.resolvedAt = { not: null };
    if (type) where.rule = { type };

    const [alerts, total, unresolved] = await Promise.all([
      prisma.rFIDAlert.findMany({
        where,
        include: { rule: { select: { type: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.rFIDAlert.count({ where }),
      prisma.rFIDAlert.count({
        where: { ...(orgId ? { organizationId: orgId } : {}), resolvedAt: null },
      }),
    ]);

    return res.status(200).json({ alerts, total, unresolved, page: Number(page) });
  }

  // POST: check-missing endpoint (called from client on interval)
  if (req.method === 'POST') {
    const { action } = req.body ?? {};
    if (action !== 'check-missing') return res.status(400).json({ error: 'Unknown action' });

    // Find enabled MISSING rules for this org
    const rules = await prisma.rFIDAlertRule.findMany({
      where: { type: 'MISSING', enabled: true, ...(orgId ? { organizationId: orgId } : {}) },
    });

    let created = 0;
    for (const rule of rules) {
      const thresholdMinutes = (rule.config as any)?.thresholdMinutes ?? 30;
      const since = new Date(Date.now() - thresholdMinutes * 60 * 1000);

      const missingTags = await prisma.rFIDTag.findMany({
        where: {
          ...(orgId ? { organizationId: orgId } : {}),
          status: { not: 'UNASSIGNED' },
          OR: [
            { lastSeenAt: null },
            { lastSeenAt: { lt: since } },
          ],
        },
        include: { asset: { select: { name: true } } },
      });

      for (const tag of missingTags) {
        // Avoid duplicate unresolved alerts for same tag + rule
        const existing = await prisma.rFIDAlert.findFirst({
          where: { ruleId: rule.id, tagId: tag.id, resolvedAt: null },
        });
        if (existing) continue;

        await prisma.rFIDAlert.create({
          data: {
            ruleId:    rule.id,
            tagId:     tag.id,
            assetId:   tag.assetId ?? null,
            assetName: tag.asset?.name ?? null,
            message:   `Asset "${tag.asset?.name ?? tag.tagId}" has not been seen for ${thresholdMinutes} minutes`,
            severity:  'WARNING',
            organizationId: orgId,
          },
        });
        created++;
      }
    }

    return res.status(200).json({ created });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
