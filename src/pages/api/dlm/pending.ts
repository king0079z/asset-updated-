// @ts-nocheck
/**
 * GET /api/dlm/pending
 * Returns all tickets where the current user is the DLM (dlmId = me)
 * and dlmApprovalStatus = "PENDING_DLM"
 */
import { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/util/supabase/require-auth";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;

  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        dlmId: user.id,
        dlmApprovalStatus: "PENDING_DLM",
      },
      include: {
        user: { select: { id: true, email: true, displayName: true, jobTitle: true, department: true } },
        asset: { select: { id: true, name: true, assetId: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ tickets });
  } catch (error) {
    console.error("[DLM pending]", error);
    return res.status(500).json({ error: "Failed to fetch pending approvals" });
  }
}
