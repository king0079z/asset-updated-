import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`Path: ${req.url} START RequestId: ${req.headers['x-vercel-id'] || 'unknown'}`);
  
  try {
    const supabase = createClient(req, res);
    
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log(`Path: ${req.url} Unauthorized access attempt`);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`Path: ${req.url} User authenticated: ${user.id}`);

    if (req.method !== 'GET') {
      console.log(`Path: ${req.url} Method not allowed: ${req.method}`);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get all assets that need maintenance or attention
    console.log(`Path: ${req.url} Fetching assets for user: ${user.id}`);
    const assets = await prisma.asset.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
      orderBy: {
        updatedAt: 'asc',
      },
      take: 10,
    });
    console.log(`Path: ${req.url} Found ${assets.length} assets for suggestions`);

    // Get existing tasks to avoid duplicates
    const existingTasks = await prisma.plannerTask.findMany({
      where: {
        userId: user.id,
        aiSuggested: true,
      },
      select: {
        assetId: true,
      },
    });
    console.log(`Path: ${req.url} Found ${existingTasks.length} existing AI tasks`);

    const existingTaskAssetIds = existingTasks
      .map(task => task.assetId)
      .filter(Boolean) as string[];

    // Generate AI suggestions based on assets
    const suggestions = assets
      .filter(asset => !existingTaskAssetIds.includes(asset.id))
      .map(asset => {
        try {
          // Calculate days since last update
          const daysSinceUpdate = Math.floor(
            (Date.now() - (asset.updatedAt?.getTime() || Date.now())) / (1000 * 60 * 60 * 24)
          );
          
          // Generate suggestion based on asset type and days since update
          if (daysSinceUpdate > 30) { // Reduced threshold to 30 days to generate more suggestions
            // Create dates for 1 and 2 weeks from now
            const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
            
            return {
              title: `Maintenance check for ${asset.name}`,
              description: `This asset hasn't been updated in ${daysSinceUpdate} days. Consider scheduling a maintenance check.`,
              startDate: startDate.toISOString(), // Convert to ISO string for consistent serialization
              endDate: endDate.toISOString(), // Convert to ISO string for consistent serialization
              priority: 'MEDIUM',
              status: 'PLANNED',
              assetId: asset.id,
              userId: user.id,
              aiSuggested: true,
              aiNotes: `Suggestion based on asset age (${daysSinceUpdate} days since last update)`,
            };
          }
          
          return null;
        } catch (error) {
          console.error(`Path: ${req.url} Error processing asset ${asset.id}:`, error);
          return null;
        }
      })
      .filter(Boolean);

    console.log(`Path: ${req.url} Generated ${suggestions.length} AI suggestions`);
    
    // If no suggestions based on days, create at least one generic suggestion
    if (suggestions.length === 0 && assets.length > 0) {
      const randomAsset = assets[Math.floor(Math.random() * assets.length)];
      suggestions.push({
        title: `Regular inspection for ${randomAsset.name}`,
        description: `It's a good practice to regularly inspect your assets. Schedule a routine check for this item.`,
        startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        priority: 'LOW',
        status: 'PLANNED',
        assetId: randomAsset.id,
        userId: user.id,
        aiSuggested: true,
        aiNotes: `Regular maintenance suggestion`,
      });
      console.log(`Path: ${req.url} Added a fallback suggestion`);
    }

    return res.status(200).json(suggestions);
  } catch (error) {
    console.error(`Path: ${req.url} Error generating AI suggestions:`, error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  } finally {
    console.log(`Path: ${req.url} END RequestId: ${req.headers['x-vercel-id'] || 'unknown'}`);
  }
}