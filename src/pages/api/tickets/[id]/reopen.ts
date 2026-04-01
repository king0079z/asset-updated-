// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;
  const { id } = req.query;
  const { reason } = req.body;

  if (!reason || reason.trim().length < 10) {
    return res.status(400).json({ error: 'A reason of at least 10 characters is required to reopen a ticket.' });
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: id as string } });
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
    return res.status(409).json({ error: 'Only resolved or closed tickets can be reopened.' });
  }

  const updated = await prisma.ticket.update({
    where: { id: id as string },
    data: {
      status: 'REOPENED',
      slaBreached: false,
      reopenReason: reason.trim(),
      resolveBy: null,
    },
  });

  await prisma.ticketHistory.create({
    data: {
      ticketId: id as string,
      status: 'REOPENED' as any,
      comment: `Ticket reopened. Reason: ${reason.trim()}`,
      userId: user.id,
    },
  });

  // Notify assignee
  if (ticket.assignedToId) {
    await prisma.notification.create({
      data: {
        userId: ticket.assignedToId,
        ticketId: id as string,
        type: 'TICKET_REOPENED',
        title: 'Ticket Reopened',
        message: `Ticket "${ticket.title}" was reopened. Reason: ${reason.slice(0, 200)}`,
      },
    });
  }

  return res.status(200).json(updated);
}
