import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Only allow admins
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });

  if (!dbUser?.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admins only' });
  }

  if (req.method === 'GET') {
    try {
      const assets = await prisma.asset.findMany({
        select: {
          id: true,
          assetId: true,
          name: true,
          organizationId: true,
          userId: true,
          barcode: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'asc' }
      });
      return res.status(200).json({ assets });
    } catch (error) {
      console.error('Error fetching assets:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal Server Error' });
    }
  }

  res.setHeader('Allow', ['GET']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}