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
    const { userId: qUserId, from, to, grouped } = req.query;

    const sessions = await prisma.handheldSession.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        ...(qUserId ? { userId: qUserId as string } : !isAdmin ? { userId: user.id } : {}),
        ...(from ? { startedAt: { gte: new Date(from as string) } } : {}),
        ...(to ? { startedAt: { lte: new Date(to as string) } } : {}),
      },
      include: {
        user: { select: { email: true, id: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 500,
    });

    const stats = {
      totalSessions: sessions.length,
      totalScans: sessions.reduce((s, x) => s + (x.scanCount || 0), 0),
      totalTickets: sessions.reduce((s, x) => s + (x.ticketsCreated || 0), 0),
      uniqueDevices: new Set(sessions.map(s => s.deviceId)).size,
      uniqueUsers: new Set(sessions.map(s => s.userId)).size,
    };

    // Build grouped-by-user structure
    const userMap: Record<string, any> = {};
    for (const s of sessions) {
      const uid = s.userId;
      if (!userMap[uid]) {
        userMap[uid] = {
          userId: uid,
          email: s.user?.email || uid,
          sessions: [],
          totalScans: 0,
          totalTickets: 0,
          totalDurationMs: 0,
          avgBatteryDrain: null,
          lastActiveAt: null,
          platform: s.platform,
        };
      }
      const u = userMap[uid];
      const durationMs = s.endedAt ? (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) : null;
      u.sessions.push({
        id: s.id,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationMs,
        scanCount: s.scanCount || 0,
        ticketsCreated: s.ticketsCreated || 0,
        deviceId: s.deviceId,
        deviceName: s.deviceName,
        platform: s.platform,
        batteryStart: s.batteryStart,
        batteryEnd: s.batteryEnd,
        batteryDrain: s.batteryDrain,
      });
      u.totalScans += s.scanCount || 0;
      u.totalTickets += s.ticketsCreated || 0;
      if (durationMs) u.totalDurationMs += durationMs;
      if (!u.lastActiveAt || new Date(s.startedAt) > new Date(u.lastActiveAt)) u.lastActiveAt = s.startedAt;
    }

    // Compute AI insights per user
    const users = Object.values(userMap).map((u: any) => {
      const completedSessions = u.sessions.filter((s: any) => s.endedAt);
      const avgDuration = completedSessions.length > 0
        ? Math.round(completedSessions.reduce((a: number, s: any) => a + (s.durationMs || 0), 0) / completedSessions.length)
        : null;
      const drainSessions = u.sessions.filter((s: any) => s.batteryDrain != null);
      const avgBatteryDrain = drainSessions.length > 0
        ? Math.round(drainSessions.reduce((a: number, s: any) => a + s.batteryDrain, 0) / drainSessions.length)
        : null;
      const scansPerHour = (avgDuration && u.totalScans > 0)
        ? Math.round((u.totalScans / u.sessions.length) / (avgDuration / 3_600_000))
        : null;
      const productivityScore = Math.min(100, Math.round(
        (u.totalScans * 2 + u.totalTickets * 5 + u.sessions.length * 1) / Math.max(1, u.sessions.length)
      ));
      return {
        ...u,
        sessionCount: u.sessions.length,
        avgDurationMs: avgDuration,
        avgBatteryDrain,
        scansPerHour,
        productivityScore,
      };
    }).sort((a: any, b: any) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());

    return res.status(200).json({ sessions, stats, users });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const { deviceId, deviceName, appVersion, platform, batteryStart } = body || {};
    const session = await prisma.handheldSession.create({
      data: {
        deviceId: deviceId || 'unknown',
        deviceName,
        userId: user.id,
        appVersion,
        platform,
        batteryStart: batteryStart != null ? Number(batteryStart) : null,
        organizationId: orgId,
        actionsLog: [],
      },
    });
    return res.status(201).json(session);
  }

  if (req.method === 'PATCH') {
    let patchBody = req.body;
    if (typeof patchBody === 'string') { try { patchBody = JSON.parse(patchBody); } catch { patchBody = {}; } }
    const { id, endedAt, scanCount, ticketsCreated, actionsLog, batteryEnd, batteryDrain } = patchBody || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const updateData: any = {};
    if (endedAt !== undefined) updateData.endedAt = new Date(endedAt);
    if (scanCount !== undefined) updateData.scanCount = scanCount;
    if (ticketsCreated !== undefined) updateData.ticketsCreated = ticketsCreated;
    if (actionsLog !== undefined) updateData.actionsLog = actionsLog;
    if (batteryEnd != null) updateData.batteryEnd = Number(batteryEnd);
    if (batteryDrain != null) updateData.batteryDrain = Number(batteryDrain);
    const session = await prisma.handheldSession.update({ where: { id }, data: updateData });
    return res.status(200).json(session);
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
