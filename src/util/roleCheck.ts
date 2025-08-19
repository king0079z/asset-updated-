import prisma from '@/lib/prisma';

/**
 * Checks if a user has admin or manager role
 * 
 * @param userId The user ID to check
 * @returns Boolean indicating if the user is an admin or manager
 */
export async function isAdminOrManager(userId: string): Promise<boolean> {
  try {
    console.log(`[roleCheck] Checking if user ${userId} is admin or manager`);
    
    // First, check if the user exists
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });
    
    if (!userExists) {
      console.log(`[roleCheck] User ${userId} not found in database`);
      return false;
    }
    
    // Get user data with role information
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true }
    });
    
    if (!userData) {
      console.log(`[roleCheck] User ${userId} data could not be retrieved`);
      return false;
    }
    
    console.log(`[roleCheck] User ${userId} email: ${userData.email}`);
    console.log(`[roleCheck] User ${userId} role: ${userData.role}`);
    
    // Check if the role is ADMIN or MANAGER
    const isAdminOrManagerRole = userData.role === 'ADMIN' || userData.role === 'MANAGER';
    console.log(`[roleCheck] User ${userId} isAdminOrManager: ${isAdminOrManagerRole}`);
    
    // Double-check with a direct query to ensure we're getting the latest role
    const directRoleCheck = await prisma.$queryRaw`
      SELECT role FROM "User" WHERE id = ${userId}::uuid
    `;
    
    console.log(`[roleCheck] Direct SQL query result:`, directRoleCheck);
    
    if (Array.isArray(directRoleCheck) && directRoleCheck.length > 0) {
      const directRole = directRoleCheck[0].role;
      console.log(`[roleCheck] Direct role check: ${directRole}`);
      const directIsAdminOrManager = directRole === 'ADMIN' || directRole === 'MANAGER';
      
      // If there's a discrepancy, log it
      if (directIsAdminOrManager !== isAdminOrManagerRole) {
        console.log(`[roleCheck] WARNING: Role discrepancy detected. Prisma: ${userData.role}, Direct SQL: ${directRole}`);
      }
      
      // Return the result from the direct query for maximum reliability
      return directIsAdminOrManager;
    }
    
    return isAdminOrManagerRole;
  } catch (error) {
    console.error(`[roleCheck] Error checking user role for ${userId}:`, error);
    if (error instanceof Error) {
      console.error(`[roleCheck] Error name: ${error.name}`);
      console.error(`[roleCheck] Error message: ${error.message}`);
      console.error(`[roleCheck] Error stack: ${error.stack}`);
    }
    return false; // Default to false if there's an error
  }
}

/**
 * Checks if a user has admin, manager, or supervisor role
 * 
 * @param userId The user ID to check
 * @returns Boolean indicating if the user is an admin, manager, or supervisor
 */
export async function isAdminManagerOrSupervisor(userId: string): Promise<boolean> {
  try {
    console.log(`[roleCheck] Checking if user ${userId} is admin, manager, or supervisor`);
    
    // Get user data with role information
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, customRoleId: true }
    });
    
    if (!userData) {
      console.log(`[roleCheck] User ${userId} data could not be retrieved`);
      return false;
    }
    
    console.log(`[roleCheck] User ${userId} email: ${userData.email}`);
    console.log(`[roleCheck] User ${userId} role: ${userData.role}`);
    
    // Check if the role is ADMIN or MANAGER
    if (userData.role === 'ADMIN' || userData.role === 'MANAGER') {
      return true;
    }
    
    // Check if the user has a custom role with "supervisor" in the name
    if (userData.customRoleId) {
      const customRole = await prisma.customRole.findUnique({
        where: { id: userData.customRoleId },
        select: { name: true }
      });
      
      if (customRole && customRole.name.toLowerCase().includes('supervisor')) {
        console.log(`[roleCheck] User ${userId} has supervisor custom role: ${customRole.name}`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`[roleCheck] Error checking supervisor role for ${userId}:`, error);
    return false; // Default to false if there's an error
  }
}

/**
 * Checks if a user has admin role
 * 
 * @param userId The user ID to check
 * @returns Boolean indicating if the user is an admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    return userData?.role === 'ADMIN';
  } catch (error) {
    console.error(`Error checking admin role for ${userId}:`, error);
    return false; // Default to false if there's an error
  }
}