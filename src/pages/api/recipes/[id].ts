import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification } from "@/lib/audit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid recipe ID' });
  }

  // GET - Retrieve a specific recipe
  if (req.method === 'GET') {
    try {
      // Fetch the recipe and only one level of subrecipes (for performance)
      const recipe = await prisma.recipe.findUnique({
        where: { id },
        include: {
          ingredients: {
            include: {
              foodSupply: {
                select: {
                  id: true,
                  name: true,
                  unit: true,
                  pricePerUnit: true,
                }
              },
              wastes: true,
              subRecipe: {
                select: {
                  id: true,
                  name: true,
                  servings: true,
                  ingredients: {
                    include: {
                      foodSupply: {
                        select: {
                          id: true,
                          name: true,
                          unit: true,
                          pricePerUnit: true,
                        }
                      },
                      wastes: true,
                    }
                  }
                }
              }
            }
          },
          usages: true
        }
      });

      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      // Helper: recursively flatten all ingredients (for display)
      function flattenIngredients(ingredients, foodSuppliesMap) {
        let result = [];
        for (const ing of ingredients) {
          if (ing.foodSupplyId) {
            result.push({
              name: ing.foodSupply?.name || 'Unknown',
              quantity: ing.quantity,
              unit: ing.foodSupply?.unit || '',
              wastePercentage: ing.wastes?.[0]?.wastePercentage ?? 0,
              type: 'food',
              foodSupplyId: ing.foodSupplyId
            });
          } else if (ing.subRecipe) {
            // Add subrecipe as a group
            result.push({
              name: ing.subRecipe.name,
              quantity: ing.quantity,
              unit: '', // subrecipes may not have a unit
              wastePercentage: 0,
              type: 'subrecipe',
              subRecipeId: ing.subRecipeId
            });
            // Recursively add subrecipe's ingredients (flattened)
            result = result.concat(flattenIngredients(ing.subRecipe.ingredients, foodSuppliesMap));
          }
        }
        return result;
      }

      // Helper: recursively sum cost and waste for a recipe's ingredients
      function sumCostAndWaste(ingredients, servings = 1) {
        let totalCost = 0;
        let totalWaste = 0;
        for (const ing of ingredients) {
          if (ing.foodSupplyId) {
            const pricePerUnit = ing.foodSupply?.pricePerUnit || 0;
            const wastePercentage = ing.wastes?.[0]?.wastePercentage ?? 0;
            const qty = ing.quantity * servings;
            const cost = qty * pricePerUnit;
            const waste = qty * pricePerUnit * (wastePercentage / 100);
            totalCost += cost;
            totalWaste += waste;
          } else if (ing.subRecipe) {
            // For subrecipes, multiply by quantity used
            const subQty = ing.quantity * servings;
            const { totalCost: subCost, totalWaste: subWaste } = sumCostAndWaste(ing.subRecipe.ingredients, subQty);
            totalCost += subCost;
            totalWaste += subWaste;
          }
        }
        return { totalCost, totalWaste };
      }

      // Calculate total cost and waste for this recipe (including subrecipes)
      const { totalCost, totalWaste } = sumCostAndWaste(recipe.ingredients, 1);

      // Calculate cost per serving
      const costPerServing = recipe.servings > 0 ? totalCost / recipe.servings : totalCost;

      // Calculate usage count and last used
      const usageCount = recipe.usages.length;
      const lastUsed = recipe.usages.length > 0
        ? recipe.usages.reduce((latest, u) => u.createdAt > latest ? u.createdAt : latest, recipe.usages[0].createdAt)
        : null;

      // Compose response (no kitchen breakdown)
      return res.status(200).json({
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        servings: recipe.servings,
        prepTime: recipe.prepTime,
        instructions: recipe.instructions,
        sellingPrice: recipe.sellingPrice,
        isSubrecipe: recipe.isSubrecipe,
        totalCost,
        costPerServing,
        totalWasteAmount: totalWaste,
        netAfterWaste: recipe.sellingPrice ? recipe.sellingPrice - totalWaste : undefined,
        profit: recipe.sellingPrice ? recipe.sellingPrice - totalCost : undefined,
        usageCount,
        lastUsed,
        ingredients: flattenIngredients(recipe.ingredients, {})
      });
    } catch (error) {
      console.error('Error fetching recipe:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      });
    }
  }
  
  // PUT - Update a recipe
  else if (req.method === 'PUT') {
    try {
      const { name, description, servings, prepTime, instructions, ingredients, sellingPrice, totalCost, costPerServing } = req.body;
      
      if (!name || !servings || !ingredients || ingredients.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      // Check if recipe exists
      const existingRecipe = await prisma.recipe.findUnique({
        where: { id },
        include: {
          ingredients: true
        }
      });
      
      if (!existingRecipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }
      
      // Start a transaction to update the recipe and its ingredients
      const updatedRecipe = await prisma.$transaction(async (prisma) => {
        // First, delete all existing ingredients
        await prisma.recipeIngredient.deleteMany({
          where: { recipeId: id }
        });
        
        // Then update the recipe
        const recipe = await prisma.recipe.update({
          where: { id },
          data: {
            name,
            description,
            servings,
            prepTime,
            instructions,
            totalCost,
            costPerServing,
            sellingPrice: sellingPrice || 0,
            ingredients: {
              create: await Promise.all(ingredients.map(async ing => {
                if (ing.type === 'food') {
                  // Fetch latest pricePerUnit for foodSupply
                  const foodSupply = await prisma.foodSupply.findUnique({
                    where: { id: ing.foodSupplyId }
                  });
                  const pricePerUnit = foodSupply?.pricePerUnit || 0;
                  const waste = typeof ing.wastePercentage === 'number' ? ing.wastePercentage : 0;
                  const baseCost = ing.quantity * pricePerUnit;
                  const wasteCost = ing.quantity * (waste / 100) * pricePerUnit;
                  const totalIngredientCost = baseCost + wasteCost;
                  return {
                    foodSupply: { connect: { id: ing.foodSupplyId } },
                    quantity: ing.quantity,
                    cost: totalIngredientCost,
                  };
                } else if (ing.type === 'subrecipe') {
                  // Fetch latest costPerServing for subrecipe
                  const subRecipe = await prisma.recipe.findUnique({
                    where: { id: ing.subRecipeId }
                  });
                  const costPerServing = subRecipe?.costPerServing || 0;
                  const totalIngredientCost = costPerServing * ing.quantity;
                  return {
                    subRecipeId: ing.subRecipeId,
                    quantity: ing.quantity,
                    cost: totalIngredientCost,
                  };
                }
                return {};
              }))
            }
          },
          include: {
            ingredients: {
              include: {
                foodSupply: true
              }
            }
          }
        });

        // After creating ingredients, create IngredientWaste records for food ingredients
        for (const ing of ingredients) {
          if (ing.type === 'food') {
            // Find the corresponding RecipeIngredient by foodSupplyId and quantity (should be unique per recipe)
            const recipeIngredient = await prisma.recipeIngredient.findFirst({
              where: {
                recipeId: recipe.id,
                foodSupplyId: ing.foodSupplyId,
                quantity: ing.quantity,
              }
            });
            if (recipeIngredient) {
              await prisma.ingredientWaste.upsert({
                where: {
                  recipeIngredientId_wasteType: {
                    recipeIngredientId: recipeIngredient.id,
                    wasteType: 'ingredient', // or whatever type is appropriate
                  }
                },
                update: {
                  wastePercentage: typeof ing.wastePercentage === 'number' ? ing.wastePercentage : 0,
                },
                create: {
                  recipeIngredientId: recipeIngredient.id,
                  wasteType: 'ingredient', // or whatever type is appropriate
                  wastePercentage: typeof ing.wastePercentage === 'number' ? ing.wastePercentage : 0,
                }
              });
            }
          }
        }

        // Add wastePercentage to each ingredient in the response (for frontend compatibility)
        const recipeWithWaste = {
          ...recipe,
          ingredients: await Promise.all(recipe.ingredients.map(async ing => {
            let wastePercentage = 0;
            if (ing.foodSupplyId) {
              const waste = await prisma.ingredientWaste.findFirst({
                where: { recipeIngredientId: ing.id, wasteType: 'ingredient' }
              });
              wastePercentage = waste?.wastePercentage ?? 0;
            }
            return {
              ...ing,
              wastePercentage,
            };
          }))
        };
        return recipeWithWaste;
      });
      
      // Create audit log
      await logDataModification(
        'RECIPE',
        id,
        'UPDATE',
        { recipeName: name, ingredients: ingredients.length },
        {
          action: 'Recipe Update',
          recipeName: name,
          userId: user.id,
          userEmail: user.email
        }
      );
      
      return res.status(200).json(updatedRecipe);
    } catch (error) {
      console.error('Error updating recipe:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      });
    }
  }
  
  // DELETE - Delete a recipe
  else if (req.method === 'DELETE') {
    try {
      // Check if recipe exists
      const existingRecipe = await prisma.recipe.findUnique({
        where: { id }
      });
      
      if (!existingRecipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }
      
      // Delete the recipe (this will cascade delete ingredients due to the relation)
      await prisma.recipe.delete({
        where: { id }
      });
      
      // Create audit log
      await logDataModification(
        'RECIPE',
        id,
        'DELETE',
        { recipeName: existingRecipe.name },
        {
          action: 'Recipe Deletion',
          recipeName: existingRecipe.name,
          userId: user.id,
          userEmail: user.email
        }
      );
      
      return res.status(200).json({ success: true, message: 'Recipe deleted successfully' });
    } catch (error) {
      console.error('Error deleting recipe:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}