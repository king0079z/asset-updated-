import prisma from '@/lib/prisma';

export async function mockPushAsset(asset: any, direction: 'PUSH' | 'PULL' = 'PUSH'): Promise<void> {
  await prisma.d365SyncLog.create({
    data: {
      entityType: 'Asset',
      entityId: asset.id,
      direction,
      status: 'SUCCESS',
      payload: {
        assetId: asset.assetId,
        name: asset.name,
        status: asset.status,
        type: asset.type,
        purchaseAmount: asset.purchaseAmount,
        purchaseDate: asset.purchaseDate,
      },
      responseData: { mock: true, message: 'Mock sync — configure D365 credentials to enable real sync' },
      syncedAt: new Date(),
      organizationId: asset.organizationId,
    },
  });
}

export async function mockPushDisposal(asset: any): Promise<void> {
  await prisma.d365SyncLog.create({
    data: {
      entityType: 'Disposal',
      entityId: asset.id,
      direction: 'PUSH',
      status: 'SUCCESS',
      payload: {
        assetId: asset.assetId,
        name: asset.name,
        disposedAt: asset.disposedAt,
        status: asset.status,
      },
      responseData: { mock: true, message: 'Mock disposal sync' },
      syncedAt: new Date(),
      organizationId: asset.organizationId,
    },
  });
}
