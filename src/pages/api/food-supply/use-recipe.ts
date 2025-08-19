import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification } from "@/lib/audit";

interface RecipeIngredient {
  id: string;
  foodSupplyId: string;
  name: string;
  quantity: number;
  unit: string;
  cost: number;
}

interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  servings: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { recipe, kitchenId, notes, forceUse = false } = req.body;

    if (!recipe || !kitchenId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify kitchen exists
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
    });

    if (!kitchen) {
      return res.status(404).json({ error: 'Kitchen not found' });
    }

    // Check if there's enough quantity for each ingredient
    const insufficientIngredients = [];
    
    for (const ingredient of recipe.ingredients) {
      const foodSupply = await prisma.foodSupply.findUnique({
        where: { id: ingredient.foodSupplyId },
      });

      if (!foodSupply) {
        return res.status(404).json({ 
          error: `Food supply not found for ingredient: ${ingredient.name}` 
        });
      }

      if (foodSupply.quantity < ingredient.quantity && !forceUse) {
        insufficientIngredients.push({
          name: ingredient.name,
          required: ingredient.quantity,
          available: foodSupply.quantity,
          unit: foodSupply.unit
        });
      }
    }

    if (insufficientIngredients.length > 0 && !forceUse) {
      return res.status(400).json({ 
        error: 'Insufficient ingredients',
        insufficientIngredients
      });
    }

    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (prisma) => {
      const consumptionRecords = [];
      const disposalRecords = [];

      let totalCost = 0;
      let totalWaste = 0;

      // Process each ingredient
      for (const ingredient of recipe.ingredients) {
        // Get the current food supply
        const foodSupply = await prisma.foodSupply.findUnique({
          where: { id: ingredient.foodSupplyId },
        });

        if (!foodSupply) continue;

        // Calculate the actual quantity to deduct (either the full amount or what's available)
        const quantityToDeduct = forceUse 
          ? Math.min(ingredient.quantity, foodSupply.quantity)
          : ingredient.quantity;

        if (quantityToDeduct <= 0) continue;

        // Calculate cost for this ingredient
        const ingredientCost = (foodSupply.pricePerUnit || 0) * quantityToDeduct;
        totalCost += ingredientCost;

        // Record consumption
        const consumption = await prisma.foodConsumption.create({
          data: {
            quantity: quantityToDeduct,
            notes: notes || `Used in recipe: ${recipe.name}`,
            foodSupplyId: ingredient.foodSupplyId,
            kitchenId,
            userId: user.id,
          },
          include: {
            foodSupply: true,
          },
        });

        consumptionRecords.push(consumption);

        // Update food supply quantity
        await prisma.foodSupply.update({
          where: { id: ingredient.foodSupplyId },
          data: {
            quantity: {
              decrement: quantityToDeduct,
            },
          },
        });

        // --- NEW: Record ingredient waste as FoodDisposal ---
        // Find the RecipeIngredient record for this ingredient in this recipe
        const recipeIngredient = await prisma.recipeIngredient.findFirst({
          where: {
            recipeId: recipe.id,
            foodSupplyId: ingredient.foodSupplyId,
          },
        });

        if (recipeIngredient) {
          // Get all waste types for this ingredient (usually one, but could be more)
          const ingredientWastes = await prisma.ingredientWaste.findMany({
            where: {
              recipeIngredientId: recipeIngredient.id,
            },
          });

          for (const waste of ingredientWastes) {
            // Robustly handle both percent and fraction input
            let wasteFraction = waste.wastePercentage || 0;
            if (wasteFraction > 1) {
              wasteFraction = wasteFraction / 100;
            }
            const wasteAmount = quantityToDeduct * wasteFraction;
            if (wasteAmount > 0) {
              totalWaste += (foodSupply.pricePerUnit || 0) * wasteAmount;
              const disposal = await prisma.foodDisposal.create({
                data: {
                  foodSupplyId: ingredient.foodSupplyId,
                  kitchenId,
                  userId: user.id,
                  quantity: wasteAmount,
                  reason: "ingredient_waste",
                  notes: `Auto-recorded waste for ingredient in recipe: ${recipe.name}`,
                  cost: (foodSupply.pricePerUnit || 0) * wasteAmount,
                  recipeId: recipe.id,
                  source: "recipe",
                },
              });
              disposalRecords.push(disposal);
            }
          }
        }
      }

      // Get selling price from recipe (per usage)
      const dbRecipe = await prisma.recipe.findUnique({
        where: { id: recipe.id },
        select: { sellingPrice: true }
      });
      const sellingPrice = dbRecipe?.sellingPrice || 0;

      // Calculate profit
      const profit = sellingPrice - totalCost - totalWaste;

      // Record RecipeUsage
      await prisma.recipeUsage.create({
        data: {
          recipeId: recipe.id,
          kitchenId,
          userId: user.id,
          servingsUsed: 1,
          cost: totalCost,
          waste: totalWaste,
          sellingPrice: sellingPrice,
          profit: profit,
          notes: notes || undefined,
        }
      });

      return { consumptionRecords, disposalRecords };
    });

    // Create audit log for recipe usage
    await logDataModification(
      'RECIPE_USAGE',
      recipe.id,
      'USE',
      {
        recipeName: recipe.name,
        kitchenId,
        kitchenName: kitchen.name,
        ingredients: recipe.ingredients.map(ing => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit
        }))
      },
      {
        action: 'Recipe Usage',
        recipeName: recipe.name,
        kitchen: kitchen.name,
        userId: user.id,
        userEmail: user.email
      }
    );

    // Include a flag in the response to indicate that the client should refresh forecast data
    return res.status(200).json({
      success: true,
      message: 'Recipe used successfully',
      consumptionRecords: result.consumptionRecords,
      disposalRecords: result.disposalRecords,
      refreshForecast: true
    });
  } catch (error) {
    console.error('Recipe Usage API Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error' 
    });
  }
}