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
    const zones = await prisma.rFIDZone.findMany({
      where: orgId ? { organizationId: orgId } : {},
      include: {
        _count: { select: { tags: true, scans: true } },
        tags: {
          include: { asset: { select: { id: true, name: true, status: true } } },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ zones });
  }

  if (req.method === 'POST') {
    const { name, description, apMacAddress, apIpAddress, apSerialNumber, floorNumber, roomNumber, building } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

    const zone = await prisma.rFIDZone.create({
      data: {
        name:          name.trim(),
        description:   description || null,
        apMacAddress:  apMacAddress?.trim().toUpperCase() || null,
        apIpAddress:   apIpAddress?.trim() || null,
        apSerialNumber: apSerialNumber?.trim() || null,
        floorNumber:   floorNumber || null,
        roomNumber:    roomNumber  || null,
        building:      building   || null,
        organizationId: orgId,
      },
    });
    return res.status(201).json({ zone });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
