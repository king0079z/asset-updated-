import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { getUserRoleData, isAdminOrManager } from '@/util/roleCheck';

// Enhanced logging function
const logApiEvent = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} [Ticket Detail API] ${message}`);
  if (data) {
    console.log(`${timestamp} [Ticket Detail API] Data:`, typeof data === 'object' ? JSON.stringify(data) : data);
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log(`Ticket detail API: Received ${req.method} request`);
  
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { user } = auth;

    // Extract and validate ticket ID from URL
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      console.log('Invalid ticket ID provided:', id);
      return res.status(400).json({ error: 'Invalid ticket ID' });
    }

    console.log(`Processing ${req.method} request for ticket ${id} from user: ${user.id}`);

    if (req.method === 'GET') {
      try {
        // Fetch ticket by id; allow if user is creator, assignee, or admin/manager for same org
        console.log(`Attempting to fetch ticket ${id} for user ${user.id}`);
        const ticket = await prisma.ticket.findUnique({
          where: { id },
          include: {
            asset: {
              select: {
                id: true,
                name: true,
                assetId: true,
              },
            },
            assignedTo: {
              select: {
                id: true,
                email: true,
              },
            },
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        });

        if (!ticket) {
          return res.status(404).json({ error: 'Ticket not found' });
        }
        const isOwnerOrAssignee = ticket.userId === user.id || ticket.assignedToId === user.id;
        const roleData = await getUserRoleData(user.id);
        const isAdminUser = roleData?.isAdmin || roleData?.role === 'ADMIN';
        const isManagerUser = roleData?.role === 'MANAGER';
        // For managers: same org OR either side has no org. Admins bypass entirely.
        const orgMatch = !roleData?.organizationId || !ticket.organizationId || roleData.organizationId === ticket.organizationId;
        const hasAccess = isOwnerOrAssignee || isAdminUser || (isManagerUser && orgMatch);
        if (!hasAccess) {
          return res.status(404).json({ error: 'Ticket not found or you do not have permission to access it' });
        }

        console.log(`Successfully found ticket: ${ticket.id}, title: ${ticket.title}`);

        // Ensure dates are properly formatted with null checks
        const formattedTicket = {
          ...ticket,
          createdAt: ticket.createdAt ? ticket.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: ticket.updatedAt ? ticket.updatedAt.toISOString() : new Date().toISOString(),
          resolveBy: ticket.resolveBy ? ticket.resolveBy.toISOString() : null
        };
        
        // Log the ticket data to verify barcode is included
        console.log(`Ticket data being returned: ${JSON.stringify({
          id: formattedTicket.id,
          title: formattedTicket.title,
          barcode: formattedTicket.barcode,
          hasBarcode: !!formattedTicket.barcode
        })}`);

        return res.status(200).json(formattedTicket);
      } catch (error) {
        console.error('Error fetching ticket:', error);
        
        // Log the full error details for debugging
        if (error instanceof Error) {
          console.error(`Error name: ${error.name}`);
          console.error(`Error message: ${error.message}`);
          console.error(`Error stack: ${error.stack}`);
        }
        
        return res.status(500).json({ 
          error: 'Failed to fetch ticket',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else if (req.method === 'PUT' || req.method === 'PATCH') {
      try {
        const { title, description, status, priority, assetId, comment, assignedToId } = req.body;
        
        console.log(`Ticket update request data (${req.method}):`, { 
          id,
          title, 
          description: description?.substring(0, 50) + '...', 
          status,
          priority, 
          assetId,
          hasComment: !!comment,
          assignedToId: assignedToId ?? undefined
        });

        // Special handling for status-only updates from mobile quick actions
        const isStatusOnlyUpdate = status && !title && !description && !priority && !assetId;
        
        // For PATCH requests, we only need to validate the fields that are provided
        // For PUT requests, we require title and description unless it's a status-only update
        if (req.method === 'PUT' && !isStatusOnlyUpdate && (!title || !description)) {
          console.log('Validation failed: Missing title or description for PUT request');
          return res.status(400).json({ 
            error: 'Missing required fields',
            details: 'Title and description are required for PUT requests'
          });
        }

        // Fetch ticket by id and determine permission (owner, assignee, or admin/manager for org)
        const existingTicket = await prisma.ticket.findUnique({ where: { id } });
        if (!existingTicket) {
          return res.status(404).json({ error: 'Ticket not found' });
        }
        const isOwnerOrAssignee = existingTicket.userId === user.id || existingTicket.assignedToId === user.id;
        const roleData = await getUserRoleData(user.id);
        const isAdminUserPatch = roleData?.isAdmin || roleData?.role === 'ADMIN';
        const isManagerUserPatch = roleData?.role === 'MANAGER';
        const orgMatchPatch = !roleData?.organizationId || !existingTicket.organizationId || roleData.organizationId === existingTicket.organizationId;
        const adminOrManagerForTicket = isAdminUserPatch || (isManagerUserPatch && orgMatchPatch);
        if (!isOwnerOrAssignee && !adminOrManagerForTicket) {
          return res.status(404).json({ error: 'Ticket not found or you do not have permission to access it' });
        }

        // Only admin/manager (for this ticket) can set or clear assignedToId
        let newAssignedToId: string | null | undefined = undefined; // undefined = do not change
        let assigneeDetails: { email: string; displayName: string; phone?: string | null } | null = null;
        if (assignedToId !== undefined && adminOrManagerForTicket) {
          if (assignedToId === null || assignedToId === '') {
            newAssignedToId = null;
          } else {
            const assignee = await prisma.user.findUnique({
              where: { id: assignedToId as string },
              select: { id: true, email: true, phone: true },
            });
            if (assignee) {
              newAssignedToId = assignee.id;
              const displayName = assignee.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              assigneeDetails = { email: assignee.email, displayName, phone: assignee.phone ?? null };
            } else {
              newAssignedToId = null;
            }
          }
        }

        // Use provided status/priority or keep existing (for partial PATCH)
        const validStatus = status && Object.values(TicketStatus).includes(status as TicketStatus)
          ? status as TicketStatus
          : existingTicket.status;

        const validPriority = priority && Object.values(TicketPriority).includes(priority as TicketPriority)
          ? priority as TicketPriority
          : existingTicket.priority;

        // Check if status or priority is being changed
        const isStatusChanged = existingTicket.status !== validStatus;
        const isPriorityChanged = existingTicket.priority !== validPriority;
        
        // Comment is now optional, but we'll log whether one was provided
        if (isStatusChanged || isPriorityChanged) {
          console.log(`Status or priority change detected. Status: ${existingTicket.status} -> ${validStatus}, Priority: ${existingTicket.priority} -> ${validPriority}`);
          console.log(`Comment provided: ${comment ? 'Yes' : 'No'}`);
        }

        // Build update payload (assignedToId only when allowed)
        const updateData: Record<string, unknown> = {
          title: title ?? existingTicket.title,
          description: description ?? existingTicket.description,
          status: validStatus,
          priority: validPriority,
          assetId: assetId !== undefined ? (assetId || null) : existingTicket.assetId,
          updatedAt: new Date(),
        };
        if (newAssignedToId !== undefined) {
          updateData.assignedToId = newAssignedToId;
        }

        // Start a transaction to update ticket and create history entry
        const result = await prisma.$transaction(async (tx) => {
          // Update the ticket
          const updatedTicket = await tx.ticket.update({
            where: { id },
            data: updateData as any,
            include: {
              asset: {
                select: {
                  id: true,
                  name: true,
                  assetId: true,
                },
              },
              user: {
                select: {
                  email: true,
                }
              },
              assignedTo: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          });

          // Create history entry for status or priority changes, assignment, or comment
          const isAssignmentChange = newAssignedToId !== undefined && (newAssignedToId !== existingTicket.assignedToId);
          const shouldCreateHistory = isStatusChanged || isPriorityChanged || (comment && comment.trim() !== '') || isAssignmentChange;

          let ticketHistoryEntry = null;
          if (shouldCreateHistory) {
            // Generate the initial comment
            let historyComment = comment && comment.trim() !== '' 
              ? comment.trim() 
              : isStatusChanged 
                ? `Status changed from ${existingTicket.status} to ${validStatus}` 
                : isPriorityChanged
                ? `Priority changed from ${existingTicket.priority} to ${validPriority}`
                : isAssignmentChange && assigneeDetails
                ? `Ticket assigned to staff.`
                : 'Ticket updated.';

            // When ticket is assigned or reassigned to staff, append assignee email and mobile so the requester sees who is handling their ticket in the Activity Timeline
            if (isAssignmentChange && assigneeDetails) {
              const contactParts = [`Email: ${assigneeDetails.email}`];
              if (assigneeDetails.phone && assigneeDetails.phone.trim()) {
                contactParts.push(`Mobile: ${assigneeDetails.phone.trim()}`);
              }
              historyComment += ` Assigned to: ${assigneeDetails.displayName}. Contact — ${contactParts.join('; ')}. You can reach them for updates on your ticket.`;
            }
            
            console.log(`Creating ticket history entry with comment: ${historyComment}`);
            
            // Find the most recent IN_PROGRESS entry for this ticket if we're resolving it
            let startedAt = null;
            let resolutionTime = null;
            
            if (isStatusChanged && validStatus === TicketStatus.RESOLVED && existingTicket.status === TicketStatus.IN_PROGRESS) {
              // Find the most recent history entry where status was changed to IN_PROGRESS
              const inProgressEntry = await tx.ticketHistory.findFirst({
                where: {
                  ticketId: id,
                  status: TicketStatus.IN_PROGRESS
                },
                orderBy: {
                  createdAt: 'desc'
                }
              });
              
              if (inProgressEntry) {
                // Calculate resolution time in seconds
                const startTime = inProgressEntry.createdAt;
                const endTime = new Date();
                const diffInMs = endTime.getTime() - startTime.getTime();
                resolutionTime = Math.floor(diffInMs / 1000); // Convert to seconds
                startedAt = startTime;
                
                console.log(`Calculated resolution time: ${resolutionTime} seconds from ${startTime.toISOString()} to ${endTime.toISOString()}`);
                
                // Add resolution time to the comment
                const hours = Math.floor(resolutionTime / 3600);
                const minutes = Math.floor((resolutionTime % 3600) / 60);
                const seconds = resolutionTime % 60;
                
                const timeString = [];
                if (hours > 0) timeString.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
                if (minutes > 0) timeString.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
                if (seconds > 0 && hours === 0) timeString.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
                
                const formattedTime = timeString.join(', ');
                historyComment = `${historyComment}. Resolution time: ${formattedTime}`;
              }
            } else if (isStatusChanged && validStatus === TicketStatus.IN_PROGRESS) {
              // If we're starting work on the ticket, record the start time
              startedAt = new Date();
            }
            
            ticketHistoryEntry = await tx.ticketHistory.create({
              data: {
                ticketId: id,
                status: isStatusChanged ? validStatus : null,
                priority: isPriorityChanged ? validPriority : null,
                comment: historyComment,
                userId: user.id,
                startedAt: startedAt,
                resolutionTime: resolutionTime
              },
              include: {
                user: {
                  select: {
                    email: true,
                  }
                }
              }
            });
          }

          // If the ticket is linked to an asset, add an entry to asset history
          if (updatedTicket.asset && (isStatusChanged || isPriorityChanged || (comment && comment.trim() !== ''))) {
            // Use the same comment logic as for ticket history
            const assetHistoryComment = comment && comment.trim() !== '' 
              ? comment.trim() 
              : isStatusChanged 
                ? `Status changed from ${existingTicket.status} to ${validStatus}` 
                : `Priority changed from ${existingTicket.priority} to ${validPriority}`;
            
            await tx.assetHistory.create({
              data: {
                assetId: updatedTicket.asset.id,
                action: 'REGISTERED',
                userId: user.id,
                details: {
                  action: 'TICKET_UPDATED',
                  ticketId: updatedTicket.id,
                  ticketDisplayId: updatedTicket.displayId,
                  ticketTitle: updatedTicket.title,
                  ticketStatus: validStatus,
                  ticketPriority: validPriority,
                  comment: assetHistoryComment,
                  updatedAt: new Date().toISOString(),
                  updatedBy: user.email || 'Unknown',
                  previousStatus: isStatusChanged ? existingTicket.status : null,
                  previousPriority: isPriorityChanged ? existingTicket.priority : null,
                  latestUpdate: ticketHistoryEntry ? {
                    status: ticketHistoryEntry.status || validStatus,
                    priority: ticketHistoryEntry.priority || validPriority,
                    comment: ticketHistoryEntry.comment,
                    updatedAt: ticketHistoryEntry.createdAt.toISOString(),
                    updatedBy: ticketHistoryEntry.user.email,
                  } : null
                }
              }
            });
            
            console.log(`Added asset history entry for ticket update on asset ${updatedTicket.asset.id}`);
          }

          return updatedTicket;
        });

        console.log(`Successfully updated ticket ${id}`);

        // Notify ticket creator when someone else (staff) updates the ticket (Jira-style)
        // Include assigned staff name and contact so the user can reach them
        if (existingTicket.userId !== user.id) {
          try {
            const assignee = result.assignedTo;
            const assigneeName = assignee?.email ? assignee.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : null;
            const assigneeContact = assignee?.email ? `Email: ${assignee.email}` : null;
            const assigneeBlock = assigneeName && assigneeContact
              ? ` Assigned to: ${assigneeName}. Contact: ${assigneeContact}`
              : '';

            const summaryParts = [
              isStatusChanged && `Status: ${validStatus}`,
              isPriorityChanged && `Priority: ${validPriority}`,
              (comment && comment.trim()) && 'Comment added',
            ].filter(Boolean);
            const summary = summaryParts.length ? summaryParts.join('. ') : 'Ticket was updated.';
            const message = `${existingTicket.displayId || id}: ${summary}.${assigneeBlock}`;

            await prisma.notification.create({
              data: {
                userId: existingTicket.userId,
                ticketId: id,
                type: newAssignedToId !== undefined ? 'TICKET_ASSIGNED' : 'TICKET_UPDATE',
                title: newAssignedToId !== undefined
                  ? (assigneeName ? `Ticket assigned to ${assigneeName}` : 'Ticket assigned')
                  : (isStatusChanged && validStatus === 'IN_PROGRESS' && assigneeName
                    ? `In progress — assigned to ${assigneeName}`
                    : 'Ticket updated'),
                message,
              },
            });
          } catch (notifErr) {
            console.error('Failed to create notification for ticket update:', notifErr);
          }
        }

        // Ensure dates are properly formatted
        const formattedTicket = {
          ...result,
          createdAt: result.createdAt.toISOString(),
          updatedAt: result.updatedAt.toISOString()
        };

        return res.status(200).json(formattedTicket);
      } catch (error) {
        console.error('Error updating ticket:', error);
        
        // Log the full error details for debugging
        if (error instanceof Error) {
          console.error(`Error name: ${error.name}`);
          console.error(`Error message: ${error.message}`);
          console.error(`Error stack: ${error.stack}`);
        }
        
        // Check for specific Prisma errors
        if (error instanceof Error) {
          if (error.message.includes('Foreign key constraint failed')) {
            return res.status(400).json({ 
              error: 'Invalid asset ID provided', 
              details: 'The specified asset does not exist or is not accessible' 
            });
          }
          
          if (error.message.includes('Enumerable') || error.message.includes('enum')) {
            return res.status(400).json({ 
              error: 'Invalid status or priority value', 
              details: 'Please provide a valid status and priority value' 
            });
          }
        }
        
        return res.status(500).json({ 
          error: 'Failed to update ticket',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else if (req.method === 'DELETE') {
      try {
        // Check if the ticket belongs to the user or is assigned to them
        console.log(`Checking if ticket ${id} belongs to or is assigned to user ${user.id} before deletion`);
        const existingTicket = await prisma.ticket.findFirst({
          where: {
            id,
            OR: [
              { userId: user.id },
              { assignedToId: user.id }
            ]
          }
        });

        if (!existingTicket) {
          console.log(`Cannot delete ticket ${id}: not found or not accessible by user ${user.id}`);
          return res.status(404).json({ error: 'Ticket not found or you do not have permission to access it' });
        }

        console.log(`Deleting ticket ${id} for user ${user.id}`);
        await prisma.ticket.delete({
          where: { id },
        });

        console.log(`Successfully deleted ticket ${id}`);
        return res.status(204).end();
      } catch (error) {
        console.error('Error deleting ticket:', error);
        
        // Log the full error details for debugging
        if (error instanceof Error) {
          console.error(`Error name: ${error.name}`);
          console.error(`Error message: ${error.message}`);
          console.error(`Error stack: ${error.stack}`);
        }
        
        return res.status(500).json({ 
          error: 'Failed to delete ticket',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Unexpected error in ticket API:', error);
    
    // Log the full error details for debugging
    if (error instanceof Error) {
      console.error(`Error name: ${error.name}`);
      console.error(`Error message: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
    }
    
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}