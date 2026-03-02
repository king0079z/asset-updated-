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
  const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

  if (authError || !user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, isAdmin: true },
    });
    const isAuthorizedAdmin =
      !!dbUser && (dbUser.role === 'ADMIN' || dbUser.isAdmin === true);

    if (!isAuthorizedAdmin) {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

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

    const updateOperations = rentalsWithoutDisplayId.map((rental) => {
      const stableSuffix = rental.id.slice(-4).toUpperCase();
      const displayId = formatRentalId(rental.startDate, stableSuffix, null);
      return prisma.vehicleRental.update({
        where: { id: rental.id },
        data: { displayId },
      });
    });
    const updatedRentals = await prisma.$transaction(updateOperations);

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