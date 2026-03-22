import type { Prisma } from '@prisma/client';
import { getUserRoleData, isAdminManagerOrSupervisor } from '@/util/roleCheck';

export type TicketRoleLite = {
  role: string;
  organizationId: string | null;
  isAdmin?: boolean;
} | null;

/**
 * Who may see all tickets for an organization (not only own + assigned).
 * Includes: ADMIN/MANAGER roles, legacy User.isAdmin, and supervisor-style custom roles.
 */
export async function computeTicketOrgWideAccess(userId: string): Promise<{
  roleData: Awaited<ReturnType<typeof getUserRoleData>>;
  orgWideView: boolean;
}> {
  const roleData = await getUserRoleData(userId);
  const orgWideView =
    !!roleData &&
    (roleData.isAdmin === true || (await isAdminManagerOrSupervisor(userId)));
  return { roleData, orgWideView };
}

/**
 * Same scope as GET /api/tickets.
 * - Super-admin (isAdmin === true): ALL tickets in the system, no org restriction.
 * - ADMIN/MANAGER role or supervisor custom role: org-wide tickets.
 * - Staff / everyone else: own + assigned tickets only.
 *
 * @param orgWideView — from {@link computeTicketOrgWideAccess}; when false, only own + assigned tickets.
 */
export function buildTicketListWhere(
  userId: string,
  roleData: TicketRoleLite,
  orgWideView: boolean,
): Prisma.TicketWhereInput {
  // Super-admins (isAdmin flag) can see every ticket in the system regardless of org.
  if (roleData?.isAdmin === true) {
    return {};
  }

  const orgId = roleData?.organizationId ?? null;

  if (orgWideView && orgId) {
    return {
      OR: [
        { organizationId: orgId },
        {
          AND: [{ organizationId: null }, { user: { organizationId: orgId } }],
        },
      ],
    };
  }
  if (orgWideView && !orgId) {
    return { OR: [{ organizationId: null }, { userId }] };
  }
  return { OR: [{ userId }, { assignedToId: userId }] };
}

/** Tickets raised by end users (portal, Outlook add-in, etc.) — not internal staff-only creates */
export function isUserSubmittedTicketSource(source: string | null | undefined): boolean {
  const s = (source ?? '').trim().toUpperCase();
  return s === 'PORTAL' || s === 'OUTLOOK';
}
