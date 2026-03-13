// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  const orgId = roleData?.organizationId ?? null;
  const { id } = req.query as { id: string };

  const alert = await prisma.rFIDAlert.findFirst({
    where: { id, ...(orgId ? { organizationId: orgId } : {}) },
  });
  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  const updated = await prisma.rFIDAlert.update({
    where: { id },
    data: { resolvedAt: new Date() },
  });

  return res.status(200).json({ alert: updated });
}
