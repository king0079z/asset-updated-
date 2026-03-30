// @ts-nocheck
/**
 * DELETE /api/admin/users/delete
 *
 * Admin-only: completely removes a user from:
 *   1. Our Prisma User table (with all owned records handled)
 *   2. Supabase Auth (so they can register fresh with the same email)
 *
 * Body: { userId: string }
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';
import { getUserRoleData } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  if (!roleData?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

  const { userId } = req.body as { userId?: string };
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  // Prevent admin from deleting themselves
  if (userId === session.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  try {
    // ── Step 1: Remove all owned/related records from Prisma ─────
    // Use a transaction so everything succeeds or nothing does.
    await prisma.$transaction(async (tx) => {
      // Nullify optional user references on records that should survive
      await tx.$executeRaw`UPDATE "Asset"        SET "userId" = NULL WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "Ticket"       SET "userId" = NULL WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "Ticket"       SET "assignedToId" = NULL WHERE "assignedToId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "AssetHistory" SET "userId" = NULL WHERE "userId"::text = ${userId}`;
      await tx.$executeRaw`UPDATE "FoodConsumption" SET "userId" = NULL WHERE "userId"::text = ${userId}`;
      await tx.$executeRaw`UPDATE "FoodDisposal"    SET "userId" = NULL WHERE "userId"::text = ${userId}`;
      await tx.$executeRaw`UPDATE "FoodSupply"      SET "userId" = NULL WHERE "userId"::text = ${userId}`;
      await tx.$executeRaw`UPDATE "VehicleRental"   SET "userId" = NULL WHERE "userId"::text = ${userId}`;
      await tx.$executeRaw`UPDATE "VehicleMaintenance" SET "userId" = NULL WHERE "userId"::text = ${userId}`;
      await tx.$executeRaw`UPDATE "StockTransfer"   SET "requestedById" = NULL WHERE "requestedById"::text = ${userId}`;
      await tx.$executeRaw`UPDATE "StockTransfer"   SET "approvedById"  = NULL WHERE "approvedById"::text = ${userId}`;
      await tx.$executeRaw`UPDATE "PlannerTask"     SET "assignedToId"  = NULL WHERE "assignedToId"::text = ${userId}`;
      await tx.$executeRaw`UPDATE "PlannerTask"     SET "userId"        = NULL WHERE "userId"::text = ${userId}`;
      await tx.$executeRaw`UPDATE "ProductionBatch" SET "userId"        = NULL WHERE "userId"::text = ${userId}`;
      await tx.$executeRaw`UPDATE "PurchaseOrder"   SET "userId"        = NULL WHERE "userId"::text = ${userId}`;
      await tx.$executeRaw`UPDATE "KitchenAssignment" SET "assignedById" = NULL WHERE "assignedById"::text = ${userId}`;

      // Delete records that are purely owned by this user
      await tx.notification.deleteMany({ where: { userId } });
      await tx.licenseKeyRole.deleteMany({ where: { userId } });
      await tx.organizationMember.deleteMany({ where: { userId } });
      await tx.ticketHistory.deleteMany({ where: { userId } });
      await tx.kitchenAssignment.deleteMany({ where: { userId } });

      // Finally delete the User row itself
      await tx.user.delete({ where: { id: userId } });
    });

    // ── Step 2: Delete from Supabase Auth ────────────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (supabaseUrl && serviceKey) {
      const adminClient = createAdminClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
      if (authError) {
        // Log but don't fail — the DB row is already gone
        console.warn('[delete-user] Supabase auth delete failed (non-fatal):', authError.message);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[delete-user] Error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to delete user' });
  }
}
