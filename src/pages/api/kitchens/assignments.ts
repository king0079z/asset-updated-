import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { logDataModification, logUserActivity } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is admin for certain operations
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true, role: true }
  });

  const isAdminOrManager = dbUser?.isAdmin || dbUser?.role === 'MANAGER';

  try {
    switch (req.method) {
      case 'GET':
        // Get kitchen assignments for a user or all assignments
        const { userId: queryUserId } = req.query;
        
        // If userId is provided, get assignments for that user
        if (queryUserId) {
          const assignments = await prisma.kitchenAssignment.findMany({
            where: { userId: queryUserId as string },
            include: {
              kitchen: true
            }
          });
          return res.status(200).json(assignments);
        } 
        
        // If no userId and user is admin/manager, get all assignments
        if (isAdminOrManager) {
          const assignments = await prisma.kitchenAssignment.findMany({
            include: {
              kitchen: true,
              user: {
                select: {
                  id: true,
                  email: true
                }
              }
            }
          });
          return res.status(200).json(assignments);
        }
        
        // If not admin/manager and no userId, return only their assignments
        const userAssignments = await prisma.kitchenAssignment.findMany({
          where: { userId: user.id },
          include: {
            kitchen: true
          }
        });
        return res.status(200).json(userAssignments);

      case 'POST':
        // Only admin or manager can create assignments
        if (!isAdminOrManager) {
          return res.status(403).json({ error: 'Forbidden: Admin or Manager access required' });
        }

        const { userId, kitchenId } = req.body;
        
        if (!userId || !kitchenId) {
          return res.status(400).json({ error: 'User ID and Kitchen ID are required' });
        }

        // Check if assignment already exists
        const existingAssignment = await prisma.kitchenAssignment.findFirst({
          where: {
            userId,
            kitchenId
          }
        });

        if (existingAssignment) {
          return res.status(400).json({ error: 'Assignment already exists' });
        }

        // Create new assignment
        const assignment = await prisma.kitchenAssignment.create({
          data: {
            userId,
            kitchenId,
            assignedById: user.id
          },
          include: {
            kitchen: true,
            user: {
              select: {
                email: true
              }
            }
          }
        });
        
        // Create audit log
        await logDataModification(
          'KITCHEN_ASSIGNMENT',
          assignment.id,
          'CREATE',
          { userId, kitchenId },
          {
            action: 'Kitchen Assignment',
            kitchenId,
            assignedUserId: userId,
            assignedUserEmail: assignment.user.email,
            assignedById: user.id,
            assignedByEmail: user.email
          }
        );
        
        return res.status(201).json(assignment);

      case 'DELETE':
        // Only admin or manager can delete assignments
        if (!isAdminOrManager) {
          return res.status(403).json({ error: 'Forbidden: Admin or Manager access required' });
        }

        const { id } = req.query;
        
        if (!id) {
          return res.status(400).json({ error: 'Assignment ID is required' });
        }

        // Get assignment details before deletion for audit log
        const assignmentToDelete = await prisma.kitchenAssignment.findUnique({
          where: { id: id as string },
          include: {
            kitchen: true,
            user: {
              select: {
                email: true
              }
            }
          }
        });

        if (!assignmentToDelete) {
          return res.status(404).json({ error: 'Assignment not found' });
        }

        // Delete assignment
        await prisma.kitchenAssignment.delete({
          where: { id: id as string }
        });
        
        // Create audit log
        await logDataModification(
          'KITCHEN_ASSIGNMENT',
          id as string,
          'DELETE',
          { id },
          {
            action: 'Kitchen Assignment Deletion',
            kitchenId: assignmentToDelete.kitchenId,
            kitchenName: assignmentToDelete.kitchen.name,
            userId: assignmentToDelete.userId,
            userEmail: assignmentToDelete.user.email,
            deletedById: user.id,
            deletedByEmail: user.email
          }
        );
        
        return res.status(200).json({ success: true });

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Kitchen Assignment API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}