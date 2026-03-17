// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query as { id: string };

  if (req.method === 'PUT') {
    const { assetId, status, manufacturer, model, notes, tagType } = req.body;
    const tag = await prisma.rFIDTag.update({
      where: { id },
      data: {
        ...(assetId !== undefined ? { assetId: assetId || null } : {}),
        ...(status     ? { status }       : {}),
        ...(tagType    ? { tagType }      : {}),
        ...(manufacturer !== undefined ? { manufacturer: manufacturer || null } : {}),
        ...(model        !== undefined ? { model: model || null }               : {}),
        ...(notes        !== undefined ? { notes: notes || null }               : {}),
        // Auto-update status when asset is linked/unlinked
        ...(assetId !== undefined ? { status: assetId ? 'ACTIVE' : 'UNASSIGNED' } : {}),
      },
      include: {
        asset:    { select: { id: true, name: true } },
        lastZone: { select: { id: true, name: true } },
      },
    });
    return res.status(200).json({ tag });
  }

  if (req.method === 'DELETE') {
    await prisma.rFIDTag.delete({ where: { id } });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
