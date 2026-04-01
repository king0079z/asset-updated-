// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;
  const roleData = await getUserRoleData(user.id);
  const orgId = roleData?.organizationId || null;

  if (req.method === 'GET') {
    const { assetId } = req.query;
    const contracts = await prisma.serviceContract.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        ...(assetId ? { assetId: assetId as string } : {}),
      },
      include: {
        asset: { select: { id: true, name: true, assetId: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { endDate: 'asc' },
    });
    return res.status(200).json(contracts);
  }

  if (req.method === 'POST') {
    const { assetId, vendorId, contractNumber, title, coverageDetails, startDate, endDate, cost, autoRenew, notifyDaysBefore } = req.body;
    if (!title || !startDate || !endDate) return res.status(400).json({ error: 'title, startDate, endDate required' });
    const contract = await prisma.serviceContract.create({
      data: { assetId, vendorId, contractNumber, title, coverageDetails, startDate: new Date(startDate), endDate: new Date(endDate), cost: cost || 0, autoRenew: !!autoRenew, notifyDaysBefore: notifyDaysBefore || 30, organizationId: orgId },
    });
    return res.status(201).json(contract);
  }

  if (req.method === 'PUT') {
    const { id, ...data } = req.body;
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    const contract = await prisma.serviceContract.update({ where: { id }, data });
    return res.status(200).json(contract);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    await prisma.serviceContract.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
