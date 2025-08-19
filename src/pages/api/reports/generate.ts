import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get the user from Supabase auth
  const supabase = createClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Report generation request received:', req.body);
    const { reportType, itemScope, specificItemId, dateRange, startDate, endDate } = req.body;

    if (!reportType) {
      console.log('Error: Report type is required');
      return res.status(400).json({ error: 'Report type is required' });
    }

    // Create a date filter based on the date range
    const dateFilter = dateRange === 'custom' && startDate && endDate
      ? {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }
      : {};

    // Create an item filter based on the item scope
    const itemFilter = itemScope === 'specific' && specificItemId
      ? { id: specificItemId }
      : {};

    // Fetch data based on report type
    let reportData;
    switch (reportType) {
      case 'asset':
        if (itemScope === 'specific' && specificItemId) {
          // For specific asset, include detailed information including tickets and complete history
          try {
            console.log(`Fetching specific asset with ID: ${specificItemId}`);
            
            // First check if the asset exists
            const assetExists = await prisma.asset.findUnique({
              where: {
                id: specificItemId,
              },
              select: { id: true }
            });
            
            if (!assetExists) {
              console.error(`Asset with ID ${specificItemId} not found`);
              return res.status(404).json({ error: `Asset with ID ${specificItemId} not found` });
            }
            
            // Fetch the asset with all related data
            reportData = await prisma.asset.findMany({
              where: {
                id: specificItemId,
                userId: user.id, // Ensure the asset belongs to the user
              },
              include: {
                location: true,
                history: {
                  include: {
                    user: {
                      select: {
                        email: true,
                      },
                    },
                  },
                  orderBy: {
                    createdAt: 'desc',
                  },
                },
                tickets: {
                  include: {
                    user: {
                      select: {
                        email: true,
                      },
                    },
                    history: true,
                  },
                  orderBy: {
                    createdAt: 'desc',
                  },
                },
                vendor: true,
              },
            });
            
            // Ensure history and tickets are always arrays, even if they're null or undefined
            if (reportData && reportData.length > 0) {
              reportData = reportData.map(asset => ({
                ...asset,
                history: Array.isArray(asset.history) ? asset.history : [],
                tickets: Array.isArray(asset.tickets) ? asset.tickets : []
              }));
            }
            
            if (!reportData || reportData.length === 0) {
              console.error(`No data found for asset ${specificItemId}`);
              return res.status(404).json({ error: `No data found for asset ${specificItemId}` });
            }
            
            console.log(`Asset report data for ID ${specificItemId}:`, 
              JSON.stringify({
                assetId: reportData[0]?.id,
                historyCount: reportData[0]?.history?.length,
                ticketsCount: reportData[0]?.tickets?.length
              })
            );
          } catch (error) {
            console.error(`Error fetching specific asset ${specificItemId}:`, error);
            return res.status(500).json({ error: `Error fetching asset: ${error.message}` });
          }
        } else {
          // For all assets, include basic information
          reportData = await prisma.asset.findMany({
            where: {
              ...dateFilter,
              userId: user.id, // Ensure assets belong to the user
            },
            include: {
              location: true,
              vendor: true,
            },
            orderBy: {
              name: 'asc',
            },
          });
        }
        break;
      
      case 'food':
        try {
          console.log(`Fetching food supply data. Scope: ${itemScope}, ID: ${specificItemId || 'all'}`);
          
          if (itemScope === 'specific' && specificItemId) {
            // First check if the food supply item exists
            const foodSupplyExists = await prisma.foodSupply.findUnique({
              where: {
                id: specificItemId,
              },
              select: { id: true }
            });
            
            if (!foodSupplyExists) {
              console.error(`Food supply with ID ${specificItemId} not found`);
              return res.status(404).json({ error: `Food supply with ID ${specificItemId} not found` });
            }
            
            // For specific food supply item, include detailed consumption history
            reportData = await prisma.foodSupply.findMany({
              where: {
                id: specificItemId,
                userId: user.id, // Ensure the food supply belongs to the user
              },
              include: {
                consumption: {
                  include: {
                    kitchen: true,
                    user: {
                      select: {
                        email: true,
                      },
                    },
                  },
                  orderBy: {
                    createdAt: 'desc',
                  },
                },
              },
            });
            
            // Ensure consumption is always an array
            if (reportData && reportData.length > 0) {
              reportData = reportData.map(item => ({
                ...item,
                consumption: Array.isArray(item.consumption) ? item.consumption : []
              }));
            }
            
            console.log(`Food supply report data for ID ${specificItemId}:`, 
              JSON.stringify({
                id: reportData[0]?.id,
                name: reportData[0]?.name,
                consumptionCount: reportData[0]?.consumption?.length || 0
              })
            );
          } else {
            // For all food supply items, include basic consumption data
            reportData = await prisma.foodSupply.findMany({
              where: {
                ...dateFilter,
                userId: user.id, // Ensure food supplies belong to the user
              },
              include: {
                consumption: {
                  select: {
                    id: true,
                    quantity: true,
                    date: true,
                  },
                },
              },
              orderBy: {
                name: 'asc',
              },
            });
            
            // Ensure consumption is always an array for each item
            reportData = reportData.map(item => ({
              ...item,
              consumption: Array.isArray(item.consumption) ? item.consumption : []
            }));
            
            console.log(`Retrieved ${reportData.length} food supply items for report`);
          }
          
          if (!reportData || reportData.length === 0) {
            console.log('No food supply data found for the specified criteria');
            // Return an empty array instead of an error for empty results
            reportData = [];
          }
        } catch (error) {
          console.error(`Error fetching food supply data:`, error);
          return res.status(500).json({ error: `Error fetching food supply data: ${error.message}` });
        }
        break;
      
      case 'vehicle':
        reportData = await prisma.vehicle.findMany({
          where: {
            ...itemFilter,
            ...dateFilter,
          },
          include: {
            rentals: true,
          },
        });
        break;
      
      case 'ai':
        // Since there's no aiAlert model in the schema, we'll generate AI recommendations directly
        try {
          // Get data for AI analysis
          const [assets, foodSupplies, vehicles] = await Promise.all([
            prisma.asset.count({ where: { userId: user.id } }),
            prisma.foodSupply.findMany({ 
              where: { userId: user.id },
              include: { consumption: true }
            }),
            prisma.vehicle.findMany()
          ]);
          
          // Create some basic recommendations based on the data
          const recommendations = [
            {
              type: 'Budget',
              severity: 'info',
              title: 'Budget Planning',
              description: 'Consider reviewing your monthly budget allocation based on current asset and inventory trends.',
              createdAt: new Date().toISOString()
            },
            {
              type: 'Inventory',
              severity: 'medium',
              title: 'Inventory Optimization',
              description: 'You currently have ' + assets + ' assets tracked in the system. Regular maintenance checks are recommended.',
              createdAt: new Date().toISOString()
            },
            {
              type: 'Food Supply',
              severity: 'low',
              title: 'Food Supply Management',
              description: 'Monitor consumption patterns to optimize food supply ordering and reduce waste.',
              createdAt: new Date().toISOString()
            }
          ];
          
          reportData = recommendations;
        } catch (error) {
          console.error('Error generating AI recommendations:', error);
          reportData = [
            {
              type: 'System',
              severity: 'info',
              title: 'AI Analysis',
              description: 'AI analysis is currently unavailable. Please try again later.',
              createdAt: new Date().toISOString()
            }
          ];
        }
        break;
      
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    // Record this report generation in history
    await prisma.reportHistory.create({
      data: {
        userId: user.id,
        userEmail: user.email || '',
        reportType,
        itemScope,
        specificItemId: specificItemId || null,
        dateRange,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });
    
    // Also log as user activity for the user activity tab
    await logUserActivity(
      'REPORT_GENERATED',
      'REPORT',
      {
        reportType,
        itemScope,
        specificItemId: specificItemId || null,
        dateRange,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        timestamp: new Date().toISOString(),
        userId: user.id,
        userEmail: user.email
      }
    );

    return res.status(200).json(reportData);
  } catch (error) {
    console.error('Error generating report:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}