// @ts-nocheck
/**
 * GET  /api/dlm/users  – all users in the org with their current DLM (manager) info
 * POST /api/dlm/users  – assign (or clear) a DLM for a user  { userId, managerId }
 */
import { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/util/supabase/require-auth";
import { getUserRoleData } from "@/util/roleCheck";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;

  const roleData = await getUserRoleData(user.id);

  // Allow any admin (isAdmin=true) OR any user with role ADMIN or MANAGER
  const hasAccess =
    roleData?.isAdmin === true ||
    roleData?.role === "ADMIN" ||
    roleData?.role === "MANAGER";

  if (!hasAccess) {
    return res.status(403).json({ error: "Forbidden: Admin or Manager access required" });
  }

  if (req.method === "GET") {
    try {
      // UserStatus enum only has PENDING, APPROVED, REJECTED — no DELETED value.
      // Fetch all users (no status filter needed for DLM assignment purposes).
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          displayName: true,
          department: true,
          jobTitle: true,
          role: true,
          status: true,
          isAdmin: true,
          azureAdId: true,
          organizationId: true,
          managerId: true,
          manager: {
            select: {
              id: true,
              email: true,
              displayName: true,
              jobTitle: true,
              department: true,
            },
          },
          directReports: {
            select: { id: true, email: true, displayName: true, jobTitle: true },
          },
          dlmApprovalTickets: {
            select: {
              id: true,
              dlmApprovalStatus: true,
            },
          },
        },
        orderBy: [{ department: "asc" }, { displayName: "asc" }],
      });

      return res.status(200).json({ users });
    } catch (err) {
      console.error("[DLM users GET]", err);
      return res.status(500).json({ error: "Failed to fetch users", detail: String(err) });
    }
  }

  if (req.method === "POST") {
    const { userId, managerId } = req.body as { userId: string; managerId: string | null };
    if (!userId) return res.status(400).json({ error: "userId required" });

    // Prevent circular assignment
    if (managerId && userId === managerId) {
      return res.status(400).json({ error: "A user cannot be their own DLM" });
    }

    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { managerId: managerId || null },
        select: {
          id: true,
          email: true,
          displayName: true,
          managerId: true,
          manager: { select: { id: true, email: true, displayName: true } },
        },
      });

      return res.status(200).json({ user: updated });
    } catch (err) {
      console.error("[DLM users POST]", err);
      return res.status(500).json({ error: "Failed to assign DLM", detail: String(err) });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
