import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification, createAuditLog, logUserActivity } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { reason } = req.body;

  // Validate that reason is provided
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    console.error('Missing or invalid disposal reason');
    return res.status(400).json({ error: 'Disposal reason is required' });
  }

  try {
    // Verify user authentication
    const supabase = createClient(req, res);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.info('Disposing asset:', { id, userId: user.id, reason });

    // Get current asset details
    const currentAsset = await prisma.asset.findUnique({
      where: { id: String(id) },
      select: { status: true, name: true, purchaseAmount: true, location: true }
    });

    if (!currentAsset) {
      console.error('Asset not found:', id);
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Use a transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (prisma) => {
      const disposedAt = new Date();
      
      // Update asset status
      const updatedAsset = await prisma.asset.update({
        where: { id: String(id) },
        data: {
          status: 'DISPOSED',
          disposedAt,
        },
      });

      // Record in history with reason
      const history = await prisma.assetHistory.create({
        data: {
          assetId: String(id),
          action: 'DISPOSED',
          userId: user.id,
          details: {
            previousStatus: currentAsset.status,
            disposedAt: disposedAt.toISOString(),
            timestamp: disposedAt.toISOString(),
            reason: reason.trim(),
          },
        },
      });

      return { asset: updatedAsset, history };
    });

    console.info('Asset disposed successfully:', {
      assetId: id,
      historyId: result.history.id,
      reason: reason.trim()
    });

    // Create audit log for asset disposal
    await logDataModification(
      'ASSET',
      String(id),
      'UPDATE',
      {
        previousStatus: currentAsset.status,
        newStatus: 'DISPOSED',
        disposedAt: new Date().toISOString(),
        reason: reason.trim()
      },
      {
        action: 'Asset Disposal',
        assetName: currentAsset.name,
        assetValue: currentAsset.purchaseAmount,
        location: currentAsset.location,
        userId: user.id,
        userEmail: user.email
      }
    );
    
    // Add a specific user activity log for better visibility in the user activity tab
    await logUserActivity(
      'ASSET_DISPOSED',
      'ASSET',
      {
        assetName: currentAsset.name,
        previousStatus: currentAsset.status,
        disposedAt: new Date().toISOString(),
        assetValue: currentAsset.purchaseAmount,
        location: currentAsset.location,
        reason: reason.trim(),
        userId: user.id,
        userEmail: user.email
      },
      String(id)
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error disposing asset:', error);
    return res.status(500).json({ error: 'Failed to dispose asset', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}