import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { withAuditLog } from '../../middleware/audit-middleware';
import { logUserActivity } from '@/lib/audit';

async function assetHandler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  // Verify user authentication
  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Authentication error:', authError);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Handle GET request
  if (req.method === 'GET') {
    try {
      console.log(`Fetching asset details for id: ${id}`);
      
      const asset = await prisma.asset.findUnique({
        where: { id: String(id) },
        include: {
          vendor: true,
          location: true,
        },
      });

      if (!asset) {
        console.error(`Asset not found with id: ${id}`);
        return res.status(404).json({ error: 'Asset not found' });
      }

      // Log the asset data to help with debugging
      console.log(`Asset found: ${asset.name} (${asset.id})`);
      console.log(`Purchase date: ${asset.purchaseDate ? new Date(asset.purchaseDate).toISOString() : 'null'}`);
      
      // Log the asset data to help with debugging
      console.log(`Asset found: ${asset.name} (${asset.id})`);
      console.log(`Purchase date from DB: ${asset.purchaseDate ? new Date(asset.purchaseDate).toISOString() : 'null'}`);
      
      // Create a copy of the asset with properly formatted dates
      const assetResponse = {
        ...asset,
      };
      
      // Safely handle purchase date formatting
      if (asset.purchaseDate) {
        try {
          const parsedDate = new Date(asset.purchaseDate);
          if (!isNaN(parsedDate.getTime())) {
            assetResponse.purchaseDate = parsedDate.toISOString();
            console.log(`Purchase date formatted successfully: ${assetResponse.purchaseDate}`);
          } else {
            console.error(`Invalid purchase date: ${asset.purchaseDate}`);
            assetResponse.purchaseDate = null;
          }
        } catch (dateError) {
          console.error('Error formatting purchase date:', dateError);
          assetResponse.purchaseDate = null;
        }
      } else {
        assetResponse.purchaseDate = null;
        console.log('Purchase date is null in the database');
      }
      
      // Additional logging to help diagnose the issue
      if (asset.purchaseDate) {
        console.log(`Purchase date type: ${typeof asset.purchaseDate}`);
        console.log(`Purchase date raw value: ${String(asset.purchaseDate)}`);
        console.log(`Purchase date after conversion: ${new Date(asset.purchaseDate).toISOString()}`);
      } else {
        console.log('Purchase date is null or undefined in the database');
      }
      
      return res.status(200).json({ asset: assetResponse });
    } catch (error) {
      console.error('Error fetching asset:', error);
      return res.status(500).json({ error: 'Failed to fetch asset' });
    }
  }

  // Handle PUT request
  if (req.method === 'PUT') {
    try {
      const {
        name,
        description,
        type,
        status,
        floorNumber,
        roomNumber,
        purchaseAmount,
        purchaseDate,
      } = req.body;

      // Get the current asset data to compare changes
      const currentAsset = await prisma.asset.findUnique({
        where: { id: String(id) },
      });

      if (!currentAsset) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      // Update the asset
      const updatedAsset = await prisma.asset.update({
        where: {
          id: String(id),
        },
        data: {
          name,
          description,
          type,
          status,
          floorNumber,
          roomNumber,
          purchaseAmount: purchaseAmount ? Number(purchaseAmount) : null,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        },
      });

      // Create a history record for the update
      const changedFields: Record<string, { from: any; to: any }> = {};
      
      // Check which fields were changed
      if (name !== currentAsset.name) {
        changedFields.name = { from: currentAsset.name, to: name };
      }
      if (description !== currentAsset.description) {
        changedFields.description = { from: currentAsset.description, to: description };
      }
      if (type !== currentAsset.type) {
        changedFields.type = { from: currentAsset.type, to: type };
      }
      
      // Handle status change separately to create a STATUS_CHANGED history entry
      const statusChanged = status !== currentAsset.status;
      if (statusChanged) {
        changedFields.status = { from: currentAsset.status, to: status };
      }
      
      if (floorNumber !== currentAsset.floorNumber) {
        changedFields.floorNumber = { from: currentAsset.floorNumber, to: floorNumber };
      }
      if (roomNumber !== currentAsset.roomNumber) {
        changedFields.roomNumber = { from: currentAsset.roomNumber, to: roomNumber };
      }
      
      // Check purchase amount (handle null/undefined cases)
      const currentPurchaseAmount = currentAsset.purchaseAmount ? Number(currentAsset.purchaseAmount) : null;
      const newPurchaseAmount = purchaseAmount ? Number(purchaseAmount) : null;
      if (currentPurchaseAmount !== newPurchaseAmount) {
        changedFields.purchaseAmount = { from: currentPurchaseAmount, to: newPurchaseAmount };
      }
      
      // Check purchase date (handle null/undefined cases)
      const currentPurchaseDate = currentAsset.purchaseDate ? new Date(currentAsset.purchaseDate).toISOString() : null;
      const newPurchaseDate = purchaseDate ? new Date(purchaseDate).toISOString() : null;
      if (currentPurchaseDate !== newPurchaseDate) {
        changedFields.purchaseDate = { 
          from: currentPurchaseDate ? new Date(currentPurchaseDate).toISOString().split('T')[0] : null, 
          to: newPurchaseDate ? new Date(newPurchaseDate).toISOString().split('T')[0] : null 
        };
      }

      // Only create history record if there were changes
      if (Object.keys(changedFields).length > 0) {
        await prisma.assetHistory.create({
          data: {
            action: 'UPDATED',
            details: changedFields,
            asset: {
              connect: { id: String(id) },
            },
            user: {
              connect: { id: user.id },
            },
          },
        });
        
        // Create a separate STATUS_CHANGED history entry if status was changed
        if (statusChanged) {
          await prisma.assetHistory.create({
            data: {
              action: 'STATUS_CHANGED',
              details: {
                fromStatus: currentAsset.status,
                toStatus: status,
                timestamp: new Date().toISOString()
              },
              asset: {
                connect: { id: String(id) },
              },
              user: {
                connect: { id: user.id },
              },
            },
          });
          
          console.log(`Asset status changed from ${currentAsset.status} to ${status}`);
        }
        
        // Also log as user activity for the user activity tab
        // Create a direct entry in the audit log table using Prisma for better consistency
        try {
          await prisma.auditLog.create({
            data: {
              userId: user.id,
              userEmail: user.email,
              action: statusChanged ? 'ASSET_STATUS_CHANGED' : 'ASSET_UPDATED',
              resourceType: 'ASSET',
              resourceId: String(id),
              details: {
                assetId: String(id),
                assetName: name,
                changes: changedFields,
                timestamp: new Date().toISOString(),
                userId: user.id,
                userEmail: user.email,
                action: statusChanged ? `Changed asset status from ${currentAsset.status} to ${status}` : 'Updated asset properties'
              },
              type: 'USER_ACTIVITY',
              severity: statusChanged ? 'INFO' : 'INFO',
              timestamp: new Date(),
              ipAddress: req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress,
              userAgent: req.headers['user-agent']
            }
          });
          console.log('User activity log created for asset update');
        } catch (logError) {
          console.error('Error creating user activity log:', logError);
        }
      }

      return res.status(200).json(updatedAsset);
    } catch (error) {
      console.error('Error updating asset:', error);
      return res.status(500).json({ error: 'Failed to update asset' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Export the handler wrapped with audit logging middleware
export default withAuditLog(assetHandler, {
  resourceType: 'ASSET',
  logRequestBody: true,
  logResponseBody: false, // Don't log response bodies to avoid excessive log size
  type: 'USER_ACTIVITY', // Changed from DATA_MODIFICATION to USER_ACTIVITY to ensure it appears in the User Activity tab
  skipMethods: ['OPTIONS'], // Skip logging for OPTIONS requests
});