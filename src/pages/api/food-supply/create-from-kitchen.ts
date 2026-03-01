import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";
import { logDataModification } from "@/lib/audit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = createClient(req, res);
    const {
      data: { user },
    } = await supabase.auth.getSession();

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, quantity, unit, category, expirationDate, notes, pricePerUnit, vendorId, kitchenId, linkedFoodSupplyId } = req.body;

    // Validate kitchen exists
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
    });

    if (!kitchen) {
      return res.status(404).json({ error: "Kitchen not found" });
    }

    // Check if a food supply with this name already exists
    const existingFoodSupply = await prisma.foodSupply.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
        unit: unit,
      },
    });

    let foodSupply;

    // If linkedFoodSupplyId is provided, use that food supply
    if (linkedFoodSupplyId) {
      // Check if the linked food supply exists
      const linkedFoodSupply = await prisma.foodSupply.findUnique({
        where: { id: linkedFoodSupplyId },
      });

      if (!linkedFoodSupply) {
        return res.status(404).json({ error: "Linked food supply not found" });
      }

      // Check if this food supply is already linked to this kitchen
      const existingKitchenFoodSupply = await prisma.kitchenFoodSupply.findUnique({
        where: {
          kitchenId_foodSupplyId: {
            kitchenId: kitchenId,
            foodSupplyId: linkedFoodSupplyId,
          },
        },
      });

      if (existingKitchenFoodSupply) {
        // If it's already linked to this kitchen, update the quantity and expiration date
        await prisma.kitchenFoodSupply.update({
          where: {
            id: existingKitchenFoodSupply.id,
          },
          data: {
            quantity: {
              increment: parseFloat(quantity),
            },
            expirationDate: new Date(expirationDate),
          },
        });
      } else {
        // If it's not linked to this kitchen, create a new kitchen-specific entry
        await prisma.kitchenFoodSupply.create({
          data: {
            kitchenId,
            foodSupplyId: linkedFoodSupplyId,
            quantity: parseFloat(quantity),
            expirationDate: new Date(expirationDate),
          },
        });
      }

      foodSupply = linkedFoodSupply;
    } else if (existingFoodSupply) {
      // If the food supply already exists, check if it's already linked to this kitchen
      const existingKitchenFoodSupply = await prisma.kitchenFoodSupply.findUnique({
        where: {
          kitchenId_foodSupplyId: {
            kitchenId: kitchenId,
            foodSupplyId: existingFoodSupply.id,
          },
        },
      });

      if (existingKitchenFoodSupply) {
        // If it's already linked to this kitchen, update the quantity and expiration date
        await prisma.kitchenFoodSupply.update({
          where: {
            id: existingKitchenFoodSupply.id,
          },
          data: {
            quantity: {
              increment: parseFloat(quantity),
            },
            expirationDate: new Date(expirationDate),
          },
        });
      } else {
        // If it's not linked to this kitchen, create a new kitchen-specific entry
        await prisma.kitchenFoodSupply.create({
          data: {
            kitchenId,
            foodSupplyId: existingFoodSupply.id,
            quantity: parseFloat(quantity),
            expirationDate: new Date(expirationDate),
          },
        });
      }

      foodSupply = existingFoodSupply;
    } else {
      // Create a new food supply if it doesn't exist
      foodSupply = await prisma.foodSupply.create({
        data: {
          name,
          quantity: parseFloat(quantity), // Keep this for backward compatibility
          unit,
          category,
          expirationDate: new Date(expirationDate), // Keep this for backward compatibility
          notes: notes || "",
          userId: user.id,
          pricePerUnit: parseFloat(pricePerUnit || 0),
          vendorId: vendorId === "none" ? null : vendorId || null,
        },
      });

      // Create a kitchen-specific entry for this food supply
      await prisma.kitchenFoodSupply.create({
        data: {
          kitchenId,
          foodSupplyId: foodSupply.id,
          quantity: parseFloat(quantity),
          expirationDate: new Date(expirationDate),
        },
      });
    }

    // Generate a barcode for the kitchen-food supply combination
    const timestamp = Date.now();
    const barcode = `KIT${kitchenId.substring(0, 4)}SUP${foodSupply.id.substring(0, 4)}${timestamp}`.toUpperCase();
    
    // Create the kitchen barcode
    const kitchenBarcode = await prisma.kitchenBarcode.create({
      data: {
        barcode,
        kitchenId,
        foodSupplyId: foodSupply.id,
      },
      include: {
        kitchen: true,
        foodSupply: true,
      },
    });
    
    // Also update the food supply with the barcode for direct scanning
    await prisma.foodSupply.update({
      where: { id: foodSupply.id },
      data: { barcode },
    });

    // Create audit log for food supply creation
    await logDataModification(
      'FOOD_SUPPLY',
      foodSupply.id,
      'CREATE',
      {
        name,
        quantity: parseFloat(quantity),
        unit,
        category,
        expirationDate: new Date(expirationDate),
        pricePerUnit: parseFloat(pricePerUnit || 0),
        kitchenId,
        kitchenName: kitchen.name,
      },
      {
        action: 'Food Supply Registration from Kitchen',
        foodSupplyName: name,
        category,
        quantity: `${quantity} ${unit}`,
        userId: user.id,
        userEmail: user.email,
        kitchenId,
        kitchenName: kitchen.name,
      }
    );

    return res.status(200).json({
      foodSupply,
      kitchenBarcode,
    });
  } catch (error) {
    console.error("Error creating food supply from kitchen:", error);
    return res.status(500).json({ error: "Failed to create food supply" });
  }
}