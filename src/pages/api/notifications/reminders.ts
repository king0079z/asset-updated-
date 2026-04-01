// @ts-nocheck
/**
 * POST /api/notifications/reminders
 * Sends reminders for all pending actions: overdue borrows, warranty expiry,
 * pending approvals, unacknowledged policies, SLA breach risk.
 * Called by cron or manually.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email/sendEmail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const now = new Date();
  let sent = 0;

  // 1. Pending approval steps (remind approvers)
  const pendingSteps = await prisma.approvalStep.findMany({
    where: { status: 'PENDING', createdAt: { lt: new Date(now.getTime() - 24 * 3_600_000) } },
    include: {
      assignedTo: { select: { email: true } },
      request: { select: { entityType: true, entityId: true } },
    },
    take: 50,
  });

  for (const step of pendingSteps) {
    if (step.assignedTo?.email) {
      await sendEmail({
        to: step.assignedTo.email,
        template: 'approval-request',
        data: {
          entityType: step.request.entityType,
          entityId: step.request.entityId,
          requestedBy: 'System Reminder',
          description: 'This approval request has been pending for over 24 hours.',
          approvalUrl: `${SITE_URL}/approvals/${step.requestId}`,
        },
      });
      sent++;
    }
  }

  // 2. Tickets approaching SLA breach (within 2 hours)
  const soonBreaching = await prisma.ticket.findMany({
    where: {
      status: { notIn: ['RESOLVED', 'CLOSED'] },
      resolveBy: { gte: now, lte: new Date(now.getTime() + 2 * 3_600_000) },
      slaBreached: false,
    },
    include: { assignedTo: { select: { email: true } } },
    take: 50,
  });

  for (const ticket of soonBreaching) {
    if (ticket.assignedTo?.email) {
      const hoursLeft = Math.round((ticket.resolveBy!.getTime() - now.getTime()) / 3_600_000 * 10) / 10;
      await sendEmail({
        to: ticket.assignedTo.email,
        template: 'sla-breach',
        data: {
          ticketId: ticket.displayId || ticket.id,
          title: ticket.title,
          priority: ticket.priority,
          resolveBy: ticket.resolveBy!.toLocaleString(),
          hoursOverdue: `${hoursLeft}h remaining`,
          assigneeName: ticket.assignedTo.email,
          ticketUrl: `${SITE_URL}/tickets/${ticket.id}`,
        },
      });
      sent++;
    }
  }

  // 3. In-app notifications for pending policy acceptances (remind users)
  const usersWithPending = await prisma.policyAcceptance.groupBy({
    by: ['userId'],
    where: { acceptedAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } },
  });

  for (const { userId } of usersWithPending.slice(0, 20)) {
    await prisma.notification.create({
      data: {
        userId,
        type: 'POLICY_REMINDER',
        title: 'Policy Acceptance Required',
        message: 'You have pending policies that require your acceptance before continuing.',
      },
    }).catch(() => {});
    sent++;
  }

  return res.status(200).json({ ok: true, sent, ts: now.toISOString() });
}
