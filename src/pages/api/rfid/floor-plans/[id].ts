// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  const orgId = roleData?.organizationId ?? null;
  const { id } = req.query as { id: string };

  const plan = await prisma.floorPlan.findFirst({
    where: { id, ...(orgId ? { organizationId: orgId } : {}) },
  });
  if (!plan) return res.status(404).json({ error: 'Floor plan not found' });

  if (req.method === 'GET') {
    const full = await prisma.floorPlan.findUnique({
      where: { id },
      include: { zones: { orderBy: { name: 'asc' } } },
    });
    return res.status(200).json({ plan: full });
  }

  if (req.method === 'PUT') {
    const { name, building, floorNumber, imageUrl, imageWidth, imageHeight } = req.body;
    const updated = await prisma.floorPlan.update({
      where: { id },
      data: {
        ...(name        ? { name: name.trim() }         : {}),
        ...(building !== undefined ? { building }        : {}),
        ...(floorNumber !== undefined ? { floorNumber: floorNumber ? Number(floorNumber) : null } : {}),
        ...(imageUrl    ? { imageUrl }                  : {}),
        ...(imageWidth  ? { imageWidth:  Number(imageWidth)  } : {}),
        ...(imageHeight ? { imageHeight: Number(imageHeight) } : {}),
      },
    });
    return res.status(200).json({ plan: updated });
  }

  if (req.method === 'DELETE') {
    await prisma.floorPlan.delete({ where: { id } });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
