import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification, logUserActivity } from '@/lib/audit';
import { isAdminOrManager } from '@/util/roleCheck';

// Server-side cache — 60s TTL per user
const vehiclesCache = new Map<string, { data: any[]; ts: number }>();
const VEHICLES_CACHE_TTL = 60_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`[${req.method}] /api/vehicles - Request received`);
  
  try {
    const supabase = createClient(req, res);

    let user: any = null;
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError) {
        return res.status(401).json({ message: 'Unauthorized', error: authError.message });
      }
      user = session?.user ?? null;
    } catch (authException: any) {
      // getSession() can throw when the refresh token is completely invalid
      return res.status(401).json({ message: 'Unauthorized - Session error', error: authException?.message });
    }

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized - No user found' });
    }

    console.log(`User authenticated: ${user.email}`);

    switch (req.method) {
      case 'GET':
        console.log('Fetching vehicles from database');
        try {
          const userIsAdminOrManager = await isAdminOrManager(user.id);

          // Serve from cache if fresh
          const cacheKey = `${user.id}:${userIsAdminOrManager}`;
          const cached = vehiclesCache.get(cacheKey);
          if (cached && Date.now() - cached.ts < VEHICLES_CACHE_TTL) {
            res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
            return res.status(200).json({ vehicles: cached.data });
          }

          const take = 500;
          let vehicles;
          if (userIsAdminOrManager) {
            vehicles = await prisma.vehicle.findMany({ orderBy: { createdAt: 'desc' }, take });
          } else {
            vehicles = await prisma.vehicle.findMany({
              where: { rentals: { some: { userId: user.id, status: 'ACTIVE' } } },
              orderBy: { createdAt: 'desc' },
              take,
            });
          }

          vehiclesCache.set(cacheKey, { data: vehicles, ts: Date.now() });
          res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
          return res.status(200).json({ vehicles });
        } catch (dbError) {
          console.error('Database error when fetching vehicles:', dbError);
          return res.status(500).json({ message: 'Database error when fetching vehicles', error: dbError instanceof Error ? dbError.message : 'Unknown error' });
        }

      case 'POST':
        console.log('Creating new vehicle');
        const {
          make,
          model,
          year,
          licensePlate,
          rentalAmount,
          imageUrl,
        } = req.body;

        // Validate required fields
        if (!make || !model || !year || !licensePlate || !rentalAmount) {
          console.error('Missing required fields for vehicle creation');
          return res.status(400).json({ message: 'Missing required fields' });
        }

        try {
          const newVehicle = await prisma.vehicle.create({
            data: {
              name: `${make} ${model}`, // Combine make and model for name
              make,
              model,
              year: parseInt(year),
              plateNumber: licensePlate,
              rentalAmount: parseFloat(rentalAmount),
              imageUrl,
            },
          });
          
          console.log(`Vehicle created successfully with ID: ${newVehicle.id}`);
          
          // Create audit log for vehicle creation
          await logDataModification(
            'VEHICLE',
            newVehicle.id,
            'CREATE',
            {
              make,
              model,
              year: parseInt(year),
              plateNumber: licensePlate,
              rentalAmount: parseFloat(rentalAmount),
            },
            {
              action: 'Vehicle Registration',
              vehicleName: `${make} ${model}`,
              licensePlate,
              userId: user.id,
              userEmail: user.email
            }
          );
          
          // Also log as user activity for the user activity tab
          await logUserActivity(
            'VEHICLE_CREATED',
            'VEHICLE',
            {
              vehicleId: newVehicle.id,
              vehicleName: `${make} ${model}`,
              make,
              model,
              year: parseInt(year),
              plateNumber: licensePlate,
              rentalAmount: parseFloat(rentalAmount),
              timestamp: new Date().toISOString(),
              userId: user.id,
              userEmail: user.email
            },
            newVehicle.id
          );

          return res.status(201).json(newVehicle);
        } catch (createError) {
          console.error('Error creating vehicle:', createError);
          return res.status(500).json({ 
            message: 'Error creating vehicle', 
            error: createError instanceof Error ? createError.message : 'Unknown error' 
          });
        }

      default:
        console.log(`Method ${req.method} not allowed`);
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error('Vehicle API Error:', error);
    return res.status(500).json({ 
      message: 'Internal Server Error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}