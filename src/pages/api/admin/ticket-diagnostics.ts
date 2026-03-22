/**
 * GET /api/admin/ticket-diagnostics?email=king0079z@hotmail.com
 *
 * Returns a JSON summary that shows:
 *  - The user record + which org they belong to
 *  - Their most recent 20 tickets + each ticket's organizationId
 *  - The admin's org (the session user) for easy comparison
 *
 * Only accessible by isAdmin users.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/util/supabase/require-auth';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const auth = await requireAuth(req, res);
  if (!auth) return;

  const viewerRole = await getUserRoleData(auth.user.id);
  if (!viewerRole?.isAdmin) {
    return res.status(403).json({ error: 'Admin only' });
  }

  const { email } = req.query;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Pass ?email=<user email> as query param' });
  }

  const targetUser = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: 'insensitive' } },
    select: {
      id: true,
      email: true,
      status: true,
      role: true,
      isAdmin: true,
      organizationId: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!targetUser) {
    return res.status(404).json({ error: `No user found with email: ${email}` });
  }

  const tickets = await prisma.ticket.findMany({
    where: { userId: targetUser.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      displayId: true,
      title: true,
      status: true,
      priority: true,
      source: true,
      organizationId: true,
      createdAt: true,
      organization: { select: { id: true, name: true } },
    },
  });

  const viewerOrg = await prisma.organization.findUnique({
    where: { id: viewerRole.organizationId ?? '__none__' },
    select: { id: true, name: true },
  }).catch(() => null);

  return res.status(200).json({
    viewer: {
      id: auth.user.id,
      email: viewerRole.email,
      role: viewerRole.role,
      isAdmin: viewerRole.isAdmin,
      organizationId: viewerRole.organizationId,
      organizationName: viewerOrg?.name ?? null,
    },
    targetUser: {
      ...targetUser,
      organizationName: targetUser.organization?.name ?? null,
    },
    orgMismatch: viewerRole.organizationId !== targetUser.organizationId,
    sameOrg: viewerRole.organizationId === targetUser.organizationId,
    tickets: tickets.map(t => ({
      id: t.id,
      displayId: t.displayId,
      title: t.title,
      status: t.status,
      priority: t.priority,
      source: t.source,
      organizationId: t.organizationId,
      organizationName: t.organization?.name ?? null,
      ticketOrgMatchesViewer: t.organizationId === viewerRole.organizationId,
      createdAt: t.createdAt,
    })),
  });
}
