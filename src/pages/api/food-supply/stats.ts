import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";
import { getUserRoleData } from "@/util/roleCheck";

// 5-minute server-side cache per user+category
const statsCache = new Map<string, { data: any; ts: number }>();
const STATS_CACHE_TTL = 5 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { category } = req.query;
    const cacheKey = `${user.id}:${category || ''}`;

    // ── Cache hit ────────────────────────────────────────────────────────────
    const cached = statsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < STATS_CACHE_TTL) {
      res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=60');
      return res.status(200).json(cached.data);
    }

    // ── Auth / role check ─────────────────────────────────────────────────────
    const roleData = await getUserRoleData(user.id);
    const showAllSupplies =
      roleData?.role === 'ADMIN' || roleData?.role === 'MANAGER' ||
      roleData?.pageAccess?.['/food-supply'] === true;

    const today           = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo   = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const baseWhere: any  = showAllSupplies ? {} : { userId: user.id };
    const catFilter       = category && typeof category === "string"
      ? { category: { equals: category as string, mode: "insensitive" as const } }
      : {};

    const supplyWhere         = { ...baseWhere, ...catFilter };
    const expiringWhere       = { ...supplyWhere, expirationDate: { gte: today, lte: thirtyDaysFromNow } };
    const wasteWhere: any     = { createdAt: { gte: thirtyDaysAgo }, ...baseWhere };
    const consumptionWhere: any = { date: { gte: thirtyDaysAgo }, ...baseWhere };
    if (catFilter.category) {
      wasteWhere.foodSupply    = { category: catFilter.category };
      consumptionWhere.foodSupply = { category: catFilter.category };
    }

    // ── ONE parallel block — all 9 queries fire at once ─────────────────────
    const [
      foodSuppliesInCategory,   // ids + prices + names
      allRecipes,
      recipeUsages,
      totalSupplies,
      expiringSupplies,
      categoryStats,
      recentSupplies,
      wasteRecords,
      totalConsumedRaw,
    ] = await Promise.all([
      prisma.foodSupply.findMany({
        where: supplyWhere,
        select: { id: true, name: true, pricePerUnit: true, category: true },
        take: 500,
      }),
      // Include only what's needed for waste/consumption calculation
      prisma.recipe.findMany({
        select: {
          id: true,
          ingredients: {
            select: {
              id: true, foodSupplyId: true, quantity: true, subRecipeId: true,
              foodSupply: { select: { pricePerUnit: true } },
              wastes:    { select: { wastePercentage: true } },
              subRecipe: {
                select: {
                  id: true,
                  ingredients: {
                    select: {
                      id: true, foodSupplyId: true, quantity: true, subRecipeId: true,
                      foodSupply: { select: { pricePerUnit: true } },
                      wastes:    { select: { wastePercentage: true } },
                    },
                  },
                },
              },
            },
          },
        },
        take: 200,
      }),
      prisma.recipeUsage.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { recipeId: true, servingsUsed: true },
        take: 1000,
      }),
      prisma.foodSupply.count({ where: supplyWhere }),
      prisma.foodSupply.count({ where: expiringWhere }),
      prisma.foodSupply.groupBy({
        by: ['category'], where: supplyWhere, _count: true,
      }),
      prisma.foodSupply.findMany({
        where: supplyWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { vendor: true },
      }),
      prisma.foodDisposal.findMany({
        where: wasteWhere,
        select: {
          quantity: true, foodSupplyId: true, createdAt: true,
          foodSupply: { select: { pricePerUnit: true, category: true } },
        },
        take: 500,
      }),
      prisma.foodConsumption.findMany({
        where: consumptionWhere,
        select: {
          quantity: true,
          foodSupply: { select: { pricePerUnit: true, category: true } },
        },
        take: 1000,
      }),
    ]);

    // ── In-memory computation ────────────────────────────────────────────────
    const foodSupplyIds    = new Set(foodSuppliesInCategory.map(fs => fs.id));
    const foodSupplyIdToName: Record<string, string> = {};
    const foodSupplyPrice:  Record<string, number>   = {};
    for (const fs of foodSuppliesInCategory) {
      foodSupplyIdToName[fs.id] = fs.name;
      foodSupplyPrice[fs.id]    = fs.pricePerUnit;
    }

    // Build recipeId → totalServings map
    const recipeUsageMap: Record<string, number> = {};
    for (const u of recipeUsages) {
      recipeUsageMap[u.recipeId] = (recipeUsageMap[u.recipeId] || 0) + (u.servingsUsed || 0);
    }

    // Recursive ingredient cost/waste aggregation
    function sumIngredients(
      ingredients: any[], servings: number, ids: Set<string>
    ): { consumed: number; waste: number; breakdown: any[] } {
      let consumed = 0, waste = 0;
      const breakdown: any[] = [];
      for (const ing of ingredients) {
        if (ing.foodSupplyId && ids.has(ing.foodSupplyId)) {
          const qty    = (ing.quantity || 0) * servings;
          const price  = ing.foodSupply?.pricePerUnit || 0;
          const pct    = ing.wastes.reduce((s: number, w: any) => s + (w.wastePercentage || 0), 0);
          const wCost  = qty * price * (pct / 100);
          consumed    += qty * price;
          waste       += wCost;
          if (wCost > 0) breakdown.push({
            ingredientName: foodSupplyIdToName[ing.foodSupplyId] || ing.foodSupplyId,
            wasteCost: wCost, wastePercentage: pct,
          });
        }
        if (ing.subRecipe?.ingredients && ing.subRecipeId) {
          const sub = sumIngredients(ing.subRecipe.ingredients, servings * (ing.quantity || 1), ids);
          consumed += sub.consumed;
          waste    += sub.waste;
          breakdown.push(...sub.breakdown);
        }
      }
      return { consumed, waste, breakdown };
    }

    let recipeBasedConsumed = 0, recipeBasedWaste = 0;
    const ingredientWasteBreakdown: any[] = [];
    for (const recipe of allRecipes) {
      const servings = recipeUsageMap[recipe.id] || 0;
      if (servings > 0) {
        const { consumed, waste, breakdown } = sumIngredients(recipe.ingredients, servings, foodSupplyIds);
        recipeBasedConsumed += consumed;
        recipeBasedWaste    += waste;
        ingredientWasteBreakdown.push(...breakdown);
      }
    }

    const directConsumedValue = totalConsumedRaw.reduce(
      (s, r) => s + r.quantity * (r.foodSupply?.pricePerUnit || 0), 0
    );
    const expirationWasteCost = wasteRecords.reduce(
      (s, r) => s + (r.quantity || 0) * (r.foodSupply?.pricePerUnit || 0), 0
    );

    const totalConsumedValue = directConsumedValue + recipeBasedConsumed;
    const totalWasteCost     = expirationWasteCost + recipeBasedWaste;

    const expirationWasteBreakdown = wasteRecords.map(r => ({
      supplyName:   foodSupplyIdToName[r.foodSupplyId || ''] || r.foodSupplyId || 'Unknown',
      quantity:     r.quantity,
      pricePerUnit: r.foodSupply?.pricePerUnit || 0,
      totalCost:    (r.quantity || 0) * (r.foodSupply?.pricePerUnit || 0),
      disposalDate: r.createdAt,
    }));

    const responseData = {
      totalSupplies,
      expiringSupplies,
      categoryStats,
      recentSupplies,
      totalConsumed:          totalConsumedValue,
      ingredientWasteCost:    recipeBasedWaste,
      expirationWasteCost,
      totalWasteCost,
      wastePercentage:        totalConsumedValue > 0
        ? (totalWasteCost / totalConsumedValue) * 100 : 0,
      ingredientWasteBreakdown,
      expirationWasteBreakdown,
    };

    statsCache.set(cacheKey, { data: responseData, ts: Date.now() });
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=60');
    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching food supply stats:", error);
    return res.status(500).json({ error: "Failed to fetch food supply statistics" });
  }
}
