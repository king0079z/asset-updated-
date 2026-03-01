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
    } = await supabase.auth.getSession();

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Handle barcode scanning
    const { barcode, kitchenId, expiringSoon, lowStock } = req.query;

    if (barcode) {
      // Normalize the barcode to uppercase for consistent lookup
      const normalizedBarcode = (barcode as string).toUpperCase();
      console.info(`[Barcode Lookup] Searching for barcode: ${normalizedBarcode} in kitchen: ${kitchenId || 'any'}`);
      
      // Log the search attempt
      console.info(`[Barcode Search] Attempting to find barcode: ${normalizedBarcode}`);
      
      // Try to find the barcode directly in FoodSupply first
      let foodSupply = await prisma.foodSupply.findFirst({
        where: {
          barcode: {
            mode: 'insensitive',
            equals: normalizedBarcode,
          },
        },
        include: {
          kitchen: true,
        },
      });

      // If found directly in FoodSupply, return it
      if (foodSupply) {
        console.info(`[Barcode Lookup] Found barcode directly in FoodSupply: ${normalizedBarcode}`);
        
        // Get the kitchen name if it exists
        let kitchenName = 'Unknown Kitchen';
        if (foodSupply.kitchenId) {
          const kitchen = await prisma.kitchen.findUnique({
            where: { id: foodSupply.kitchenId },
            select: { name: true }
          });
          if (kitchen) {
            kitchenName = kitchen.name;
          }
        }
        
        // If kitchenId is specified, check if it matches or if there's a KitchenFoodSupply entry
        if (kitchenId && kitchenId !== 'default' && foodSupply.kitchenId !== kitchenId) {
          console.info(`[Barcode Lookup] Found barcode but kitchen doesn't match. Expected: ${kitchenId}, Found: ${foodSupply.kitchenId}`);
          
          // Check if there's a KitchenFoodSupply entry for this food supply in the requested kitchen
          const kitchenFoodSupply = await prisma.kitchenFoodSupply.findFirst({
            where: {
              foodSupplyId: foodSupply.id,
              kitchenId: kitchenId as string
            },
            include: {
              kitchen: true
            }
          });
          
          if (kitchenFoodSupply) {
            console.info(`[Barcode Lookup] Found KitchenFoodSupply entry for this food supply in requested kitchen`);
  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');

            return res.status(200).json({
              supply: {
                id: foodSupply.id,
                name: foodSupply.name,
                quantity: kitchenFoodSupply.quantity,
                unit: foodSupply.unit,
                expirationDate: kitchenFoodSupply.expirationDate || foodSupply.expirationDate,
                kitchenId: kitchenId,
                kitchenName: kitchenFoodSupply.kitchen.name,
              }
            });
          }
          
          return res.status(404).json({ 
            error: "No food supply found for this barcode in the specified kitchen",
            debug: {
              requestedBarcode: normalizedBarcode,
              requestedKitchen: kitchenId,
              foundKitchen: foodSupply.kitchenId
            }
          });
        }
        
        return res.status(200).json({
          supply: {
            id: foodSupply.id,
            name: foodSupply.name,
            quantity: foodSupply.quantity,
            unit: foodSupply.unit,
            expirationDate: foodSupply.expirationDate,
            kitchenId: foodSupply.kitchenId,
            kitchenName: kitchenName,
          }
        });
      }
      
      // If not found in FoodSupply, try KitchenBarcode
      // First try to find the barcode with kitchen ID if provided
      let kitchenBarcode = await prisma.kitchenBarcode.findFirst({
        where: {
          barcode: {
            mode: 'insensitive',
            equals: normalizedBarcode,
          },
          ...(kitchenId && kitchenId !== 'default' ? { kitchenId: kitchenId as string } : {}),
        },
        include: {
          foodSupply: true,
          kitchen: true,
        },
      });

      // If not found with kitchen ID, try to find it in any kitchen
      if (!kitchenBarcode) {
        console.info(`[Barcode Search] Not found in specified kitchen, searching in all kitchens`);
        kitchenBarcode = await prisma.kitchenBarcode.findFirst({
          where: {
            barcode: {
              mode: 'insensitive',
              equals: normalizedBarcode,
            },
          },
          include: {
            foodSupply: true,
            kitchen: true,
          },
        });
      }

      if (!kitchenBarcode) {
        console.info(`[Barcode Lookup] No barcode found for: ${normalizedBarcode}`);
        
        // Try to find the barcode in Recipe table as a fallback
        const recipe = await prisma.recipe.findFirst({
          where: {
            barcode: {
              mode: 'insensitive',
              equals: normalizedBarcode,
            },
          },
        });
        
        if (recipe) {
          console.info(`[Barcode Lookup] Found barcode in Recipe table: ${normalizedBarcode}`);
          return res.status(404).json({ 
            error: "Barcode belongs to a recipe, not a food supply item",
            recipeId: recipe.id,
            recipeName: recipe.name
          });
        }
        
        // Log all barcodes in the system for debugging
        const allBarcodes = await prisma.kitchenBarcode.findMany({
          select: { barcode: true, kitchenId: true }
        });
        
        console.info(`[Barcode Debug] Available barcodes in system: ${JSON.stringify(allBarcodes)}`);
        
        return res.status(404).json({ 
          error: kitchenId 
            ? "No food supply found for this barcode in the specified kitchen" 
            : "No food supply found for this barcode",
          debug: {
            requestedBarcode: normalizedBarcode,
            requestedKitchen: kitchenId || 'any'
          }
        });
      }

      console.info(`[Barcode Lookup] Found barcode: ${normalizedBarcode}, Kitchen: ${kitchenBarcode.kitchen.name}`);

      // Check if the food supply exists and is active
      if (!kitchenBarcode.foodSupply) {
        console.warn(`[Barcode Lookup] Found barcode but no food supply linked: ${normalizedBarcode}`);
        return res.status(404).json({ error: "Food supply not found" });
      }

      return res.status(200).json({
        supply: {
          id: kitchenBarcode.foodSupply.id,
          name: kitchenBarcode.foodSupply.name,
          quantity: kitchenBarcode.foodSupply.quantity,
          unit: kitchenBarcode.foodSupply.unit,
          expirationDate: kitchenBarcode.foodSupply.expirationDate,
          kitchenId: kitchenBarcode.kitchenId,
          kitchenName: kitchenBarcode.kitchen.name,
        }
      });
    }

    // Check if user is admin or manager
    const userIsAdminOrManager = await isAdminOrManager(user.id);
    console.info(`[Food Supplies API] User role check: isAdminOrManager=${userIsAdminOrManager}`);
    
    // Check if user has access to food supply page
    const userPermissions = await prisma.user.findUnique({
      where: { id: user.id },
      select: { pageAccess: true }
    });
    
    const hasFoodSupplyAccess = userPermissions?.pageAccess && 
      (userPermissions.pageAccess['/food-supply'] === true);
    
    console.info(`[Food Supplies API] User page access check: hasFoodSupplyAccess=${hasFoodSupplyAccess}`);
    
    // Build the where clause based on query parameters
    let whereClause: any = userIsAdminOrManager || hasFoodSupplyAccess
      ? {} // Empty where clause returns all food supplies for users with access
      : { userId: user.id }; // Only return food supplies owned by the user

    // Filter by category if provided
    const { category } = req.query;
    if (category && typeof category === "string") {
      // Case-insensitive match for category
      whereClause = {
        ...whereClause,
        category: {
          equals: category,
          mode: "insensitive"
        }
      };
      console.info(`[Food Supplies API] Filtering by category: ${category}`);
    }

    // Filter by kitchen if kitchenId is provided
    if (kitchenId && kitchenId !== 'default') {
      whereClause = {
        ...whereClause,
        kitchenId: kitchenId as string
      };
      console.info(`[Food Supplies API] Filtering by kitchen ID: ${kitchenId}`);
    }
    
    // Handle expiringSoon parameter
    if (expiringSoon === 'true') {
      const today = new Date();
      const twoWeeksFromNow = new Date();
      twoWeeksFromNow.setDate(today.getDate() + 14); // Items expiring within 14 days
      
      whereClause = {
        ...whereClause,
        expirationDate: {
          lte: twoWeeksFromNow,
          gte: today, // Only include items that haven't expired yet
        },
      };
      
      console.info(`[Food Supplies API] Filtering for expiring items: ${today.toISOString()} to ${twoWeeksFromNow.toISOString()}`);
    }
    
    // Handle lowStock parameter
    if (lowStock === 'true') {
      whereClause = {
        ...whereClause,
        quantity: {
          lte: 5, // Consider items with quantity <= 5 as low stock
        },
      };
      
      console.info(`[Food Supplies API] Filtering for low stock items (quantity <= 5)`);
    }
    
    // Regular food supplies list with filters applied
    const foodSupplies = await prisma.foodSupply.findMany({
      where: whereClause,
      include: {
        vendor: true,
        kitchenSupplies: {
          include: {
            kitchen: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // If this is a notification request, format the response differently
    if (expiringSoon === 'true' || lowStock === 'true') {
      return res.status(200).json({
        items: foodSupplies
      });
    }
    
    // If kitchenId is provided, filter the kitchenSupplies to only include the specified kitchen
    if (kitchenId && kitchenId !== 'default') {
      // First, get all food supplies directly linked to this kitchen
      const directKitchenSupplies = await prisma.foodSupply.findMany({
        where: { kitchenId: kitchenId as string },
        include: {
          vendor: true,
          kitchenSupplies: {
            include: {
              kitchen: true,
            },
          },
        },
      });
      
      // Then, get all food supplies linked through KitchenFoodSupply
      const kitchenFoodSupplies = await prisma.kitchenFoodSupply.findMany({
        where: { kitchenId: kitchenId as string },
        include: {
          foodSupply: {
            include: {
              vendor: true,
              kitchenSupplies: {
                include: {
                  kitchen: true,
                },
              },
            },
          },
        },
      });
      
      // Combine both sets, ensuring no duplicates
      const foodSuppliesFromKitchenLinks = kitchenFoodSupplies.map(ks => ks.foodSupply);
      const allSupplies = [...directKitchenSupplies];
      
      // Add supplies from kitchen links if they're not already in the list
      for (const supply of foodSuppliesFromKitchenLinks) {
        if (!allSupplies.some(s => s.id === supply.id)) {
          allSupplies.push(supply);
        }
      }
      
      // Filter kitchenSupplies to only include the specified kitchen
      const foodSuppliesWithFilteredKitchens = allSupplies.map(supply => ({
        ...supply,
        kitchenSupplies: supply.kitchenSupplies.filter(ks => ks.kitchenId === kitchenId),
      }));
      
      console.log(`[Food Supplies API] Returning ${foodSuppliesWithFilteredKitchens.length} food supplies for kitchen ${kitchenId}`);
      return res.status(200).json(foodSuppliesWithFilteredKitchens);
    }
    
    return res.status(200).json(foodSupplies);
  } catch (error) {
    console.error("[Food Supplies API] Error:", error);
    return res.status(500).json({ error: "Failed to process request" });
  }
}