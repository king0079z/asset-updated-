import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getSessionSafe } from '@/util/supabase/require-auth';

/**
 * POST /api/rfid/resolve-room-tag
 * 
 * Resolves a scanned RFID tag ID to a room location (floor/room).
 * Returns the floor and room number if the tag is a room tag.
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

    const { tagId } = req.body;
    if (!tagId || typeof tagId !== 'string') {
      return res.status(400).json({ error: 'tagId is required' });
    }

    // Normalize tag ID (uppercase, trim)
    const inputTagId = tagId.trim().toUpperCase();
    
    // For room tags that start with "RO:", preserve the prefix
    // Otherwise, normalize by removing invalid hex chars (but keep colons)
    let normalisedTagId: string;
    if (inputTagId.startsWith('RO:')) {
      // Room tag format: preserve "RO:" prefix, normalize the rest
      const rest = inputTagId.substring(3);
      const normalizedRest = rest.replace(/[^0-9A-F:]/g, '');
      normalisedTagId = `RO:${normalizedRest}`;
    } else {
      // Regular tag: remove all non-hex chars (but keep colons)
      normalisedTagId = inputTagId.replace(/[^0-9A-F:]/g, '');
    }

    // Try to find the tag - first try exact match, then try case-insensitive search
    let tag = await prisma.rFIDTag.findUnique({
      where: { tagId: normalisedTagId },
      include: {
        roomZone: {
          select: {
            id: true,
            name: true,
            floorNumber: true,
            roomNumber: true,
            building: true,
            description: true,
          },
        },
      },
    });

    // If not found, try searching for room tags that match (case-insensitive)
    if (!tag && inputTagId.startsWith('RO:')) {
      // Try to find by matching the pattern (RO: followed by hex)
      const allRoomTags = await prisma.rFIDTag.findMany({
        where: {
          isRoomTag: true,
          tagId: { startsWith: 'RO:', mode: 'insensitive' },
        },
        include: {
          roomZone: {
            select: {
              id: true,
              name: true,
              floorNumber: true,
              roomNumber: true,
              building: true,
              description: true,
            },
          },
        },
      });
      // Find exact match (case-insensitive)
      tag = allRoomTags.find(t => t.tagId.toUpperCase() === normalisedTagId.toUpperCase()) || null;
    }

    if (!tag) {
      return res.status(404).json({ error: 'RFID tag not found' });
    }

    // Check if it's a room tag
    if (!tag.isRoomTag) {
      return res.status(400).json({ 
        error: 'This RFID tag is not a room tag',
        isRoomTag: false,
      });
    }

    if (!tag.roomZone) {
      return res.status(400).json({ 
        error: 'Room tag is not linked to a zone',
        isRoomTag: true,
      });
    }

    if (!tag.roomZone.floorNumber || !tag.roomZone.roomNumber) {
      return res.status(400).json({ 
        error: 'Room zone is missing floor or room number',
        isRoomTag: true,
        zone: tag.roomZone,
      });
    }

    return res.status(200).json({
      success: true,
      tagId: tag.tagId,
      floorNumber: tag.roomZone.floorNumber,
      roomNumber: tag.roomZone.roomNumber,
      building: tag.roomZone.building,
      zoneName: tag.roomZone.name,
      zoneDescription: tag.roomZone.description,
    });
  } catch (error) {
    console.error('Error resolving room tag:', error);
    return res.status(500).json({ 
      error: 'Failed to resolve room tag',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
