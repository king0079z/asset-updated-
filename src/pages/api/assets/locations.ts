import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";
import { getUserRoleData } from "@/util/roleCheck";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (authError) {
      return res.status(401).json({ message: "Authentication error", error: authError.message });
    }

    if (!user) {
      return res.status(401).json({ message: "Unauthorized - No user found" });
    }

    const roleData = await getUserRoleData(user.id);
    const organizationId = roleData?.organizationId ?? null;
    const isAdminOrManagerUser = roleData?.role === 'ADMIN' || roleData?.role === 'MANAGER' || roleData?.isAdmin === true;

    // Build where clause based on role
    let whereClause: any = {
      location: { isNot: null }
    };

    if (isAdminOrManagerUser && organizationId) {
      // Admins/Managers see all org assets
      whereClause.organizationId = organizationId;
    } else if (organizationId) {
      // Regular users see only their own assets within the org
      whereClause.userId = user.id;
      whereClause.organizationId = organizationId;
    } else {
      // Fallback: user's own assets
      whereClause.userId = user.id;
    }

    const assets = await prisma.asset.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        type: true,
        location: {
          select: {
            id: true,
            latitude: true,
            longitude: true,
            address: true,
            accuracy: true,
            source: true,
            updatedAt: true,
          }
        },
        floorNumber: true,
        roomNumber: true,
        purchaseAmount: true,
        createdAt: true,
        updatedAt: true,
        imageUrl: true,
        assetId: true,
      },
    });

    // Filter out assets with invalid location data
    const validAssets = assets.filter(asset => {
      if (
        !asset.location ||
        typeof asset.location.latitude !== 'number' ||
        typeof asset.location.longitude !== 'number' ||
        isNaN(asset.location.latitude) ||
        isNaN(asset.location.longitude)
      ) {
        return false;
      }
      return true;
    });

    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=15');
    return res.status(200).json(validAssets);
  } catch (error) {
    console.error("Error fetching asset locations:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "An unexpected error occurred"
    });
  }
}
