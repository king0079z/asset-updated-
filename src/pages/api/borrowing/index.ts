// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';
import { getUserRoleData } from '@/util/roleCheck';
import { sendEmail } from '@/lib/email/sendEmail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;
  const roleData = await getUserRoleData(user.id);
  const orgId = roleData?.organizationId || null;

  if (req.method === 'GET') {
    const { status, assetId, userId: qUserId } = req.query;
    const borrows = await prisma.assetBorrow.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        ...(status ? { status: status as any } : {}),
        ...(assetId ? { assetId: assetId as string } : {}),
        ...(qUserId ? { borrowedById: qUserId as string } : {}),
      },
      include: {
        asset: { select: { id: true, name: true, assetId: true, status: true } },
        borrowedBy: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return res.status(200).json(borrows);
  }

  if (req.method === 'POST') {
    const { assetId, borrowedById, expectedReturnAt, borrowLocation, custodianName, notes } = req.body;
    if (!assetId || !borrowedById || !expectedReturnAt) {
      return res.status(400).json({ error: 'assetId, borrowedById, and expectedReturnAt are required' });
    }

    // Check asset is available
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    if (asset.status === 'BORROWED') return res.status(409).json({ error: 'Asset is already borrowed' });

    const borrow = await prisma.assetBorrow.create({
      data: {
        assetId,
        borrowedById,
        expectedReturnAt: new Date(expectedReturnAt),
        borrowLocation,
        custodianName,
        notes,
        organizationId: orgId,
        approvedById: user.id,
      },
    });

    // Update asset status
    await prisma.asset.update({ where: { id: assetId }, data: { status: 'BORROWED' } });

    // Log history
    await prisma.assetHistory.create({
      data: {
        assetId,
        action: 'ASSIGNED',
        details: { borrowId: borrow.id, borrowedById, expectedReturnAt },
        userId: user.id,
      },
    });

    // Email borrower
    const borrower = await prisma.user.findUnique({ where: { id: borrowedById }, select: { email: true } });
    if (borrower?.email) {
      await sendEmail({
        to: borrower.email,
        template: 'overdue-asset',
        data: {
          assetName: asset.name,
          assetId: asset.assetId || asset.id,
          dueDate: new Date(expectedReturnAt).toLocaleDateString(),
          type: 'Asset Borrowing',
          url: `${SITE_URL}/assets/${assetId}`,
        },
      });
    }

    return res.status(201).json(borrow);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
