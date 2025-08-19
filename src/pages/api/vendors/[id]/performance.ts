import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Get the authenticated user
  const supabase = createClient(req, res);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Authentication error:", authError);
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ message: "Invalid vendor ID" });
  }

  // Handle POST request (submit performance evaluation)
  if (req.method === "POST") {
    try {
      const { reliabilityScore, qualityScore, responseTimeScore, lastReviewDate, notes } = req.body;

      // Log the performance evaluation submission
      console.log(`Vendor performance evaluation submitted for ${id}:`, {
        reliabilityScore,
        qualityScore,
        responseTimeScore,
        lastReviewDate,
        notes,
        userId: user.id,
        userEmail: user.email,
      });

      // Update the vendor with the performance metrics
      const updatedVendor = await prisma.vendor.update({
        where: { id },
        data: {
          reliabilityScore,
          qualityScore,
          responseTimeScore,
          lastReviewDate,
          notes,
        },
      });

      // Create an audit log entry for the performance evaluation
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

      return res.status(200).json(updatedVendor);
    } catch (error) {
      console.error(`Error submitting vendor performance evaluation for ${id}:`, error);
      return res.status(500).json({ message: "Failed to submit performance evaluation" });
    }
  }

  // Handle GET request (get vendor performance history)
  if (req.method === "GET") {
    try {
      // Get the vendor details
      const vendor = await prisma.vendor.findUnique({
        where: { id },
      });

      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }

      // Get the performance evaluation history from audit logs
      const performanceHistory = await prisma.auditLog.findMany({
        where: {
          resourceType: "VENDOR",
          resourceId: id,
          action: "VENDOR_PERFORMANCE_EVALUATION",
        },
        orderBy: {
          timestamp: "desc",
        },
      });

      return res.status(200).json({
        vendor,
        performanceHistory,
      });
    } catch (error) {
      console.error(`Error fetching vendor performance history for ${id}:`, error);
      return res.status(500).json({ message: "Failed to fetch performance history" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}