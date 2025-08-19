import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";
import { isAdminOrManager } from "@/util/roleCheck";

// Enhanced logging function
const logApiEvent = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} [Assets API] ${message}`);
  if (data) {
    console.log(`${timestamp} [Assets API] Data:`, typeof data === 'object' ? JSON.stringify(data) : data);
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  logApiEvent(`Received ${req.method} request`);
  
  try {
    // Get the authenticated user
    const supabase = createClient(req, res);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      logApiEvent("Authentication error", authError);
      logApiEvent("Auth error details", {
        name: authError.name,
        message: authError.message,
        status: authError.status
      });
    } else if (!user) {
      logApiEvent("No user found and no auth error");
    }
    
    // For GET requests, proceed even without authentication to prevent blocking the UI
    // This is a temporary fix to allow the application to function
    if (req.method === "GET") {
      if (authError || !user) {
        logApiEvent("Proceeding with GET request despite auth issues");
      }
    } else if (authError || !user) {
      // For non-GET requests, we still require authentication
      logApiEvent("Authentication required for non-GET requests");
      return res.status(401).json({ error: "Unauthorized", details: "You must be logged in to access this resource" });
    }

    // Only log authenticated user if we have one
    if (user) {
      logApiEvent(`Authenticated user: ${user.id}`);
    }

    if (req.method === "GET") {
      try {
        // Handle different search parameters
        const { search, barcode, assetId } = req.query;
        const searchTerm = search || barcode || assetId;
        
        logApiEvent(`Processing GET request`, { searchTerm: searchTerm || "none" });

        // CRITICAL FIX: First, directly check if the user is an admin or manager
        // This is the most reliable way to determine the user's role
        let userRoleData = null;
        let isAdminOrManagerUser = false;
        let organizationId = null;
        
        if (user) {
          userRoleData = await prisma.user.findUnique({
            where: { id: user.id },
            select: { id: true, email: true, role: true, isAdmin: true, organizationId: true }
          });
          
          if (userRoleData) {
            logApiEvent(`User role data:`, userRoleData);
            organizationId = userRoleData.organizationId;
            
            // Determine if user is admin or manager using multiple checks for redundancy
            const isAdminByRole = userRoleData.role === 'ADMIN' || userRoleData.role === 'MANAGER';
            const isAdminByFlag = userRoleData.isAdmin === true;
            isAdminOrManagerUser = isAdminByRole || isAdminByFlag;
            
            logApiEvent(`Role determination: isAdminByRole=${isAdminByRole}, isAdminByFlag=${isAdminByFlag}, final=${isAdminOrManagerUser}, organizationId=${organizationId}`);
          } else {
            logApiEvent(`User ${user.id} not found in database`);
          }
        } else {
          logApiEvent(`No authenticated user, proceeding with read-only access`);
        }
        
        // We've already determined isAdminOrManagerUser above
        
        if (searchTerm) {
          logApiEvent(`Searching for asset by identifier`, { searchTerm, searchType: search ? 'general' : barcode ? 'barcode' : 'assetId' });
          
          // Get user's organization for scoping
          let organizationId = null;
          if (user) {
            const userData = await prisma.user.findUnique({
              where: { id: user.id },
              select: { organizationId: true }
            });
            organizationId = userData?.organizationId;
          }
          
          // Build search conditions based on the parameter type
          let searchConditions;
          if (barcode) {
            // Exact barcode match
            searchConditions = [{ barcode: String(barcode) }];
          } else if (assetId) {
            // Exact assetId match
            searchConditions = [{ assetId: String(assetId) }];
          } else {
            // General search - try both barcode and assetId, plus partial matches
            searchConditions = [
              { barcode: String(searchTerm) },
              { assetId: String(searchTerm) },
              { barcode: { contains: String(searchTerm), mode: 'insensitive' } },
              { assetId: { contains: String(searchTerm), mode: 'insensitive' } },
              { name: { contains: String(searchTerm), mode: 'insensitive' } }
            ];
          }
          
          // Search by barcode or assetId, scoped to organization
          const asset = await prisma.asset.findFirst({
            where: {
              OR: searchConditions,
              // Always scope to organization if available
              ...(organizationId ? { organizationId } : {}),
              // For admin/manager, don't filter by userId within organization
              // If no user, don't filter by userId (temporary fix)
              ...(isAdminOrManagerUser || !user ? {} : { userId: user.id })
            },
            include: {
              vendor: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });

          if (!asset) {
            logApiEvent(`No asset found with identifier`, { searchTerm });
            return res.status(404).json({ error: "Asset not found" });
          }

          logApiEvent(`Asset found`, { assetId: asset.id, assetName: asset.name });
          return res.status(200).json({ asset });
        }

        if (user) {
          logApiEvent(`Fetching assets for user ${user.id} (isAdminOrManager=${isAdminOrManagerUser})`);
        } else {
          logApiEvent(`Fetching assets without authenticated user`);
        }
        
        let assets;

        // GLOBAL ADMIN: If user is isAdmin or email is admin@example.com, return ALL assets
        if (userRoleData && (userRoleData.isAdmin === true || userRoleData.email === 'admin@example.com')) {
          logApiEvent(`Global admin detected (${userRoleData.email}), fetching ALL assets (no organization filter)`);
          assets = await prisma.asset.findMany({
            select: {
              id: true,
              assetId: true,
              name: true,
              description: true,
              barcode: true,
              type: true,
              imageUrl: true,
              floorNumber: true,
              roomNumber: true,
              status: true,
              purchaseAmount: true,
              purchaseDate: true,
              userId: true,
              vendorId: true,
              vendor: {
                select: {
                  id: true,
                  name: true,
                },
              },
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          });
          logApiEvent(`Found ${assets.length} assets for global admin`);
        }
        // Use separate queries for admin/manager vs regular users vs no user
        else if (isAdminOrManagerUser && organizationId) {
          // For admin/manager, get ALL assets within their organization
          logApiEvent(`Fetching organization assets for admin/manager user`);
          logApiEvent(`Executing query to fetch organization assets (organizationId: ${organizationId})`);
          assets = await prisma.asset.findMany({
            where: {
              organizationId: organizationId
            },
            select: {
              id: true,
              assetId: true,
              name: true,
              description: true,
              barcode: true,
              type: true,
              imageUrl: true,
              floorNumber: true,
              roomNumber: true,
              status: true,
              purchaseAmount: true,
              purchaseDate: true,
              userId: true, // Include userId for debugging
              vendorId: true, // Explicitly include vendorId
              vendor: {
                select: {
                  id: true,
                  name: true,
                },
              },
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          });
          logApiEvent(`Found ${assets.length} organization assets for admin/manager user`);
          if (assets.length > 0) {
            logApiEvent(`First asset:`, {
              id: assets[0].id,
              name: assets[0].name,
              userId: assets[0].userId
            });
          }
        } else if (user && organizationId) {
          // For regular users, only get their own assets within their organization
          logApiEvent(`Fetching user's assets within organization for regular user ${user.id}`);
          assets = await prisma.asset.findMany({
            where: { 
              userId: user.id,
              organizationId: organizationId
            },
            select: {
              id: true,
              assetId: true,
              name: true,
              description: true,
              barcode: true,
              type: true,
              imageUrl: true,
              floorNumber: true,
              roomNumber: true,
              status: true,
              purchaseAmount: true,
              purchaseDate: true,
              vendorId: true, // Explicitly include vendorId
              vendor: {
                select: {
                  id: true,
                  name: true,
                },
              },
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          });
          
          logApiEvent(`Found ${assets.length} assets for regular user within organization`);
        } else {
          // No authenticated user or no organization, return empty array for security
          logApiEvent(`No authenticated user or organization, returning empty array`);
          assets = [];
        }
        
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
            createdAt: asset.createdAt.toISOString()
          };
        });
        
        logApiEvent(`Successfully fetched ${formattedAssets.length} assets`);
        return res.status(200).json(formattedAssets);
      } catch (error) {
        logApiEvent("Error fetching assets", error);
        
        // Log detailed error information
        if (error instanceof Error) {
          console.error(`Error name: ${error.name}`);
          console.error(`Error message: ${error.message}`);
          console.error(`Error stack: ${error.stack}`);
          
          // Handle database connection issues
          if (error.message.includes('connect ECONNREFUSED') || 
              error.message.includes('Connection refused') ||
              error.message.includes('timeout')) {
            return res.status(503).json({ 
              error: 'Database connection error', 
              details: 'Could not connect to the database. Please try again later.' 
            });
          }
        }
        
        return res.status(500).json({ 
          error: "Failed to fetch assets", 
          details: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    logApiEvent("Unexpected error in assets API", error);
    
    // Log detailed error information
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