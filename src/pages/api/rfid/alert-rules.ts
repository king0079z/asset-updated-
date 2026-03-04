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
    const rules = await prisma.rFIDAlertRule.findMany({
      where: orgId ? { organizationId: orgId } : {},
      include: { _count: { select: { alerts: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return res.status(200).json({ rules });
  }

  if (req.method === 'POST') {
    const { type, name, enabled, config } = req.body;
    const validTypes = ['ZONE_BREACH', 'RESTRICTED_ZONE', 'MISSING', 'LOW_BATTERY'];
    if (!type || !validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

    const rule = await prisma.rFIDAlertRule.create({
      data: {
        type,
        name: name.trim(),
        enabled: enabled !== false,
        config: config ?? {},
        organizationId: orgId,
      },
    });
    return res.status(201).json({ rule });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
