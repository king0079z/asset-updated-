import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const { vehicleId, userId, startDate, endDate, notes } = req.body;

    if (!vehicleId || !userId || !startDate || !endDate) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if vehicle exists and is available
    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: vehicleId,
      },
    });

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    if (vehicle.status !== 'AVAILABLE') {
      return res.status(400).json({ message: 'Vehicle is not available for rental' });
    }

    // Generate display ID for the rental
    const startDateObj = new Date(startDate);
    const year = startDateObj.getFullYear();
    const month = String(startDateObj.getMonth() + 1).padStart(2, '0');
    const day = String(startDateObj.getDate()).padStart(2, '0');
    
    // Format: RNT-YYYYMMDD-XXXX
    // Get the count of rentals for today to generate a sequential number
    const todayRentals = await prisma.vehicleRental.count({
      where: {
        startDate: {
          gte: new Date(startDateObj.setHours(0, 0, 0, 0)),
          lt: new Date(startDateObj.setHours(23, 59, 59, 999)),
        },
      },
    });
    
    const displayId = `RNT-${year}${month}${day}-${String(todayRentals + 1).padStart(4, '0')}`;

    // Create the rental
    const rental = await prisma.vehicleRental.create({
      data: {
        displayId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'ACTIVE',
        vehicleId,
        userId,
        notes,
      },
    });

    // Update vehicle status to RENTED
    await prisma.vehicle.update({
      where: {
        id: vehicleId,
      },
      data: {
        status: 'RENTED',
      },
    });

    // Log the data access
    await logDataAccess(
      'vehicle_rental',
      rental.id,
      { 
        action: 'VEHICLE_RENTAL_CREATED', 
        description: `User created rental for vehicle ${vehicle.name} (${vehicle.plateNumber})`
      }
    );

    return res.status(201).json({ 
      rental,
      message: 'Vehicle rental created successfully' 
    });
  } catch (error) {
    console.error('Error creating vehicle rental:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}