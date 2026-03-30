/**
 * POST /api/admin/users/reset-password
 *
 * Admin-only: set a temporary password for a user and mark their account
 * as mustChangePassword = true so the app forces them to set a new one on
 * next login.
 *
 * Body: { userId: string; tempPassword: string }
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  if (!roleData?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

  const { userId, tempPassword } = req.body as { userId?: string; tempPassword?: string };
  if (!userId || !tempPassword) {
    return res.status(400).json({ error: 'userId and tempPassword are required' });
  }
  if (tempPassword.length < 8) {
    return res.status(400).json({ error: 'Temporary password must be at least 8 characters' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server not configured for admin password reset' });
  }

  const adminClient = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Set the password in Supabase Auth
  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });

  if (authError) {
    console.error('[reset-password] Supabase error:', authError);
    return res.status(500).json({ error: authError.message || 'Failed to update password in auth' });
  }

  // Mark the user as mustChangePassword in our database
  await prisma.user.update({
    where: { id: userId },
    data: { mustChangePassword: true },
  });

  return res.status(200).json({ success: true, message: 'Temporary password set. User will be prompted to change it on next login.' });
}
