import { isD365Configured, d365Request } from './d365Client';
import { mockPushAsset, mockPushDisposal } from './d365MockAdapter';
import prisma from '@/lib/prisma';

/** Push asset creation/update to D365 FA module */
export async function pushAssetToD365(asset: any): Promise<void> {
  if (!isD365Configured()) {
    await mockPushAsset(asset);
    return;
  }

  try {
    const payload = {
      msdyn_name: asset.name,
      msdyn_description: asset.description,
      // Map Asset AI fields → D365 Fixed Assets fields
      msdyn_assetid: asset.assetId,
      msdyn_status: mapStatusToD365(asset.status),
    };

    await d365Request('msdyn_customerassets', 'POST', payload);

    await prisma.d365SyncLog.create({
      data: {
        entityType: 'Asset',
        entityId: asset.id,
        direction: 'PUSH',
        status: 'SUCCESS',
        payload,
        syncedAt: new Date(),
        organizationId: asset.organizationId,
      },
    });
  } catch (err: any) {
    await prisma.d365SyncLog.create({
      data: {
        entityType: 'Asset',
        entityId: asset.id,
        direction: 'PUSH',
        status: 'ERROR',
        payload: { assetId: asset.id },
        errorMessage: err.message,
        organizationId: asset.organizationId,
      },
    });
  }
}

/** Push disposal notification to D365 */
export async function pushDisposalToD365(asset: any): Promise<void> {
  if (!isD365Configured()) {
    await mockPushDisposal(asset);
    return;
  }

  try {
    await d365Request(`msdyn_customerassets(${asset.assetId})`, 'PATCH', {
      msdyn_status: 'Disposed',
    });

    await prisma.d365SyncLog.create({
      data: {
        entityType: 'Disposal',
        entityId: asset.id,
        direction: 'PUSH',
        status: 'SUCCESS',
        payload: { assetId: asset.assetId, status: 'DISPOSED' },
        syncedAt: new Date(),
        organizationId: asset.organizationId,
      },
    });
  } catch (err: any) {
    await prisma.d365SyncLog.create({
      data: {
        entityType: 'Disposal',
        entityId: asset.id,
        direction: 'PUSH',
        status: 'ERROR',
        errorMessage: err.message,
        organizationId: asset.organizationId,
      },
    });
  }
}

function mapStatusToD365(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'Active',
    MAINTENANCE: 'UnderMaintenance',
    DISPOSED: 'Disposed',
    DAMAGED: 'Damaged',
    BORROWED: 'CheckedOut',
    RETURNED: 'Available',
    LOST_REPORTED: 'Lost',
  };
  return map[status] || 'Active';
}
