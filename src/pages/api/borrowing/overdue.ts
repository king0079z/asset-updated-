// @ts-nocheck
/**
 * GET /api/borrowing/overdue — returns overdue borrows
 * Also serves as cron endpoint to send overdue notifications (called by Vercel Cron hourly)
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email/sendEmail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const now = new Date();

  const overdueBorrows = await prisma.assetBorrow.findMany({
    where: {
      status: 'BORROWED',
      expectedReturnAt: { lt: now },
    },
    include: {
      asset: { select: { name: true, assetId: true, id: true } },
      borrowedBy: { select: { email: true } },
    },
    take: 200,
  });

  // Mark as overdue
  if (overdueBorrows.length > 0) {
    await prisma.assetBorrow.updateMany({
      where: { id: { in: overdueBorrows.map(b => b.id) } },
      data: { status: 'OVERDUE' },
    });
  }

  // Send notifications if this is the cron call
  if (req.method === 'POST' || req.headers['x-cron'] === '1') {
    for (const borrow of overdueBorrows) {
      if (borrow.borrowedBy?.email) {
        const daysOverdue = Math.ceil((now.getTime() - borrow.expectedReturnAt.getTime()) / 86_400_000);
        await sendEmail({
          to: borrow.borrowedBy.email,
          template: 'borrow-overdue',
          data: {
            assetName: borrow.asset.name,
            assetId: borrow.asset.assetId || borrow.asset.id,
            borrowedAt: borrow.borrowedAt.toLocaleDateString(),
            expectedReturnAt: borrow.expectedReturnAt.toLocaleDateString(),
            daysOverdue,
            borrowerName: borrow.borrowedBy.email,
            url: `${SITE_URL}/borrowing/${borrow.id}`,
          },
        });
      }
    }
  }

  return res.status(200).json({ overdue: overdueBorrows.length, items: overdueBorrows });
}
