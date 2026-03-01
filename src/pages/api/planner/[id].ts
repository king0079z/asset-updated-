import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { differenceInHours } from 'date-fns';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`Path: ${req.url} START RequestId: ${req.headers['x-vercel-id'] || 'unknown'}`);
  
  try {
    const supabase = createClient(req, res);
    
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    
    if (!user) {
      console.log(`Path: ${req.url} Unauthorized access attempt`);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`Path: ${req.url} User authenticated: ${user.id}`);

    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      console.log(`Path: ${req.url} Invalid task ID: ${id}`);
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    console.log(`Path: ${req.url} Processing ${req.method} request for task ID: ${id}`);

    // GET - Retrieve a specific task
    if (req.method === 'GET') {
      const task = await prisma.plannerTask.findUnique({
        where: {
          id,
        },
        include: {
          asset: {
            select: {
              id: true,
              name: true,
              assetId: true,
              barcode: true,
            },
          },
        },
      });
      
      if (!task) {
        console.log(`Path: ${req.url} Task not found: ${id}`);
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Verify the task belongs to the user
      if (task.userId !== user.id) {
        console.log(`Path: ${req.url} Forbidden access to task: ${id} by user: ${user.id}`);
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      console.log(`Path: ${req.url} Successfully retrieved task: ${id}`);
      return res.status(200).json(task);
    }
    
    // PUT or PATCH - Update a task
    if (req.method === 'PUT' || req.method === 'PATCH') {
      console.log(`Path: ${req.url} Updating task: ${id} with method: ${req.method}`);
      
      // First check if the task exists and belongs to the user or is assigned to the user
      const existingTask = await prisma.plannerTask.findUnique({
        where: { id },
      });
      
      if (!existingTask) {
        console.log(`Path: ${req.url} Task not found for update: ${id}`);
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Allow updates if the user created the task or if the task is assigned to them
      const isTaskOwner = existingTask.userId === user.id;
      const isTaskAssignee = existingTask.assignedToUserId === user.id;
      
      if (!isTaskOwner && !isTaskAssignee) {
        console.log(`Path: ${req.url} Forbidden update to task: ${id} by user: ${user.id}`);
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      // For PATCH requests, we only update the fields that are provided
      if (req.method === 'PATCH') {
        const { status } = req.body;
        
        if (!status) {
          return res.status(400).json({ error: 'Status is required for PATCH requests' });
        }
        
        console.log(`Path: ${req.url} Updating task status to: ${status} for task: ${id}`);
        
        // Convert status to uppercase to match TaskStatus enum
        // This handles cases where frontend sends lowercase values like "in_progress" instead of "IN_PROGRESS"
        const normalizedStatus = status.toUpperCase();
        
        // Check if status is changing to COMPLETED
        const wasCompleted = existingTask.status === 'COMPLETED';
        const isNowCompleted = normalizedStatus === 'COMPLETED';
        
        // Set completedAt if task is being marked as completed
        let completedAt = existingTask.completedAt;
        let actualHours = existingTask.actualHours;
        
        if (!wasCompleted && isNowCompleted) {
          completedAt = new Date();
          
          // Automatically calculate actual hours if not provided
          if (!actualHours) {
            try {
              // Calculate hours from task creation to completion
              const taskCreatedAt = existingTask.createdAt;
              const hoursSpent = differenceInHours(completedAt, taskCreatedAt);
              
              // Ensure we have a positive value (minimum 0.1 hours)
              actualHours = Math.max(0.1, hoursSpent);
              
              console.log(`Path: ${req.url} Auto-calculated actual hours: ${actualHours} for task: ${id}`);
            } catch (error) {
              console.error(`Path: ${req.url} Error calculating actual hours:`, error);
              // Keep actualHours as null if calculation fails
            }
          }
        } else if (wasCompleted && !isNowCompleted) {
          completedAt = null;
        }
        
        const updatedTask = await prisma.plannerTask.update({
          where: { id },
          data: {
            status: normalizedStatus,
            completedAt,
            actualHours,
          },
        });
        
        console.log(`Path: ${req.url} Successfully updated task status: ${id}`);
        return res.status(200).json(updatedTask);
      }
      
      // For PUT requests, we update all fields
      const { title, description, startDate, endDate, priority, status, assetId, aiSuggested, aiNotes, assignedToUserId, estimatedHours, actualHours } = req.body;
      
      console.log(`Path: ${req.url} Updating task with data:`, { 
        title, 
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        status,
        assetId,
        assignedToUserId,
        estimatedHours,
        actualHours
      });
      
      // Handle assetId - ensure it's null if it's "none" or empty string
      const sanitizedAssetId = assetId === "none" || assetId === "" ? null : assetId;
      
      // Handle assignedToUserId - ensure it's null if it's empty string
      const sanitizedAssignedToUserId = assignedToUserId === "" ? null : assignedToUserId;
      
      // Parse numeric fields
      const parsedEstimatedHours = estimatedHours ? parseFloat(estimatedHours) : null;
      const parsedActualHours = actualHours ? parseFloat(actualHours) : null;
      
      // Check if status is changing to COMPLETED
      const wasCompleted = existingTask.status === 'COMPLETED';
      const isNowCompleted = status === 'COMPLETED';
      
      // Set completedAt if task is being marked as completed
      let completedAt = existingTask.completedAt;
      let calculatedActualHours = parsedActualHours;
      
      if (!wasCompleted && isNowCompleted) {
        completedAt = new Date();
        
        // Automatically calculate actual hours if not provided
        if (!calculatedActualHours) {
          try {
            // Calculate hours from task creation to completion
            const taskCreatedAt = existingTask.createdAt;
            const hoursSpent = differenceInHours(completedAt, taskCreatedAt);
            
            // Ensure we have a positive value (minimum 0.1 hours)
            calculatedActualHours = Math.max(0.1, hoursSpent);
            
            console.log(`Path: ${req.url} Auto-calculated actual hours: ${calculatedActualHours} for task: ${id}`);
          } catch (error) {
            console.error(`Path: ${req.url} Error calculating actual hours:`, error);
            // Keep actualHours as null if calculation fails
          }
        }
      } else if (wasCompleted && !isNowCompleted) {
        completedAt = null;
      }
      
      const updatedTask = await prisma.plannerTask.update({
        where: { id },
        data: {
          title,
          description,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : null,
          priority,
          status,
          assetId: sanitizedAssetId,
          aiSuggested,
          aiNotes,
          assignedToUserId: sanitizedAssignedToUserId,
          estimatedHours: parsedEstimatedHours,
          actualHours: calculatedActualHours,
          completedAt,
        },
      });
      
      console.log(`Path: ${req.url} Successfully updated task: ${id}`);
      return res.status(200).json(updatedTask);
    }
    
    // DELETE - Delete a task
    if (req.method === 'DELETE') {
      console.log(`Path: ${req.url} Deleting task: ${id}`);
      
      // First check if the task exists and belongs to the user
      const existingTask = await prisma.plannerTask.findUnique({
        where: { id },
      });
      
      if (!existingTask) {
        console.log(`Path: ${req.url} Task not found for deletion: ${id}`);
        return res.status(404).json({ error: 'Task not found' });
      }
      
      if (existingTask.userId !== user.id) {
        console.log(`Path: ${req.url} Forbidden deletion of task: ${id} by user: ${user.id}`);
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      await prisma.plannerTask.delete({
        where: { id },
      });
      
      console.log(`Path: ${req.url} Successfully deleted task: ${id}`);
      return res.status(200).json({ message: 'Task deleted successfully' });
    }
    
    console.log(`Path: ${req.url} Method not allowed: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(`Path: ${req.url} Error in planner API:`, error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  } finally {
    console.log(`Path: ${req.url} END RequestId: ${req.headers['x-vercel-id'] || 'unknown'}`);
  }
}