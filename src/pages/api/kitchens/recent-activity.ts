// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { format, subDays } from 'date-fns';

// Helper functions to check if a date is today or yesterday
function isToday(date: Date | null): boolean {
  if (!date) return false;
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

function isYesterday(date: Date | null): boolean {
  if (!date) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { kitchenId } = req.query;

  if (!kitchenId) {
    return res.status(400).json({ error: 'Kitchen ID is required' });
  }

  try {
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);

    // Get recent food consumption records with error handling
    const consumptions = await prisma.foodConsumption.findMany({
      where: {
        kitchenId: kitchenId as string,
        date: {
          gte: sevenDaysAgo
        }
      },
      orderBy: {
        date: 'desc'
      },
      include: {
        foodSupply: {
          select: {
            name: true,
            unit: true,
          },
        },
        user: {
          select: {
            email: true
          }
        },
        kitchen: {
          select: {
            name: true
          }
        }
      },
      take: 10
    }).catch(error => {
      console.error('Error fetching consumptions:', error);
      return [];
    });
    
    console.log(`Found ${consumptions.length} consumption records for kitchen ${kitchenId}`);

    // Get recent recipe usages with error handling
    const recipeUsages = await prisma.recipeUsage.findMany({
      where: {
        kitchenId: kitchenId as string,
        createdAt: {
          gte: sevenDaysAgo
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        recipe: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            email: true
          }
        }
      },
      take: 10
    }).catch(error => {
      console.error('Error fetching recipe usages:', error);
      return [];
    });

    // Get recent food disposals
    const disposals = await prisma.foodDisposal.findMany({
      where: {
        foodSupply: {
          kitchenId: kitchenId as string
        },
        createdAt: {
          gte: sevenDaysAgo
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        foodSupply: {
          select: {
            name: true,
            unit: true,
          },
        },
        user: {
          select: {
            email: true
          }
        }
      },
      take: 10
    }).catch(error => {
      console.error('Error fetching disposals:', error);
      return [];
    });

    // Format the data for the frontend with null checks
    const formattedConsumptions = consumptions
      .filter(consumption => consumption.foodSupply && consumption.user && consumption.date)
      .map(consumption => ({
        id: consumption.id,
        type: 'consumption',
        title: 'Consumption Recorded',
        description: `${consumption.foodSupply?.name || 'Unknown Item'} (${consumption.quantity}${consumption.foodSupply?.unit || ''})`,
        date: consumption.date,
        user: consumption.user?.email || 'Unknown User',
        timestamp: consumption.date.getTime(),
        timeFormatted: consumption.date ? format(consumption.date, 'h:mm a') : '',
        dateFormatted: consumption.date ? (
          isToday(consumption.date) 
            ? 'today' 
            : isYesterday(consumption.date) 
              ? 'yesterday' 
              : format(consumption.date, 'MMM dd')
        ) : ''
      }));

    const formattedRecipeUsages = recipeUsages
      .filter(usage => usage.recipe && usage.user && usage.createdAt)
      .map(usage => ({
        id: usage.id,
        type: 'recipe',
        title: 'Recipe Served',
        description: `${usage.recipe?.name || 'Unknown Recipe'} (${usage.servingsUsed} servings)`,
        date: usage.createdAt,
        user: usage.user?.email || 'Unknown User',
        timestamp: usage.createdAt.getTime(),
        timeFormatted: usage.createdAt ? format(usage.createdAt, 'h:mm a') : '',
        dateFormatted: usage.createdAt ? (
          isToday(usage.createdAt) 
            ? 'today' 
            : isYesterday(usage.createdAt) 
              ? 'yesterday' 
              : format(usage.createdAt, 'MMM dd')
        ) : ''
      }));

    const formattedDisposals = disposals
      .filter(disposal => disposal.foodSupply && disposal.user && disposal.createdAt)
      .map(disposal => ({
        id: disposal.id,
        type: 'waste',
        title: 'Waste Recorded',
        description: `${disposal.foodSupply?.name || 'Unknown Item'} (${disposal.quantity}${disposal.foodSupply?.unit || ''})`,
        date: disposal.createdAt,
        user: disposal.user?.email || 'Unknown User',
        timestamp: disposal.createdAt.getTime(),
        timeFormatted: disposal.createdAt ? format(disposal.createdAt, 'h:mm a') : '',
        dateFormatted: disposal.createdAt ? (
          isToday(disposal.createdAt) 
            ? 'today' 
            : isYesterday(disposal.createdAt) 
              ? 'yesterday' 
              : format(disposal.createdAt, 'MMM dd')
        ) : ''
      }));

    // Combine all activities and sort by date (newest first)
    const allActivities = [...formattedConsumptions, ...formattedRecipeUsages, ...formattedDisposals]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10); // Limit to 10 most recent activities

    return res.status(200).json({
      activities: allActivities
    });
  } catch (error) {
    console.error('Kitchen Recent Activity API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}