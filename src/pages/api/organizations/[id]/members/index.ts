import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification } from "@/lib/audit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id: organizationId } = req.query;

  if (!organizationId || typeof organizationId !== 'string') {
    return res.status(400).json({ error: 'Organization ID is required' });
  }

  // Check if the user is an admin or owner of the organization
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: user.id,
      role: { in: ['OWNER', 'ADMIN'] },
    },
  });

  // If not a direct member with admin/owner role, check if the user has admin role in the system
  // or if they have a license key with appropriate permissions
  if (!membership) {
    // Check if user is a system admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true, role: true, customRoleId: true },
    });

    // If user is a system admin, allow access
    if (dbUser?.isAdmin) {
      // Allow access for system admins
    } 
    // If user has ADMIN role, allow access
    else if (dbUser?.role === 'ADMIN') {
      // Allow access for users with ADMIN role
    }
    // If user has MANAGER role, allow access
    else if (dbUser?.role === 'MANAGER') {
      // Allow access for users with MANAGER role
    }
    // Check if user has a license key with appropriate role permissions
    else {
      // Check if the user has a license key with admin or manager role
      const licenseKeyRole = await prisma.licenseKeyRole.findFirst({
        where: {
          userId: user.id,
          role: { in: ['ADMIN', 'MANAGER'] }
        },
      });

      // If no appropriate role found, deny access
      if (!licenseKeyRole) {
        return res.status(403).json({ error: 'You do not have permission to manage members' });
      }
    }
  }

  // GET - List members of the organization
  if (req.method === 'GET') {
    try {
      const memberships = await prisma.organizationMember.findMany({
        where: { organizationId },
        include: {
          user: {
            select: { email: true },
          },
        },
      });

      const members = memberships.map(m => ({
        id: m.id,
        userId: m.userId,
        email: m.user?.email || m.invitedEmail,
        role: m.role,
        inviteAccepted: m.inviteAccepted,
      }));

      return res.status(200).json({ members });
    } catch (error) {
      console.error('Error fetching organization members:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      });
    }
  }
  
  // POST - Invite a new member to the organization
  else if (req.method === 'POST') {
    try {
      const { email, role } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      
      if (!role || !['OWNER', 'ADMIN', 'MEMBER'].includes(role)) {
        return res.status(400).json({ error: 'Valid role is required (OWNER, ADMIN, or MEMBER)' });
      }
      
      // Check if the organization has reached its user limit
      const subscription = await prisma.subscription.findUnique({
        where: { organizationId },
      });
      
      const memberCount = await prisma.organizationMember.count({
        where: { organizationId },
      });
      
      if (subscription && memberCount >= subscription.maxUsers) {
        return res.status(403).json({ 
          error: 'Organization has reached its user limit. Please upgrade your subscription.' 
        });
      }
      
      // Check if the user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });
      
      // Check if the user is already a member
      const existingMember = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          OR: [
            { userId: existingUser?.id },
            { invitedEmail: email },
          ],
        },
      });
      
      if (existingMember) {
        return res.status(400).json({ error: 'User is already a member or has a pending invitation' });
      }
      
      // Create the member
      const member = await prisma.organizationMember.create({
        data: {
          organizationId,
          userId: existingUser?.id || null,
          invitedEmail: existingUser ? null : email,
          role,
          inviteAccepted: !!existingUser,
        },
      });
      
      // If the user exists, update their organization ID
      if (existingUser) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { organizationId },
        });
      } else {
        // TODO: Send invitation email
        console.log(`Invitation email would be sent to ${email}`);
      }
      
      // Create audit log
      await logDataModification(
        'ORGANIZATION_MEMBER',
        member.id,
        'CREATE',
        { email, role },
        {
          action: 'Member Invitation',
          userId: user.id,
          userEmail: user.email
        }
      );
      
      return res.status(201).json({
        member: {
          id: member.id,
          userId: member.userId,
          email,
          role: member.role,
          inviteAccepted: member.inviteAccepted,
        },
      });
    } catch (error) {
      console.error('Error inviting member:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}