// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification } from "@/lib/audit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { recipeId, kitchenId, notes, servingsUsed = 1, forceUse = false } = req.body;

    if (!recipeId || !kitchenId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify kitchen exists
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
    });

    if (!kitchen) {
      return res.status(404).json({ error: 'Kitchen not found' });
    }

    // Get recipe with ingredients and subrecipes (recursive, 2 levels deep)
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ingredients: {
          include: {
            foodSupply: true,
            subRecipe: {
              include: {
                ingredients: {
                  include: {
                    foodSupply: true,
                    subRecipe: true // one more level deep
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Helper: Recursively check for insufficient ingredients (including subrecipes)
    const insufficientIngredients: any[] = [];

    async function checkInsufficient(ingredient, multiplier = 1) {
      if (ingredient.foodSupply) {
        const required = ingredient.quantity * multiplier;
        if (ingredient.foodSupply.quantity < required && !forceUse) {
          insufficientIngredients.push({
            name: ingredient.foodSupply.name,
            required,
            available: ingredient.foodSupply.quantity,
            unit: ingredient.foodSupply.unit
          });
        }
      } else if (ingredient.subRecipe) {
        for (const subIng of ingredient.subRecipe.ingredients) {
          await checkInsufficient(subIng, multiplier * ingredient.quantity);
        }
      } else {
        insufficientIngredients.push({
          name: 'Unknown',
          required: ingredient.quantity * multiplier,
          available: 0,
          unit: ''
        });
      }
    }

    for (const ingredient of recipe.ingredients) {
      await checkInsufficient(ingredient, servingsUsed);
    }

    if (insufficientIngredients.length > 0 && !forceUse) {
      return res.status(400).json({ 
        error: 'Insufficient ingredients',
        insufficientIngredients
      });
    }

    // --- Refactored: Prepare all DB actions before transaction ---

    // Pre-fetch all RecipeIngredient and IngredientWaste for this recipe
    const recipeIngredients = await prisma.recipeIngredient.findMany({
      where: { recipeId: recipe.id },
      include: { wastes: true }
    });
    // Build a map: foodSupplyId -> array of wastePercentages
    const ingredientWasteMap: Record<string, number[]> = {};
    for (const ri of recipeIngredients) {
      if (ri.foodSupplyId) {
        ingredientWasteMap[ri.foodSupplyId] = ri.wastes.map(w => {
          let wp = w.wastePercentage || 0;
          if (wp > 1) wp = wp / 100;
          return wp;
        });
      }
    }

    // Helper: Recursively collect all DB actions needed for deduction, waste, and consumption
    const consumptionActions: any[] = [];
    const disposalActions: any[] = [];
    const updateActions: any[] = [];
    let totalCost = 0;
    let totalWaste = 0;

    // Helper: Recursively collect actions
    function collectActions(ingredient, multiplier = 1, parentName = recipe.name) {
      if (ingredient.foodSupply) {
        const required = ingredient.quantity * multiplier;
        const quantityToDeduct = forceUse
          ? Math.min(required, ingredient.foodSupply.quantity)
          : required;
        if (quantityToDeduct <= 0) return;

        // Calculate cost for this ingredient
        const pricePerUnit = ingredient.foodSupply.pricePerUnit || 0;
        const ingredientCost = pricePerUnit * quantityToDeduct;
        totalCost += ingredientCost;

        // Calculate waste for this ingredient using pre-fetched map
        const wasteFractions = ingredientWasteMap[ingredient.foodSupply.id] || [];
        for (const wasteFraction of wasteFractions) {
          const wasteAmount = quantityToDeduct * wasteFraction;
          if (wasteAmount > 0) {
            totalWaste += pricePerUnit * wasteAmount;
            disposalActions.push({
              foodSupplyId: ingredient.foodSupply.id,
              kitchenId,
              userId: user.id,
              quantity: wasteAmount,
              reason: "ingredient_waste",
              notes: `Auto-recorded waste for ingredient in recipe: ${parentName}`,
              cost: pricePerUnit * wasteAmount,
              recipeId: recipe.id,
              source: "recipe",
            });
          }
        }

        // Prepare consumption record
        consumptionActions.push({
          quantity: quantityToDeduct,
          notes: notes || `Used in recipe: ${parentName}`,
          foodSupplyId: ingredient.foodSupply.id,
          kitchenId,
          userId: user.id,
        });

        // Prepare update for food supply quantity
        updateActions.push({
          id: ingredient.foodSupply.id,
          decrement: quantityToDeduct,
        });
      } else if (ingredient.subRecipe) {
        for (const subIng of ingredient.subRecipe.ingredients) {
          collectActions(subIng, multiplier * ingredient.quantity, ingredient.subRecipe.name);
        }
      }
    }

    for (const ingredient of recipe.ingredients) {
      collectActions(ingredient, servingsUsed, recipe.name);
    }

    // Calculate selling price for the batch
    const sellingPrice = (recipe.sellingPrice || 0) * servingsUsed;
    // Calculate profit
    const profit = sellingPrice - totalCost - totalWaste;

    // --- Transaction: Only DB writes ---
    const result = await prisma.$transaction(async (tx) => {
      // Create all foodConsumption records
      const consumptionRecords = [];
      for (const c of consumptionActions) {
        const consumption = await tx.foodConsumption.create({
          data: c,
          include: { foodSupply: true },
        });
        consumptionRecords.push(consumption);
      }
      // Create all foodDisposal records
      for (const d of disposalActions) {
        await tx.foodDisposal.create({ data: d });
      }
      // Update all foodSupply quantities
      for (const u of updateActions) {
        await tx.foodSupply.update({
          where: { id: u.id },
          data: { quantity: { decrement: u.decrement } },
        });
      }
      // Record recipe usage
      const recipeUsage = await tx.recipeUsage.create({
        data: {
          recipeId,
          kitchenId,
          userId: user.id,
          notes: notes || '',
          servingsUsed: servingsUsed || recipe.servings,
          cost: totalCost,
          waste: totalWaste,
          sellingPrice: sellingPrice,
          profit: profit,
        }
      });
      return {
        consumptionRecords,
        recipeUsage
      };
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
          name: ing.foodSupply?.name,
          quantity: ing.quantity,
          unit: ing.foodSupply?.unit
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

    return res.status(200).json({
      success: true,
      message: 'Recipe used successfully',
      consumptionRecords: result.consumptionRecords,
      recipeUsage: result.recipeUsage
    });
  } catch (error) {
    console.error('Recipe Usage API Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error' 
    });
  }
}