// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id: vehicleId } = req.query;
  const { userId, endDate } = req.body;

  if (!vehicleId || typeof vehicleId !== 'string') {
    return res.status(400).json({ error: 'Vehicle ID is required' });
  }
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // Verify the vehicle exists
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        rentals: {
          where: { status: 'ACTIVE' },
          orderBy: { startDate: 'desc' },
          take: 5,
        }
      }
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    if (vehicle.status === 'MAINTENANCE') {
      return res.status(400).json({ error: 'Vehicle is currently under maintenance and cannot be assigned.' });
    }
    if (vehicle.status === 'RETIRED') {
      return res.status(400).json({ error: 'Vehicle is retired and cannot be assigned.' });
    }

    // Verify the target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    });
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Cancel all existing ACTIVE rentals for this vehicle
    const cancelledCount = await prisma.vehicleRental.updateMany({
      where: { vehicleId, status: 'ACTIVE' },
      data: { status: 'CANCELLED', endDate: new Date() }
    });

    // Generate a human-readable rental display ID
    const rentalCount = await prisma.vehicleRental.count();
    const displayId = `RNT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(rentalCount + 1).padStart(4, '0')}`;

    // Create the new rental record
    const rental = await prisma.vehicleRental.create({
      data: {
        vehicleId,
        userId,
        startDate: new Date(),
        endDate: endDate ? new Date(endDate) : null,
        status: 'ACTIVE',
        displayId,
        dailyRate: vehicle.rentalAmount || null,
      }
    });

    // Update vehicle status to RENTED
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'RENTED' }
    });

    // Audit log
    await logDataModification(
      'VEHICLE_RENTAL',
      rental.id,
      'CREATE',
      { vehicleId, userId, endDate },
      {
        action: 'Vehicle Assigned',
        vehicleName: vehicle.name,
        assignedTo: targetUser.email,
        assignedBy: user.email,
      }
    );

    return res.status(200).json({
      success: true,
      rental,
      previousRentalsCancelled: cancelledCount.count,
      message: cancelledCount.count > 0
        ? `Vehicle assigned to ${targetUser.email}. ${cancelledCount.count} previous rental(s) were cancelled.`
        : `Vehicle successfully assigned to ${targetUser.email}.`
    });

  } catch (error) {
    console.error('Vehicle assign-user error:', error);
    return res.status(500).json({
      error: 'Failed to assign vehicle',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}
