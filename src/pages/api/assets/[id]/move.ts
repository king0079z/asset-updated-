import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification, logUserActivity } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { floorNumber, roomNumber } = req.body;

  if (!floorNumber || !roomNumber) {
    return res.status(400).json({ error: 'Floor number and room number are required' });
  }

  try {
    // Verify user authentication
    const supabase = createClient(req, res);
    const { data: { user }, error } = await supabase.auth.getSession();

    if (error || !user) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.info('Moving asset:', { id, floorNumber, roomNumber, userId: user.id });

    // Get current asset details
    const currentAsset = await prisma.asset.findUnique({
      where: { id: String(id) },
      select: { floorNumber: true, roomNumber: true, name: true }
    });

    if (!currentAsset) {
      console.error('Asset not found:', id);
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Use a transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (prisma) => {
      const timestamp = new Date();
      
      // Update asset location
      const updatedAsset = await prisma.asset.update({
        where: { id: String(id) },
        data: {
          floorNumber,
          roomNumber,
          status: 'ACTIVE',
          lastMovedAt: timestamp,
        },
      });

      // Create movement record
      const movement = await prisma.assetMovement.create({
        data: {
          assetId: String(id),
          fromFloor: currentAsset.floorNumber,
          fromRoom: currentAsset.roomNumber,
          toFloor: floorNumber,
          toRoom: roomNumber,
        },
      });

      // Record in history
      const history = await prisma.assetHistory.create({
        data: {
          assetId: String(id),
          action: 'MOVED',
          userId: user.id,
          details: {
            fromFloor: currentAsset.floorNumber,
            fromRoom: currentAsset.roomNumber,
            toFloor: floorNumber,
            toRoom: roomNumber,
            timestamp: timestamp.toISOString(),
          },
        },
      });

      return { asset: updatedAsset, movement, history };
    });

    console.info('Asset moved successfully:', {
      assetId: id,
      historyId: result.history.id,
      movementId: result.movement.id
    });

    // Create audit log for asset movement
    await logDataModification(
      'ASSET',
      String(id),
      'UPDATE',
      {
        previousLocation: {
          floorNumber: currentAsset.floorNumber,
          roomNumber: currentAsset.roomNumber
        },
        newLocation: {
          floorNumber,
          roomNumber
        },
        movedAt: new Date().toISOString()
      },
      {
        action: 'Asset Movement',
        assetName: currentAsset.name,
        fromLocation: `Floor ${currentAsset.floorNumber}, Room ${currentAsset.roomNumber}`,
        toLocation: `Floor ${floorNumber}, Room ${roomNumber}`,
        userId: user.id,
        userEmail: user.email
      }
    );
    
    // Also log as user activity for the user activity tab
    await logUserActivity(
      'ASSET_MOVED',
      'ASSET',
      {
        assetName: currentAsset.name,
        assetId: String(id),
        fromLocation: `Floor ${currentAsset.floorNumber}, Room ${currentAsset.roomNumber}`,
        toLocation: `Floor ${floorNumber}, Room ${roomNumber}`,
        timestamp: new Date().toISOString(),
        userId: user.id,
        userEmail: user.email
      },
      String(id)
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error moving asset:', error);
    return res.status(500).json({ error: 'Failed to move asset', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}