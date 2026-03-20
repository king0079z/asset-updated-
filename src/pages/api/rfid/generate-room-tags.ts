import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getSessionSafe } from '@/util/supabase/require-auth';

/**
 * POST /api/rfid/generate-room-tags
 * 
 * Generates RFID tags for existing zones (rooms) that don't have room tags yet.
 * Creates tags with isRoomTag=true and links them to zones.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user } = await getSessionSafe(req, res);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { zoneIds, generateForAll } = req.body;

    // Get zones that need room tags
    let zonesToProcess;
    if (generateForAll) {
      // Get all zones with floor/room numbers that don't have room tags yet
      zonesToProcess = await prisma.rFIDZone.findMany({
        where: {
          AND: [
            { floorNumber: { not: null } },
            { roomNumber: { not: null } },
            {
              roomTags: {
                none: {},
              },
            },
          ],
        },
        select: {
          id: true,
          name: true,
          floorNumber: true,
          roomNumber: true,
          building: true,
          organizationId: true,
        },
      });
    } else if (Array.isArray(zoneIds) && zoneIds.length > 0) {
      zonesToProcess = await prisma.rFIDZone.findMany({
        where: {
          id: { in: zoneIds },
          floorNumber: { not: null },
          roomNumber: { not: null },
        },
        select: {
          id: true,
          name: true,
          floorNumber: true,
          roomNumber: true,
          building: true,
          organizationId: true,
        },
      });
    } else {
      return res.status(400).json({ error: 'Either zoneIds array or generateForAll=true is required' });
    }

    if (zonesToProcess.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No zones found that need room tags',
        generated: [],
      });
    }

    // Generate room tags for each zone
    const generated = [];
    for (const zone of zonesToProcess) {
      // Generate a unique tag ID (MAC address format for consistency)
      const tagId = generateRoomTagId();

      // Check if tag ID already exists
      const existing = await prisma.rFIDTag.findUnique({
        where: { tagId },
      });

      if (existing) {
        // Skip if tag already exists, try generating another
        continue;
      }

      // Create the room tag
      const roomTag = await prisma.rFIDTag.create({
        data: {
          tagId,
          tagType: 'BLE',
          isRoomTag: true,
          roomZoneId: zone.id,
          status: 'ACTIVE',
          organizationId: zone.organizationId || undefined,
          notes: `Room tag for ${zone.name} (Floor ${zone.floorNumber}, Room ${zone.roomNumber})`,
        },
        include: {
          roomZone: {
            select: {
              id: true,
              name: true,
              floorNumber: true,
              roomNumber: true,
              building: true,
            },
          },
        },
      });

      generated.push({
        id: roomTag.id,
        tagId: roomTag.tagId,
        zoneId: zone.id,
        zoneName: zone.name,
        floorNumber: zone.floorNumber,
        roomNumber: zone.roomNumber,
        building: zone.building,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Generated ${generated.length} room tag(s)`,
      generated,
    });
  } catch (error) {
    console.error('Error generating room tags:', error);
    return res.status(500).json({
      error: 'Failed to generate room tags',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Generates a unique RFID tag ID in MAC address format (e.g., AA:BB:CC:DD:EE:FF)
 */
function generateRoomTagId(): string {
  const bytes = Array.from({ length: 6 }, () => Math.floor(Math.random() * 256));
  // Use a prefix to identify room tags (e.g., RO:XX:XX:XX:XX:XX)
  return `RO:${bytes.slice(1).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(':')}`;
}
