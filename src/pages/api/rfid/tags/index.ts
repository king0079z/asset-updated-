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
  const orgId    = roleData?.organizationId ?? null;

  if (req.method === 'GET') {
    const tags = await prisma.rFIDTag.findMany({
      where: orgId ? { organizationId: orgId } : {},
      include: {
        asset:    { select: { id: true, name: true, type: true, status: true, imageUrl: true, floorNumber: true, roomNumber: true } },
        lastZone: { select: { id: true, name: true, floorNumber: true, roomNumber: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=20');
    return res.status(200).json({ tags });
  }

  if (req.method === 'POST') {
    const { tagId, tagType = 'BLE', assetId, manufacturer, model, notes } = req.body;
    if (!tagId?.trim()) return res.status(400).json({ error: 'tagId is required' });

    // Check uniqueness
    const existing = await prisma.rFIDTag.findUnique({ where: { tagId: tagId.trim() } });
    if (existing) return res.status(409).json({ error: 'A tag with this ID already exists' });

    const tag = await prisma.rFIDTag.create({
      data: {
        tagId:         tagId.trim(),
        tagType:       tagType ?? 'BLE',
        assetId:       assetId || null,
        status:        assetId ? 'ACTIVE' : 'UNASSIGNED',
        manufacturer:  manufacturer || null,
        model:         model || null,
        notes:         notes || null,
        organizationId: orgId,
      },
      include: {
        asset:    { select: { id: true, name: true, type: true, status: true } },
        lastZone: { select: { id: true, name: true } },
      },
    });
    return res.status(201).json({ tag });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
