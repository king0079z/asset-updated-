import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Only allow admins
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });

  if (!dbUser?.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admins only' });
  }

  if (req.method === 'POST') {
    const { userId, organizationId, role } = req.body;

    if (!userId || !organizationId || !role) {
      return res.status(400).json({ error: 'userId, organizationId, and role are required' });
    }

    try {
      // Check if the membership already exists
      const existing = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          }
        }
      });

      let member;
      if (existing) {
        // Update role if needed
        member = await prisma.organizationMember.update({
          where: {
            organizationId_userId: {
              organizationId,
              userId,
            }
          },
          data: {
            role,
            inviteAccepted: true,
          }
        });
      } else {
        // Create new membership
        member = await prisma.organizationMember.create({
          data: {
            organizationId,
            userId,
            role,
            inviteAccepted: true,
          }
        });
      }

      // Optionally, update the user's primary organizationId if not set
      await prisma.user.update({
        where: { id: userId },
        data: { organizationId },
      });

      return res.status(200).json({ member });
    } catch (error) {
      console.error('Error assigning user to organization:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal Server Error' });
    }
  }

  res.setHeader('Allow', ['POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}