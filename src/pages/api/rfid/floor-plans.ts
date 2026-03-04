// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  const orgId = roleData?.organizationId ?? null;

  if (req.method === 'GET') {
    const plans = await prisma.floorPlan.findMany({
      where: orgId ? { organizationId: orgId } : {},
      include: { _count: { select: { zones: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ plans });
  }

  if (req.method === 'POST') {
    const { name, building, floorNumber, imageUrl, imageWidth, imageHeight } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    if (!imageUrl)     return res.status(400).json({ error: 'imageUrl is required' });

    const plan = await prisma.floorPlan.create({
      data: {
        name:          name.trim(),
        building:      building || null,
        floorNumber:   floorNumber ? Number(floorNumber) : null,
        imageUrl,
        imageWidth:    imageWidth  ? Number(imageWidth)  : 1000,
        imageHeight:   imageHeight ? Number(imageHeight) : 700,
        organizationId: orgId,
      },
    });
    return res.status(201).json({ plan });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
