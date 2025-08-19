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

    const { name, quantity, unit, category, expirationDate, notes, vendorId, pricePerUnit } = req.body;

    const foodSupply = await prisma.foodSupply.create({
      data: {
        name,
        quantity: parseFloat(quantity),
        unit,
        category,
        expirationDate: new Date(expirationDate),
        notes: notes || "",
        userId: user.id,
        vendorId,
        pricePerUnit: parseFloat(pricePerUnit || 0),
      },
      include: {
        vendor: {
          select: {
            name: true,
          },
        },
      },
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
        vendorId,
        vendorName: foodSupply.vendor?.name,
        pricePerUnit: parseFloat(pricePerUnit || 0),
      },
      {
        action: 'Food Supply Registration',
        foodSupplyName: name,
        category,
        quantity: `${quantity} ${unit}`,
        userId: user.id,
        userEmail: user.email
      }
    );
    
    // Also log as user activity for the user activity tab
    await logUserActivity(
      'FOOD_SUPPLY_CREATED',
      'FOOD_SUPPLY',
      {
        foodSupplyId: foodSupply.id,
        foodSupplyName: name,
        category,
        quantity: `${quantity} ${unit}`,
        expirationDate: new Date(expirationDate).toISOString(),
        vendorName: foodSupply.vendor?.name,
        pricePerUnit: parseFloat(pricePerUnit || 0),
        timestamp: new Date().toISOString(),
        userId: user.id,
        userEmail: user.email
      },
      foodSupply.id
    );

    return res.status(200).json(foodSupply);
  } catch (error) {
    console.error("Error creating food supply:", error);
    return res.status(500).json({ error: "Failed to create food supply" });
  }
}