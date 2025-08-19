import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification } from "@/lib/audit";
import { generateRecipeBarcodeId } from '@/util/barcode';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Authenticate the user
  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { recipeId } = req.body;

    if (!recipeId) {
      return res.status(400).json({ error: 'Recipe ID is required' });
    }

    // Find the recipe
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId }
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Generate a new barcode ID
    const newBarcodeId = generateRecipeBarcodeId();

    // Update the recipe with the new ID
    const updatedRecipe = await prisma.recipe.update({
      where: { id: recipeId },
      data: {
        id: newBarcodeId
      }
    });

    // Log the change
    await logDataModification(
      'RECIPE',
      newBarcodeId,
      'UPDATE',
      { oldId: recipeId, newId: newBarcodeId },
      {
        action: 'Recipe Barcode Regeneration',
        recipeName: recipe.name,
        userId: user.id,
        userEmail: user.email
      }
    );

    return res.status(200).json({ 
      success: true, 
      recipe: updatedRecipe,
      message: 'Recipe barcode regenerated successfully'
    });
  } catch (error) {
    console.error('Error regenerating recipe barcode:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error' 
    });
  }
}