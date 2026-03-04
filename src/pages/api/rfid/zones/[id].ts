// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query as { id: string };

  if (req.method === 'GET') {
    const zone = await prisma.rFIDZone.findUnique({
      where: { id },
      include: {
        floorPlan: true,
        tags: { include: { asset: { select: { id: true, name: true, status: true } } } },
        _count: { select: { scans: true } },
      },
    });
    if (!zone) return res.status(404).json({ error: 'Zone not found' });
    return res.status(200).json({ zone });
  }

  if (req.method === 'PUT') {
    const {
      name, description, apMacAddress, apIpAddress, apSerialNumber,
      floorNumber, roomNumber, building,
      isRestricted, floorPlanId, mapX, mapY, mapWidth, mapHeight,
    } = req.body;

    const zone = await prisma.rFIDZone.update({
      where: { id },
      data: {
        ...(name              ? { name: name.trim() }                                                 : {}),
        ...(description       !== undefined ? { description: description || null }                    : {}),
        ...(apMacAddress      !== undefined ? { apMacAddress: apMacAddress?.trim().toUpperCase() || null } : {}),
        ...(apIpAddress       !== undefined ? { apIpAddress: apIpAddress?.trim() || null }           : {}),
        ...(apSerialNumber    !== undefined ? { apSerialNumber: apSerialNumber?.trim() || null }      : {}),
        ...(floorNumber       !== undefined ? { floorNumber: floorNumber || null }                    : {}),
        ...(roomNumber        !== undefined ? { roomNumber: roomNumber || null }                      : {}),
        ...(building          !== undefined ? { building: building || null }                          : {}),
        ...(isRestricted      !== undefined ? { isRestricted: isRestricted === true || isRestricted === 'true' } : {}),
        ...(floorPlanId       !== undefined ? { floorPlanId: floorPlanId || null }                   : {}),
        ...(mapX              !== undefined ? { mapX: mapX != null ? Number(mapX) : null }           : {}),
        ...(mapY              !== undefined ? { mapY: mapY != null ? Number(mapY) : null }           : {}),
        ...(mapWidth          !== undefined ? { mapWidth: mapWidth != null ? Number(mapWidth) : null } : {}),
        ...(mapHeight         !== undefined ? { mapHeight: mapHeight != null ? Number(mapHeight) : null } : {}),
      },
    });
    return res.status(200).json({ zone });
  }

  if (req.method === 'DELETE') {
    await prisma.rFIDZone.delete({ where: { id } });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
