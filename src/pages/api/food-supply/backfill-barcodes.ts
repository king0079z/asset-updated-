// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

/**
 * POST /api/food-supply/backfill-barcodes
 * Generates barcodes for all FoodSupply records that have null or empty barcode.
 * Idempotent and safe to call multiple times.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const suppliesWithoutBarcode = await prisma.foodSupply.findMany({
      where: {
        OR: [
          { barcode: null },
          { barcode: '' },
        ],
      },
      select: { id: true },
    });

    if (suppliesWithoutBarcode.length === 0) {
      return res.status(200).json({ updated: 0, message: 'All food supplies already have barcodes' });
    }

    const used = new Set<string>();
    const generateUnique = () => {
      let barcode: string;
      do {
        const ts = Date.now().toString(36).toUpperCase();
        barcode = `SUP${ts}${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      } while (used.has(barcode));
      used.add(barcode);
      return barcode;
    };

    let updated = 0;
    for (const { id } of suppliesWithoutBarcode) {
      const barcode = generateUnique();
      await prisma.foodSupply.update({
        where: { id },
        data: { barcode },
      });
      updated++;
    }

    return res.status(200).json({ updated, total: suppliesWithoutBarcode.length });
  } catch (error) {
    console.error('[backfill-barcodes]', error);
    return res.status(500).json({ error: 'Failed to backfill barcodes' });
  }
}
