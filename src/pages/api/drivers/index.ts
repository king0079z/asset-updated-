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
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const DRIVERS_TAKE = 200;
    const drivers = await prisma.user.findMany({
      where: {
        vehicles: { some: {} },
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        vehicles: { select: { id: true, vehicleId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: DRIVERS_TAKE,
    });

    const driverIds = drivers.map((d) => d.id);
    const [allTrips] = await Promise.all([
      driverIds.length
        ? prisma.vehicleTrip.findMany({
            where: { userId: { in: driverIds }, endTime: { not: null } },
            select: { userId: true, startTime: true, endTime: true, distance: true },
          })
        : Promise.resolve([]),
    ]);

    const tripsByUser = allTrips.reduce((acc, t) => {
      if (!acc[t.userId]) acc[t.userId] = [];
      acc[t.userId].push(t);
      return acc;
    }, {} as Record<string, typeof allTrips>);

    const driversWithStats = drivers.map((driver) => {
      const trips = tripsByUser[driver.id] || [];
      let totalDistance = 0;
      let totalHours = 0;
      trips.forEach((trip) => {
        totalDistance += trip.distance || 0;
        if (trip.endTime && trip.startTime) {
          totalHours += (new Date(trip.endTime).getTime() - new Date(trip.startTime).getTime()) / (1000 * 60 * 60);
        }
      });
      const uniqueVehicleIds = new Set(driver.vehicles.map((r) => r.vehicleId));
      return {
        id: driver.id,
        email: driver.email,
        createdAt: driver.createdAt,
        vehicleCount: uniqueVehicleIds.size,
        tripCount: trips.length,
        totalDistance,
        totalHours,
      };
    });

    // Log the access
    try {
      await logDataAccess(
        'user',
        user.id,
        { 
          action: 'DRIVERS_LIST_VIEW', 
          description: `User viewed the drivers list` 
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }
  res.setHeader('Cache-Control', 'private, max-age=120, stale-while-revalidate=60');


    return res.status(200).json({ 
      drivers: driversWithStats
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}