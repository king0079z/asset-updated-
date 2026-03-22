/**
 * Server-only: creates Organization + Subscription + User + OrganizationMember via Prisma.
 * Use this instead of Supabase client inserts — RLS on "Organization" blocks anon inserts (42501).
 */
import prisma from '@/lib/prisma';
import { invalidateUserRoleCache } from '@/util/roleCheck';

const ADMIN_EMAIL = 'admin@example.com';

export type ProvisionedUser = {
  id: string;
  email: string;
  status: string;
  organizationId: string | null;
};

/**
 * Idempotent: returns existing user if already in DB; otherwise provisions org + user.
 */
export async function ensureUserProvisioned(
  authUserId: string,
  email: string | null | undefined,
): Promise<ProvisionedUser> {
  const emailNorm = (email ?? '').trim();

  const existing = await prisma.user.findUnique({
    where: { id: authUserId },
    select: { id: true, email: true, status: true, organizationId: true },
  });

  if (existing) {
    return existing;
  }

  const isAdminEmail = emailNorm === ADMIN_EMAIL;

  const invite = await prisma.organizationMember.findFirst({
    where: { invitedEmail: emailNorm },
    select: { organizationId: true, role: true },
  });

  let organizationId: string;
  let memberRole: string;

  if (invite) {
    organizationId = invite.organizationId;
    memberRole = invite.role ?? 'MEMBER';
  } else {
    const localPart = emailNorm.split('@')[0] || 'user';
    const orgName = `${localPart}'s Organization`;
    const slug = `${localPart}-${Math.random().toString(36).substring(2, 7)}`.toLowerCase();
    const org = await prisma.organization.create({
      data: {
        name: orgName,
        slug,
        status: 'ACTIVE',
      },
    });
    organizationId = org.id;
    memberRole = isAdminEmail ? 'OWNER' : 'MEMBER';

    await prisma.subscription.create({
      data: {
        organizationId,
        plan: 'FREE',
        isActive: true,
        maxUsers: 5,
        maxKitchens: 2,
        maxRecipes: 50,
        maxAssets: 100,
        features: {},
      },
    });
  }

  const newUser = await prisma.user.create({
    data: {
      id: authUserId,
      email: emailNorm,
      status: isAdminEmail ? 'APPROVED' : 'PENDING',
      isAdmin: isAdminEmail,
      role: isAdminEmail ? 'ADMIN' : 'STAFF',
      organizationId,
      pageAccess: isAdminEmail ? {} : null,
      canDeleteDocuments: isAdminEmail,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: { organizationId, userId: authUserId },
    },
    create: {
      organizationId,
      userId: authUserId,
      role: memberRole,
      inviteAccepted: true,
    },
    update: {
      role: memberRole,
      inviteAccepted: true,
    },
  });

  invalidateUserRoleCache(authUserId);

  return {
    id: newUser.id,
    email: newUser.email ?? emailNorm,
    status: newUser.status,
    organizationId: newUser.organizationId,
  };
}
