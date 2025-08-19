import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Get the user from Supabase auth
  const supabase = createClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      // Get report history
      const reports = await prisma.reportHistory.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

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

      return res.status(201).json(report);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error handling report history:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}