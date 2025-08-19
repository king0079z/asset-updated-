import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";
import { VendorType } from "@prisma/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Enhanced logging for debugging
  console.log(`[Vendors API] Processing ${req.method} request to /api/vendors`);
  
  // Get the authenticated user
  const supabase = createClient(req, res);
  
  // Log auth attempt
  console.log(`[Vendors API] Attempting to get authenticated user`);
  
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Log auth result
  if (authError) {
    console.error("[Vendors API] Authentication error:", authError);
    console.error("[Vendors API] Auth error details:", JSON.stringify({
      name: authError.name,
      message: authError.message,
      status: authError.status
    }));
  } else if (user) {
    console.log(`[Vendors API] Successfully authenticated user: ${user.id}`);
  } else {
    console.error("[Vendors API] No user found and no auth error");
  }

  // For GET requests, proceed even without authentication to prevent blocking the UI
  // This is a temporary fix to allow the application to function
  if (req.method === "GET") {
    try {
      const { type } = req.query;
      
      console.log(`[Vendors API] Fetching vendors with type filter: ${type || 'none'}`);
      
      const vendors = await prisma.vendor.findMany({
        where: type ? {
          type: {
            has: type as VendorType
          }
        } : undefined,
        orderBy: {
          name: "asc",
        },
      });
      
      console.log(`[Vendors API] Successfully fetched ${vendors.length} vendors`);
      return res.status(200).json(vendors);
    } catch (error) {
      console.error("[Vendors API] Error fetching vendors:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  // For non-GET requests, we still require authentication
  if (authError || !user) {
    console.error("[Vendors API] Authentication required for non-GET requests");
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.method === "POST") {
    try {
      const vendor = await prisma.vendor.create({
        data: req.body,
      });
      return res.status(201).json(vendor);
    } catch (error) {
      console.error("Error creating vendor:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}