import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

// 60 s server-side cache per user — report history doesn't change often
type CacheEntry = { data: any[]; ts: number };
const historyCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60_000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      // Serve from cache when fresh
      const cached = historyCache.get(user.id);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
        return res.status(200).json(cached.data);
      }

      const reports = await prisma.reportHistory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      historyCache.set(user.id, { data: reports, ts: Date.now() });
      res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
      return res.status(200).json(reports);
    } 
    else if (req.method === 'POST') {
      // Create a new report history entry
      const { reportType, itemScope, specificItemId, dateRange, startDate, endDate } = req.body;

      if (!reportType) {
        return res.status(400).json({ error: 'Report type is required' });
      }

      const report = await prisma.reportHistory.create({
        data: {
          userId: user.id,
          userEmail: user.email || '',
          reportType,
          itemScope,
          specificItemId: specificItemId || null,
          dateRange,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
        },
      });
      // Invalidate cache so next GET sees the new entry
      historyCache.delete(user.id);
      return res.status(201).json(report);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error handling report history:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}