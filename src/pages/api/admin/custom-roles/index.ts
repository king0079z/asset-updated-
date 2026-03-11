import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { getUserRoleData } from '@/util/roleCheck';

// 5-minute server-side cache (roles rarely change)
const rolesCache = new Map<string, { data: any; ts: number }>();
const ROLES_TTL  = 5 * 60_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Use cached role data instead of raw prisma.user.findUnique
  const roleData = await getUserRoleData(user.id);
  if (!roleData?.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  // Handle GET request - Get all custom roles
  if (req.method === 'GET') {
    try {
      const cached = rolesCache.get('all');
      if (cached && Date.now() - cached.ts < ROLES_TTL) {
        res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=60');
        return res.status(200).json(cached.data);
      }

      const customRoles = await prisma.customRole.findMany({
        orderBy: { name: 'asc' }
      });
      rolesCache.set('all', { data: customRoles, ts: Date.now() });
      res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=60');
      return res.status(200).json(customRoles);
    } catch (error) {
      console.error('Error fetching custom roles:', error);
      return res.status(500).json({ error: 'Failed to fetch custom roles' });
    }
  }

  // Handle POST request - Create a new custom role
  if (req.method === 'POST') {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Role name is required' });
      }

      // Check if role name already exists
      const existingRole = await prisma.customRole.findUnique({
        where: { name }
      });

      if (existingRole) {
        return res.status(400).json({ error: 'A role with this name already exists' });
      }

      // Create new custom role
      const newRole = await prisma.customRole.create({
        data: {
          name,
          description: description || null
        }
      });

      return res.status(201).json(newRole);
    } catch (error) {
      console.error('Error creating custom role:', error);
      return res.status(500).json({ error: 'Failed to create custom role' });
    }
  }

  // Handle DELETE request - Delete a custom role
  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Role ID is required' });
      }

      // Check if role permissions exist for this role
      const rolePermissions = await prisma.roleDefaultPermission.findUnique({
        where: { customRoleId: id }
      });

      // Delete role permissions if they exist
      if (rolePermissions) {
        await prisma.roleDefaultPermission.delete({
          where: { customRoleId: id }
        });
      }

      // Delete the custom role
      await prisma.customRole.delete({
        where: { id }
      });

      return res.status(200).json({ message: 'Custom role deleted successfully' });
    } catch (error) {
      console.error('Error deleting custom role:', error);
      return res.status(500).json({ error: 'Failed to delete custom role' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}