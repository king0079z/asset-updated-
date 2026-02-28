// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification } from "@/lib/audit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // POST - Switch to a different organization
  if (req.method === 'POST') {
    try {
      const { organizationId } = req.body;
      
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }
      
      // Check if the user is a member of the organization
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: user.id,
          inviteAccepted: true,
        },
      });
      
      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this organization' });
      }
      
      // Update the user's organization ID
      await prisma.user.update({
        where: { id: user.id },
        data: { organizationId },
      });
      
      // Get the organization
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });
      
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }
      
      // Get the subscription
      const subscription = await prisma.subscription.findUnique({
        where: { organizationId },
      });
      
      // Get the members
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
      
      // Create audit log
      await logDataModification(
        'ORGANIZATION',
        organizationId,
        'SWITCH',
        { organizationName: organization.name },
        {
          action: 'Organization Switch',
          userId: user.id,
          userEmail: user.email
        }
      );
      
      return res.status(200).json({
        organization,
        subscription,
        members,
      });
    } catch (error) {
      console.error('Error switching organization:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}