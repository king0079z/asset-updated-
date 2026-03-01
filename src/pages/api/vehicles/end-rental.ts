import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

  if (authError || !user) {
    console.error('Authentication error:', authError);
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const { rentalId, notes, endDate: requestEndDate } = req.body;

    if (!rentalId) {
      return res.status(400).json({ message: 'Rental ID is required' });
    }

    console.log(`Ending rental with ID: ${rentalId}`);

    // Get the rental to update
    const rental = await prisma.vehicleRental.findUnique({
      where: {
        id: rentalId,
      },
      include: {
        vehicle: true,
      },
    });

    if (!rental) {
      console.error(`Rental not found with ID: ${rentalId}`);
      return res.status(404).json({ message: 'Rental not found' });
    }

    if (rental.status !== 'ACTIVE') {
      console.error(`Cannot end rental with status: ${rental.status}`);
      return res.status(400).json({ message: 'Only active rentals can be ended' });
    }

    // Use the provided end date if available, otherwise use current date
    let endDate: Date;
    if (requestEndDate) {
      try {
        endDate = new Date(requestEndDate);
        // Validate that the parsed date is valid
        if (isNaN(endDate.getTime())) {
          console.warn(`Invalid end date provided: ${requestEndDate}, using current date instead`);
          endDate = new Date();
        }
      } catch (dateError) {
        console.error(`Error parsing provided end date: ${requestEndDate}`, dateError);
        endDate = new Date();
      }
    } else {
      endDate = new Date();
    }
    
    console.log(`Using end date: ${endDate.toISOString()}`);
    
    
    // Calculate total cost based on daily rate and duration
    const startDate = new Date(rental.startDate);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const dailyRate = rental.dailyRate || rental.vehicle.rentalAmount;
    const totalCost = dailyRate * diffDays;
    
    console.log(`Rental duration: ${diffDays} days, Daily rate: ${dailyRate}, Total cost: ${totalCost}`);

    // Update the rental status to COMPLETED
    const updatedRental = await prisma.vehicleRental.update({
      where: {
        id: rentalId,
      },
      data: {
        status: 'COMPLETED',
        endDate: endDate,
        notes: notes || 'Rental completed',
        totalCost: totalCost
      },
    });

    // Update the vehicle status to AVAILABLE
    await prisma.vehicle.update({
      where: {
        id: rental.vehicleId,
      },
      data: {
        status: 'AVAILABLE',
      },
    });

    console.log(`Successfully ended rental for vehicle: ${rental.vehicle.name} (${rental.vehicle.plateNumber})`);

    // Log the data access
    try {
      await logDataAccess(
        'vehicle_rental',
        rentalId,
        { 
          action: 'VEHICLE_RENTAL_ENDED', 
          description: `User ended rental for vehicle ${rental.vehicle.name} (${rental.vehicle.plateNumber})`,
          userId: user.id,
          details: {
            vehicleId: rental.vehicleId,
            startDate: rental.startDate,
            endDate: endDate,
            totalCost: totalCost,
            duration: diffDays
          }
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    return res.status(200).json({ 
      rental: updatedRental,
      message: 'Rental ended successfully',
      totalCost: totalCost,
      duration: diffDays
    });
  } catch (error) {
    console.error('Error ending rental:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}