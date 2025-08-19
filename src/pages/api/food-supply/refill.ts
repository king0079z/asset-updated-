import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id, newQuantity, newExpirationDate, disposedQuantity } = req.body;

    if (!id || !newQuantity || !newExpirationDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Get the current food supply item
    const foodSupply = await prisma.foodSupply.findUnique({
      where: { id },
    });

    if (!foodSupply) {
      return res.status(404).json({ message: "Food supply not found" });
    }

    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (prisma) => {
      // If there's disposed quantity (expired items), create a waste record
      if (disposedQuantity > 0) {
        await prisma.foodDisposal.create({
          data: {
            foodSupplyId: id,
            quantity: disposedQuantity,
            reason: "Expired - Replaced during refill",
            userId: userId,
          },
        });
        
        // Update the totalWasted field on the food supply item
        await prisma.foodSupply.update({
          where: { id },
          data: {
            totalWasted: {
              increment: disposedQuantity
            }
          }
        });
      }

      // Update the food supply item with new quantity and expiration date
      const updatedFoodSupply = await prisma.foodSupply.update({
        where: { id },
        data: {
          quantity: newQuantity,
          expirationDate: new Date(newExpirationDate),
          updatedAt: new Date(),
        },
      });

      return updatedFoodSupply;
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error refilling food supply:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}