import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

// Server-side cache: global, 5-min TTL (same data for all users)
let _cache: { totalConsumed: number; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (authError || !user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Return cached value if fresh
    if (_cache && Date.now() - _cache.ts < CACHE_TTL) {
      res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=60');
      return res.status(200).json({ totalConsumed: _cache.totalConsumed });
    }

    // Use a raw aggregate instead of fetching all rows then reducing in JS
    const result = await prisma.$queryRaw<[{ total: number }]>`
      SELECT COALESCE(SUM(fc.quantity * fs."pricePerUnit"), 0) AS total
      FROM "FoodConsumption" fc
      JOIN "FoodSupply" fs ON fc."foodSupplyId" = fs.id
    `;

    const totalConsumed = Number(result[0]?.total ?? 0);
    _cache = { totalConsumed, ts: Date.now() };

    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=60');
    return res.status(200).json({ totalConsumed });
  } catch (error) {
    console.error('Error getting total consumed:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
