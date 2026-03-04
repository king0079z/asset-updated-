import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";
import { getUserRoleData } from "@/util/roleCheck";

/**
 * GET /api/assets/by-user
 * Returns two things:
 *   1. A list of unique users who have assets assigned to them (with count)
 *   2. If ?userId= is provided, all assets assigned to that user
 *
 * Query params:
 *   userId   - (optional) filter assets by this assigned user id
 *   search   - (optional) filter users by email search term
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const roleData = await getUserRoleData(user.id);
    const isPrivileged = roleData
      ? roleData.role === "ADMIN" || roleData.role === "MANAGER" || roleData.isAdmin
      : false;
    const orgId = roleData?.organizationId ?? null;

    // Org scope for assets
    const orgScope = orgId
      ? { OR: [{ organizationId: orgId }, { organizationId: null }] }
      : {};

    const { userId, search } = req.query;

    // ── Return assets for a specific assigned user ──────────────────────────
    if (userId && typeof userId === "string") {
      const assets = await prisma.asset.findMany({
        where: {
          assignedToId: userId,
          ...orgScope,
        },
        select: {
          id: true, assetId: true, name: true, type: true, status: true,
          imageUrl: true, floorNumber: true, roomNumber: true,
          purchaseAmount: true, purchaseDate: true, barcode: true,
          createdAt: true, lastMovedAt: true,
          assignedToName: true, assignedToEmail: true, assignedToId: true, assignedAt: true,
          vendor: { select: { name: true } },
        },
        orderBy: { assignedAt: "desc" },
      });

      return res.status(200).json({ assets });
    }

    // ── Return grouped user list with asset counts ──────────────────────────
    // Get all assets that have been assigned
    const allAssigned = await prisma.asset.findMany({
      where: {
        assignedToId: { not: null },
        ...orgScope,
      },
      select: {
        assignedToId: true,
        assignedToName: true,
        assignedToEmail: true,
        status: true,
      },
    });

    // Group by user
    const userMap = new Map<string, {
      userId: string;
      name: string | null;
      email: string | null;
      total: number;
      active: number;
    }>();

    for (const asset of allAssigned) {
      if (!asset.assignedToId) continue;
      const existing = userMap.get(asset.assignedToId);
      if (existing) {
        existing.total++;
        if (asset.status === "ACTIVE") existing.active++;
      } else {
        userMap.set(asset.assignedToId, {
          userId: asset.assignedToId,
          name: asset.assignedToName ?? null,
          email: asset.assignedToEmail ?? null,
          total: 1,
          active: asset.status === "ACTIVE" ? 1 : 0,
        });
      }
    }

    let users = Array.from(userMap.values()).sort((a, b) => b.total - a.total);

    // Optional email search filter
    if (search && typeof search === "string" && search.trim()) {
      const q = search.toLowerCase();
      users = users.filter(u =>
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q)
      );
    }

    return res.status(200).json({ users });
  } catch (err) {
    console.error("by-user API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
