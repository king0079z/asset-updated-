import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

  if (authError || !user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const { id } = req.query;

    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: String(id),
      },
    });

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    return res.status(200).json({ vehicle });
  } catch (error) {
    console.error('Error fetching vehicle details:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}