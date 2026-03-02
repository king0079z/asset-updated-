import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(user.id);
  const organizationId = roleData?.organizationId;

  const users = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      ...(organizationId ? { organizationId } : {}),
    },
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
    },
    orderBy: { email: 'asc' },
    take: 100,
  });

  res.setHeader('Cache-Control', 'private, max-age=60');
  return res.status(200).json(users);
}
