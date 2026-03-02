// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { AuditLogType } from '@prisma/client';
import { isAdminManagerOrSupervisor } from '@/util/roleCheck';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Authenticate the user
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const {
        page = '1',
        limit = '20',
        resourceType,
        resourceId,
        startDate,
        endDate,
        userId,
        action,
        actionType,
        export: isExport = 'false',
        forceRefresh = 'false'
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Check if the user is an admin, manager, or supervisor
      const userHasOversightRole = await isAdminManagerOrSupervisor(user.id);
      console.log(`[staff-activity] User ${user.id} hasOversightRole: ${userHasOversightRole}`);

      // Build filter conditions
      const where: any = {
        // Only get USER_ACTIVITY type logs for staff activity
        type: AuditLogType.USER_ACTIVITY
      };
      
      // Apply role-based filtering:
      // - Admin/Manager/Supervisor: Can see all activities (no userId filter unless explicitly requested)
      // - Staff: Can only see their own activities
      if (!userHasOversightRole && !userId) {
        // For regular staff users, always filter by their own userId if not explicitly specified
        where.userId = user.id;
        console.log(`[staff-activity] Restricting to user's own activities for staff user ${user.id}`);
      } else if (userId) {
        // If userId is explicitly specified in the query, use that
        where.userId = userId as string;
        console.log(`[staff-activity] Using explicitly requested userId filter: ${userId}`);
      } else {
        console.log(`[staff-activity] No userId filter applied - showing all activities for oversight role`);
      }
      
      if (resourceType && resourceType !== 'ALL') where.resourceType = { contains: resourceType as string, mode: 'insensitive' };
      if (resourceId) where.resourceId = { contains: resourceId as string, mode: 'insensitive' };
      
      // Handle action search and actionType filter
      if (action) {
        where.action = { contains: action as string, mode: 'insensitive' };
      } else if (actionType && actionType !== 'ALL') {
        // Filter by action type (CREATE, UPDATE, DELETE, etc.)
        where.action = { contains: actionType as string, mode: 'insensitive' };
      }
      
      // Date range filtering
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate as string);
        if (endDate) {
          // Add one day to endDate to include the entire day
          const endDateObj = new Date(endDate as string);
          endDateObj.setDate(endDateObj.getDate() + 1);
          where.timestamp.lte = endDateObj;
        }
      }

      // Get total count for pagination
      const totalCount = await prisma.auditLog.count({ where });

      // Log the query for debugging
      console.log('[staff-activity] Fetching staff activities with filters:', JSON.stringify(where));
      
      // Only force refresh when explicitly requested
      if (forceRefresh === 'true') {
        await prisma.$disconnect();
        await prisma.$connect();
      }
      
      // Always order by timestamp descending for consistency
      const orderBy = { timestamp: 'desc' };
      
      // For exports, increase the limit
      const exportLimit = isExport === 'true' ? 1000 : limitNum;
      
      const activities = await prisma.auditLog.findMany({
        where,
        orderBy,
        skip: isExport === 'true' ? 0 : skip, // No skip for exports
        take: exportLimit,
        select: {
          id: true,
          timestamp: true,
          userId: true,
          userEmail: true,
          action: true,
          resourceType: true,
          resourceId: true,
          details: true
        }
      });
      
      console.log(`[staff-activity] Found ${activities.length} staff activities`);
  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');


      return res.status(200).json({
        activities,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalCount / limitNum)
        }
      });
    } catch (error) {
      console.error('[staff-activity] Error fetching staff activities:', error);
      
      // Return a more descriptive error message if possible
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({ 
        error: 'Failed to fetch staff activities', 
        details: errorMessage 
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}