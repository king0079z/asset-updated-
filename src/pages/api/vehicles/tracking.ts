import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { getUserRoleData } from '@/util/roleCheck';

// 30-second server cache — matches the polling interval so repeat polls are free
const trackingCache = new Map<string, { data: any; ts: number }>();
const TRACKING_TTL = 30_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { session }, error } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Use cached role data (5-min TTL) — avoids fresh DB query every 30s poll
    const roleData = await getUserRoleData(user.id);
    const orgId = roleData?.organizationId ?? null;

    // Serve from server cache when fresh
    const cacheKey = `tracking:${orgId ?? 'global'}`;
    const cached = trackingCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TRACKING_TTL) {
      res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=10');
      return res.status(200).json(cached.data);
    }

    // Fetch vehicles with their latest location data
    const vehicles = await prisma.vehicle.findMany({
      where: orgId ? { OR: [{ organizationId: orgId }, { organizationId: null }] } : {},
      select: {
        id: true,
        name: true,
        plateNumber: true,
        status: true,
        make: true,
        model: true,
        year: true,
        type: true,
        vehicleLocations: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: {
            latitude: true,
            longitude: true,
            timestamp: true,
          },
        },
      },
    });

    // Transform the data for the frontend
    const transformedVehicles = vehicles.map(vehicle => ({
      id: vehicle.id,
      name: vehicle.name,
      licensePlate: vehicle.plateNumber,
      plateNumber: vehicle.plateNumber,
      status: vehicle.status.toLowerCase(),
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      type: vehicle.type,
      location: vehicle.vehicleLocations?.length > 0
        ? {
            lat: vehicle.vehicleLocations[0].latitude,
            lng: vehicle.vehicleLocations[0].longitude,
            lastUpdated: vehicle.vehicleLocations[0].timestamp.toISOString(),
          }
        : undefined,
    }));

    const payload = { vehicles: transformedVehicles };
    trackingCache.set(cacheKey, { data: payload, ts: Date.now() });
    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=10');
    return res.status(200).json(payload);
  } catch (error) {
    console.error('Error fetching vehicle tracking data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}