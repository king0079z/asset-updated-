// @ts-nocheck
/**
 * GET /api/tickets/dlm-queue
 * Returns ALL tickets that have a DLM approval gate (any status: PENDING_DLM | DLM_APPROVED | DLM_REJECTED)
 * Used in the main Tickets page "DLM Approvals" tab for admins / support staff to monitor.
 * Optionally filter: ?status=PENDING_DLM | DLM_APPROVED | DLM_REJECTED
 */
import { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/util/supabase/require-auth";
import prisma from "@/lib/prisma";
import { getUserRoleData } from "@/util/roleCheck";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;

  const { status } = req.query;

  try {
    const roleData = await getUserRoleData(user.id);

    const where: any = {
      dlmApprovalStatus: { not: null },
    };

    if (status && ["PENDING_DLM", "DLM_APPROVED", "DLM_REJECTED"].includes(status as string)) {
      where.dlmApprovalStatus = status as string;
    }

    // Non-admins only see their own org
    if (!roleData?.isAdmin && roleData?.organizationId) {
      where.organizationId = roleData.organizationId;
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, displayName: true, jobTitle: true, department: true } },
        dlm:  { select: { id: true, email: true, displayName: true } },
        asset: { select: { id: true, name: true, assetId: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ tickets });
  } catch (error) {
    console.error("[DLM queue]", error);
    return res.status(500).json({ error: "Failed to fetch DLM queue" });
  }
}
