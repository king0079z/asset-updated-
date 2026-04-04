// @ts-nocheck
/**
 * GET /api/dlm/history
 * Returns all tickets that have ever entered the DLM approval workflow,
 * including pending, approved, and rejected. Admins/managers only.
 */
import { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/util/supabase/require-auth";
import { getUserRoleData } from "@/util/roleCheck";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;

  const roleData = await getUserRoleData(user.id);
  const isAdminOrManager =
    roleData?.isAdmin === true ||
    roleData?.role === "ADMIN" ||
    roleData?.role === "MANAGER";

  try {
    const where: any = {
      dlmApprovalStatus: { not: null },
    };

    // Non-admins only see their own DLM decisions
    if (!isAdminOrManager) {
      where.dlmId = user.id;
    }

    const { status, limit = "100" } = req.query as { status?: string; limit?: string };
    if (status && ["PENDING_DLM", "DLM_APPROVED", "DLM_REJECTED"].includes(status)) {
      where.dlmApprovalStatus = status;
    }

    const tickets = await prisma.ticket.findMany({
      where,
      select: {
        id: true,
        displayId: true,
        title: true,
        category: true,
        priority: true,
        status: true,
        dlmApprovalStatus: true,
        dlmComment: true,
        dlmDecidedAt: true,
        createdAt: true,
        user: { select: { id: true, email: true, displayName: true, department: true, jobTitle: true } },
        dlm: { select: { id: true, email: true, displayName: true, jobTitle: true } },
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string, 10) || 100,
    });

    const stats = {
      total: tickets.length,
      pending: tickets.filter((t) => t.dlmApprovalStatus === "PENDING_DLM").length,
      approved: tickets.filter((t) => t.dlmApprovalStatus === "DLM_APPROVED").length,
      rejected: tickets.filter((t) => t.dlmApprovalStatus === "DLM_REJECTED").length,
    };

    return res.status(200).json({ tickets, stats });
  } catch (err) {
    console.error("[DLM history]", err);
    return res.status(500).json({ error: "Failed to fetch DLM history" });
  }
}
