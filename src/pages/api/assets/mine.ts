/**
 * GET /api/assets/mine
 * Returns assets assigned to the currently authenticated user.
 * Supports both cookie sessions AND Bearer token (for Outlook add-in).
 */
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/util/supabase/require-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;

  try {
    const assets = await prisma.asset.findMany({
      where: { assignedToId: user.id },
      select: {
        id: true,
        assetId: true,
        name: true,
        type: true,
        status: true,
        imageUrl: true,
        floorNumber: true,
        roomNumber: true,
        purchaseAmount: true,
        purchaseDate: true,
        barcode: true,
        createdAt: true,
        lastMovedAt: true,
        assignedToName: true,
        assignedToEmail: true,
        assignedToId: true,
        assignedAt: true,
        vendor: { select: { name: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
    return res.status(200).json({ assets });
  } catch (err) {
    console.error('[/api/assets/mine] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
