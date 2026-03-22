/**
 * /api/portal/data — single endpoint for the support portal.
 * One auth check, three parallel DB queries, one response.
 * Eliminates the 3× Supabase getSession() round-trips the portal used to make.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';
import { TicketStatus, TicketPriority } from '@prisma/client';
import { getUserRoleData } from '@/util/roleCheck';

// Server-side cache keyed by userId — 20 s TTL (short so newly-assigned tickets appear quickly)
const cache = new Map<string, { data: any; ts: number }>();
const TTL = 20_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;

  // ── 2. Server-side cache hit? ────────────────────────────────────────────
  const bypassCache = req.headers['cache-control'] === 'no-cache';
  const hit = cache.get(user.id);
  if (!bypassCache && hit && Date.now() - hit.ts < TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(hit.data);
  }

  // ── 3. Role data (cached in memory by roleCheck util) ───────────────────
  const roleData = await getUserRoleData(user.id);
  const isAdminOrManager = roleData?.role === 'ADMIN' || roleData?.role === 'MANAGER';
  const isSuperAdmin = roleData?.isAdmin === true;
  const orgId = roleData?.organizationId ?? null;

  // ── 4. Build ticket query ────────────────────────────────────────────────
  // Rule: ALWAYS include tickets where assignedToId === me (cross-org support).
  // Super-admins see everything. Admin/Manager see their org. Staff see own + assigned.
  let ticketWhere: any;
  if (isSuperAdmin) {
    ticketWhere = {}; // all tickets
  } else if (isAdminOrManager && orgId) {
    ticketWhere = {
      OR: [
        { organizationId: orgId },
        { organizationId: null },
        { assignedToId: user.id }, // cross-org assignments always visible
      ],
    };
  } else if (isAdminOrManager) {
    ticketWhere = { OR: [{ organizationId: null }, { userId: user.id }, { assignedToId: user.id }] };
  } else {
    ticketWhere = { OR: [{ userId: user.id }, { assignedToId: user.id }] };
  }

  const [rawTickets, rawNotifications] = await Promise.all([
    prisma.ticket.findMany({
      where: ticketWhere,
      select: {
        id: true, displayId: true, title: true, description: true,
        status: true, priority: true, userId: true, assignedToId: true,
        source: true, ticketType: true, category: true, subcategory: true,
        location: true, contactDetails: true,
        createdAt: true, updatedAt: true,
        assignedTo: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);

  // ── 5. Shape the response ────────────────────────────────────────────────
  const tickets = rawTickets.map(t => ({
    ...t,
    status: Object.values(TicketStatus).includes(t.status as TicketStatus) ? t.status : TicketStatus.OPEN,
    priority: Object.values(TicketPriority).includes(t.priority as TicketPriority) ? t.priority : TicketPriority.MEDIUM,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  const notifications = rawNotifications.map(n => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt?.toISOString() ?? null,
  }));

  const permissions = {
    isAdmin: roleData?.isAdmin ?? false,
    role: roleData?.role ?? null,
    pageAccess: roleData?.pageAccess ?? {},
    hasDashboardAccess: !!(roleData?.isAdmin || isAdminOrManager || (roleData?.pageAccess as any)?.['/dashboard']),
    canAccessDashboard: !!(roleData?.isAdmin || isAdminOrManager || (roleData?.pageAccess as any)?.['/dashboard']),
    isStaff: !!(roleData?.role === 'STAFF'),
  };

  const payload = { tickets, notifications, permissions };

  // Store in cache
  cache.set(user.id, { data: payload, ts: Date.now() });
  res.setHeader('X-Cache', 'MISS');
  res.setHeader('Cache-Control', 'private, max-age=20, stale-while-revalidate=10');
  return res.status(200).json(payload);
}
