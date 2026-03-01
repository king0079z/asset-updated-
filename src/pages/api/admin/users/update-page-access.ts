import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check if user is authenticated and is admin
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is admin
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true }
  });

  if (!dbUser?.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, pageAccess } = req.body;

    if (!userId || pageAccess === undefined) {
      return res.status(400).json({ error: 'User ID and pageAccess are required' });
    }

    // Update user page access
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { pageAccess },
      select: {
        id: true,
        email: true,
        pageAccess: true
      }
    });

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating user page access:', error);
    return res.status(500).json({ error: 'Failed to update user page access' });
  }
}