import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";
import { isAdminOrManager } from "@/util/roleCheck";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
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

    // Check if user is admin or manager
    const userIsAdminOrManager = await isAdminOrManager(user.id);
    console.info(`[Food Supply Stats API] User role check: isAdminOrManager=${userIsAdminOrManager}`);
    
    // Check if user has access to food supply page
    const userPermissions = await prisma.user.findUnique({
      where: { id: user.id },
      select: { pageAccess: true }
    });
    
    const hasFoodSupplyAccess = userPermissions?.pageAccess && 
      (userPermissions.pageAccess['/food-supply'] === true);
    
    console.info(`[Food Supply Stats API] User page access check: hasFoodSupplyAccess=${hasFoodSupplyAccess}`);

    // Determine if we should show all supplies or just user's supplies
    const showAllSupplies = userIsAdminOrManager || hasFoodSupplyAccess;
    console.info(`[Food Supply Stats API] Showing all supplies: ${showAllSupplies}`);

    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Add category filter if provided
    const { category } = req.query;
    let whereClause: any = showAllSupplies ? {} : { userId: user.id };
    if (category && typeof category === "string") {
      whereClause = { 
        ...whereClause, 
        category: { equals: category, mode: "insensitive" }
      };
    }
    const expiringWhereClause = {
      ...whereClause,
      expirationDate: {
        gte: today,
        lte: thirtyDaysFromNow
      }
    };

    // Calculate date ranges for waste data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Add category filter for waste and consumption if provided
    let wasteWhereClause: any = {
      createdAt: { gte: thirtyDaysAgo },
      ...(showAllSupplies ? {} : { userId: user.id })
    };
    let consumptionWhereClause: any = {
      date: { gte: thirtyDaysAgo },
      ...(showAllSupplies ? {} : { userId: user.id })
    };
    if (category && typeof category === "string") {
      wasteWhereClause = { 
        ...wasteWhereClause, 
        foodSupply: { category: { equals: category, mode: "insensitive" } }
      };
      consumptionWhereClause = { 
        ...consumptionWhereClause, 
        foodSupply: { category: { equals: category, mode: "insensitive" } }
      };
    }

    // --- Enhanced logic for per-category consumption and waste (direct + recipe usage, including subrecipes) ---

    // 1. Get all food supplies in this category
    const foodSuppliesInCategory = await prisma.foodSupply.findMany({
      where: whereClause,
      select: {
        id: true,
        pricePerUnit: true,
        category: true
      }
    });
    const foodSupplyIds = foodSuppliesInCategory.map(fs => fs.id);

    // 2. Get all recipes and all their ingredients (including subrecipes)
    const allRecipes = await prisma.recipe.findMany({
      select: {
        id: true,
        ingredients: {
          select: {
            id: true,
            foodSupplyId: true,
            quantity: true,
            foodSupply: {
              select: {
                pricePerUnit: true
              }
            },
            wastes: {
              select: {
                wastePercentage: true
              }
            },
            subRecipeId: true,
            subRecipe: {
              select: {
                id: true,
                ingredients: {
                  select: {
                    id: true,
                    foodSupplyId: true,
                    quantity: true,
                    foodSupply: {
                      select: {
                        pricePerUnit: true
                      }
                    },
                    wastes: {
                      select: {
                        wastePercentage: true
                      }
                    },
                    subRecipeId: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // 3. Get all recipe usages in the last 30 days
    const recipeUsages = await prisma.recipeUsage.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo }
      },
      select: {
        recipeId: true,
        servingsUsed: true
      }
    });

    // Build a map of recipeId -> totalServingsUsed in the period
    const recipeUsageMap: Record<string, number> = {};
    recipeUsages.forEach(usage => {
      recipeUsageMap[usage.recipeId] = (recipeUsageMap[usage.recipeId] || 0) + (usage.servingsUsed || 0);
    });

    // Helper: recursively sum ingredient usage for a recipe
    function sumCategoryIngredientUsage(ingredients: any[], servings: number, foodSupplyIds: string[]) {
      let consumed = 0;
      let waste = 0;
      for (const ingredient of ingredients) {
        if (ingredient.foodSupplyId && foodSupplyIds.includes(ingredient.foodSupplyId)) {
          const totalQtyUsed = (ingredient.quantity || 0) * servings;
          const pricePerUnit = ingredient.foodSupply?.pricePerUnit || 0;
          consumed += totalQtyUsed * pricePerUnit;
          const totalWastePercent = ingredient.wastes.reduce((sum: number, w: any) => sum + (w.wastePercentage || 0), 0);
          waste += totalQtyUsed * pricePerUnit * (totalWastePercent / 100);
        }
        // If this is a subrecipe, recurse
        if (ingredient.subRecipe && ingredient.subRecipe.ingredients && ingredient.subRecipeId) {
          const subServings = servings * (ingredient.quantity || 1); // multiply by quantity of subrecipe used
          const { consumed: subConsumed, waste: subWaste } = sumCategoryIngredientUsage(
            ingredient.subRecipe.ingredients,
            subServings,
            foodSupplyIds
          );
          consumed += subConsumed;
          waste += subWaste;
        }
      }
      return { consumed, waste };
    }

    // 4. Calculate total recipe-based consumption and waste for this category (including subrecipes)
    let recipeBasedConsumed = 0;
    let recipeBasedWaste = 0;
    for (const recipe of allRecipes) {
      const totalServings = recipeUsageMap[recipe.id] || 0;
      if (totalServings > 0) {
        const { consumed, waste } = sumCategoryIngredientUsage(recipe.ingredients, totalServings, foodSupplyIds);
        recipeBasedConsumed += consumed;
        recipeBasedWaste += waste;
      }
    }

    // 5. Get direct consumption and waste as before
    const [
      totalSupplies,
      expiringSupplies,
      categoryStats,
      recentSupplies,
      wasteRecords,
      totalConsumed
    ] = await Promise.all([
      // Total number of supplies
      prisma.foodSupply.count({
        where: whereClause
      }),
      // Supplies expiring in the next 30 days
      prisma.foodSupply.count({
        where: expiringWhereClause
      }),
      // Supplies by category
      prisma.foodSupply.groupBy({
        by: ['category'],
        where: whereClause,
        _count: true,
      }),
      // Recent supplies (last 5)
      prisma.foodSupply.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { vendor: true }
      }),
      // Waste records for the last 30 days (filtered by category if provided)
      prisma.foodDisposal.findMany({
        where: wasteWhereClause,
        include: {
          foodSupply: {
            select: {
              pricePerUnit: true,
              category: true
            }
          }
        }
      }),
      // Total consumed value (filtered by category if provided)
      prisma.foodConsumption.findMany({
        where: consumptionWhereClause,
        include: {
          foodSupply: {
            select: {
              pricePerUnit: true,
              category: true
            }
          }
        }
      })
    ]);

    // Calculate total consumed value (direct)
    const totalConsumedValueDirect = totalConsumed.reduce((sum, record) => {
      const pricePerUnit = record.foodSupply?.pricePerUnit || 0;
      return sum + (record.quantity * pricePerUnit);
    }, 0);

    // Calculate expiration waste cost (direct disposal)
    const expirationWasteCost = wasteRecords.reduce((sum, record) => {
      const quantity = record.quantity || 0;
      const pricePerUnit = record.foodSupply?.pricePerUnit || 0;
      return sum + (quantity * pricePerUnit);
    }, 0);

    // ingredient waste cost (from recipes)
    const ingredientWasteCost = recipeBasedWaste;

    // --- Ingredient Waste Breakdown ---
    // For each recipe, for each ingredient in the category, calculate waste per ingredient
    let ingredientWasteBreakdown: any[] = [];
    for (const recipe of allRecipes) {
      const totalServings = recipeUsageMap[recipe.id] || 0;
      if (totalServings > 0) {
        function collectIngredientWaste(ingredients: any[], servings: number, recipeName: string) {
          for (const ingredient of ingredients) {
            if (ingredient.foodSupplyId && foodSupplyIds.includes(ingredient.foodSupplyId)) {
              const totalQtyUsed = (ingredient.quantity || 0) * servings;
              const pricePerUnit = ingredient.foodSupply?.pricePerUnit || 0;
              const totalWastePercent = ingredient.wastes.reduce((sum: number, w: any) => sum + (w.wastePercentage || 0), 0);
              const wasteCost = totalQtyUsed * pricePerUnit * (totalWastePercent / 100);
              if (wasteCost > 0) {
                ingredientWasteBreakdown.push({
                  ingredientName: ingredient.foodSupplyId,
                  wasteCost,
                  wastePercentage: totalWastePercent,
                  recipeName
                });
              }
            }
            // If this is a subrecipe, recurse
            if (ingredient.subRecipe && ingredient.subRecipe.ingredients && ingredient.subRecipeId) {
              const subServings = servings * (ingredient.quantity || 1);
              collectIngredientWaste(ingredient.subRecipe.ingredients, subServings, recipeName);
            }
          }
        }
        collectIngredientWaste(recipe.ingredients, totalServings, recipe.id);
      }
    }
    // Map ingredientName from id to actual name
    const foodSupplyIdToName: Record<string, string> = {};
    for (const fs of foodSuppliesInCategory) {
      foodSupplyIdToName[fs.id] = fs.id; // fallback to id
    }
    // Try to get names from DB (if not already present)
    const foodSupplyNames = await prisma.foodSupply.findMany({
      where: { id: { in: Object.keys(foodSupplyIdToName) } },
      select: { id: true, name: true }
    });
    for (const fs of foodSupplyNames) {
      foodSupplyIdToName[fs.id] = fs.name;
    }
    ingredientWasteBreakdown = ingredientWasteBreakdown.map(item => ({
      ...item,
      ingredientName: foodSupplyIdToName[item.ingredientName] || item.ingredientName
    }));

    // --- Expiration Waste Breakdown ---
    const expirationWasteBreakdown = wasteRecords.map(record => ({
      supplyName: record.foodSupplyId ? (foodSupplyIdToName[record.foodSupplyId] || record.foodSupplyId) : "Unknown",
      quantity: record.quantity,
      pricePerUnit: record.foodSupply?.pricePerUnit || 0,
      totalCost: (record.quantity || 0) * (record.foodSupply?.pricePerUnit || 0),
      disposalDate: record.createdAt
    }));

    // Final totals: direct + recipe-based
    const totalConsumedValue = totalConsumedValueDirect + recipeBasedConsumed;
    const totalWasteCost = expirationWasteCost + ingredientWasteCost;

    return res.status(200).json({
      totalSupplies,
      expiringSupplies,
      categoryStats,
      recentSupplies,
      totalConsumed: totalConsumedValue,
      ingredientWasteCost,
      expirationWasteCost,
      totalWasteCost,
      wastePercentage: totalConsumedValue > 0 ? (totalWasteCost / totalConsumedValue) * 100 : 0,
      ingredientWasteBreakdown,
      expirationWasteBreakdown
    });
  } catch (error) {
    console.error("Error fetching food supply stats:", error);
    return res.status(500).json({ error: "Failed to fetch food supply statistics" });
  }
}