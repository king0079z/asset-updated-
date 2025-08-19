import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification } from "@/lib/audit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { id, leadTime, reorderPoint } = req.body;

    if (!id || (leadTime === undefined && reorderPoint === undefined)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if the food supply exists
    const foodSupply = await prisma.foodSupply.findUnique({
      where: { id },
    });

    if (!foodSupply) {
      return res.status(404).json({ error: 'Food supply not found' });
    }

    // Update the food supply with lead time settings
    // Note: In a real implementation, you would need to add these fields to the FoodSupply model
    // For this example, we'll store them in the notes field as JSON
    const currentNotes = foodSupply.notes ? JSON.parse(foodSupply.notes) : {};
    const updatedNotes = {
      ...currentNotes,
      leadTime: leadTime !== undefined ? leadTime : currentNotes.leadTime,
      reorderPoint: reorderPoint !== undefined ? reorderPoint : currentNotes.reorderPoint
    };

    const updatedFoodSupply = await prisma.foodSupply.update({
      where: { id },
      data: {
        notes: JSON.stringify(updatedNotes)
      },
    });

    // Log the update
    await logDataModification(
      'FOOD_SUPPLY',
      id,
      'UPDATE_LEAD_TIME',
      {
        leadTime,
        reorderPoint,
        previousLeadTime: currentNotes.leadTime,
        previousReorderPoint: currentNotes.reorderPoint
      },
      {
        action: 'Update Lead Time Settings',
        foodSupplyName: foodSupply.name,
        userId: user.id,
        userEmail: user.email
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Lead time settings updated successfully',
      foodSupply: updatedFoodSupply
    });
  } catch (error) {
    console.error('Update Lead Time API Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error' 
    });
  }
}