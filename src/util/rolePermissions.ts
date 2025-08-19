import prisma from '@/lib/prisma';

/**
 * Gets the default permissions for a specific user role
 * @param role The user role to get permissions for
 * @returns The default permissions for the role, or null if not found
 */
export async function getDefaultPermissionsForRole(role: string) {
  try {
    const defaultPermissions = await prisma.roleDefaultPermission.findUnique({
      where: { role: role as any }
    });
    
    return defaultPermissions;
  } catch (error) {
    console.error('Error fetching default permissions for role:', error);
    return null;
  }
}

/**
 * Applies default role permissions to a user
 * @param userId The user ID to apply permissions to
 * @param role The role to apply permissions from
 * @returns The updated user with applied permissions, or null if failed
 */
export async function applyDefaultRolePermissions(userId: string, role: string) {
  try {
    // Get default permissions for the role
    const defaultPermissions = await getDefaultPermissionsForRole(role);
    
    if (!defaultPermissions) {
      // If no default permissions found, only update the role
      return await prisma.user.update({
        where: { id: userId },
        data: { 
          role: role as any,
          isAdmin: role === 'ADMIN'
        }
      });
    }
    
    // Apply default permissions to the user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: role as any,
        isAdmin: role === 'ADMIN',
        pageAccess: defaultPermissions.pageAccess,
        canDeleteDocuments: defaultPermissions.canDeleteDocuments,
        buttonVisibility: defaultPermissions.buttonVisibility
      }
    });
    
    return updatedUser;
  } catch (error) {
    console.error('Error applying default role permissions:', error);
    return null;
  }
}

/**
 * Creates default permissions for a role if they don't exist
 * @param role The role to create default permissions for
 * @param pageAccess The default page access permissions
 * @param canDeleteDocuments Whether users with this role can delete documents by default
 * @returns The created or updated role permissions
 */
export async function createDefaultRolePermissions(
  role: string, 
  pageAccess: Record<string, boolean>, 
  canDeleteDocuments: boolean = false
) {
  try {
    // Check if permissions already exist for this role
    const existingPermissions = await prisma.roleDefaultPermission.findUnique({
      where: { role: role as any }
    });
    
    if (existingPermissions) {
      // Update existing permissions
      return await prisma.roleDefaultPermission.update({
        where: { role: role as any },
        data: {
          pageAccess,
          canDeleteDocuments,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new permissions
      return await prisma.roleDefaultPermission.create({
        data: {
          role: role as any,
          pageAccess,
          canDeleteDocuments
        }
      });
    }
  } catch (error) {
    console.error('Error creating default role permissions:', error);
    return null;
  }
}