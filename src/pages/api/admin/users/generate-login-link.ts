/**
 * POST /api/admin/users/generate-login-link
 *
 * Admin-only: generates a one-time magic sign-in link for any user.
 * This bypasses email/password entirely — the user clicks the link,
 * gets signed in, and the force-change password modal appears.
 *
 * Body: { userId: string; email: string }
 * Response: { link: string }
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

  const { userId, email } = req.body as { userId?: string; email?: string };
  if (!userId || !email) {
    return res.status(400).json({ error: 'userId and email are required' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const adminClient = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Step 1: Ensure the email is confirmed before generating the link
  // (generateLink also fails if email is unconfirmed on some project configs)
  try {
    await prisma.$executeRaw`
      UPDATE auth.users
      SET
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        confirmation_token = '',
        recovery_token     = '',
        updated_at         = NOW()
      WHERE id::text = ${userId}
    `;
  } catch (sqlErr) {
    console.warn('[generate-login-link] SQL confirm email failed (non-fatal):', sqlErr);
  }

  // Step 2: Generate a one-time magic sign-in link
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${siteUrl}/portal`,
    },
  });

  if (error || !data?.properties?.action_link) {
    console.error('[generate-login-link] generateLink error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to generate login link' });
  }

  // Step 3: Also mark mustChangePassword so force-change modal appears after login
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: true },
    });
  } catch {
    // Non-fatal — user might not exist in our DB yet
  }

  return res.status(200).json({ link: data.properties.action_link });
}
