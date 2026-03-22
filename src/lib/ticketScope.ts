import type { Prisma } from '@prisma/client';

type RoleLite = { role: string; organizationId: string | null } | null;

/**
 * Same scope as GET /api/tickets — staff see own + assigned; admin/manager see full org (+ legacy null-org fix).
 */
export function buildTicketListWhere(userId: string, roleData: RoleLite): Prisma.TicketWhereInput {
  const userIsAdminOrManager = roleData?.role === 'ADMIN' || roleData?.role === 'MANAGER';
  const orgId = roleData?.organizationId ?? null;

  let ticketWhere: Prisma.TicketWhereInput = { OR: [{ userId }, { assignedToId: userId }] };
  if (userIsAdminOrManager && orgId) {
    ticketWhere = {
      OR: [
        { organizationId: orgId },
        {
          AND: [{ organizationId: null }, { user: { organizationId: orgId } }],
        },
      ],
    };
  } else if (userIsAdminOrManager && !orgId) {
    ticketWhere = { OR: [{ organizationId: null }, { userId }] };
  }
  return ticketWhere;
}

/** Tickets raised by end users (portal, Outlook add-in, etc.) — not internal staff-only creates */
export function isUserSubmittedTicketSource(source: string | null | undefined): boolean {
  const s = (source ?? '').trim().toUpperCase();
  return s === 'PORTAL' || s === 'OUTLOOK';
}
