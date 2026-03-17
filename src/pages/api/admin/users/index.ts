import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { getUserRoleData } from '@/util/roleCheck';

// Per-status server-side cache to eliminate repeated full-table scans
const usersCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL  = 60_000; // 1 minute

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Use cached role data instead of a raw findUnique call
  const roleData = await getUserRoleData(user.id);
  if (!roleData?.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

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
    const cacheKey = `users:${status ?? 'all'}:${userId ?? ''}`;

    // Shorter cache for PENDING so new signups appear soon
    const ttl = status === 'PENDING' ? 15_000 : CACHE_TTL;
    const cached = usersCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < ttl) {
      res.setHeader('Cache-Control', status === 'PENDING' ? 'private, max-age=15' : 'private, max-age=60, stale-while-revalidate=30');
      return res.status(200).json(cached.data);
    }

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
      orderBy: { createdAt: 'desc' },
      take: 500,
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
      
      const usersWithCustomRoleNames = users.map(user => {
        if (user.customRoleId && customRoleMap[user.customRoleId]) {
          return { ...user, customRoleName: customRoleMap[user.customRoleId] };
        }
        return user;
      });
      usersCache.set(cacheKey, { data: usersWithCustomRoleNames, ts: Date.now() });
      res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
      return res.status(200).json(usersWithCustomRoleNames);
    }

    usersCache.set(cacheKey, { data: users, ts: Date.now() });
    res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
    return res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
}