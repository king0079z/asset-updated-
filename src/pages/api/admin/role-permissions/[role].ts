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

  // Only allow GET method
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { role } = req.query;

    if (!role || typeof role !== 'string') {
      return res.status(400).json({ error: 'Role is required' });
    }

    // Validate role
    if (!['ADMIN', 'MANAGER', 'STAFF'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role value' });
    }

    // Get role permissions
    const rolePermission = await prisma.roleDefaultPermission.findUnique({
      where: { role: role as any }
    });

    if (!rolePermission) {
      return res.status(404).json({ error: 'Role permissions not found' });
    }

    return res.status(200).json(rolePermission);
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    return res.status(500).json({ error: 'Failed to fetch role permissions' });
  }
}