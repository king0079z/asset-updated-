import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";
import { getUserRoleData } from "@/util/roleCheck";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.query;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Food supply ID is required" });
    }

    const supply = await prisma.foodSupply.findUnique({
      where: { id },
      include: {
        vendor: true,
        kitchenSupplies: {
          include: {
            kitchen: true,
          },
        },
      },
    });

    if (!supply) {
      return res.status(404).json({ error: "Food supply not found" });
    }

    let roleData: Awaited<ReturnType<typeof getUserRoleData>> = null;
    try {
      roleData = await getUserRoleData(user.id);
    } catch (e) {
      console.error("[Food supply GET] getUserRoleData error:", e instanceof Error ? e.message : e);
    }
    const userIsAdminOrManager = roleData?.role === "ADMIN" || roleData?.role === "MANAGER";
    const hasFoodSupplyAccess = roleData?.pageAccess?.["/food-supply"] === true;
    const canAccess = userIsAdminOrManager || hasFoodSupplyAccess || supply.userId === user.id;

    if (!canAccess) {
      return res.status(403).json({ error: "You do not have access to this food supply" });
    }

    return res.status(200).json(supply);
  } catch (error) {
    console.error("[Food supply GET]", error);
    return res.status(500).json({ error: "Failed to load food supply" });
  }
}
