import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id, pricePerUnit } = req.body;
    const newPrice = parseFloat(pricePerUnit);

    const foodSupply = await prisma.foodSupply.update({
      where: { id },
      data: { pricePerUnit: newPrice },
    });

    // Recalculate cost for all recipes that use this food supply
    const affectedIngredients = await prisma.recipeIngredient.findMany({
      where: { foodSupplyId: id },
      include: {
        wastes: true,
        recipe: {
          include: {
            ingredients: {
              include: { foodSupply: true, wastes: true, subRecipe: { select: { costPerServing: true } } }
            }
          }
        }
      }
    });

    const recipeIdsToUpdate = [...new Set(affectedIngredients.map(i => i.recipeId).filter(Boolean))];

    for (const recipeId of recipeIdsToUpdate) {
      // Re-fetch the recipe with latest prices for fresh calculation
      const recipe = await prisma.recipe.findUnique({
        where: { id: recipeId },
        include: {
          ingredients: {
            include: { foodSupply: true, wastes: true, subRecipe: { select: { costPerServing: true } } }
          }
        }
      });
      if (!recipe) continue;

      let totalCost = 0;
      for (const ing of recipe.ingredients) {
        if (ing.subRecipeId && ing.subRecipe) {
          totalCost += (ing.subRecipe.costPerServing || 0) * ing.quantity;
        } else if (ing.foodSupply) {
          const price = ing.foodSupplyId === id ? newPrice : (ing.foodSupply.pricePerUnit || 0);
          let wastePct = 0;
          if (ing.wastes?.length > 0) wastePct = parseFloat(ing.wastes[0].wastePercentage) || 0;
          totalCost += ing.quantity * price * (1 + wastePct / 100);
        }
      }
      const costPerServing = recipe.servings > 0 ? totalCost / recipe.servings : 0;
      await prisma.recipe.update({
        where: { id: recipeId },
        data: { totalCost, costPerServing }
      });
    }

    return res.status(200).json({ ...foodSupply, recipesUpdated: recipeIdsToUpdate.length });
  } catch (error) {
    console.error("Error updating food supply price:", error);
    return res.status(500).json({ error: "Failed to update food supply price" });
  }
}