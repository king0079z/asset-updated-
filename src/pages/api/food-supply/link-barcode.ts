import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = createClient(req, res);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { foodSupplyId, kitchenId } = req.body;

    if (!foodSupplyId || !kitchenId) {
      return res.status(400).json({ error: "foodSupplyId and kitchenId are required" });
    }

    // Check if the food supply exists
    const foodSupply = await prisma.foodSupply.findUnique({
      where: { id: foodSupplyId },
    });

    if (!foodSupply) {
      return res.status(404).json({ error: "Food supply not found" });
    }

    // Check if the kitchen exists
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
    });

    if (!kitchen) {
      return res.status(404).json({ error: "Kitchen not found" });
    }

    // Check if a barcode already exists for this food supply in this kitchen
    const existingBarcode = await prisma.kitchenBarcode.findFirst({
      where: {
        kitchenId,
        foodSupplyId,
      },
    });

    if (existingBarcode) {
      return res.status(200).json({
        barcode: existingBarcode.barcode,
        message: "Barcode already exists for this food supply in this kitchen"
      });
    }

    // Create a new barcode
    const timestamp = Date.now();
    const barcode = `KIT${kitchenId.substring(0, 4)}SUP${foodSupplyId.substring(0, 4)}${timestamp}`.toUpperCase();
    console.info(`[Barcode Generation] Creating new barcode: ${barcode} for kitchen: ${kitchenId} and food supply: ${foodSupplyId}`);
    
    const kitchenBarcode = await prisma.kitchenBarcode.create({
      data: {
        barcode,
        kitchenId,
        foodSupplyId,
      },
    });

    return res.status(200).json({
      barcode: kitchenBarcode.barcode,
      message: "Successfully linked barcode to food supply"
    });
  } catch (error) {
    console.error("Error in link-barcode API:", error);
    return res.status(500).json({ error: "Failed to create and link barcode" });
  }
}