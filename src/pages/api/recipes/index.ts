// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification } from "@/lib/audit";
import { getUserRoleData } from '@/util/roleCheck';

// 5-minute cache per org+query key
const recipesCache = new Map<string, { data: any; ts: number }>();
const RECIPES_TTL  = 5 * 60_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Use cached role data instead of a raw findUnique
  const roleData = await getUserRoleData(user.id);
  const orgId = roleData?.organizationId ?? null;
  const orgFilter = orgId ? { OR: [{ organizationId: orgId }, { organizationId: null }] } : {};

  // GET - Retrieve all recipes
  if (req.method === 'GET') {
    try {
      const { popular, subrecipesOnly, kitchenId } = req.query;
      const cacheKey = `recipes:${orgId ?? 'global'}:${popular}:${subrecipesOnly}:${kitchenId ?? ''}`;
      const cached = recipesCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < RECIPES_TTL) {
        res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=60');
        return res.status(200).json(cached.data);
      }

      // Handle popular recipes request
      if (popular === 'true') {
        console.info('[Recipes API] Fetching popular recipes');
        
        // Get recipes with their usage counts
        const recipes = await prisma.recipe.findMany({
          where: orgFilter,
          include: {
            ingredients: {
              include: {
                foodSupply: true
              }
            },
            usages: true
          }
        });
        
        // Calculate usage statistics for each recipe
        const recipesWithStats = recipes.map(recipe => {
          const usageCount = recipe.usages.length;
          const lastUsed = recipe.usages.length > 0
            ? recipe.usages.reduce((latest, u) =>
                new Date(u.createdAt) > new Date(latest.createdAt) ? u : latest
              ).createdAt
            : null;
            
          // Format ingredients for the response
          const formattedIngredients = recipe.ingredients.map(ing => ({
            name: ing.foodSupply?.name || 'Unknown',
            quantity: ing.quantity,
            unit: ing.foodSupply?.unit || 'units'
          }));
          
          return {
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            servings: recipe.servings,
            usageCount,
            lastUsed: lastUsed?.toISOString() || new Date().toISOString(),
            ingredients: formattedIngredients
          };
        });
        
        // Sort by usage count (most used first)
        const sortedRecipes = recipesWithStats
          .sort((a, b) => b.usageCount - a.usageCount)
          .slice(0, 10);
        
        const popularPayload = { items: sortedRecipes };
        recipesCache.set(cacheKey, { data: popularPayload, ts: Date.now() });
        res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=60');
        return res.status(200).json(popularPayload);
      }
      
      // Regular recipe listing, with optional subrecipe filtering + org scoping
      const whereClause: any = { ...orgFilter };
      if (subrecipesOnly === 'true') {
        whereClause.isSubrecipe = true;
      }
      // If kitchenId provided, further filter to recipes used in that kitchen
      if (kitchenId && typeof kitchenId === 'string') {
        // Run both pre-queries in parallel
        const [usedRecipeIds, noUsageRecipes] = await Promise.all([
          prisma.recipeUsage.findMany({
            where: { kitchenId },
            select: { recipeId: true },
            distinct: ['recipeId'],
          }),
          prisma.recipe.findMany({
            where: { ...orgFilter, usages: { none: {} } },
            select: { id: true },
          }),
        ]);
        const noUsageIds = noUsageRecipes.map(r => r.id);
        const usedIds = usedRecipeIds.map(u => u.recipeId);
        whereClause.id = { in: [...new Set([...usedIds, ...noUsageIds])] };
      }

      const recipes = await prisma.recipe.findMany({
        where: whereClause,
        include: {
          ingredients: {
            include: {
              foodSupply: true,
              wastes: true,
              subRecipe: {
                include: {
                  ingredients: {
                    include: {
                      foodSupply: true,
                      wastes: true,
                      subRecipe: true // one more level deep
                    }
                  },
                  usages: true,
                  usedAsSubrecipeIn: true
                }
              }
            }
          },
          usages: true,
          usedAsSubrecipeIn: true
        }
      });

      // Helper: Recursively calculate total waste for a recipe (including subrecipes)
      const getTotalWasteAmount = (recipeObj: any, allRecipes: any[]): number => {
        let totalWaste = 0;
        for (const ing of recipeObj.ingredients) {
          if (ing.subRecipeId && ing.subRecipe) {
            // Find the subrecipe in allRecipes (to avoid infinite recursion)
            const sub = allRecipes.find(r => r.id === ing.subRecipeId) || ing.subRecipe;
            if (sub) {
              // Recursively calculate subrecipe waste and multiply by quantity used
              const subWaste = getTotalWasteAmount(sub, allRecipes);
              totalWaste += subWaste * ing.quantity;
            }
          } else {
            // Food ingredient: use wastePercentage if available
            let wastePercentage = undefined;
            if (ing.wastes && ing.wastes.length > 0) {
              wastePercentage = parseFloat(ing.wastes[0].wastePercentage);
            }
            if (typeof wastePercentage === 'number' && !isNaN(wastePercentage) && wastePercentage > 0) {
              // Find pricePerUnit from foodSupply
              const pricePerUnit = ing.foodSupply?.pricePerUnit || 0;
              const wasteAmount = ing.quantity * (wastePercentage / 100) * pricePerUnit;
              totalWaste += wasteAmount;
            }
          }
        }
        return totalWaste;
      };

      // Add usage statistics and format for response
      const formattedRecipes = recipes.map(recipe => {
        const usageCount = recipe.usages.length;
        // Use reduce instead of sort to avoid mutating the shared array
        const lastUsed = recipe.usages.length > 0
          ? recipe.usages.reduce((latest, u) =>
              new Date(u.createdAt) > new Date(latest.createdAt) ? u : latest
            ).createdAt
          : null;

        // Format ingredients for the response
        const formattedIngredients = recipe.ingredients.map(ing => {
          if (ing.subRecipeId && ing.subRecipe) {
            // This ingredient is a subrecipe
            return {
              id: ing.id,
              type: 'subrecipe',
              subRecipeId: ing.subRecipeId,
              subRecipeName: ing.subRecipe.name,
              quantity: ing.quantity,
              cost: ing.cost
            };
          } else {
            // This ingredient is a food ingredient
            // Extract wastePercentage from wastes relation (if any)
            let wastePercentage = undefined;
            if (ing.wastes && ing.wastes.length > 0) {
              // Use the first waste record (could be extended to sum or handle multiple types)
              wastePercentage = parseFloat(ing.wastes[0].wastePercentage);
            }
            return {
              id: ing.id,
              type: 'food',
              foodSupplyId: ing.foodSupplyId,
              name: ing.foodSupply?.name || 'Unknown',
              quantity: ing.quantity,
              unit: ing.foodSupply?.unit || 'units',
              cost: ing.cost,
              wastePercentage
            };
          }
        });

        // Calculate total waste amount (including subrecipes)
        const totalWasteAmount = getTotalWasteAmount(recipe, recipes);

        // Dynamically calculate total cost and cost per serving from up-to-date ingredient data
        let totalCost = 0;
        for (const ing of recipe.ingredients) {
          if (ing.subRecipeId && ing.subRecipe) {
            // Subrecipe: cost = subRecipe.costPerServing * quantity
            const subCost = (ing.subRecipe.costPerServing || 0) * ing.quantity;
            totalCost += subCost;
          } else if (ing.foodSupply) {
            // Food ingredient: cost = quantity * pricePerUnit * (1 + wastePercentage/100)
            let wastePercentage = 0;
            if (ing.wastes && ing.wastes.length > 0) {
              wastePercentage = parseFloat(ing.wastes[0].wastePercentage) || 0;
            }
            const pricePerUnit = ing.foodSupply.pricePerUnit || 0;
            const baseCost = ing.quantity * pricePerUnit;
            const wasteCost = ing.quantity * (wastePercentage / 100) * pricePerUnit;
            totalCost += baseCost + wasteCost;
          }
        }
        const servings = recipe.servings || 1;
        const costPerServing = totalCost / servings;

        return {
          id: recipe.id,
          name: recipe.name,
          description: recipe.description,
          servings: recipe.servings,
          prepTime: recipe.prepTime,
          instructions: recipe.instructions,
          totalCost,
          costPerServing,
          sellingPrice: recipe.sellingPrice,
          usageCount: usageCount,
          lastUsed: lastUsed?.toISOString() || null,
          ingredients: formattedIngredients,
          createdAt: recipe.createdAt,
          updatedAt: recipe.updatedAt,
          isSubrecipe: recipe.isSubrecipe,
          totalWasteAmount
        };
      });

      return res.status(200).json(formattedRecipes);
    } catch (error) {
      console.error('Error fetching recipes:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      });
    }
  }
  
  // POST - Create a new recipe
  else if (req.method === 'POST') {
    try {
      const { name, description, servings, prepTime, instructions, ingredients, sellingPrice, isSubrecipe } = req.body;
      
      if (!name || !servings || !ingredients || ingredients.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Enforce subscription recipe limit
      if (orgId) {
        const subscription = await prisma.subscription.findUnique({
          where: { organizationId: orgId },
          select: { maxRecipes: true }
        });
        if (subscription) {
          const recipeCount = await prisma.recipe.count({ where: { organizationId: orgId } });
          if (recipeCount >= subscription.maxRecipes) {
            return res.status(403).json({
              error: `Recipe limit reached. Your plan allows up to ${subscription.maxRecipes} recipe${subscription.maxRecipes !== 1 ? 's' : ''}.`
            });
          }
        }
      }

      // Calculate total cost and cost per serving
      let totalCost = 0;

      // Batch-fetch all referenced food supplies and subrecipes in parallel (avoids N+1)
      const foodIngredients = ingredients.filter(i => i.type === 'food');
      const subrecipeIngredients = ingredients.filter(i => i.type === 'subrecipe');
      const foodSupplyIds = [...new Set(foodIngredients.map(i => i.foodSupplyId).filter(Boolean))];
      const subrecipeIds = [...new Set(subrecipeIngredients.map(i => i.subRecipeId).filter(Boolean))];

      const [foodSupplyRows, subRecipeRows] = await Promise.all([
        foodSupplyIds.length > 0
          ? prisma.foodSupply.findMany({ where: { id: { in: foodSupplyIds } } })
          : Promise.resolve([]),
        subrecipeIds.length > 0
          ? prisma.recipe.findMany({ where: { id: { in: subrecipeIds } } })
          : Promise.resolve([]),
      ]);
      const foodSupplyMap = new Map(foodSupplyRows.map(fs => [fs.id, fs]));
      const subRecipeMap = new Map(subRecipeRows.map(sr => [sr.id, sr]));

      // Prepare ingredient creation data
      const ingredientCreates: any[] = [];

      for (const ingredient of ingredients) {
        if (ingredient.type === 'food') {
          const foodSupply = foodSupplyMap.get(ingredient.foodSupplyId);
          if (!foodSupply) {
            return res.status(404).json({ 
              error: `Food supply not found for ingredient: ${ingredient.foodSupplyId}` 
            });
          }
          let waste = 0;
          if (ingredient.wastePercentage !== undefined && ingredient.wastePercentage !== null && ingredient.wastePercentage !== '') {
            waste = Number(ingredient.wastePercentage);
            if (isNaN(waste) || waste < 0) waste = 0;
            if (waste > 100) waste = 100;
          }
          const baseCost = ingredient.quantity * foodSupply.pricePerUnit;
          const wasteCost = ingredient.quantity * (waste / 100) * foodSupply.pricePerUnit;
          const totalIngredientCost = baseCost + wasteCost;
          totalCost += totalIngredientCost;

          ingredientCreates.push({
            foodSupplyId: ingredient.foodSupplyId,
            quantity: ingredient.quantity,
            cost: totalIngredientCost,
            wastes: waste > 0 ? {
              create: [{ wasteType: 'General', wastePercentage: waste }]
            } : undefined
          });
        } else if (ingredient.type === 'subrecipe') {
          const subRecipe = subRecipeMap.get(ingredient.subRecipeId);
          if (!subRecipe) {
            return res.status(404).json({ 
              error: `Subrecipe not found for ingredient: ${ingredient.subRecipeId}` 
            });
          }
          if (!subRecipe.isSubrecipe) {
            return res.status(400).json({ 
              error: `Selected recipe is not a subrecipe: ${ingredient.subRecipeId}` 
            });
          }
          const cost = subRecipe.costPerServing * ingredient.quantity;
          totalCost += cost;
          ingredientCreates.push({ subRecipeId: ingredient.subRecipeId, quantity: ingredient.quantity, cost });
        }
      }

      const costPerServing = totalCost / servings;

      // Import the barcode generator
      const { generateRecipeBarcodeId } = await import('@/util/barcode');

      // Generate a structured barcode ID for the recipe
      const recipeId = generateRecipeBarcodeId();

      // Create recipe with ingredients (and wastes for food ingredients)
      const recipe = await prisma.recipe.create({
        data: {
          id: recipeId,
          name,
          description,
          servings,
          prepTime,
          instructions,
          totalCost,
          costPerServing,
          sellingPrice: sellingPrice || 0,
          userId: user.id,
          isSubrecipe: !!isSubrecipe,
          ...(orgId ? { organizationId: orgId } : {}),
          ingredients: {
            create: ingredientCreates
          }
        },
        include: {
          ingredients: {
            include: {
              foodSupply: true,
              wastes: true,
              subRecipe: true
            }
          }
        }
      });

      // Create audit log
      await logDataModification(
        'RECIPE',
        recipe.id,
        'CREATE',
        { recipeName: name, ingredients: ingredients.length },
        {
          action: 'Recipe Creation',
          recipeName: name,
          userId: user.id,
          userEmail: user.email
        }
      );

      return res.status(201).json(recipe);
    } catch (error) {
      console.error('Error creating recipe:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}