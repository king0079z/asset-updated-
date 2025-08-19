import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';
import { formatRentalId } from '@/util/rental';

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
    // Get all rentals without display IDs
    const rentalsWithoutDisplayId = await prisma.vehicleRental.findMany({
      where: {
        OR: [
          { displayId: null },
          { displayId: { not: { startsWith: 'RNT-' } } }
        ]
      },
      orderBy: {
        startDate: 'asc'
      }
    });

    console.log(`Found ${rentalsWithoutDisplayId.length} rentals without proper display IDs`);

    // Update each rental with a display ID
    const updatedRentals = [];
    for (const rental of rentalsWithoutDisplayId) {
      // Generate a display ID using our utility function, but with a sequential number
      // instead of the rental ID substring for better organization
      const sequentialId = String(updatedRentals.length + 1).padStart(4, '0');
      const displayId = formatRentalId(rental.startDate, sequentialId, null);
      
      const updatedRental = await prisma.vehicleRental.update({
        where: { id: rental.id },
        data: { displayId }
      });
      
      updatedRentals.push(updatedRental);
    }

    // Log the action
    await logDataAccess(
      'vehicle_rental',
      'all',
      { 
        action: 'ADMIN_UPDATE_RENTAL_DISPLAY_IDS', 
        description: `Admin updated display IDs for ${updatedRentals.length} rentals`
      }
    );

    return res.status(200).json({ 
      message: `Successfully updated ${updatedRentals.length} rental display IDs`,
      updatedCount: updatedRentals.length
    });
  } catch (error) {
    console.error('Error updating rental display IDs:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}