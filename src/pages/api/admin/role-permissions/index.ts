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

  // Handle GET request - Get all role default permissions
  if (req.method === 'GET') {
    try {
      const rolePermissions = await prisma.roleDefaultPermission.findMany();
      
      // Get custom roles to include their names
      const customRoles = await prisma.customRole.findMany();
      const customRolesMap = customRoles.reduce((acc, role) => {
        acc[role.id] = role;
        return acc;
      }, {} as Record<string, any>);
      
      // Enhance response with custom role information
      const enhancedPermissions = rolePermissions.map(permission => {
        if (permission.customRoleId && customRolesMap[permission.customRoleId]) {
          return {
            ...permission,
            customRoleName: customRolesMap[permission.customRoleId].name,
            isCustomRole: true
          };
        }
        return {
          ...permission,
          isCustomRole: false
        };
      });
      
      return res.status(200).json(enhancedPermissions);
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      return res.status(500).json({ error: 'Failed to fetch role permissions' });
    }
  }

  // Handle POST request - Create or update role default permissions
  if (req.method === 'POST') {
    try {
      const { role, customRoleId, pageAccess, canDeleteDocuments, buttonVisibility } = req.body;

      if ((!role && !customRoleId) || pageAccess === undefined) {
        return res.status(400).json({ error: 'Role (standard or custom) and pageAccess are required' });
      }

      let whereClause: any = {};
      let createData: any = {
        pageAccess,
        canDeleteDocuments: canDeleteDocuments || false,
        buttonVisibility: buttonVisibility || {}
      };

      // Handle standard role
      if (role) {
        // Validate standard role
        if (!['ADMIN', 'MANAGER', 'STAFF'].includes(role)) {
          return res.status(400).json({ error: 'Invalid role value' });
        }
        
        whereClause.role = role;
        createData.role = role;
      } 
      // Handle custom role
      else if (customRoleId) {
        // Verify custom role exists
        const customRole = await prisma.customRole.findUnique({
          where: { id: customRoleId }
        });
        
        if (!customRole) {
          return res.status(400).json({ error: 'Custom role not found' });
        }
        
        whereClause.customRoleId = customRoleId;
        createData.customRoleId = customRoleId;
        createData.customRoleName = customRole.name;
      }

      // Check if role permissions already exist
      const existingPermission = await prisma.roleDefaultPermission.findFirst({
        where: whereClause
      });

      let rolePermission;

      if (existingPermission) {
        // Update existing permissions
        rolePermission = await prisma.roleDefaultPermission.update({
          where: { id: existingPermission.id },
          data: {
            pageAccess,
            canDeleteDocuments: canDeleteDocuments || false,
            buttonVisibility: buttonVisibility || {},
            updatedAt: new Date()
          }
        });
      } else {
        // Create new permissions
        rolePermission = await prisma.roleDefaultPermission.create({
          data: createData
        });
      }

      return res.status(200).json(rolePermission);
    } catch (error) {
      console.error('Error updating role permissions:', error);
      return res.status(500).json({ error: 'Failed to update role permissions' });
    }
  }

  // Handle DELETE request - Delete role default permissions
  if (req.method === 'DELETE') {
    try {
      const { role, customRoleId } = req.body;

      if (!role && !customRoleId) {
        return res.status(400).json({ error: 'Role or customRoleId is required' });
      }

      let whereClause: any = {};
      
      if (role) {
        whereClause.role = role;
      } else if (customRoleId) {
        whereClause.customRoleId = customRoleId;
      }

      // Delete role permissions
      await prisma.roleDefaultPermission.deleteMany({
        where: whereClause
      });

      return res.status(200).json({ message: 'Role permissions deleted successfully' });
    } catch (error) {
      console.error('Error deleting role permissions:', error);
      return res.status(500).json({ error: 'Failed to delete role permissions' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}