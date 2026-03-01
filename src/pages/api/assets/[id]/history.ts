// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next'
import prisma from '@/lib/prisma'
import { createClient } from '@/util/supabase/api'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('History endpoint called with query:', req.query);
    
    const supabase = createClient(req, res)
    const { data: { user } } = await supabase.auth.getSession()

    if (!user) {
      console.error('History endpoint: Unauthorized access attempt')
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Extract the actual asset ID from the query parameter
    // The query might contain the Next.js dynamic route parameter or additional parameters
    let { id, filter, startDate, endDate, actionType, userId } = req.query
    
    // Handle case where id might be an array (Next.js can sometimes provide params as arrays)
    if (Array.isArray(id)) {
      id = id[0];
    }
    
    // Extract the actual asset ID if it contains additional parameters
    // For example, if id is "assetId?nxtPid=assetId", extract just "assetId"
    if (typeof id === 'string' && id.includes('?')) {
      id = id.split('?')[0];
    }

    if (!id || typeof id !== 'string') {
      console.error('History endpoint: Invalid asset ID', { id })
      return res.status(400).json({ error: 'Invalid asset ID' })
    }

    console.info('Fetching history for asset:', id, 'with filters:', { filter, startDate, endDate, actionType, userId })

    // First check if the asset exists
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            email: true,
          }
        },
        vendor: {
          select: {
            name: true,
            email: true,
          }
        }
      }
    });

    if (!asset) {
      console.error('History endpoint: Asset not found', { id });
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Parse date filters if provided
    const dateFilter: any = {};
    if (startDate && typeof startDate === 'string') {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate && typeof endDate === 'string') {
      dateFilter.lte = new Date(endDate);
    }

    // Build the where clause for asset history
    const assetHistoryWhere: any = {
      assetId: id,
    };

    // Add date filter if provided
    if (Object.keys(dateFilter).length > 0) {
      assetHistoryWhere.createdAt = dateFilter;
    }

    // Add action type filter if provided
    if (actionType && typeof actionType === 'string') {
      const actions = actionType.split(',');
      if (actions.length > 0 && actions[0] !== 'ALL') {
        assetHistoryWhere.action = {
          in: actions as any[],
        };
      }
    } else {
      // Only include valid AssetHistoryAction enum values
      assetHistoryWhere.action = {
        in: ['REGISTERED', 'MOVED', 'DISPOSED', 'UPDATED'],
      };
    }

    // Add user filter if provided
    if (userId && typeof userId === 'string') {
      assetHistoryWhere.userId = userId;
    }

    // Get asset history records
    const assetHistory = await prisma.assetHistory.findMany({
      where: assetHistoryWhere,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Build the where clause for tickets
    const ticketWhere: any = {
      assetId: id,
    };

    // Add date filter if provided
    if (Object.keys(dateFilter).length > 0) {
      ticketWhere.createdAt = dateFilter;
    }

    // Add user filter if provided
    if (userId && typeof userId === 'string') {
      ticketWhere.userId = userId;
    }

    // Get ticket creation history for this asset
    const ticketHistory = await prisma.ticket.findMany({
      where: ticketWhere,
      select: {
        id: true,
        displayId: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        history: {
          select: {
            id: true,
            status: true,
            priority: true,
            comment: true,
            createdAt: true,
            user: {
              select: {
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Build the where clause for planner tasks
    const plannerTaskWhere: any = {
      assetId: id,
    };

    // Add date filter if provided
    if (Object.keys(dateFilter).length > 0) {
      plannerTaskWhere.createdAt = dateFilter;
    }

    // Add user filter if provided
    if (userId && typeof userId === 'string') {
      plannerTaskWhere.userId = userId;
    }

    // Get planner tasks for this asset
    const plannerTasks = await prisma.plannerTask.findMany({
      where: plannerTaskWhere,
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        priority: true,
        status: true,
        completedAt: true,
        estimatedHours: true,
        actualHours: true,
        aiSuggested: true,
        aiNotes: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        assignedToUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get asset movements for more detailed movement history
    const assetMovements = await prisma.assetMovement.findMany({
      where: {
        assetId: id,
        ...(Object.keys(dateFilter).length > 0 ? { movedAt: dateFilter } : {}),
      },
      orderBy: {
        movedAt: 'desc',
      },
    });

    // Add registration event with asset creation details
    const registrationEvent = {
      id: `registration-${asset.id}`,
      action: 'REGISTERED',
      createdAt: asset.createdAt,
      assetId: id,
      details: {
        action: 'REGISTERED',
        name: asset.name,
        description: asset.description,
        type: asset.type,
        purchaseAmount: asset.purchaseAmount,
        vendor: asset.vendor ? {
          name: asset.vendor.name,
          email: asset.vendor.email,
        } : null,
        initialLocation: {
          floorNumber: asset.floorNumber,
          roomNumber: asset.roomNumber,
        },
      },
      user: {
        id: asset.userId,
        email: asset.user.email,
      },
    };

    // Transform ticket data to match history format
    const formattedTicketHistory = ticketHistory.map(ticket => {
      // Get a properly formatted display ID
      const displayId = ticket.displayId || `T-${ticket.id.substring(0, 8)}`;
      
      // Create a detailed ticket history entry
      const ticketEntry = {
        id: `ticket-${ticket.id}`,
        action: 'TICKET_CREATED',
        createdAt: ticket.createdAt,
        assetId: id,
        details: {
          action: 'TICKET_CREATED',
          ticketId: ticket.id,
          ticketDisplayId: displayId,
          ticketTitle: ticket.title,
          ticketDescription: ticket.description,
          ticketStatus: ticket.status,
          ticketPriority: ticket.priority,
          ticketCreatedAt: ticket.createdAt,
          ticketUpdatedAt: ticket.updatedAt,
          latestUpdate: ticket.history && ticket.history.length > 0 ? {
            status: ticket.history[0].status,
            priority: ticket.history[0].priority,
            comment: ticket.history[0].comment,
            updatedAt: ticket.history[0].createdAt,
            updatedBy: ticket.history[0].user?.email || 'System',
          } : null,
        },
        user: ticket.user || { email: 'System' },
      };
      
      // Also create a REGISTERED entry with the same ticket information
      // This ensures it appears in the history even if REGISTERED actions are filtered
      const registeredEntry = {
        id: `ticket-registered-${ticket.id}`,
        action: 'REGISTERED',
        createdAt: ticket.createdAt,
        assetId: id,
        details: {
          action: 'TICKET_CREATED',
          ticketId: ticket.id,
          ticketDisplayId: displayId,
          ticketTitle: ticket.title,
          ticketDescription: ticket.description,
          ticketStatus: ticket.status,
          ticketPriority: ticket.priority,
          ticketCreatedAt: ticket.createdAt,
          ticketUpdatedAt: ticket.updatedAt,
          latestUpdate: ticket.history && ticket.history.length > 0 ? {
            status: ticket.history[0].status,
            priority: ticket.history[0].priority,
            comment: ticket.history[0].comment,
            updatedAt: ticket.history[0].createdAt,
            updatedBy: ticket.history[0].user?.email || 'System',
          } : null,
        },
        user: ticket.user || { email: 'System' },
      };
      
      // Return both entries to ensure the ticket appears in the history
      return [ticketEntry, registeredEntry];
    }).flat(); // Flatten the array of arrays

    // Transform planner task data to match history format
    const formattedTaskHistory = plannerTasks.map(task => ({
      id: `task-${task.id}`,
      action: 'TASK_CREATED',
      createdAt: task.createdAt,
      assetId: id,
      details: {
        action: 'TASK_CREATED',
        taskId: task.id,
        taskTitle: task.title,
        taskDescription: task.description,
        taskStartDate: task.startDate,
        taskEndDate: task.endDate,
        taskPriority: task.priority,
        taskStatus: task.status,
        taskCompletedAt: task.completedAt,
        taskEstimatedHours: task.estimatedHours,
        taskActualHours: task.actualHours,
        taskEfficiency: task.estimatedHours && task.actualHours 
          ? Math.round((task.estimatedHours / task.actualHours) * 100) 
          : null,
        taskAiSuggested: task.aiSuggested,
        taskAiNotes: task.aiNotes,
        taskAssignedTo: task.assignedToUser?.email,
      },
      user: task.user,
    }));

    // Add detailed movement history
    const formattedMovementHistory = assetMovements.map(movement => {
      // Find the corresponding asset history record
      const historyRecord = assetHistory.find(h => 
        h.action === 'MOVED' && 
        h.details && 
        h.details.fromRoom === movement.fromRoom && 
        h.details.toRoom === movement.toRoom &&
        h.details.fromFloor === movement.fromFloor && 
        h.details.toFloor === movement.toFloor
      );

      return {
        id: `movement-${movement.id}`,
        action: 'MOVED',
        createdAt: movement.movedAt,
        assetId: id,
        details: {
          action: 'MOVED',
          fromFloor: movement.fromFloor,
          toFloor: movement.toFloor,
          fromRoom: movement.fromRoom,
          toRoom: movement.toRoom,
          reason: movement.reason,
          movedAt: movement.movedAt,
        },
        user: historyRecord?.user || { email: 'Unknown' },
      };
    });

    // Combine all histories
    let combinedHistory = [
      ...assetHistory,
      ...formattedTicketHistory,
      ...formattedTaskHistory,
    ];
    
    // Include all REGISTERED actions, including asset creation
    // We want to keep REGISTERED actions for:
    // 1. Asset creation (from assetHistory table)
    // 2. Ticket creation (from formattedTicketHistory)
    // 3. Task creation (from formattedTaskHistory)
    combinedHistory = combinedHistory.filter(item => 
      item.action !== 'REGISTERED' || 
      (item.details && 
        (item.details.action === 'TICKET_CREATED' || 
         item.details.action === 'TASK_CREATED' ||
         // This will keep the original asset registration
         item.id.startsWith('registration-') ||
         // This will keep entries from the assetHistory table with REGISTERED action
         !item.id.includes('ticket-') && !item.id.includes('task-')))
    );

    // Filter by action type if specified
    if (filter && typeof filter === 'string' && filter !== 'ALL') {
      const filterTypes = filter.split(',');
      combinedHistory = combinedHistory.filter(item => filterTypes.includes(item.action));
    }

    // Sort by date
    combinedHistory.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Get statistics about the asset history
    const stats = {
      totalEvents: combinedHistory.length,
      byActionType: {
        REGISTERED: combinedHistory.filter(item => item.action === 'REGISTERED').length,
        MOVED: combinedHistory.filter(item => item.action === 'MOVED').length,
        DISPOSED: combinedHistory.filter(item => item.action === 'DISPOSED').length,
        TICKET_CREATED: combinedHistory.filter(item => item.action === 'TICKET_CREATED').length,
        TASK_CREATED: combinedHistory.filter(item => item.action === 'TASK_CREATED').length,
      },
      byUser: {} as Record<string, number>,
      firstEvent: combinedHistory.length > 0 ? new Date(combinedHistory[combinedHistory.length - 1].createdAt).toISOString() : null,
      lastEvent: combinedHistory.length > 0 ? new Date(combinedHistory[0].createdAt).toISOString() : null,
    };

    // Count events by user
    combinedHistory.forEach(item => {
      if (item.user && item.user.email) {
        if (!stats.byUser[item.user.email]) {
          stats.byUser[item.user.email] = 0;
        }
        stats.byUser[item.user.email]++;
      }
    });

    console.log('Found combined history records:', combinedHistory.length, 'for asset:', id);
    
    // Ensure we're returning a properly formatted response
    const response = {
      history: combinedHistory || [],
      stats,
      asset: {
        id: asset.id,
        name: asset.name,
        status: asset.status,
        createdAt: asset.createdAt,
        lastMovedAt: asset.lastMovedAt,
        disposedAt: asset.disposedAt,
        owner: asset.user.email,
        vendor: asset.vendor ? asset.vendor.name : null,
      }
    };
    
    console.log('Returning response with history length:', response.history.length);
  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');

    
    return res.status(200).json(response);
  } catch (error) {
    // Log detailed error information
    console.error('Error fetching asset history:', error);
    
    // Log additional context to help with debugging
    if (req.query && req.query.id) {
      console.error('Failed request for asset ID:', req.query.id);
    }
    
    // Provide more detailed error information in the response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: errorMessage,
      details: errorStack ? errorStack.split('\n').slice(0, 3).join('\n') : 'No stack trace available',
      timestamp: new Date().toISOString()
    });
  }
}