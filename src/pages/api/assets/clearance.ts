import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";
import { getUserRoleData } from "@/util/roleCheck";

export type ClearanceReason = "TERMINATED" | "RESIGNED" | "TRANSFERRED" | "SUSPENDED" | "OTHER";
export type AssetClearanceAction = "RETURN_TO_STOCK" | "REASSIGN" | "DISPOSE";

interface ClearanceAssetAction {
  assetId: string;
  action: AssetClearanceAction;
  newUserId?: string;
  newUserName?: string;
  newUserEmail?: string;
}

interface ClearanceRequest {
  userId: string;
  userName: string;
  userEmail: string;
  reason: ClearanceReason;
  notes?: string;
  clearanceDate: string;
  actions: ClearanceAssetAction[];
}

/**
 * POST /api/assets/clearance
 * Bulk-process asset clearance for a departing/terminated user.
 * Each asset can be: returned to stock, reassigned to another user, or disposed.
 * Full audit trail is created for every action.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const sessionUser = session?.user ?? null;

    if (authError || !sessionUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const roleData = await getUserRoleData(sessionUser.id);
    const isPrivileged = roleData
      ? roleData.role === "ADMIN" || roleData.role === "MANAGER" || roleData.isAdmin
      : false;

    if (!isPrivileged) {
      return res.status(403).json({ error: "Only admins and managers can initiate clearance" });
    }

    const body: ClearanceRequest = req.body;
    const { userId, userName, userEmail, reason, notes, clearanceDate, actions } = body;

    if (!userId || !reason || !clearanceDate || !Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ error: "Missing required fields: userId, reason, clearanceDate, actions" });
    }

    const disposedAt = new Date(clearanceDate);
    const summary: { assetId: string; action: AssetClearanceAction; success: boolean; error?: string }[] = [];

    // ── Process each asset action in a transaction ────────────────────────────
    await prisma.$transaction(async (tx) => {
      for (const item of actions) {
        const { assetId, action } = item;

        try {
          if (action === "RETURN_TO_STOCK") {
            await tx.asset.update({
              where: { id: assetId },
              data: {
                assignedToId: null,
                assignedToName: null,
                assignedToEmail: null,
                assignedAt: null,
              },
            });

            await tx.assetHistory.create({
              data: {
                assetId,
                action: "CLEARANCE",
                userId: sessionUser.id,
                details: {
                  type: "CLEARANCE_RETURN",
                  previousAssignedTo: userName,
                  previousAssignedEmail: userEmail,
                  clearanceReason: reason,
                  clearanceNotes: notes || null,
                  clearanceDate,
                  processedBy: sessionUser.email,
                },
              },
            });
            summary.push({ assetId, action, success: true });

          } else if (action === "REASSIGN" && item.newUserName) {
            await tx.asset.update({
              where: { id: assetId },
              data: {
                assignedToId: item.newUserId || null,
                assignedToName: item.newUserName,
                assignedToEmail: item.newUserEmail || null,
                assignedAt: new Date(),
              },
            });

            await tx.assetHistory.create({
              data: {
                assetId,
                action: "CLEARANCE",
                userId: sessionUser.id,
                details: {
                  type: "CLEARANCE_REASSIGN",
                  previousAssignedTo: userName,
                  previousAssignedEmail: userEmail,
                  newAssignedTo: item.newUserName,
                  newAssignedEmail: item.newUserEmail || null,
                  clearanceReason: reason,
                  clearanceNotes: notes || null,
                  clearanceDate,
                  processedBy: sessionUser.email,
                },
              },
            });
            summary.push({ assetId, action, success: true });

          } else if (action === "DISPOSE") {
            await tx.asset.update({
              where: { id: assetId },
              data: {
                status: "DISPOSED",
                disposedAt,
                assignedToId: null,
                assignedToName: null,
                assignedToEmail: null,
                assignedAt: null,
              },
            });

            await tx.assetHistory.create({
              data: {
                assetId,
                action: "DISPOSED",
                userId: sessionUser.id,
                details: {
                  type: "CLEARANCE_DISPOSE",
                  previousAssignedTo: userName,
                  previousAssignedEmail: userEmail,
                  clearanceReason: reason,
                  clearanceNotes: notes || null,
                  clearanceDate,
                  disposedAt: disposedAt.toISOString(),
                  processedBy: sessionUser.email,
                },
              },
            });
            summary.push({ assetId, action, success: true });
          } else {
            summary.push({ assetId, action, success: false, error: "Invalid action or missing reassign target" });
          }
        } catch (err) {
          summary.push({ assetId, action, success: false, error: err instanceof Error ? err.message : "Unknown error" });
        }
      }
    });

    // ── Create a master audit log for the entire clearance ────────────────────
    try {
      await prisma.auditLog.create({
        data: {
          action: "USER_CLEARANCE_PROCESSED",
          resourceType: "USER",
          resourceId: userId,
          userId: sessionUser.id,
          userEmail: sessionUser.email,
          type: "COMPLIANCE_EVENT",
          severity: "WARNING",
          details: {
            clearedUser: { userId, userName, userEmail },
            reason,
            notes: notes || null,
            clearanceDate,
            totalAssets: actions.length,
            returned: summary.filter(s => s.action === "RETURN_TO_STOCK" && s.success).length,
            reassigned: summary.filter(s => s.action === "REASSIGN" && s.success).length,
            disposed: summary.filter(s => s.action === "DISPOSE" && s.success).length,
            failed: summary.filter(s => !s.success).length,
            processedBy: { id: sessionUser.id, email: sessionUser.email },
          },
        },
      });
    } catch { /* audit failure is non-critical */ }

    const failed = summary.filter(s => !s.success);
    const succeeded = summary.filter(s => s.success);

    return res.status(200).json({
      success: true,
      summary: {
        total: actions.length,
        succeeded: succeeded.length,
        failed: failed.length,
        returned: succeeded.filter(s => s.action === "RETURN_TO_STOCK").length,
        reassigned: succeeded.filter(s => s.action === "REASSIGN").length,
        disposed: succeeded.filter(s => s.action === "DISPOSE").length,
      },
      errors: failed.length > 0 ? failed : undefined,
    });
  } catch (err) {
    console.error("Clearance API error:", err);
    return res.status(500).json({ error: "Internal server error", detail: err instanceof Error ? err.message : String(err) });
  }
}
