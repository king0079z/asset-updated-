// @ts-nocheck
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
    } = await supabase.auth.getUser();

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { kitchenId, orderItems } = req.body;

    if (!kitchenId || !orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    // Validate kitchen exists
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
    });

    if (!kitchen) {
      return res.status(404).json({ error: "Kitchen not found" });
    }

    // Process each order item
    const processedItems = [];
    
    for (const item of orderItems) {
      const { foodSupplyId, quantity, pricePerUnit } = item;
      
      // Validate food supply exists
      const foodSupply = await prisma.foodSupply.findUnique({
        where: { id: foodSupplyId },
      });

      if (!foodSupply) {
        return res.status(404).json({ error: `Food supply with ID ${foodSupplyId} not found` });
      }

      // Check if this food supply is already linked to this kitchen
      const existingKitchenFoodSupply = await prisma.kitchenFoodSupply.findUnique({
        where: {
          kitchenId_foodSupplyId: {
            kitchenId: kitchenId,
            foodSupplyId: foodSupplyId,
          },
        },
      });

      if (existingKitchenFoodSupply) {
        // If it's already linked to this kitchen, update the quantity
        const updatedKitchenFoodSupply = await prisma.kitchenFoodSupply.update({
          where: {
            id: existingKitchenFoodSupply.id,
          },
          data: {
            quantity: {
              increment: parseFloat(quantity.toString()),
            },
            // Keep the existing expiration date
          },
        });
        
        processedItems.push({
          id: updatedKitchenFoodSupply.id,
          foodSupplyId,
          quantity: updatedKitchenFoodSupply.quantity,
          action: 'updated',
        });
      } else {
        // If it's not linked to this kitchen, create a new kitchen-specific entry
        // Set expiration date to 30 days from now as default
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 30);
        
        const newKitchenFoodSupply = await prisma.kitchenFoodSupply.create({
          data: {
            kitchenId,
            foodSupplyId,
            quantity: parseFloat(quantity.toString()),
            expirationDate,
          },
        });
        
        processedItems.push({
          id: newKitchenFoodSupply.id,
          foodSupplyId,
          quantity: newKitchenFoodSupply.quantity,
          action: 'created',
        });
      }
    }

    // Create audit log for food supply order
    await logDataModification(
      'FOOD_SUPPLY',
      kitchenId,
      'ORDER',
      {
        kitchenId,
        kitchenName: kitchen.name,
        orderItems,
        processedItems,
      },
      {
        action: 'Food Supply Order',
        itemCount: orderItems.length,
        userId: user.id,
        userEmail: user.email,
        kitchenId,
        kitchenName: kitchen.name,
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Order processed successfully',
      processedItems,
    });
  } catch (error) {
    console.error("Error processing food supply order:", error);
    return res.status(500).json({ error: "Failed to process food supply order" });
  }
}