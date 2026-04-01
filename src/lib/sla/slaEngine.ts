import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email/sendEmail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

/** Assign SLA resolveBy based on the matching SLAPolicy for this org/category/priority */
export async function assignSLAToTicket(params: {
  ticketId: string;
  organizationId: string | null;
  category: string | null;
  priority: string;
}): Promise<void> {
  const { ticketId, organizationId, category, priority } = params;
  if (!category) return;

  const policy = await prisma.sLAPolicy.findFirst({
    where: {
      organizationId: organizationId || null,
      category,
      priority,
    },
  }) || await prisma.sLAPolicy.findFirst({
    where: { isDefault: true, category, priority },
  });

  if (!policy) return;

  const resolveBy = new Date(Date.now() + policy.resolutionHours * 60 * 60 * 1000);

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      resolveBy,
      slaPolicyId: policy.id,
    },
  });
}

/** Check all open tickets for SLA breaches and trigger escalations. Called by cron. */
export async function checkSLABreaches(): Promise<{ breached: number; escalated: number }> {
  const now = new Date();

  // Find open tickets past resolveBy
  const breachedTickets = await prisma.ticket.findMany({
    where: {
      status: { notIn: ['RESOLVED', 'CLOSED'] },
      resolveBy: { lt: now },
      slaBreached: false,
    },
    include: {
      assignedTo: { select: { email: true, id: true } },
      user: { select: { email: true } },
      organization: { select: { id: true } },
    },
    take: 200,
  });

  let breached = 0;
  let escalated = 0;

  for (const ticket of breachedTickets) {
    // Mark as breached
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { slaBreached: true, status: 'ESCALATED', escalationLevel: 1, lastEscalatedAt: now },
    });
    breached++;

    const hoursOverdue = Math.round((now.getTime() - (ticket.resolveBy?.getTime() ?? 0)) / 3_600_000);

    // Log escalation event
    await prisma.escalationEvent.create({
      data: {
        ticketId: ticket.id,
        ruleId: await getDefaultEscalationRuleId(ticket.organizationId, 1),
        level: 1,
        notifiedUserIds: ticket.assignedTo ? [ticket.assignedTo.id] : [],
        triggeredAt: now,
      },
    });

    // Notify assignee
    if (ticket.assignedTo?.email) {
      await sendEmail({
        to: ticket.assignedTo.email,
        template: 'sla-breach',
        data: {
          ticketId: ticket.displayId || ticket.id,
          title: ticket.title,
          priority: ticket.priority,
          resolveBy: ticket.resolveBy?.toISOString(),
          hoursOverdue,
          assigneeName: ticket.assignedTo.email,
          ticketUrl: `${SITE_URL}/tickets/${ticket.id}`,
        },
      });
      escalated++;
    }
  }

  // Also process level-2 and level-3 escalations for already-breached tickets
  await processHigherEscalations(now);

  return { breached, escalated };
}

async function processHigherEscalations(now: Date): Promise<void> {
  const rules = await prisma.escalationRule.findMany({
    where: { enabled: true, level: { in: [2, 3] } },
    orderBy: { level: 'asc' },
  });

  for (const rule of rules) {
    const delayMs = rule.delayMinutes * 60 * 1000;
    const cutoff = new Date(now.getTime() - delayMs);

    const tickets = await prisma.ticket.findMany({
      where: {
        status: 'ESCALATED',
        slaBreached: true,
        escalationLevel: rule.level - 1,
        lastEscalatedAt: { lt: cutoff },
        ...(rule.organizationId ? { organizationId: rule.organizationId } : {}),
      },
      include: {
        assignedTo: { select: { email: true, id: true } },
      },
      take: 100,
    });

    for (const ticket of tickets) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { escalationLevel: rule.level, lastEscalatedAt: now },
      });

      await prisma.escalationEvent.create({
        data: {
          ticketId: ticket.id,
          ruleId: rule.id,
          level: rule.level,
          notifiedUserIds: rule.targetUserId ? [rule.targetUserId] : [],
          triggeredAt: now,
        },
      });

      const hoursOverdue = Math.round(
        (now.getTime() - (ticket.resolveBy?.getTime() ?? now.getTime())) / 3_600_000
      );

      if (rule.targetUserId) {
        const targetUser = await prisma.user.findUnique({
          where: { id: rule.targetUserId },
          select: { email: true },
        });
        if (targetUser?.email) {
          await sendEmail({
            to: targetUser.email,
            template: 'escalation-alert',
            data: {
              ticketId: ticket.displayId || ticket.id,
              title: ticket.title,
              level: rule.level,
              hoursOverdue,
              originalAssignee: ticket.assignedTo?.email,
              ticketUrl: `${SITE_URL}/tickets/${ticket.id}`,
            },
          });
        }
      }
    }
  }
}

async function getDefaultEscalationRuleId(organizationId: string | null, level: number): Promise<string> {
  const rule = await prisma.escalationRule.findFirst({
    where: { level, enabled: true, ...(organizationId ? { organizationId } : {}) },
    select: { id: true },
  });
  // Create a default rule if none exists
  if (!rule) {
    const created = await prisma.escalationRule.create({
      data: { name: `Default Level ${level}`, level, delayMinutes: level * 60, organizationId },
    });
    return created.id;
  }
  return rule.id;
}
