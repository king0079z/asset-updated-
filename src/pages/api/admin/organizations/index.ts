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

  // Only allow admins
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });

  if (!dbUser?.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admins only' });
  }

  if (req.method === 'GET') {
    try {
      // Get all organizations, with asset count and members
      const organizations = await prisma.organization.findMany({
        include: {
          _count: { select: { assets: true } },
          members: {
            include: {
              user: {
                select: { id: true, email: true, status: true, isAdmin: true }
              }
            }
          }
        }
      });

      // Format response
      const result = organizations.map(org => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        assetCount: org._count.assets,
        members: org.members.map(m => ({
          id: m.id,
          userId: m.userId,
          email: m.user?.email,
          userStatus: m.user?.status,
          isAdmin: m.user?.isAdmin,
          role: m.role,
          inviteAccepted: m.inviteAccepted,
        })),
      }));

      return res.status(200).json({ organizations: result });
    } catch (error) {
      console.error('Error fetching organizations:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal Server Error' });
    }
  }

  res.setHeader('Allow', ['GET']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}