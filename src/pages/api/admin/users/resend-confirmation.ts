/**
 * POST /api/admin/users/resend-confirmation
 *
 * Admin-only: asks Supabase to send another signup confirmation email.
 * Only works for auth users whose email is not yet confirmed.
 *
 * Body: { userId: string }
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';
import { getUserRoleData } from '@/util/roleCheck';
import { getPublicSiteUrl } from '@/lib/site-url';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  if (!roleData?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

  const { userId } = req.body as { userId?: string };
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const siteUrl = getPublicSiteUrl();
  if (!siteUrl) {
    return res.status(500).json({
      error: 'Set NEXT_PUBLIC_SITE_URL in Vercel (e.g. https://assetxai.live) so the confirmation link points to production.',
    });
  }

  const appUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!appUser?.email) return res.status(404).json({ error: 'User not found' });

  const rows: Array<{ email_confirmed_at: Date | null }> = await prisma.$queryRaw`
    SELECT email_confirmed_at FROM auth.users WHERE id::text = ${userId} LIMIT 1
  `;
  if (!rows.length) {
    return res.status(404).json({ error: 'No Supabase auth account for this user' });
  }
  if (rows[0].email_confirmed_at != null) {
    return res.status(400).json({ error: 'This email is already confirmed. The user can sign in normally.' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server auth is not configured' });
  }

  const adminClient = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await adminClient.auth.resend({
    type: 'signup',
    email: appUser.email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    console.error('[resend-confirmation]', error);
    return res.status(500).json({ error: error.message || 'Supabase could not resend the email' });
  }

  return res.status(200).json({ success: true, email: appUser.email });
}
