// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';
import { pushAssetToD365 } from '@/lib/dynamics365/syncAsset';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const roleData = await getUserRoleData(auth.user.id);
  if (!roleData?.isAdmin && roleData?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const orgId = roleData?.organizationId || null;

  // Find pending sync logs or assets without recent sync
  const pendingLogs = await prisma.d365SyncLog.findMany({
    where: { status: { in: ['PENDING', 'ERROR'] }, retryCount: { lt: 3 } },
    take: 50,
  });

  let synced = 0;
  let errors = 0;

  for (const log of pendingLogs) {
    const asset = await prisma.asset.findUnique({ where: { id: log.entityId } });
    if (!asset) continue;
    try {
      await pushAssetToD365(asset);
      synced++;
    } catch {
      errors++;
      await prisma.d365SyncLog.update({
        where: { id: log.id },
        data: { retryCount: { increment: 1 } },
      });
    }
  }

  return res.status(200).json({ ok: true, synced, errors, ts: new Date().toISOString() });
}
