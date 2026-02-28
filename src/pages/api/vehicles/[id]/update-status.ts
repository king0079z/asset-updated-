// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const { id } = req.query;
    const { status, maintenanceCost, maintenanceReceipt } = req.body;

    if (!id || !status) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate status
    if (!['AVAILABLE', 'RENTED', 'MAINTENANCE', 'RETIRED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    // Get the vehicle
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: String(id) },
      include: { rentals: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } } }
    });

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    // If changing from MAINTENANCE to AVAILABLE, require maintenanceCost and maintenanceReceipt
    if (
      vehicle.status === 'MAINTENANCE' &&
      status === 'AVAILABLE'
    ) {
      if (
        typeof maintenanceCost !== 'number' ||
        isNaN(maintenanceCost) ||
        maintenanceCost < 0
      ) {
        return res.status(400).json({ message: 'Maintenance cost is required and must be a valid number.' });
      }
      if (!maintenanceReceipt || typeof maintenanceReceipt !== 'string') {
        return res.status(400).json({ message: 'Maintenance receipt is required.' });
      }
    }

    // Update vehicle status
    const updatedVehicle = await prisma.vehicle.update({
      where: { id: String(id) },
      data: { status }
    });

    // If changing from RENTED to another status, update the active rental to CANCELLED
    if (vehicle.status === 'RENTED' && status !== 'RENTED' && vehicle.rentals.length > 0) {
      const activeRental = vehicle.rentals[0];
      
      await prisma.vehicleRental.update({
        where: { id: activeRental.id },
        data: { status: 'CANCELLED' }
      });
    }

    // If changing from MAINTENANCE to AVAILABLE, create VehicleMaintenance record
    if (
      vehicle.status === 'MAINTENANCE' &&
      status === 'AVAILABLE' &&
      typeof maintenanceCost === 'number' &&
      maintenanceReceipt
    ) {
      await prisma.vehicleMaintenance.create({
        data: {
          vehicleId: String(id),
          userId: user.id,
          organizationId: vehicle.organizationId || null,
          maintenanceType: "General Maintenance",
          description: "Maintenance completed and vehicle returned to service.",
          maintenanceDate: new Date(),
          cost: maintenanceCost,
          vendorId: null,
          rentalId: vehicle.rentals.length > 0 ? vehicle.rentals[0].id : null,
          aiRecommendation: null,
          nextDueDate: null,
          // Store the receipt URL in description or a new field if you add one
          // For now, append to description
          description: `Maintenance completed. Receipt: ${maintenanceReceipt}`,
        }
      });
    }

    return res.status(200).json({ 
      vehicle: updatedVehicle,
      message: 'Vehicle status updated successfully' 
    });
  } catch (error) {
    console.error('Error updating vehicle status:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}