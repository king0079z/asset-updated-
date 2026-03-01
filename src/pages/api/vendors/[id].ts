import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Get the authenticated user
  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

  if (authError || !user) {
    console.error("Authentication error:", authError);
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check if user is admin
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!dbUser?.isAdmin && dbUser?.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }

  const { id, check } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ message: "Invalid vendor ID" });
  }
  
  // Handle association check (for both HEAD and GET methods)
  if (check === "associations" && (req.method === "HEAD" || req.method === "GET")) {
    try {
      // Check if vendor is associated with any assets, food supplies, etc.
      const assetsCount = await prisma.asset.count({
        where: { vendorId: id },
      });
      
      const foodSuppliesCount = await prisma.foodSupply.count({
        where: { vendorId: id },
      });
      
      if (assetsCount > 0 || foodSuppliesCount > 0) {
        // For HEAD requests, just return the status code
        if (req.method === "HEAD") {
          return res.status(409).end();
        }
        
        // For GET requests, return the full details
        let assetExamples = [];
        if (assetsCount > 0) {
          assetExamples = await prisma.asset.findMany({
            where: { vendorId: id },
            select: { id: true, name: true, assetId: true },
            take: 5, // Limit to 5 examples
          });
        }
        
        let foodSupplyExamples = [];
        if (foodSuppliesCount > 0) {
          foodSupplyExamples = await prisma.foodSupply.findMany({
            where: { vendorId: id },
            select: { id: true, name: true },
            take: 5, // Limit to 5 examples
          });
        }
        
        return res.status(200).json({
          message: "Vendor has associated items",
          details: {
            assetsCount,
            foodSuppliesCount,
            assetExamples,
            foodSupplyExamples
          },
          resolution: "Before deleting this vendor, please reassign or remove all associated assets and food supplies."
        });
      }
      
      // No associations found
      return res.status(200).json({ message: "No associations found" });
    } catch (error) {
      console.error(`Error checking vendor associations ${id}:`, error);
      return res.status(500).json({ message: "Failed to check vendor associations" });
    }
  }

  // Handle PUT request (update vendor)
  if (req.method === "PUT") {
    try {
      const { 
        name, 
        email, 
        phone, 
        address, 
        type, 
        reliabilityScore, 
        qualityScore, 
        responseTimeScore, 
        lastReviewDate, 
        notes 
      } = req.body;

      // Log the incoming data for debugging
      console.log(`Updating vendor ${id} with data:`, {
        name,
        email,
        phone,
        address,
        type,
        reliabilityScore,
        qualityScore,
        responseTimeScore,
        lastReviewDate,
        notes
      });

      // Prepare the data for update
      const updateData: any = {
        name,
        email,
        phone,
        address,
        type,
        notes
      };

      // Only include performance metrics if they are provided
      if (reliabilityScore !== undefined) {
        updateData.reliabilityScore = reliabilityScore;
      }
      
      if (qualityScore !== undefined) {
        updateData.qualityScore = qualityScore;
      }
      
      if (responseTimeScore !== undefined) {
        updateData.responseTimeScore = responseTimeScore;
      }
      
      if (lastReviewDate) {
        updateData.lastReviewDate = lastReviewDate;
      }

      const updatedVendor = await prisma.vendor.update({
        where: { id },
        data: updateData,
      });
      
      // Create an audit log entry for the performance evaluation if metrics were updated
      if (reliabilityScore !== undefined || qualityScore !== undefined || responseTimeScore !== undefined) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            userEmail: user.email,
            action: "VENDOR_PERFORMANCE_EVALUATION",
            resourceType: "VENDOR",
            resourceId: id,
            details: {
              reliabilityScore,
              qualityScore,
              responseTimeScore,
              previousReliabilityScore: updatedVendor.reliabilityScore,
              previousQualityScore: updatedVendor.qualityScore,
              previousResponseTimeScore: updatedVendor.responseTimeScore,
            },
            type: "DATA_MODIFICATION",
            severity: "INFO",
          },
        });
      }
      
      console.log(`Vendor updated: ${id}`, updatedVendor);
      return res.status(200).json(updatedVendor);
    } catch (error) {
      console.error(`Error updating vendor ${id}:`, error);
      return res.status(500).json({ message: "Failed to update vendor" });
    }
  }

  // Handle DELETE request
  if (req.method === "DELETE") {
    try {
      // Check if vendor is associated with any assets, food supplies, etc.
      const assetsCount = await prisma.asset.count({
        where: { vendorId: id },
      });
      
      const foodSuppliesCount = await prisma.foodSupply.count({
        where: { vendorId: id },
      });
      
      if (assetsCount > 0 || foodSuppliesCount > 0) {
        // If there are associated items, get some examples to help the user identify them
        let assetExamples = [];
        if (assetsCount > 0) {
          assetExamples = await prisma.asset.findMany({
            where: { vendorId: id },
            select: { id: true, name: true, assetId: true },
            take: 5, // Limit to 5 examples
          });
        }
        
        let foodSupplyExamples = [];
        if (foodSuppliesCount > 0) {
          foodSupplyExamples = await prisma.foodSupply.findMany({
            where: { vendorId: id },
            select: { id: true, name: true },
            take: 5, // Limit to 5 examples
          });
        }
        
        return res.status(409).json({ // Using 409 Conflict status code which is more appropriate
          message: "Cannot delete vendor with associated items",
          details: {
            assetsCount,
            foodSuppliesCount,
            assetExamples,
            foodSupplyExamples
          },
          resolution: "Before deleting this vendor, please reassign or remove all associated assets and food supplies."
        });
      }
      
      // Delete the vendor
      await prisma.vendor.delete({
        where: { id },
      });
      
      console.log(`Vendor deleted: ${id}`);
      return res.status(200).json({ message: "Vendor deleted successfully" });
    } catch (error) {
      console.error(`Error deleting vendor ${id}:`, error);
      return res.status(500).json({ message: "Failed to delete vendor" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}