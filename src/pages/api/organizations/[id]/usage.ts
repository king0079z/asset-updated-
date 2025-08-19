import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id: organizationId } = req.query;

  if (!organizationId || typeof organizationId !== 'string') {
    return res.status(400).json({ error: 'Organization ID is required' });
  }

  // Check if the user is a member of the organization
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: user.id,
    },
  });

  if (!membership) {
    return res.status(403).json({ error: 'You are not a member of this organization' });
  }

  // GET - Get the organization's usage statistics
  if (req.method === 'GET') {
    try {
      // Count users
      const userCount = await prisma.organizationMember.count({
        where: { organizationId },
      });

      // Count kitchens
      const kitchenCount = await prisma.kitchen.count({
        where: { organizationId },
      });

      // Count recipes
      const recipeCount = await prisma.recipe.count({
        where: { organizationId },
      });

      // Count assets
      const assetCount = await prisma.asset.count({
        where: { organizationId },
      });

      // Get the subscription to check limits
      const subscription = await prisma.subscription.findUnique({
        where: { organizationId },
      });

      // Update or create usage metrics for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.usageMetrics.upsert({
        where: {
          organizationId_date: {
            organizationId,
            date: today,
          },
        },
        update: {
          activeUsers: userCount,
          totalKitchens: kitchenCount,
          totalRecipes: recipeCount,
          totalAssets: assetCount,
        },
        create: {
          organizationId,
          date: today,
          activeUsers: userCount,
          totalKitchens: kitchenCount,
          totalRecipes: recipeCount,
          totalAssets: assetCount,
        },
      });

      return res.status(200).json({
        users: userCount,
        kitchens: kitchenCount,
        recipes: recipeCount,
        assets: assetCount,
        limits: {
          users: subscription?.maxUsers || 0,
          kitchens: subscription?.maxKitchens || 0,
          recipes: subscription?.maxRecipes || 0,
          assets: subscription?.maxAssets || 0,
        },
      });
    } catch (error) {
      console.error('Error fetching usage statistics:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
      });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}