// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

// Define default page access for newly approved users
const defaultPageAccess = {
  '/dashboard': true,
  '/assets': true,
  '/assets/[id]': true,
  '/food-supply': true,
  '/food-supply/barcodes': true,
  '/tickets': true,
  '/tickets/[id]': true,
  '/tickets/dashboard': true,
  '/tickets/kanban': true,
  '/vehicles': true,
  '/vehicles/[id]': true,
  '/vehicles/rentals': true,
  '/my-vehicle': true,
  '/planner': true,
  '/vehicle-tracking': true,
  '/vehicle-tracking/movement-analysis': true,
  '/asset-location': true
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`[update-status] Starting request processing: ${new Date().toISOString()}`);
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

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, status } = req.body;

    if (!userId || !status) {
      return res.status(400).json({ error: 'User ID and status are required' });
    }

    // Validate status
    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // Get current user data to check if pageAccess is already set
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { pageAccess: true, email: true, role: true }
    });
    
    console.log(`[update-status] Current user data: ${JSON.stringify(currentUser)}`);
    
    // Prepare update data
    const updateData: any = { status };
    
    // If user is being approved, always ensure they have page access
    if (status === 'APPROVED') {
      console.log(`[update-status] User ${userId} is being approved, setting page access`);
      
      // If pageAccess is empty or null, set default page access
      if (!currentUser?.pageAccess || Object.keys(currentUser?.pageAccess || {}).length === 0) {
        updateData.pageAccess = defaultPageAccess;
        console.log(`[update-status] Setting default page access for newly approved user ${userId} (${currentUser?.email}): ${JSON.stringify(defaultPageAccess)}`);
      } else {
        // Ensure all default pages are accessible
        // This merges existing permissions with default ones, ensuring users have at least the default access
        updateData.pageAccess = {
          ...defaultPageAccess,
          ...currentUser.pageAccess
        };
        console.log(`[update-status] Merging existing page access with defaults for user ${userId}: ${JSON.stringify(updateData.pageAccess)}`);
      }
      
      // If the user has a role, try to get role-specific permissions
      if (currentUser?.role) {
        try {
          const rolePermissions = await prisma.roleDefaultPermission.findUnique({
            where: { role: currentUser.role as any }
          });
          
          if (rolePermissions?.pageAccess) {
            console.log(`[update-status] Adding role-specific permissions for ${currentUser.role}`);
            updateData.pageAccess = {
              ...updateData.pageAccess,
              ...rolePermissions.pageAccess
            };
          }
        } catch (error) {
          console.error(`[update-status] Error fetching role permissions: ${error}`);
          // Continue even if we can't fetch role permissions
        }
      }
    }

    // Update user status and potentially page access
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        status: true,
        pageAccess: true,
        role: true
      }
    });

    console.log(`[update-status] User updated successfully: ${JSON.stringify(updatedUser)}`);
    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating user status:', error);
    return res.status(500).json({ error: 'Failed to update user status' });
  }
}