import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";
import { AssetStatus } from "@prisma/client";

// Enhanced logging function
const logApiEvent = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} [Vendor Assets API] ${message}`);
  if (data) {
    console.log(`${timestamp} [Vendor Assets API] Data:`, typeof data === 'object' ? JSON.stringify(data) : data);
  }
};

// Calculate asset health score based on status
const calculateAssetHealthScore = (status: AssetStatus): number => {
  switch (status) {
    case "LIKE_NEW":
      return 100;
    case "ACTIVE":
      return 80;
    case "MAINTENANCE":
      return 40;
    case "DAMAGED":
      return 20;
    case "CRITICAL":
      return 10;
    case "DISPOSED":
      return 0;
    case "IN_TRANSIT":
      return 70;
    default:
      return 50;
  }
};

// Calculate vendor evaluation score based on asset health and quality metrics
const calculateVendorEvaluation = (assets: any[]): {
  overallHealthScore: number;
  assetStatusCounts: Record<string, number>;
  totalAssets: number;
  healthDistribution: Record<string, number>;
  qualityMetrics: {
    disposalRate: number;
    maintenanceRate: number;
    damageRate: number;
    averageLifespan: number | null;
    qualityScore: number;
  };
} => {
  if (!assets.length) {
    return {
      overallHealthScore: 0,
      assetStatusCounts: {},
      totalAssets: 0,
      healthDistribution: {},
      qualityMetrics: {
        disposalRate: 0,
        maintenanceRate: 0,
        damageRate: 0,
        averageLifespan: null,
        qualityScore: 0
      }
    };
  }

  // Count assets by status
  const assetStatusCounts: Record<string, number> = {};
  let totalHealthScore = 0;

  assets.forEach(asset => {
    const status = asset.status;
    assetStatusCounts[status] = (assetStatusCounts[status] || 0) + 1;
    totalHealthScore += calculateAssetHealthScore(status);
  });

  // Calculate overall health score (average of all asset health scores)
  const overallHealthScore = Math.round(totalHealthScore / assets.length);

  // Calculate health distribution percentages
  const healthDistribution: Record<string, number> = {};
  Object.keys(assetStatusCounts).forEach(status => {
    healthDistribution[status] = Math.round((assetStatusCounts[status] / assets.length) * 100);
  });

  // Calculate quality metrics
  const disposedCount = assetStatusCounts["DISPOSED"] || 0;
  const maintenanceCount = assetStatusCounts["MAINTENANCE"] || 0;
  const damagedCount = assetStatusCounts["DAMAGED"] || 0;
  const criticalCount = assetStatusCounts["CRITICAL"] || 0;

  // Calculate rates as percentages
  const disposalRate = Math.round((disposedCount / assets.length) * 100);
  const maintenanceRate = Math.round((maintenanceCount / assets.length) * 100);
  const damageRate = Math.round(((damagedCount + criticalCount) / assets.length) * 100);

  // Calculate average lifespan for disposed assets (in days)
  let averageLifespan: number | null = null;
  const disposedAssets = assets.filter(asset => asset.status === "DISPOSED" && asset.purchaseDate && asset.disposedAt);
  
  if (disposedAssets.length > 0) {
    const lifespans = disposedAssets.map(asset => {
      const purchaseDate = new Date(asset.purchaseDate);
      const disposedDate = new Date(asset.disposedAt);
      return Math.round((disposedDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)); // Convert to days
    });
    
    averageLifespan = Math.round(lifespans.reduce((sum, days) => sum + days, 0) / lifespans.length);
  }

  // Calculate quality score based on multiple factors
  // Lower disposal, maintenance, and damage rates are better
  // Higher average lifespan is better
  let qualityScore = 100;
  
  // Reduce score based on disposal rate (high disposal rate = lower quality)
  qualityScore -= disposalRate * 0.5;
  
  // Reduce score based on maintenance rate
  qualityScore -= maintenanceRate * 0.3;
  
  // Reduce score based on damage rate (damaged + critical)
  qualityScore -= damageRate * 0.7;
  
  // Adjust score based on average lifespan if available
  if (averageLifespan !== null) {
    // Bonus for items lasting longer than 365 days (1 year)
    if (averageLifespan > 365) {
      qualityScore += 10;
    }
    // Penalty for items lasting less than 180 days (6 months)
    else if (averageLifespan < 180) {
      qualityScore -= 10;
    }
  }
  
  // Ensure score is between 0 and 100
  qualityScore = Math.max(0, Math.min(100, Math.round(qualityScore)));

  return {
    overallHealthScore,
    assetStatusCounts,
    totalAssets: assets.length,
    healthDistribution,
    qualityMetrics: {
      disposalRate,
      maintenanceRate,
      damageRate,
      averageLifespan,
      qualityScore
    }
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  logApiEvent(`Received ${req.method} request`);
  
  try {
    // Get the authenticated user
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (authError || !user) {
      logApiEvent("Authentication error", authError);
      return res.status(401).json({ error: "Unauthorized", details: "You must be logged in to access this resource" });
    }

    const { id } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "Invalid vendor ID" });
    }

    logApiEvent(`Authenticated user: ${user.id}, fetching assets for vendor: ${id}`);

    if (req.method === "GET") {
      try {
        // Check if user is admin or manager
        const userRoleData = await prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, email: true, role: true, isAdmin: true }
        });
        
        if (!userRoleData) {
          logApiEvent(`User ${user.id} not found in database`);
          return res.status(401).json({ error: "User not found in database" });
        }
        
        const isAdminByRole = userRoleData.role === 'ADMIN' || userRoleData.role === 'MANAGER';
        const isAdminByFlag = userRoleData.isAdmin === true;
        const isAdminOrManagerUser = isAdminByRole || isAdminByFlag;
        
        if (!isAdminOrManagerUser) {
          return res.status(403).json({ message: "Forbidden: Admin or Manager access required" });
        }

        // Get vendor details
        const vendor = await prisma.vendor.findUnique({
          where: { id },
        });

        if (!vendor) {
          return res.status(404).json({ message: "Vendor not found" });
        }

        // Get all assets for this vendor
        const assets = await prisma.asset.findMany({
          where: { 
            vendorId: id 
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        // Calculate vendor evaluation based on asset health
        const vendorEvaluation = calculateVendorEvaluation(assets);

        // Format dates to ISO strings to ensure proper serialization
        const formattedAssets = assets.map(asset => {
          // Safely format the purchase date if it exists
          let formattedPurchaseDate = null;
          if (asset.purchaseDate) {
            try {
              formattedPurchaseDate = new Date(asset.purchaseDate).toISOString();
            } catch (e) {
              console.error(`Error formatting purchase date for asset ${asset.id}:`, e);
            }
          }
          
          return {
            ...asset,
            purchaseDate: formattedPurchaseDate,
            createdAt: asset.createdAt.toISOString(),
            updatedAt: asset.updatedAt.toISOString(),
            disposedAt: asset.disposedAt ? new Date(asset.disposedAt).toISOString() : null,
            lastMovedAt: asset.lastMovedAt ? new Date(asset.lastMovedAt).toISOString() : null,
            healthScore: calculateAssetHealthScore(asset.status)
          };
        });
        
        logApiEvent(`Successfully fetched ${formattedAssets.length} assets for vendor ${id}`);
        return res.status(200).json({
          vendor,
          assets: formattedAssets,
          evaluation: vendorEvaluation
        });
      } catch (error) {
        logApiEvent("Error fetching vendor assets", error);
        
        if (error instanceof Error) {
          console.error(`Error name: ${error.name}`);
          console.error(`Error message: ${error.message}`);
          console.error(`Error stack: ${error.stack}`);
        }
        
        return res.status(500).json({ 
          error: "Failed to fetch vendor assets", 
          details: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    logApiEvent("Unexpected error in vendor assets API", error);
    
    if (error instanceof Error) {
      console.error(`Error name: ${error.name}`);
      console.error(`Error message: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
    }
    
    return res.status(500).json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    });
  }
}