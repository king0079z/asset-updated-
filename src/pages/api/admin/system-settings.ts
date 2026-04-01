// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const roleData = await getUserRoleData(auth.user.id);
  const isAdmin = roleData?.isAdmin || roleData?.role === 'ADMIN';

  if (req.method === 'GET') {
    const settings = await prisma.systemSettings.findMany({ orderBy: { key: 'asc' } });
    const map: Record<string, any> = {};
    settings.forEach(s => { map[s.key] = (s.value as any)?.value ?? s.value; });
    return res.status(200).json(map);
  }

  if (req.method === 'POST') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { key, value, description } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    const setting = await prisma.systemSettings.upsert({
      where: { key },
      update: { value: { value } as any, lastUpdatedBy: auth.user.id },
      create: { key, value: { value } as any, description, lastUpdatedBy: auth.user.id },
    });
    return res.status(200).json(setting);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
