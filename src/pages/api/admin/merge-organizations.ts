/**
 * GET  /api/admin/merge-organizations?targetOrgId=<id>
 *   Returns a dry-run preview of how many records will be re-parented.
 *
 * POST /api/admin/merge-organizations
 *   Body: { targetOrgId: string }
 *   Migrates ALL data from every other organization into targetOrgId,
 *   then deletes the now-empty organizations.
 *   Only accessible by isAdmin users.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/util/supabase/require-auth';
import { getUserRoleData, invalidateUserRoleCache } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const viewerRole = await getUserRoleData(auth.user.id);
  if (!viewerRole?.isAdmin) {
    return res.status(403).json({ error: 'Admin only' });
  }

  if (req.method === 'GET') return previewMerge(req, res);
  if (req.method === 'POST') return executeMerge(req, res, auth.user.id);
  return res.status(405).json({ error: 'GET or POST only' });
}

/* ── Preview ──────────────────────────────────────────────────────────── */
async function previewMerge(req: NextApiRequest, res: NextApiResponse) {
  const { targetOrgId } = req.query;
  if (!targetOrgId || typeof targetOrgId !== 'string') {
    return res.status(400).json({ error: 'Pass ?targetOrgId=<id>' });
  }

  const target = await prisma.organization.findUnique({
    where: { id: targetOrgId },
    select: { id: true, name: true },
  });
  if (!target) return res.status(404).json({ error: 'Target org not found' });

  const others = await prisma.organization.findMany({
    where: { id: { not: targetOrgId } },
    select: { id: true, name: true },
  });
  const otherIds = others.map(o => o.id);

  const [users, tickets, assets, members, foodSupply, kitchens, locations, plannerTasks, recipes, trackingDevices, vehicles, vehicleMaintenances, vendors] =
    await Promise.all([
      prisma.user.count({ where: { organizationId: { in: otherIds } } }),
      prisma.ticket.count({ where: { organizationId: { in: otherIds } } }),
      prisma.asset.count({ where: { organizationId: { in: otherIds } } }),
      prisma.organizationMember.count({ where: { organizationId: { in: otherIds } } }),
      prisma.foodSupply.count({ where: { organizationId: { in: otherIds } } }),
      prisma.kitchen.count({ where: { organizationId: { in: otherIds } } }),
      prisma.location.count({ where: { organizationId: { in: otherIds } } }),
      prisma.plannerTask.count({ where: { organizationId: { in: otherIds } } }),
      prisma.recipe.count({ where: { organizationId: { in: otherIds } } }),
      prisma.trackingDevice.count({ where: { organizationId: { in: otherIds } } }),
      prisma.vehicle.count({ where: { organizationId: { in: otherIds } } }),
      prisma.vehicleMaintenance.count({ where: { organizationId: { in: otherIds } } }),
      prisma.vendor.count({ where: { organizationId: { in: otherIds } } }),
    ]);

  return res.status(200).json({
    targetOrg: target,
    organizationsToDelete: others,
    willMigrate: {
      users, tickets, assets, members, foodSupply, kitchens, locations,
      plannerTasks, recipes, trackingDevices, vehicles, vehicleMaintenances, vendors,
    },
  });
}

/* ── Execute ──────────────────────────────────────────────────────────── */
async function executeMerge(req: NextApiRequest, res: NextApiResponse, callerId: string) {
  const { targetOrgId } = req.body as { targetOrgId?: string };
  if (!targetOrgId) return res.status(400).json({ error: 'targetOrgId required in body' });

  const target = await prisma.organization.findUnique({ where: { id: targetOrgId } });
  if (!target) return res.status(404).json({ error: 'Target org not found' });

  const others = await prisma.organization.findMany({
    where: { id: { not: targetOrgId } },
    select: { id: true, name: true },
  });
  const otherIds = others.map(o => o.id);

  if (otherIds.length === 0) {
    return res.status(200).json({ message: 'Nothing to merge — only one organization exists.' });
  }

  const results: Record<string, number> = {};

  try {
    // 1. Re-parent records that allow null (use updateMany for speed)
    const [u, t, a, fs, k, l, pt, r, td, v, vm, vnd] = await Promise.all([
      prisma.user.updateMany({ where: { organizationId: { in: otherIds } }, data: { organizationId: targetOrgId } }),
      prisma.ticket.updateMany({ where: { organizationId: { in: otherIds } }, data: { organizationId: targetOrgId } }),
      prisma.asset.updateMany({ where: { organizationId: { in: otherIds } }, data: { organizationId: targetOrgId } }),
      prisma.foodSupply.updateMany({ where: { organizationId: { in: otherIds } }, data: { organizationId: targetOrgId } }),
      prisma.kitchen.updateMany({ where: { organizationId: { in: otherIds } }, data: { organizationId: targetOrgId } }),
      prisma.location.updateMany({ where: { organizationId: { in: otherIds } }, data: { organizationId: targetOrgId } }),
      prisma.plannerTask.updateMany({ where: { organizationId: { in: otherIds } }, data: { organizationId: targetOrgId } }),
      prisma.recipe.updateMany({ where: { organizationId: { in: otherIds } }, data: { organizationId: targetOrgId } }),
      prisma.trackingDevice.updateMany({ where: { organizationId: { in: otherIds } }, data: { organizationId: targetOrgId } }),
      prisma.vehicle.updateMany({ where: { organizationId: { in: otherIds } }, data: { organizationId: targetOrgId } }),
      prisma.vehicleMaintenance.updateMany({ where: { organizationId: { in: otherIds } }, data: { organizationId: targetOrgId } }),
      prisma.vendor.updateMany({ where: { organizationId: { in: otherIds } }, data: { organizationId: targetOrgId } }),
    ]);

    results.users = u.count;
    results.tickets = t.count;
    results.assets = a.count;
    results.foodSupply = fs.count;
    results.kitchens = k.count;
    results.locations = l.count;
    results.plannerTasks = pt.count;
    results.recipes = r.count;
    results.trackingDevices = td.count;
    results.vehicles = v.count;
    results.vehicleMaintenances = vm.count;
    results.vendors = vnd.count;

    // 2. Migrate OrganizationMember rows — upsert to avoid unique constraint
    const memberRows = await prisma.organizationMember.findMany({
      where: { organizationId: { in: otherIds } },
      select: { userId: true, role: true },
    });
    let membersMoved = 0;
    for (const m of memberRows) {
      await prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: targetOrgId, userId: m.userId } },
        update: {},
        create: { organizationId: targetOrgId, userId: m.userId, role: m.role, inviteAccepted: true },
      });
      membersMoved++;
    }
    results.members = membersMoved;

    // 3. Delete old orgs — Cascade removes Subscription, OrganizationMember, BillingHistory, UsageMetrics, AuditLog, ErrorLog
    await prisma.organization.deleteMany({ where: { id: { in: otherIds } } });
    results.organizationsDeleted = otherIds.length;

    // 4. Bust role cache for all moved users so they see the right org immediately
    const movedUsers = await prisma.user.findMany({
      where: { organizationId: targetOrgId },
      select: { id: true },
    });
    movedUsers.forEach(u => invalidateUserRoleCache(u.id));
    invalidateUserRoleCache(callerId);

    return res.status(200).json({
      success: true,
      targetOrg: { id: target.id, name: target.name },
      deletedOrgs: others.map(o => o.name),
      migrated: results,
    });
  } catch (err) {
    console.error('[merge-organizations]', err);
    return res.status(500).json({
      error: 'Merge failed',
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
