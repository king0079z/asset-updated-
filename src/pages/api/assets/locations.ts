import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const supabase = createClient(req, res);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Auth error:", authError);
      return res.status(401).json({ 
        message: "Authentication error", 
        error: authError.message || "Failed to authenticate user"
      });
    }

    if (!user) {
      return res.status(401).json({ 
        message: "Unauthorized - No user found",
        error: "User session not found"
      });
    }

    const assets = await prisma.asset.findMany({
      where: {
        userId: user.id,
        location: {
          isNot: null
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        location: {
          select: {
            id: true,
            latitude: true,
            longitude: true,
            address: true
          }
        },
        floorNumber: true,
        roomNumber: true,
        purchaseAmount: true,
        createdAt: true,
        imageUrl: true,
      },
    }).catch((error) => {
      console.error("Prisma error:", error);
      throw new Error("Failed to fetch assets from database: " + error.message);
    });

    if (!assets) {
      return res.status(500).json({ 
        message: "Failed to fetch assets", 
        error: "Database query returned null" 
      });
    }

    // Validate location data
    const validAssets = assets.filter(asset => {
      if (!asset.location || 
          typeof asset.location.latitude !== 'number' || 
          typeof asset.location.longitude !== 'number') {
        console.warn(`Asset ${asset.id} has invalid location data:`, asset.location);
        return false;
      }
      return true;
    });

    if (validAssets.length === 0 && assets.length > 0) {
      console.warn("No assets with valid location data found");
      return res.status(200).json([]);
    }

    return res.status(200).json(validAssets);
  } catch (error) {
    console.error("Error fetching asset locations:", error);
    return res.status(500).json({ 
      message: "Internal server error", 
      error: error instanceof Error ? error.message : "An unexpected error occurred while fetching assets"
    });
  }
}