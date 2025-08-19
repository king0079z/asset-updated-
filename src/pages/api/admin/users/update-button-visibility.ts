import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check if user is authenticated and is admin
  const supabase = createClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();

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
    const { userId, buttonVisibility } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Update user's button visibility permissions
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { buttonVisibility },
      select: {
        id: true,
        email: true,
        buttonVisibility: true
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: 'UPDATE_BUTTON_VISIBILITY',
        resourceType: 'User',
        resourceId: userId,
        details: { buttonVisibility },
        status: 'SUCCESS',
        type: 'DATA_MODIFICATION',
        severity: 'INFO'
      }
    });

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating button visibility:', error);
    
    // Log the error
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: 'UPDATE_BUTTON_VISIBILITY',
        resourceType: 'User',
        resourceId: req.body.userId,
        details: { error: (error as Error).message },
        status: 'ERROR',
        type: 'DATA_MODIFICATION',
        severity: 'ERROR'
      }
    });
    
    return res.status(500).json({ error: 'Failed to update button visibility' });
  }
}