import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

  if (authError || !user) {
    console.error('[Barcodes API] Authentication error:', authError);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.info(`[Barcodes API] Processing ${req.method} request from user ${user.id}`);

  try {
    switch (req.method) {
      case 'POST':
        const { kitchenId, foodSupplyId, generateAll } = req.body;
        
        if (generateAll) {
          // Get all food supplies that don't have barcodes for this kitchen yet
          const existingBarcodes = await prisma.kitchenBarcode.findMany({
            where: { kitchenId },
            select: { foodSupplyId: true },
          });
          
          const existingFoodSupplyIds = existingBarcodes.map(b => b.foodSupplyId);
          
          const foodSupplies = await prisma.foodSupply.findMany({
            where: {
              id: { notIn: existingFoodSupplyIds },
            },
          });
          
          const newBarcodes = await Promise.all(
            foodSupplies.map(async (foodSupply) => {
              const barcode = `KIT${kitchenId.substring(0, 4)}SUP${foodSupply.id.substring(0, 4)}${Date.now()}`;
              return prisma.kitchenBarcode.create({
                data: {
                  barcode,
                  kitchenId,
                  foodSupplyId: foodSupply.id,
                },
                include: {
                  kitchen: true,
                  foodSupply: true,
                },
              });
            })
          );
          
          return res.status(201).json(newBarcodes);
        } else {
          // Generate a single barcode
          // Check if barcode already exists for this combination
          const existingBarcode = await prisma.kitchenBarcode.findFirst({
            where: {
              kitchenId,
              foodSupplyId,
            },
          });

          if (existingBarcode) {
            return res.status(400).json({ 
              error: "A barcode already exists for this food supply in this kitchen" 
            });
          }

          // Verify that the food supply exists
          const foodSupply = await prisma.foodSupply.findUnique({
            where: { id: foodSupplyId },
          });

          if (!foodSupply) {
            return res.status(404).json({ error: "Food supply not found" });
          }

          const barcode = `KIT${kitchenId.substring(0, 4)}SUP${foodSupplyId.substring(0, 4)}${Date.now()}`.toUpperCase();
          
          console.info(`[Barcode Generation] Creating new barcode: ${barcode} for kitchen: ${kitchenId} and food supply: ${foodSupplyId}`);
          
          const kitchenBarcode = await prisma.kitchenBarcode.create({
            data: {
              barcode,
              kitchenId,
              foodSupplyId,
            },
            include: {
              kitchen: true,
              foodSupply: true,
            },
          });
          
          return res.status(201).json(kitchenBarcode);
        }

      case 'GET':
        const { kitchenId: queryKitchenId, foodSupplyId: queryFoodSupplyId } = req.query;
        
        if (queryFoodSupplyId && queryKitchenId) {
          // Get a specific barcode for a food supply in a kitchen
          const barcode = await prisma.kitchenBarcode.findFirst({
            where: {
              kitchenId: String(queryKitchenId),
              foodSupplyId: String(queryFoodSupplyId)
            },
            include: {
              kitchen: true,
              foodSupply: true,
            },
          });
          
          if (!barcode) {
            return res.status(404).json({ error: "Barcode not found" });
          }
          
          return res.status(200).json({ barcode: barcode.barcode });
        } else {
          // Get all barcodes for a kitchen
          const barcodes = await prisma.kitchenBarcode.findMany({
            where: queryKitchenId ? { kitchenId: String(queryKitchenId) } : undefined,
            include: {
              kitchen: true,
              foodSupply: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          });
          
          return res.status(200).json(barcodes);
        }

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Kitchen Barcodes API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}