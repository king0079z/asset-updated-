import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get the user's data from the database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        role: true,
        isAdmin: true,
        pageAccess: true,
        buttonVisibility: true,
        canDeleteDocuments: true,
        customRoleId: true,
        status: true
      }
    });

    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get custom role information if applicable
    let customRole = null;
    if (dbUser.customRoleId) {
      customRole = await prisma.customRole.findUnique({
        where: { id: dbUser.customRoleId },
        select: { id: true, name: true, description: true }
      });
    }

    // Get license key roles for this user
    const licenseKeyRoles = await prisma.licenseKeyRole.findMany({
      where: { userId: user.id },
      select: { 
        licenseKey: true, 
        role: true, 
        plan: true, 
        expirationDate: true 
      }
    });

    return res.status(200).json({
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      isAdmin: dbUser.isAdmin,
      pageAccess: dbUser.pageAccess,
      buttonVisibility: dbUser.buttonVisibility,
      canDeleteDocuments: dbUser.canDeleteDocuments,
      customRole: customRole,
      status: dbUser.status,
      licenseKeyRoles: licenseKeyRoles
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error' 
    });
  }
}