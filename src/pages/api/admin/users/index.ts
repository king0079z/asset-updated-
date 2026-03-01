import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check if user is authenticated and is admin
  const supabase = createClient(req, res);
  const { data: { user } } = await supabase.auth.getSession();

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

  // Handle different HTTP methods
  switch (req.method) {
    case 'GET':
      return getUsers(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getUsers(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { status, userId } = req.query;
    
    // Build the where clause based on query parameters
    const where: any = {};
    if (status && typeof status === 'string') {
      where.status = status.toUpperCase();
    }
    if (userId && typeof userId === 'string') {
      where.id = userId;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        status: true,
        isAdmin: true,
        role: true,
        customRoleId: true,
        pageAccess: true,
        canDeleteDocuments: true,
        buttonVisibility: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch custom role names for users with customRoleId
    const usersWithCustomRoleIds = users.filter(user => user.customRoleId);
    
    if (usersWithCustomRoleIds.length > 0) {
      // Get all unique custom role IDs
      const customRoleIds = [...new Set(usersWithCustomRoleIds.map(user => user.customRoleId))];
      
      // Fetch all custom roles in one query
      const customRoles = await prisma.customRole.findMany({
        where: {
          id: {
            in: customRoleIds as string[]
          }
        },
        select: {
          id: true,
          name: true
        }
      });
      
      // Create a map of custom role IDs to names
      const customRoleMap = customRoles.reduce((map: Record<string, string>, role) => {
        map[role.id] = role.name;
        return map;
      }, {});
      
      // Add custom role names to users
      const usersWithCustomRoleNames = users.map(user => {
        if (user.customRoleId && customRoleMap[user.customRoleId]) {
          return {
            ...user,
            customRoleName: customRoleMap[user.customRoleId]
          };
        }
        return user;
      });
      
      return res.status(200).json(usersWithCustomRoleNames);
    }

    return res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
}