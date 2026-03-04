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
  const { id } = req.query as { id: string };

  const rule = await prisma.rFIDAlertRule.findFirst({
    where: { id, ...(orgId ? { organizationId: orgId } : {}) },
  });
  if (!rule) return res.status(404).json({ error: 'Rule not found' });

  if (req.method === 'GET') {
    return res.status(200).json({ rule });
  }

  if (req.method === 'PUT') {
    const { name, enabled, config } = req.body;
    const updated = await prisma.rFIDAlertRule.update({
      where: { id },
      data: {
        ...(name !== undefined    ? { name: name.trim() } : {}),
        ...(enabled !== undefined ? { enabled }           : {}),
        ...(config !== undefined  ? { config }            : {}),
      },
    });
    return res.status(200).json({ rule: updated });
  }

  if (req.method === 'DELETE') {
    await prisma.rFIDAlertRule.delete({ where: { id } });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
