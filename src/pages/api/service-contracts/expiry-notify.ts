// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email/sendEmail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const now = new Date();
  const contracts = await prisma.serviceContract.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gte: now },
    },
    include: { asset: { select: { name: true, assetId: true, id: true } } },
    take: 500,
  });

  const expiring = contracts.filter(c => {
    const daysRemaining = Math.ceil((c.endDate.getTime() - now.getTime()) / 86_400_000);
    return daysRemaining <= (c.notifyDaysBefore || 30);
  });

  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] } },
    select: { email: true },
    take: 10,
  });

  let notified = 0;
  for (const contract of expiring) {
    const daysRemaining = Math.ceil((contract.endDate.getTime() - now.getTime()) / 86_400_000);
    for (const admin of admins) {
      if (admin.email) {
        await sendEmail({
          to: admin.email,
          template: 'warranty-expiry',
          data: {
            assetName: contract.asset?.name || contract.title,
            assetId: contract.asset?.assetId || contract.id,
            expiryDate: contract.endDate.toLocaleDateString(),
            daysRemaining,
            type: 'Service Contract',
            url: `${SITE_URL}/service-contracts`,
          },
        });
        notified++;
      }
    }
  }

  return res.status(200).json({ ok: true, expiring: expiring.length, notified });
}
