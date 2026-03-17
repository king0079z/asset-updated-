// @ts-nocheck
/**
 * Creates a User row for the current auth user if missing (server-side provisioning).
 * Ensures new signups appear in admin Pending list even when client-side createUser failed.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

const ADMIN_EMAIL = 'admin@example.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  const authUser = session?.user ?? null;

  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, email: true, status: true, organizationId: true },
    });

    if (existing) {
      return res.status(200).json({ user: existing });
    }

    const email = authUser.email ?? '';
    const isAdminEmail = email === ADMIN_EMAIL;

    // Check for existing invite (OrganizationMember with this invitedEmail)
    const invite = await prisma.organizationMember.findFirst({
      where: { invitedEmail: email },
      select: { organizationId: true, role: true },
    });

    let organizationId: string;
    let memberRole: string;

    if (invite) {
      organizationId = invite.organizationId;
      memberRole = invite.role ?? 'MEMBER';
    } else {
      // Create new organization
      const orgName = `${email.split('@')[0]}'s Organization`;
      const slug = `${email.split('@')[0]}-${Math.random().toString(36).substring(2, 7)}`.toLowerCase();
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
        id: authUser.id,
        email,
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
        organizationId_userId: { organizationId, userId: authUser.id },
      },
      create: {
        organizationId,
        userId: authUser.id,
        role: memberRole,
        inviteAccepted: true,
      },
      update: {
        role: memberRole,
        inviteAccepted: true,
      },
    });

    return res.status(201).json({ user: { id: newUser.id, email: newUser.email, status: newUser.status, organizationId: newUser.organizationId } });
  } catch (error) {
    console.error('[provision] Error:', error);
    return res.status(500).json({ error: 'Failed to provision user' });
  }
}
