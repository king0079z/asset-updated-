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
    // Find all recipes that don't have the new format (don't start with RCP-)
    const recipes = await prisma.recipe.findMany({
      where: {
        NOT: {
          id: {
            startsWith: 'RCP-'
          }
        }
      }
    });

    if (recipes.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'No recipes found with old barcode format',
        updatedCount: 0
      });
    }

    // Update each recipe with a new barcode ID
    const updatedRecipes = [];
    for (const recipe of recipes) {
      const newBarcodeId = generateRecipeBarcodeId();
      
      // Update the recipe with the new ID
      const updatedRecipe = await prisma.recipe.update({
        where: { id: recipe.id },
        data: {
          id: newBarcodeId
        }
      });
      
      updatedRecipes.push(updatedRecipe);

      // Log the change
      await logDataModification(
        'RECIPE',
        newBarcodeId,
        'UPDATE',
        { oldId: recipe.id, newId: newBarcodeId },
        {
          action: 'Bulk Recipe Barcode Regeneration',
          recipeName: recipe.name,
          userId: user.id,
          userEmail: user.email
        }
      );
    }

    return res.status(200).json({ 
      success: true, 
      message: `Successfully updated ${updatedRecipes.length} recipes with new barcode format`,
      updatedCount: updatedRecipes.length
    });
  } catch (error) {
    console.error('Error regenerating all recipe barcodes:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error' 
    });
  }
}