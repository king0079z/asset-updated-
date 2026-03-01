import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
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

    const { id, pricePerUnit } = req.body;

    const foodSupply = await prisma.foodSupply.update({
      where: { id },
      data: {
        pricePerUnit: parseFloat(pricePerUnit),
      },
    });

    return res.status(200).json(foodSupply);
  } catch (error) {
    console.error("Error updating food supply price:", error);
    return res.status(500).json({ error: "Failed to update food supply price" });
  }
}