import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { isAdminOrManager } from '@/util/roleCheck';

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
    
    // GET - Retrieve tasks based on user role
    if (req.method === 'GET') {
      console.log(`Path: ${req.url} Fetching tasks for user: ${user.id}`);
      
      try {
        // Check if user is admin or manager
        const userIsAdminOrManager = await isAdminOrManager(user.id);
        console.log(`Path: ${req.url} User role check: isAdminOrManager=${userIsAdminOrManager}`);
        
        // For regular users, only show their own tasks
        // Admin and manager users can see all tasks
        const tasks = await prisma.plannerTask.findMany({
          where: userIsAdminOrManager 
            ? {} // Empty where clause returns all tasks for admin/manager
            : { userId: user.id }, // Only return tasks created by the user
          include: {
            asset: {
              select: {
                id: true,
                name: true,
                assetId: true,
                barcode: true,
              },
            },
            user: {
              select: {
                id: true,
                email: true,
              }
            },
            assignedToUser: {
              select: {
                id: true,
                email: true,
              }
            }
          },
          orderBy: {
            startDate: 'asc',
          },
        });
        
        // Ensure all dates are properly formatted
        const formattedTasks = tasks.map(task => ({
          ...task,
          startDate: task.startDate ? task.startDate.toISOString() : null,
          endDate: task.endDate ? task.endDate.toISOString() : null,
        }));
        
        console.log(`Path: ${req.url} Successfully fetched ${tasks.length} tasks`);
        return res.status(200).json(formattedTasks);
      } catch (error) {
        console.error(`Path: ${req.url} Error fetching tasks:`, error);
        return res.status(500).json({ error: 'Failed to fetch tasks', details: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    
    // POST - Create a new task
    if (req.method === 'POST') {
      console.log(`Path: ${req.url} Creating new task for user: ${user.id}`);
      
      try {
        // Validate request body
        if (!req.body) {
          console.log(`Path: ${req.url} Empty request body`);
          return res.status(400).json({ error: 'Request body is required' });
        }
        
        const { title, description, startDate, endDate, priority, status, assetId, aiSuggested, aiNotes } = req.body;
        
        console.log(`Path: ${req.url} Request body:`, JSON.stringify({
          title,
          startDate: startDate ? (startDate instanceof Date ? startDate.toISOString() : startDate) : null,
          endDate: endDate ? (endDate instanceof Date ? endDate.toISOString() : endDate) : null,
          priority,
          status
        }));
        
        if (!title || !startDate) {
          console.log(`Path: ${req.url} Missing required fields: title or startDate`);
          return res.status(400).json({ error: 'Title and start date are required' });
        }
        
        // Safely parse dates
        let parsedStartDate: Date;
        let parsedEndDate: Date | null = null;
        
        try {
          // Handle if startDate is already a Date object
          if (startDate instanceof Date) {
            parsedStartDate = startDate;
            if (isNaN(parsedStartDate.getTime())) {
              console.log(`Path: ${req.url} Invalid Date object for startDate`);
              parsedStartDate = new Date(); // Fallback to current date
            }
          } else {
            parsedStartDate = new Date(startDate);
            if (isNaN(parsedStartDate.getTime())) {
              console.log(`Path: ${req.url} Invalid startDate format: ${startDate}, using current date`);
              parsedStartDate = new Date(); // Fallback to current date
            }
          }
          
          if (endDate) {
            // Handle if endDate is already a Date object
            if (endDate instanceof Date) {
              parsedEndDate = endDate;
              if (isNaN(parsedEndDate.getTime())) {
                console.log(`Path: ${req.url} Invalid Date object for endDate`);
                parsedEndDate = null;
              }
            } else {
              parsedEndDate = new Date(endDate);
              if (isNaN(parsedEndDate.getTime())) {
                console.log(`Path: ${req.url} Invalid endDate format: ${endDate}, setting to null`);
                parsedEndDate = null;
              }
            }
          }
        } catch (error) {
          console.error(`Path: ${req.url} Error parsing dates:`, error);
          // Use current date as fallback for startDate
          parsedStartDate = new Date();
          parsedEndDate = null;
        }
        
        console.log(`Path: ${req.url} Parsed dates - startDate: ${parsedStartDate.toISOString()}, endDate: ${parsedEndDate?.toISOString() || 'null'}`);
        
        // Validate priority and status
        const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
        const validStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
        
        const sanitizedPriority = validPriorities.includes(priority) ? priority : 'MEDIUM';
        const sanitizedStatus = validStatuses.includes(status) ? status : 'PLANNED';
        
        // Handle assetId - ensure it's null if it's "none" or empty string
        const sanitizedAssetId = assetId === "none" || assetId === "" ? null : assetId;
        
        // Extract KPI fields
        const { assignedToUserId, estimatedHours, actualHours } = req.body;
        
        // Handle KPI fields
        const sanitizedAssignedToUserId = assignedToUserId === "" ? null : assignedToUserId;
        const parsedEstimatedHours = estimatedHours ? parseFloat(estimatedHours) : null;
        const parsedActualHours = actualHours ? parseFloat(actualHours) : null;
        
        // Set completedAt if status is COMPLETED
        const completedAt = sanitizedStatus === 'COMPLETED' ? new Date() : null;
        
        // Create the task with sanitized data
        const task = await prisma.plannerTask.create({
          data: {
            title,
            description: description || null,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            priority: sanitizedPriority,
            status: sanitizedStatus,
            assetId: sanitizedAssetId,
            userId: user.id,
            aiSuggested: aiSuggested || false,
            aiNotes: aiNotes || null,
            assignedToUserId: sanitizedAssignedToUserId,
            estimatedHours: parsedEstimatedHours,
            actualHours: parsedActualHours,
            completedAt: completedAt,
          },
        });
        
        console.log(`Path: ${req.url} Task created successfully with ID: ${task.id}`);
        return res.status(201).json(task);
      } catch (error) {
        console.error(`Path: ${req.url} Error creating task:`, error);
        return res.status(500).json({ 
          error: 'Failed to create task', 
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : null) : undefined
        });
      }
    }
    
    console.log(`Path: ${req.url} Method not allowed: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(`Path: ${req.url} Error in planner API:`, error);
    return res.status(500).json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' });
  } finally {
    console.log(`Path: ${req.url} END RequestId: ${req.headers['x-vercel-id'] || 'unknown'}`);
  }
}