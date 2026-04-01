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
  const isAdmin = roleData?.isAdmin || roleData?.role === 'ADMIN' || roleData?.role === 'MANAGER';

  if (req.method === 'GET') {
    const { userId: qUserId, from, to } = req.query;

    const sessions = await prisma.handheldSession.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        ...(qUserId ? { userId: qUserId as string } : !isAdmin ? { userId: user.id } : {}),
        ...(from ? { startedAt: { gte: new Date(from as string) } } : {}),
        ...(to ? { startedAt: { lte: new Date(to as string) } } : {}),
      },
      include: { user: { select: { email: true } } },
      orderBy: { startedAt: 'desc' },
      take: 200,
    });

    const stats = {
      totalSessions: sessions.length,
      totalScans: sessions.reduce((s, x) => s + (x.scanCount || 0), 0),
      totalTickets: sessions.reduce((s, x) => s + (x.ticketsCreated || 0), 0),
      uniqueDevices: new Set(sessions.map(s => s.deviceId)).size,
    };

    return res.status(200).json({ sessions, stats });
  }

  if (req.method === 'POST') {
    const { deviceId, deviceName, appVersion, platform } = req.body;
    const session = await prisma.handheldSession.create({
      data: {
        deviceId: deviceId || 'unknown',
        deviceName,
        userId: user.id,
        appVersion,
        platform,
        organizationId: orgId,
        actionsLog: [],
      },
    });
    return res.status(201).json(session);
  }

  if (req.method === 'PATCH') {
    const { id, endedAt, scanCount, ticketsCreated, actionsLog } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const session = await prisma.handheldSession.update({
      where: { id },
      data: {
        endedAt: endedAt ? new Date(endedAt) : new Date(),
        scanCount,
        ticketsCreated,
        actionsLog,
      },
    });
    return res.status(200).json(session);
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
