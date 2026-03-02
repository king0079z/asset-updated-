import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate the user
    const supabase = createClient(req, res);
    const { data: { session }, error } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Log the action using the correct function from audit.ts
    await logDataAccess(
      'vehicle',
      'all',
      { action: 'VEHICLE_TRACKING_VIEW', description: 'User viewed vehicle tracking data' }
    );

    // Scope to caller's organization
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true }
    });
    const orgId = userRecord?.organizationId ?? null;

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

    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=10');
    return res.status(200).json({ vehicles: transformedVehicles });
  } catch (error) {
    console.error('Error fetching vehicle tracking data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}