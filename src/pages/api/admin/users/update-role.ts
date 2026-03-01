import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`[update-role] Starting request processing: ${new Date().toISOString()}`);
  // Check if user is authenticated and is admin
  const supabase = createClient(req, res);
  const { data: { user } } = await supabase.auth.getSession();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is admin
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true, role: true }
  });

  if (!dbUser?.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, role, customRoleId } = req.body;

    if (!userId || (!role && !customRoleId)) {
      return res.status(400).json({ error: 'User ID and either role or customRoleId are required' });
    }

    // Get the current user data to preserve existing permissions and status
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        pageAccess: true,
        buttonVisibility: true,
        canDeleteDocuments: true,
        status: true,
        email: true
      }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`[update-role] Processing role change for user ${userId} (${currentUser.email})`);
    console.log(`[update-role] Current user status: ${currentUser.status}`);

    // Prepare update data
    const updateData: any = {};
    
    // Handle standard roles
    if (role) {
      // Validate standard role
      if (!['ADMIN', 'MANAGER', 'STAFF'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role value' });
      }
      
      updateData.role = role;
      updateData.isAdmin = role === 'ADMIN'; // Set isAdmin to true only for ADMIN role
      updateData.customRoleId = null; // Clear any custom role when setting a standard role
      
      // Get default permissions for the selected standard role
      try {
        const defaultPermissions = await prisma.roleDefaultPermission.findUnique({
          where: { role: role as any }
        });
        
        if (defaultPermissions) {
          console.log(`Found default permissions for role ${role}`);
          // Replace existing permissions with default permissions for this role
          // This ensures the user gets exactly the permissions defined for this role
          updateData.pageAccess = defaultPermissions.pageAccess;
          updateData.canDeleteDocuments = defaultPermissions.canDeleteDocuments;
          updateData.buttonVisibility = defaultPermissions.buttonVisibility || {};
          
          console.log(`Applied default permissions for role ${role}:`, JSON.stringify({
            pageAccess: Object.keys(defaultPermissions.pageAccess || {}).length,
            canDeleteDocuments: defaultPermissions.canDeleteDocuments,
            buttonVisibility: Object.keys(defaultPermissions.buttonVisibility || {}).length
          }));
        } else if (role === 'ADMIN') {
          // For admin role, grant all permissions by default
          const availablePages = [
            '/dashboard', '/assets', '/asset-location', '/food-supply', 
            '/food-supply/barcodes', '/tickets', '/tickets/dashboard', 
            '/tickets/kanban', '/vehicles', '/vehicles/rentals', 
            '/vehicle-tracking', '/vehicle-tracking/movement-analysis', 
            '/my-vehicle', '/planner', '/staff-activity', '/ai-analysis', 
            '/settings', '/settings/compliance'
          ];
          
          // Create a pageAccess object with all pages enabled
          const fullPageAccess: Record<string, boolean> = {};
          availablePages.forEach(page => {
            fullPageAccess[page] = true;
          });
          
          // Create a buttonVisibility object with all buttons enabled
          const fullButtonVisibility: Record<string, boolean> = {
            'dispose_asset': true,
            'edit_food_supply': true,
            'assets_button': true
          };
          
          updateData.pageAccess = fullPageAccess;
          updateData.canDeleteDocuments = true;
          updateData.buttonVisibility = fullButtonVisibility;
          
          console.log('Applied full permissions for ADMIN role');
        } else {
          // If no default permissions are found for this role, set minimal permissions
          console.log(`No default permissions found for role ${role}, setting minimal permissions`);
          updateData.pageAccess = { '/dashboard': true };
          updateData.canDeleteDocuments = false;
          updateData.buttonVisibility = {};
        }
      } catch (error) {
        console.error('Error fetching default permissions for standard role:', error);
        // Continue even if default permissions can't be fetched
      }
    }
    // Handle custom roles
    else if (customRoleId) {
      // Get the custom role and its permissions
      try {
        // First, get the custom role to verify it exists
        const customRole = await prisma.customRole.findUnique({
          where: { id: customRoleId }
        });
        
        if (!customRole) {
          return res.status(404).json({ error: 'Custom role not found' });
        }
        
        // Then get the permissions for this custom role
        const rolePermissions = await prisma.roleDefaultPermission.findUnique({
          where: { customRoleId: customRoleId }
        });
        
        if (rolePermissions) {
          console.log(`Found permissions for custom role ${customRole.name} (${customRoleId})`);
          // Replace existing permissions with the custom role's default permissions
          // This ensures the user gets exactly the permissions defined for this custom role
          updateData.pageAccess = rolePermissions.pageAccess;
          updateData.canDeleteDocuments = rolePermissions.canDeleteDocuments;
          updateData.buttonVisibility = rolePermissions.buttonVisibility || {};
          
          console.log(`Applied permissions for custom role ${customRole.name}:`, JSON.stringify({
            pageAccess: Object.keys(rolePermissions.pageAccess || {}).length,
            canDeleteDocuments: rolePermissions.canDeleteDocuments,
            buttonVisibility: Object.keys(rolePermissions.buttonVisibility || {}).length
          }));
        } else {
          console.log(`No permissions found for custom role ${customRole.name} (${customRoleId}), setting minimal permissions`);
          // Set minimal permissions if no role permissions exist
          updateData.pageAccess = { '/dashboard': true };
          updateData.canDeleteDocuments = false;
          updateData.buttonVisibility = {};
        }
        
        // Set standard role to STAFF for custom roles
        updateData.role = 'STAFF'; // Must use a valid enum value from UserRole
        updateData.customRoleId = customRoleId; // Store the custom role ID
        updateData.isAdmin = false;
      } catch (error) {
        console.error('Error fetching custom role permissions:', error);
        return res.status(500).json({ error: 'Failed to fetch custom role permissions' });
      }
    }
    
    // Ensure user status is preserved if it was already APPROVED
    if (currentUser.status === 'APPROVED') {
      console.log(`[update-role] Preserving APPROVED status for user ${userId}`);
      updateData.status = 'APPROVED';
    }
    
    console.log('Updating user with data:', JSON.stringify(updateData, null, 2));
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        customRoleId: true,
        isAdmin: true,
        pageAccess: true,
        canDeleteDocuments: true,
        buttonVisibility: true,
        status: true
      }
    });
    
    // If this is a custom role, add the custom role name to the response
    if (customRoleId) {
      try {
        const customRole = await prisma.customRole.findUnique({
          where: { id: customRoleId },
          select: { name: true }
        });
        
        if (customRole) {
          (updatedUser as any).customRoleName = customRole.name;
        }
      } catch (error) {
        console.error('Error fetching custom role name:', error);
        // Continue even if we can't fetch the custom role name
      }
    }

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating user role:', error);
    return res.status(500).json({ error: 'Failed to update user role' });
  }
}