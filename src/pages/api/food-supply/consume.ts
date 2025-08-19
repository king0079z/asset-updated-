import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification, logUserActivity } from "@/lib/audit";

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
    const { supplyId, quantity, kitchenId, notes } = req.body;

    if (!supplyId || quantity === undefined || !kitchenId) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: {
          supplyId: supplyId ? 'provided' : 'missing',
          quantity: quantity !== undefined ? 'provided' : 'missing',
          kitchenId: kitchenId ? 'provided' : 'missing'
        }
      });
    }
    
    // Ensure quantity is a number and greater than 0
    const parsedQuantity = parseFloat(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ 
        error: 'Invalid quantity value',
        details: { 
          provided: quantity,
          message: 'Quantity must be a positive number'
        }
      });
    }

    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (prisma) => {
      // Check if there's a kitchen-specific food supply entry
      const kitchenFoodSupply = await prisma.kitchenFoodSupply.findUnique({
        where: {
          kitchenId_foodSupplyId: {
            kitchenId,
            foodSupplyId: supplyId,
          },
        },
        include: {
          foodSupply: true,
        },
      });

      if (!kitchenFoodSupply) {
        // If no kitchen-specific entry, check the main food supply
        const foodSupply = await prisma.foodSupply.findUnique({
          where: { id: supplyId },
        });

        if (!foodSupply) {
          throw new Error('Food supply not found');
        }

        if (foodSupply.quantity < quantity) {
          throw new Error('Insufficient quantity available');
        }

        // Update food supply quantity
        await prisma.foodSupply.update({
          where: { id: supplyId },
          data: {
            quantity: {
              decrement: quantity,
            },
          },
        });
      } else {
        // If kitchen-specific entry exists, check and update its quantity
        if (kitchenFoodSupply.quantity < quantity) {
          throw new Error('Insufficient quantity available in this kitchen');
        }

        // Update kitchen-specific quantity
        await prisma.kitchenFoodSupply.update({
          where: {
            id: kitchenFoodSupply.id,
          },
          data: {
            quantity: {
              decrement: quantity,
            },
          },
        });
      }

      // Verify kitchen exists
      const kitchen = await prisma.kitchen.findUnique({
        where: { id: kitchenId },
      });

      if (!kitchen) {
        throw new Error('Kitchen not found');
      }

      // Get the expiration date to record with the consumption
      const expirationDate = kitchenFoodSupply 
        ? kitchenFoodSupply.expirationDate 
        : (await prisma.foodSupply.findUnique({ where: { id: supplyId } }))?.expirationDate;

      // Record consumption with user information and expiration date
      const consumption = await prisma.foodConsumption.create({
        data: {
          quantity,
          notes,
          foodSupplyId: supplyId,
          kitchenId,
          userId: user.id,
          expirationDate: expirationDate, // Record the expiration date at time of consumption
        },
        include: {
          kitchen: true,
          foodSupply: {
            select: {
              id: true,
              name: true,
              quantity: true,
              unit: true,
              pricePerUnit: true
            }
          },
          user: {
            select: {
              email: true,
            },
          },
        },
      });

      return consumption;
    });

    // Create audit log for food consumption
    await logDataModification(
      'FOOD_CONSUMPTION',
      result.id,
      'CREATE',
      {
        foodSupplyId: supplyId,
        foodSupplyName: result.foodSupply.name,
        quantity,
        kitchenId,
        kitchenName: result.kitchen.name,
        previousQuantity: result.foodSupply.quantity + quantity,
        newQuantity: result.foodSupply.quantity,
      },
      {
        action: 'Food Consumption',
        foodSupplyName: result.foodSupply.name,
        quantity: `${quantity} ${result.foodSupply.unit}`,
        kitchen: result.kitchen.name,
        userId: user.id,
        userEmail: user.email
      }
    );
    
    // Also log as user activity for the user activity tab
    try {
      // Create a direct entry in the audit log table using Prisma
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          action: 'CONSUME_FOOD_SUPPLY',
          resourceType: 'FOOD_SUPPLY',
          resourceId: result.id,
          details: {
            foodSupplyId: supplyId,
            foodSupplyName: result.foodSupply.name,
            quantity: `${quantity} ${result.foodSupply.unit}`,
            kitchenId,
            kitchenName: result.kitchen.name,
            previousQuantity: result.foodSupply.quantity + quantity,
            newQuantity: result.foodSupply.quantity,
            action: 'Food consumption'
          },
          type: 'USER_ACTIVITY',
          severity: 'INFO',
          timestamp: new Date(),
          ipAddress: req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      });
      console.log('User activity log created for food consumption');
    } catch (logError) {
      console.error('Error creating user activity log:', logError);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Food Consumption API Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error' 
    });
  }
}