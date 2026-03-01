import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getSession();

  if (authError || !user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const { id } = req.query;

    const maintenances = await prisma.vehicleMaintenance.findMany({
      where: {
        vehicleId: String(id),
      },
      orderBy: {
        maintenanceDate: 'desc',
      },
      include: {
        vendor: true,
        user: {
          select: {
            id: true,
            email: true,
          }
        }
      }
    });

    // Map to include receipt/invoice URL if stored in description or a dedicated field in the future
    const mapped = maintenances.map(m => ({
      id: m.id,
      maintenanceType: m.maintenanceType,
      description: m.description,
      maintenanceDate: m.maintenanceDate,
      cost: m.cost,
      mileage: m.mileage,
      vendor: m.vendor ? { id: m.vendor.id, name: m.vendor.name } : null,
      user: m.user,
      receiptUrl: m.description && m.description.startsWith('http') ? m.description : null, // TEMP: if receipt is stored as URL in description
      createdAt: m.createdAt,
      nextDueDate: m.nextDueDate,
      aiRecommendation: m.aiRecommendation,
    }));

    return res.status(200).json({ maintenanceHistory: mapped });
  } catch (error) {
    console.error('Error fetching maintenance history:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}