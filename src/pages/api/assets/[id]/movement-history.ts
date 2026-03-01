import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  try {
    // Verify user authentication
    const supabase = createClient(req, res);
    const { data: { user }, error } = await supabase.auth.getSession();

    if (error || !user) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get asset movements
    const movements = await prisma.assetMovement.findMany({
      where: { 
        assetId: String(id),
        asset: {
          userId: user.id
        }
      },
      orderBy: {
        movedAt: 'desc'
      },
      include: {
        asset: {
          select: {
            name: true
          }
        }
      }
    });

    if (!movements) {
  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');

      return res.status(200).json([]);
    }

    return res.status(200).json(movements);
  } catch (error) {
    console.error('Error fetching asset movement history:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch movement history', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}