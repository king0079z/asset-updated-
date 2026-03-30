/**
 * GET /api/users/me
 * Returns a lightweight profile for the currently authenticated user,
 * including the mustChangePassword flag.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      isAdmin: true,
      mustChangePassword: true,
    },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.status(200).json(user);
}
