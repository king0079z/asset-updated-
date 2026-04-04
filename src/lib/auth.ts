/**
 * Lightweight server-side auth helper.
 * Returns the Supabase user from the request session (cookie-based),
 * or null if not authenticated.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import { prisma } from '@/lib/prisma';

export async function getServerSession(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  // Enrich with DB profile so callers get role, id, etc.
  try {
    const profile = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, role: true, name: true },
    });
    return profile ?? null;
  } catch {
    // Fall back to basic session user if DB is unavailable
    return { id: session.user.id, email: session.user.email ?? '', role: null as any, name: null };
  }
}
