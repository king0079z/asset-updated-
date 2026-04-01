// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email/sendEmail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get all parts
  const allParts = await prisma.sparePart.findMany({ take: 1000 });
  const lowStock = allParts.filter(p => p.quantity <= p.reorderLevel);

  if (lowStock.length === 0) return res.status(200).json({ ok: true, notified: 0 });

  // Find admins/managers to notify
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] } },
    select: { email: true },
    take: 10,
  });

  for (const admin of admins) {
    if (admin.email) {
      await sendEmail({
        to: admin.email,
        template: 'overdue-asset',
        data: {
          assetName: `${lowStock.length} spare part(s)`,
          assetId: 'multiple',
          dueDate: new Date().toLocaleDateString(),
          type: 'Low Stock Alert',
          url: `${SITE_URL}/spare-parts`,
        },
      });
    }
  }

  return res.status(200).json({ ok: true, lowStock: lowStock.length, notified: admins.length });
}
