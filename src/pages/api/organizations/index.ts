import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification } from "@/lib/audit";
import { slugify } from '@/util/string';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // GET - List organizations the user belongs to
  if (req.method === 'GET') {
    try {
      // Get organizations where user is a member
      const memberships = await prisma.organizationMember.findMany({
        where: {
          userId: user.id,
        },
        include: {
          organization: true,
        },
      });

      const organizations = memberships.map(membership => membership.organization);

      return res.status(200).json({ organizations });
    } catch (error) {
      console.error('Error fetching organizations:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      });
    }
  }
  
  // POST - Create a new organization
  else if (req.method === 'POST') {
    try {
      const { name, userId } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Organization name is required' });
      }
      
      // If userId is provided, check if the current user is an admin
      let targetUserId = user.id;
      let targetUserEmail = user.email;
      
      if (userId && userId !== user.id) {
        // Check if current user is an admin
        const adminUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { isAdmin: true },
        });
        
        if (!adminUser?.isAdmin) {
          return res.status(403).json({ error: 'Only administrators can create organizations for other users' });
        }
        
        // Get the target user
        const targetUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true },
        });
        
        if (!targetUser) {
          return res.status(404).json({ error: 'Target user not found' });
        }
        
        targetUserId = targetUser.id;
        targetUserEmail = targetUser.email;
      }
      
      // Generate a slug from the name
      let slug = slugify(name);
      
      // Check if slug already exists
      const existingOrg = await prisma.organization.findUnique({
        where: { slug },
      });
      
      // If slug exists, append a random string
      if (existingOrg) {
        const randomStr = Math.random().toString(36).substring(2, 7);
        slug = `${slug}-${randomStr}`;
      }
      
      // Create the organization
      const organization = await prisma.organization.create({
        data: {
          name,
          slug,
          status: 'ACTIVE',
        },
      });
      
      // Create a free subscription for the organization
      const subscription = await prisma.subscription.create({
        data: {
          organizationId: organization.id,
          plan: 'FREE',
          isActive: true,
          maxUsers: 5,
          maxKitchens: 2,
          maxRecipes: 50,
          maxAssets: 100,
          features: {},
        },
      });
      
      // Add the target user as an owner of the organization
      const member = await prisma.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: targetUserId,
          role: 'OWNER',
          inviteAccepted: true,
        },
      });
      
      // Update the target user's organization ID
      await prisma.user.update({
        where: { id: targetUserId },
        data: { organizationId: organization.id },
      });
      
      // Create audit log
      await logDataModification(
        'ORGANIZATION',
        organization.id,
        'CREATE',
        { 
          organizationName: name,
          createdForUserId: targetUserId !== user.id ? targetUserId : undefined
        },
        {
          action: 'Organization Creation',
          userId: user.id,
          userEmail: user.email
        }
      );
      
      return res.status(201).json({
        organization,
        subscription,
        members: [{
          id: member.id,
          userId: user.id,
          email: user.email,
          role: member.role,
          inviteAccepted: true,
        }],
      });
    } catch (error) {
      console.error('Error creating organization:', error);
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