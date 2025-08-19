import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';
import { isAdminOrManager } from '@/util/roleCheck';

interface VehicleRentalWithUser {
  id: string;
  displayId?: string | null;
  startDate: Date;
  endDate?: Date | null;
  status: string;
  vehicleId: string;
  userId: string;
  notes?: string | null;
  dailyRate?: number | null;
  totalCost?: number | null;
  createdAt: Date;
  updatedAt: Date;
  vehicle: {
    id: string;
    name: string;
    make?: string | null;
    model: string;
    year: number;
    plateNumber: string;
    status: string;
    type: string;
    color?: string | null;
    rentalAmount: number;
    imageUrl?: string | null;
  };
  user: {
    id: string;
    email: string;
  };
  userName?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Authentication error:', authError);
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    console.log('Fetching vehicle rentals data');
    
    // Check if user is admin or manager
    const userIsAdminOrManager = await isAdminOrManager(user.id);
    console.log(`User role check: isAdminOrManager=${userIsAdminOrManager}`);
    
    // Get rentals based on user role
    const rentals = await prisma.vehicleRental.findMany({
      where: {
        status: 'ACTIVE',
        // For regular users, only show their own rentals
        ...(userIsAdminOrManager ? {} : { userId: user.id })
      },
      include: {
        vehicle: true,
        user: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: {
        startDate: 'desc',
      },
    });
    
    console.log(`Retrieved ${rentals.length} active rentals`);
    
    // Transform the data to include userName from email
    const rentalsWithUserNames = rentals.map(rental => {
      const userName = rental.user?.email ? rental.user.email.split('@')[0] : 'Unknown User';
      
      // Format dates to ISO strings for consistent handling
      const formattedRental = {
        ...rental,
        userName,
        startDate: rental.startDate,
        endDate: rental.endDate,
        // Ensure dailyRate is populated from vehicle.rentalAmount if not set
        dailyRate: rental.dailyRate || rental.vehicle.rentalAmount
      };
      
      return formattedRental;
    });

    // Log the data access
    try {
      await logDataAccess(
        'vehicle_rental',
        'all',
        { 
          action: 'VEHICLE_RENTALS_VIEW', 
          description: `User viewed all vehicle rentals`,
          userId: user.id
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    return res.status(200).json({ 
      rentals: rentalsWithUserNames,
      message: 'Vehicle rentals retrieved successfully',
      count: rentalsWithUserNames.length
    });
  } catch (error) {
    console.error('Error retrieving vehicle rentals:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}