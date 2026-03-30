// @ts-nocheck
/**
 * DELETE /api/admin/users/delete
 *
 * Admin-only: removes a user from Prisma + Supabase Auth.
 * Required (NOT NULL) user FKs are reassigned to the admin performing the delete.
 * Optional FKs are nulled. Kitchen assignments for this user are removed.
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

  if (userId === session.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  const adminId = session.user.id;

  try {
    await prisma.$transaction(async (tx) => {
      // ── Optional FKs → NULL ─────────────────────────────────────
      await tx.$executeRaw`UPDATE "Ticket" SET "assignedToId" = NULL WHERE "assignedToId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "StockTransfer" SET "approvedById" = NULL WHERE "approvedById" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "PlannerTask" SET "assignedToUserId" = NULL WHERE "assignedToUserId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "Asset" SET "assignedToId" = NULL WHERE "assignedToId" IS NOT NULL AND "assignedToId"::text = ${userId}`;
      await tx.$executeRaw`UPDATE "VehicleMaintenance" SET "userId" = NULL WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "VehicleLocation" SET "userId" = NULL WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "ErrorLog" SET "userId" = NULL WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "ErrorLog" SET "resolvedBy" = NULL WHERE "resolvedBy" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "AuditLog" SET "userId" = NULL WHERE "userId" = ${userId}::uuid`;

      // ── Required FKs → reassign to admin ──────────────────────────
      await tx.$executeRaw`UPDATE "Asset" SET "userId" = ${adminId}::uuid WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "Ticket" SET "userId" = ${adminId}::uuid WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "AssetHistory" SET "userId" = ${adminId}::uuid WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "FoodSupply" SET "userId" = ${adminId}::uuid WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "FoodConsumption" SET "userId" = ${adminId}::uuid WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "FoodDisposal" SET "userId" = ${adminId}::uuid WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "VehicleRental" SET "userId" = ${adminId}::uuid WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "VehicleTrip" SET "userId" = ${adminId}::uuid WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "StockTransfer" SET "requestedById" = ${adminId}::uuid WHERE "requestedById" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "ProductionBatch" SET "createdById" = ${adminId}::uuid WHERE "createdById" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "PurchaseOrder" SET "orderedById" = ${adminId}::uuid WHERE "orderedById" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "PlannerTask" SET "userId" = ${adminId}::uuid WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "TicketHistory" SET "userId" = ${adminId}::uuid WHERE "userId" = ${userId}::uuid`;

      // Tables with userId but no Prisma relation to User (still may exist in DB)
      await tx.$executeRaw`UPDATE "ReportHistory" SET "userId" = ${adminId}::uuid WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "Recipe" SET "userId" = ${adminId}::uuid WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "RecipeUsage" SET "userId" = ${adminId}::uuid WHERE "userId" = ${userId}::uuid`;

      // Documents uploaded by this user → attribute to admin (keeps FK valid if present)
      await tx.$executeRaw`UPDATE "AssetDocument" SET "uploadedById" = ${adminId}::uuid WHERE "uploadedById" = ${userId}::uuid`;

      // Kitchen: remove this user's assignments; reassign "assigned by" to admin
      await tx.$executeRaw`DELETE FROM "KitchenAssignment" WHERE "userId" = ${userId}::uuid`;
      await tx.$executeRaw`UPDATE "KitchenAssignment" SET "assignedById" = ${adminId}::uuid WHERE "assignedById" = ${userId}::uuid`;

      // Purely owned rows (Prisma)
      await tx.notification.deleteMany({ where: { userId } });
      await tx.licenseKeyRole.deleteMany({ where: { userId } });
      await tx.organizationMember.deleteMany({ where: { userId } });

      await tx.user.delete({ where: { id: userId } });
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (supabaseUrl && serviceKey) {
      const adminClient = createAdminClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
      if (authError) {
        console.warn('[delete-user] Supabase auth delete failed (non-fatal):', authError.message);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[delete-user] Error:', error);
    const msg = error?.meta?.message || error?.message || String(error);
    return res.status(500).json({ error: msg || 'Failed to delete user' });
  }
}
