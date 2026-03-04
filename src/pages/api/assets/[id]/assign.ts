import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const roleData = await getUserRoleData(user.id);
  const isAdminOrManager = roleData?.role === 'ADMIN' || roleData?.role === 'MANAGER' || roleData?.isAdmin === true;
  const organizationId = roleData?.organizationId;

  // Build access scope — mirror the same OR-null pattern used by the GET handler
  // so that older assets (organizationId = null) can also be assigned
  const assetWhere: any = { id: String(id) };
  if (isAdminOrManager && organizationId) {
    assetWhere.OR = [
      { organizationId: organizationId },
      { organizationId: null },
    ];
  } else {
    assetWhere.userId = user.id;
  }

  // ── POST: Assign asset to a person ───────────────────────────────────────
  if (req.method === 'POST') {
    const { assignedToName, assignedToEmail, assignedToId } = req.body;

    if (!assignedToName || typeof assignedToName !== 'string' || !assignedToName.trim()) {
      return res.status(400).json({ error: 'assignedToName is required' });
    }

    const asset = await prisma.asset.findFirst({
      where: assetWhere,
      select: { id: true, name: true },
    });
    if (!asset) return res.status(404).json({ error: 'Asset not found or access denied' });

    const updatedAsset = await prisma.asset.update({
      where: { id: String(id) },
      data: {
        assignedToName: assignedToName.trim(),
        assignedToEmail: assignedToEmail?.trim() || null,
        assignedToId: assignedToId || null,
        assignedAt: new Date(),
      },
      select: {
        id: true,
        assignedToName: true,
        assignedToEmail: true,
        assignedToId: true,
        assignedAt: true,
      },
    });

    // Log assignment to history
    await prisma.assetHistory.create({
      data: {
        assetId: String(id),
        action: 'ASSIGNED',
        userId: user.id,
        details: {
          assignedToName: assignedToName.trim(),
          assignedToEmail: assignedToEmail?.trim() || null,
          assignedToId: assignedToId || null,
          assignedAt: new Date().toISOString(),
          assignedBy: user.email,
        },
      },
    }).catch(() => { /* non-critical */ });

    return res.status(200).json(updatedAsset);
  }

  // ── DELETE: Unassign asset ────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const asset = await prisma.asset.findFirst({
      where: assetWhere,
      select: { id: true, assignedToName: true },
    });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    await prisma.asset.update({
      where: { id: String(id) },
      data: { assignedToName: null, assignedToEmail: null, assignedToId: null, assignedAt: null },
    });

    await prisma.assetHistory.create({
      data: {
        assetId: String(id),
        action: 'UNASSIGNED',
        userId: user.id,
        details: {
          previousAssignee: asset.assignedToName,
          unassignedAt: new Date().toISOString(),
          unassignedBy: user.email,
        },
      },
    }).catch(() => { /* non-critical */ });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
