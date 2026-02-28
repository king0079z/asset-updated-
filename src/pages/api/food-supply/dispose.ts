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
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { foodSupplyId, quantity, reason, notes, source, recipeId, servings, kitchenId } = req.body;

    // Handle recipe-based waste
    if (source === 'recipe' && recipeId) {
      return await handleRecipeWaste(req, res, user, recipeId, servings, reason, notes, kitchenId);
    }

    // Handle direct food supply waste
    if (!foodSupplyId || !quantity || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify food supply exists
    const foodSupply = await prisma.foodSupply.findUnique({
      where: { id: foodSupplyId },
    });

    if (!foodSupply) {
      return res.status(404).json({ error: 'Food supply not found' });
    }

    // Check if there's enough quantity
    if (foodSupply.quantity < quantity) {
      return res.status(400).json({ 
        error: 'Insufficient quantity',
        available: foodSupply.quantity,
        requested: quantity
      });
    }

    // Calculate cost of disposed items
    const cost = quantity * foodSupply.pricePerUnit;

    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (prisma) => {
      // Record disposal
      const disposal = await prisma.foodDisposal.create({
        data: {
          foodSupplyId,
          quantity,
          reason,
          notes: notes || '',
          cost,
          userId: user.id,
          kitchenId: kitchenId || foodSupply.kitchenId, // Use provided kitchenId or the one from foodSupply
          source: 'direct',
        },
        include: {
          foodSupply: true,
        },
      });

      // Update food supply quantity
      await prisma.foodSupply.update({
        where: { id: foodSupplyId },
        data: {
          quantity: {
            decrement: quantity,
          },
          totalWasted: {
            increment: quantity
          }
        },
      });

      return disposal;
    });

    // Create audit log for food disposal
    await logDataModification(
      'FOOD_DISPOSAL',
      result.id,
      'DISPOSE',
      {
        foodSupplyName: foodSupply.name,
        quantity,
        unit: foodSupply.unit,
        reason,
        cost,
        source: 'direct'
      },
      {
        action: 'Food Disposal',
        foodSupplyName: foodSupply.name,
        userId: user.id,
        userEmail: user.email
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Food disposal recorded successfully',
      disposal: result
    });
  } catch (error) {
    console.error('Food Disposal API Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error' 
    });
  }
}

// Helper function to handle recipe-based waste
async function handleRecipeWaste(
  req: NextApiRequest, 
  res: NextApiResponse, 
  user: any, 
  recipeId: string, 
  servings: number, 
  reason: string, 
  notes?: string,
  kitchenId?: string
) {
  // Get recipe with ingredients
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      ingredients: {
        include: {
          foodSupply: true
        }
      }
    }
  });

  if (!recipe) {
    return res.status(404).json({ error: 'Recipe not found' });
  }

  // Calculate the proportion of ingredients based on servings
  const servingRatio = servings / recipe.servings;
  
  // Check if there's enough quantity for each ingredient
  const insufficientIngredients = [];
  let totalCost = 0;
  
  for (const ingredient of recipe.ingredients) {
    const foodSupply = ingredient.foodSupply;
    if (!foodSupply) continue;
    
    const requiredQuantity = ingredient.quantity * servingRatio;
    
    if (foodSupply.quantity < requiredQuantity) {
      insufficientIngredients.push({
        name: foodSupply.name,
        required: requiredQuantity,
        available: foodSupply.quantity,
        unit: foodSupply.unit
      });
    }
    
    // Calculate cost regardless of availability
    totalCost += requiredQuantity * foodSupply.pricePerUnit;
  }

  // Start a transaction to ensure data consistency
  const result = await prisma.$transaction(async (prisma) => {
    const disposals = [];
    
    // Process each ingredient
    for (const ingredient of recipe.ingredients) {
      const foodSupply = ingredient.foodSupply;
      if (!foodSupply) continue;
      
      const requiredQuantity = ingredient.quantity * servingRatio;
      
      // Calculate the actual quantity to deduct (either the full amount or what's available)
      const quantityToDeduct = Math.min(requiredQuantity, foodSupply.quantity);
      
      if (quantityToDeduct <= 0) continue;
      
      // Calculate cost of this specific disposal
      const cost = quantityToDeduct * foodSupply.pricePerUnit;
      
      // Record disposal
      const disposal = await prisma.foodDisposal.create({
        data: {
          foodSupplyId: foodSupply.id,
          quantity: quantityToDeduct,
          reason,
          notes: notes || `Waste from recipe: ${recipe.name}`,
          cost,
          userId: user.id,
          kitchenId: kitchenId || foodSupply.kitchenId, // Use provided kitchenId or the one from foodSupply
          source: 'recipe',
          recipeId,
        },
        include: {
          foodSupply: true,
        },
      });
      
      disposals.push(disposal);
      
      // Update food supply quantity
      await prisma.foodSupply.update({
        where: { id: foodSupply.id },
        data: {
          quantity: {
            decrement: quantityToDeduct,
          },
          totalWasted: {
            increment: quantityToDeduct
          }
        },
      });
    }
    
    return disposals;
  });

  // Create audit log for recipe waste
  await logDataModification(
    'RECIPE_WASTE',
    recipe.id,
    'DISPOSE',
    {
      recipeName: recipe.name,
      servings,
      reason,
      totalCost,
      ingredients: recipe.ingredients.map(ing => ({
        name: ing.foodSupply?.name,
        quantity: ing.quantity * servingRatio,
        unit: ing.foodSupply?.unit
      }))
    },
    {
      action: 'Recipe Waste',
      recipeName: recipe.name,
      userId: user.id,
      userEmail: user.email
    }
  );

  return res.status(200).json({
    success: true,
    message: 'Recipe waste recorded successfully',
    disposals: result,
    insufficientIngredients: insufficientIngredients.length > 0 ? insufficientIngredients : undefined
  });
}