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

  const { userId, canDeleteDocuments } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (typeof canDeleteDocuments !== 'boolean') {
    return res.status(400).json({ error: 'canDeleteDocuments must be a boolean value' });
  }

  try {
    // Update user's document delete permission
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { canDeleteDocuments },
      select: {
        id: true,
        email: true,
        canDeleteDocuments: true
      }
    });

    // Log the action in audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: 'UPDATE_USER_PERMISSIONS',
        resourceType: 'USER',
        resourceId: userId,
        details: { permission: 'canDeleteDocuments' },
        changes: { canDeleteDocuments },
        type: 'DATA_MODIFICATION'
      }
    });

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating document delete permission:', error);
    return res.status(500).json({ error: 'Failed to update document delete permission' });
  }
}