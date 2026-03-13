import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const roleData = await getUserRoleData(user.id);
  const isAdminOrManager = roleData?.role === 'ADMIN' || roleData?.role === 'MANAGER' || roleData?.isAdmin === true;
  const organizationId = roleData?.organizationId;

  // Build access scope
  const assetWhere: any = { id: String(id) };
  if (isAdminOrManager && organizationId) {
    assetWhere.organizationId = organizationId;
  } else {
    assetWhere.userId = user.id;
  }

  // ── GET: Return current location ──────────────────────────────────────────
  if (req.method === 'GET') {
    const asset = await prisma.asset.findFirst({
      where: assetWhere,
      select: { id: true, name: true, location: true },
    });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    return res.status(200).json({ location: asset.location });
  }

  // ── PUT: Set or update GPS location ───────────────────────────────────────
  if (req.method === 'PUT') {
    const { latitude, longitude, address } = req.body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude and longitude (numbers) are required' });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // Verify asset exists and is accessible
    const asset = await prisma.asset.findFirst({
      where: assetWhere,
      select: { id: true, name: true, location: true },
    });
    if (!asset) return res.status(404).json({ error: 'Asset not found or access denied' });

    // Upsert AssetLocation
    const location = await prisma.assetLocation.upsert({
      where: { assetId: String(id) },
      create: {
        assetId: String(id),
        latitude,
        longitude,
        address: address || null,
        source: 'manual',
      },
      update: {
        latitude,
        longitude,
        address: address !== undefined ? address : undefined,
        source: 'manual',
        updatedAt: new Date(),
      },
    });

    // Record in asset history
    await prisma.assetHistory.create({
      data: {
        assetId: String(id),
        action: 'LOCATION_UPDATED',
        userId: user.id,
        details: {
          latitude,
          longitude,
          address: address || null,
          timestamp: new Date().toISOString(),
        },
      },
    }).catch(() => { /* non-critical */ });

    return res.status(200).json({ location });
  }

  // ── DELETE: Remove GPS location ────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const asset = await prisma.asset.findFirst({
      where: assetWhere,
      select: { id: true },
    });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    await prisma.assetLocation.deleteMany({ where: { assetId: String(id) } });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
