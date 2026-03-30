/**
 * POST /api/users/change-password
 *
 * Authenticated user: updates their own password and clears the
 * mustChangePassword flag.
 *
 * Body: { newPassword: string }
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const adminClient = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Update password via Admin API (bypasses email confirmation requirement)
  const { error: authError } = await adminClient.auth.admin.updateUserById(session.user.id, {
    password: newPassword,
  });

  if (authError) {
    console.error('[change-password] Supabase error:', authError);
    return res.status(500).json({ error: authError.message || 'Failed to update password' });
  }

  // Clear the mustChangePassword flag
  await prisma.user.update({
    where: { id: session.user.id },
    data: { mustChangePassword: false },
  });

  return res.status(200).json({ success: true });
}
