import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';

// 30-second cache per user
const myVehicleCache = new Map<string, { data: any; ts: number }>();
const MY_VEHICLE_TTL = 30_000;

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

    // Cache hit
    const cached = myVehicleCache.get(user.id);
    if (cached && Date.now() - cached.ts < MY_VEHICLE_TTL) {
      res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=30');
      return res.status(200).json(cached.data);
    }

    // Find vehicle assigned to this user with rental and user details
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        rentals: {
          some: {
            userId: user.id,
            status: 'ACTIVE', // Only get vehicles that are currently rented by this user
          }
        },
        status: 'RENTED', // Only get vehicles that are currently rented
      },
      include: {
        rentals: {
          where: {
            userId: user.id,
            status: 'ACTIVE',
          },
          include: {
            user: true
          },
          take: 1
        }
      }
    });

    if (!vehicle) {
      return res.status(404).json({ 
        error: 'No vehicle assigned to you',
        message: 'You do not have any vehicle assigned to you currently.'
      });
    }

    // Calculate total distance from completed trips by this user on this vehicle
    // Using VehicleTrip records is more accurate than raw GPS points (per-user, pre-calculated)
    const userTrips = await prisma.vehicleTrip.findMany({
      where: {
        vehicleId: vehicle.id,
        userId: user.id,
      },
      select: { distance: true }
    });
    const totalDistance = userTrips.reduce((sum, t) => sum + (t.distance || 0), 0);

    // Log the access
    try {
      await logDataAccess(
        'vehicle',
        vehicle.id,
        { 
          action: 'VEHICLE_DETAILS_VIEW', 
          description: `Driver viewed assigned vehicle details` 
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    const payload = { vehicle, totalDistance };
    myVehicleCache.set(user.id, { data: payload, ts: Date.now() });
    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=30');
    return res.status(200).json(payload);
  } catch (error) {
    console.error('Error fetching assigned vehicle:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
