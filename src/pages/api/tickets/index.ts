import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { TicketPriority, TicketStatus, AuditLogType } from '@prisma/client';
import { isAdminOrManager } from '@/util/roleCheck';
import { withAuditLog } from '../middleware/audit-middleware';
import { logUserActivity } from '@/lib/audit';

// Enhanced logging function with error handling and performance tracking
const logApiEvent = (message: string, data?: any) => {
  try {
    const timestamp = new Date().toISOString();
    const logPrefix = `${timestamp} [Tickets API]`;
    console.log(`${logPrefix} ${message}`);
    
    if (data) {
      // Safely stringify objects, handling circular references
      if (typeof data === 'object' && data !== null) {
        let safeData;
        try {
          // Use a replacer function to handle circular references
          const seen = new WeakSet();
          safeData = JSON.stringify(data, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) {
                return '[Circular Reference]';
              }
              seen.add(value);
            }
            // Truncate long strings to prevent log flooding
            if (typeof value === 'string' && value.length > 500) {
              return value.substring(0, 500) + '... [truncated]';
            }
            return value;
          }, 2);
        } catch (stringifyError) {
          safeData = `[Object that couldn't be stringified: ${stringifyError.message}]`;
        }
        console.log(`${logPrefix} Data:`, safeData);
      } else {
        console.log(`${logPrefix} Data:`, data);
      }
    }
  } catch (loggingError) {
    // Fallback logging if the enhanced logging fails
    console.error('Error in logging function:', loggingError);
    console.log('Original message:', message);
  }
};

// Performance tracking
const startTimer = () => {
  return process.hrtime();
};

const endTimer = (start: [number, number], label: string) => {
  const diff = process.hrtime(start);
  const time = (diff[0] * 1e9 + diff[1]) / 1e6; // time in milliseconds
  logApiEvent(`${label} completed in ${time.toFixed(2)}ms`);
  return time;
};

// Original handler function
async function ticketsHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  logApiEvent(`Tickets API: Received ${req.method} request`);
  
  try {
    // Create Supabase client and authenticate user
    const supabase = createClient(req, res);
    
    // Wrap auth check in try-catch to handle potential Supabase errors
    let user;
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      user = data?.user;
      
      if (authError || !user || !user.id) {
        logApiEvent('Authentication error', authError || 'No user found');
        return res.status(401).json({ error: 'Unauthorized - Please log in to continue' });
      }
      
      logApiEvent(`User authenticated successfully`, { userId: user.id });
    } catch (authError) {
      logApiEvent('Unexpected authentication error', authError);
      return res.status(500).json({ error: 'Authentication service error - Please try again later' });
    }

    console.log(`Processing ${req.method} request for tickets from user: ${user.id}`);

    if (req.method === 'GET') {
      try {
        const fetchTimer = startTimer();
        logApiEvent(`Attempting to fetch tickets for user ${user.id}`);
        
        // Check if user is admin or manager
        const userIsAdminOrManager = await isAdminOrManager(user.id);
        logApiEvent(`User role check: isAdminOrManager=${userIsAdminOrManager}`);
        
        // Fetch tickets for the authenticated user with a timeout
        const tickets = await Promise.race([
          prisma.ticket.findMany({
            where: userIsAdminOrManager
              ? {} // Empty where clause returns all tickets for admin/manager
              : { userId: user.id }, // Only return tickets created by the user
            include: {
              asset: {
                select: {
                  id: true,
                  name: true,
                  assetId: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database query timeout')), 10000)
          )
        ]) as any;
        
        endTimer(fetchTimer, 'Database query');
        logApiEvent(`Successfully found ${tickets.length} tickets for user ${user.id}`);
        
        // Use a more efficient approach to format dates
        const processingTimer = startTimer();
        const formattedTickets = tickets.map(ticket => ({
          ...ticket,
          createdAt: ticket.createdAt ? ticket.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: ticket.updatedAt ? ticket.updatedAt.toISOString() : new Date().toISOString()
        }));
        
        endTimer(processingTimer, 'Ticket data processing');
        
        // Return tickets as JSON array
        logApiEvent(`Returning ${formattedTickets.length} formatted tickets`);
        return res.status(200).json(formattedTickets);
      } catch (error) {
        console.error('Error fetching tickets:', error);
        // Log the full error details for debugging
        if (error instanceof Error) {
          console.error(`Error name: ${error.name}`);
          console.error(`Error message: ${error.message}`);
          console.error(`Error stack: ${error.stack}`);
        }
        
        return res.status(500).json({ 
          error: 'Failed to fetch tickets', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    } else if (req.method === 'POST') {
      try {
        // Validate request body exists
        if (!req.body) {
          logApiEvent('Missing request body');
          return res.status(400).json({ error: 'Request body is required' });
        }
        
        // Extract ticket data from request body
        const { title, description, priority, assetId, assignedToId, requesterName } = req.body;
        
        logApiEvent(`Ticket creation request received`, { 
          title, 
          descriptionLength: description?.length || 0, 
          priority, 
          assetId: assetId || 'none'
        });
        
        // Validate required fields
        if (!title || !description) {
          logApiEvent('Validation failed: Missing title or description');
          return res.status(400).json({ error: 'Title and description are required' });
        }

        // Validate title and description length
        if (title.trim().length < 3) {
          logApiEvent('Validation failed: Title too short');
          return res.status(400).json({ error: 'Title must be at least 3 characters long' });
        }

        if (description.trim().length < 10) {
          logApiEvent('Validation failed: Description too short');
          return res.status(400).json({ error: 'Description must be at least 10 characters long' });
        }

        // Validate priority is a valid enum value
        if (priority && !Object.values(TicketPriority).includes(priority as TicketPriority)) {
          logApiEvent(`Invalid priority value: ${priority}`);
          return res.status(400).json({ 
            error: 'Invalid priority value', 
            details: `Priority must be one of: ${Object.values(TicketPriority).join(', ')}` 
          });
        }
        
        const validPriority = priority ? 
          (priority as TicketPriority) : 
          TicketPriority.MEDIUM;

        // Validate assetId if provided
        let validatedAssetId = null;
        if (assetId) {
          try {
            logApiEvent(`Validating asset ID: ${assetId}`);
            
            // Check if the asset ID is valid
            if (typeof assetId !== 'string' || !assetId.trim()) {
              logApiEvent('Invalid asset ID format');
              return res.status(400).json({ 
                error: 'Invalid asset ID format', 
                details: 'Asset ID must be a non-empty string' 
              });
            }
            
            // Check if the asset exists - removed userId filter to allow linking to any asset
            const asset = await prisma.asset.findUnique({
              where: {
                id: assetId
              }
            });
            
            if (!asset) {
              logApiEvent(`Asset validation failed: Asset not found`, { assetId });
              return res.status(400).json({ 
                error: 'Invalid asset ID', 
                details: 'The specified asset does not exist' 
              });
            }
            
            validatedAssetId = asset.id;
            logApiEvent(`Asset validation successful`, { assetId, assetName: asset.name });
          } catch (assetError) {
            logApiEvent(`Error validating asset`, { assetId, error: assetError });
            // If there's an error checking the asset, return an error
            return res.status(400).json({ 
              error: 'Error validating asset ID', 
              details: 'Could not verify the specified asset' 
            });
          }
        }

        logApiEvent(`Creating ticket for user ${user.id}`, { title, priority: validPriority });
        
        try {
          // Generate a user-friendly display ID in format TKT-YYYYMMDD-XXXX
          const today = new Date();
          const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
          
          // Get the count of tickets created today to generate sequential number
          const todayStart = new Date(today.setHours(0, 0, 0, 0));
          const todayEnd = new Date(today.setHours(23, 59, 59, 999));
          
          const todayTicketsCount = await prisma.ticket.count({
            where: {
              createdAt: {
                gte: todayStart,
                lte: todayEnd
              }
            }
          });
          
          // Format the sequential number with leading zeros (e.g., 0001, 0012, etc.)
          const sequentialNumber = String(todayTicketsCount + 1).padStart(4, '0');
          const displayId = `TKT-${datePart}-${sequentialNumber}`;
          
          logApiEvent(`Generated display ID for new ticket: ${displayId}`);
          
          // Prepare the ticket data
          const ticketData = {
            title: title.trim(),
            description: description.trim(),
            priority: validPriority,
            status: TicketStatus.OPEN,
            userId: user.id,
            displayId: displayId,
            ...(requesterName ? { requesterName: requesterName.trim() } : {})
          };
          
          // Only add assetId if it's valid
          if (validatedAssetId) {
            // @ts-ignore - TypeScript might complain about adding properties
            ticketData.assetId = validatedAssetId;
          }
          
          // Add assignedToId if provided
          if (assignedToId && assignedToId !== "none") {
            try {
              // Validate the assignedToId
              const assignedUser = await prisma.user.findUnique({
                where: { id: assignedToId }
              });
              
              if (assignedUser) {
                // @ts-ignore - TypeScript might complain about adding properties
                ticketData.assignedToId = assignedToId;
                logApiEvent(`Ticket will be assigned to user: ${assignedUser.email}`);
              } else {
                logApiEvent(`Invalid assignedToId: ${assignedToId} - User not found`);
              }
            } catch (assignError) {
              logApiEvent(`Error validating assignedToId: ${assignedToId}`, assignError);
              // Continue without assigning if there's an error
            }
          }
          
          logApiEvent(`Attempting to create ticket with data`, { 
            title: ticketData.title,
            priority: ticketData.priority,
            hasAssetId: !!validatedAssetId
          });
          
          // Create new ticket in database with explicit transaction and timeout
          const ticket = await Promise.race([
            prisma.$transaction(async (tx) => {
              // Create the ticket
              const newTicket = await tx.ticket.create({
                data: ticketData,
                include: {
                  asset: validatedAssetId ? {
                    select: {
                      id: true,
                      name: true,
                      assetId: true,
                    }
                  } : undefined,
                  assignedTo: ticketData.assignedToId ? {
                    select: {
                      id: true,
                      email: true
                    }
                  } : undefined
                }
              });
              
              // Create a ticket history entry for the ticket creation
              await tx.ticketHistory.create({
                data: {
                  ticketId: newTicket.id,
                  status: TicketStatus.OPEN,
                  priority: validPriority,
                  userId: user.id,
                  comment: `Ticket created with priority ${validPriority}${validatedAssetId ? ' and linked to an asset' : ''}${ticketData.assignedToId ? ' and assigned to staff' : ''}${requesterName ? ` by requester: ${requesterName}` : ''}`
                }
              });
              
              logApiEvent(`Created ticket history entry for new ticket ${newTicket.id}`);
              
              // If ticket is linked to an asset, add an entry to asset history
              if (validatedAssetId) {
                await tx.assetHistory.create({
                  data: {
                    assetId: validatedAssetId,
                    action: 'REGISTERED', // Using REGISTERED action type for ticket creation
                    userId: user.id,
                    details: {
                      action: 'TICKET_CREATED',
                      ticketId: newTicket.id,
                      ticketTitle: newTicket.title,
                      ticketPriority: newTicket.priority
                    }
                  }
                });
                
                logApiEvent(`Created asset history entry for ticket ${newTicket.id} on asset ${validatedAssetId}`);
              }
              
              return newTicket;
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Database transaction timeout')), 10000)
            )
          ]) as any;
          
          // Format dates to ISO strings
          const formattedTicket = {
            ...ticket,
            createdAt: ticket.createdAt.toISOString(),
            updatedAt: ticket.updatedAt.toISOString()
          };
          
          logApiEvent(`Ticket created successfully`, { ticketId: ticket.id });
          
          // Explicitly log this as a user activity for the staff activity page
          try {
            await prisma.auditLog.create({
              data: {
                userId: user.id,
                userEmail: user.email || null,
                ipAddress: req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || null,
                userAgent: req.headers['user-agent']?.toString() || null,
                action: 'CREATE_TICKET',
                resourceType: 'TICKET',
                resourceId: ticket.id,
                details: {
                  ticketId: ticket.id,
                  ticketTitle: ticket.title,
                  ticketPriority: ticket.priority,
                  ticketStatus: ticket.status,
                  displayId: ticket.displayId,
                  timestamp: new Date().toISOString(),
                  userId: user.id,
                  userEmail: user.email
                },
                type: AuditLogType.USER_ACTIVITY,
                severity: 'INFO',
                timestamp: new Date(), // Ensure timestamp is current
              }
            });
            logApiEvent(`Successfully created user activity log for ticket creation`);
          } catch (auditError) {
            console.error('Error creating user activity log for ticket creation:', auditError);
            // Don't fail the request if audit logging fails
          }
          
          return res.status(201).json(formattedTicket);
        } catch (dbError) {
          logApiEvent(`Database error creating ticket`, { error: dbError });
          
          // Check for specific Prisma errors
          if (dbError instanceof Error) {
            // Foreign key constraint error
            if (dbError.message.includes('Foreign key constraint failed')) {
              return res.status(400).json({ 
                error: 'Invalid asset ID provided', 
                details: 'The specified asset does not exist or is not accessible' 
              });
            }
            
            // Required field missing
            if (dbError.message.includes('Required field')) {
              return res.status(400).json({ 
                error: 'Missing required field', 
                details: dbError.message 
              });
            }
            
            // Database connection issues
            if (dbError.message.includes('connect ECONNREFUSED') || 
                dbError.message.includes('Connection refused') ||
                dbError.message.includes('timeout')) {
              return res.status(503).json({ 
                error: 'Database connection error', 
                details: 'Could not connect to the database. Please try again later.' 
              });
            }
          }
          
          throw new Error(`Database error: ${dbError instanceof Error ? dbError.message : 'Unknown database error'}`);
        }
      } catch (error) {
        logApiEvent('Error creating ticket', error);
        
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
          
          // Handle potential database connection issues
          if (error.message.includes('connect ECONNREFUSED') || 
              error.message.includes('Connection refused') ||
              error.message.includes('timeout')) {
            return res.status(503).json({ 
              error: 'Database connection error', 
              details: 'Could not connect to the database. Please try again later.' 
            });
          }
        }
        
        return res.status(500).json({ 
          error: 'Failed to create ticket', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Unexpected error in tickets API:', error);
    
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

// Export the handler wrapped with audit middleware
export default withAuditLog(ticketsHandler, {
  resourceType: 'TICKET',
  type: AuditLogType.USER_ACTIVITY,
  customActionName: (req) => {
    // Create descriptive action names based on HTTP method
    switch (req.method) {
      case 'POST': return 'CREATE_TICKET';
      case 'GET': return 'VIEW_TICKETS';
      default: return `${req.method}_TICKET`;
    }
  },
  // Always log user activity for non-GET methods
  alwaysLogUserActivity: true,
  // Log request body for POST requests (ticket creation)
  logRequestBody: true
});