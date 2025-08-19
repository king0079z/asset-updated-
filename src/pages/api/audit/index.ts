import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { AuditLogType, AuditLogSeverity } from '@prisma/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user has admin role for certain operations
  const isAdmin = user.email?.endsWith('@admin.com') || false; // Replace with your actual admin check logic

  if (req.method === 'GET') {
    try {
      const {
        page = '1',
        limit = '20',
        type,
        severity,
        resourceType,
        resourceId,
        startDate,
        endDate,
        userId,
        action,
        verified,
        forceRefresh = 'false'
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build filter conditions
      const where: any = {};
      
      // Handle special values for type and severity
      if (type && type !== 'ALL_TYPES') where.type = type;
      if (severity && severity !== 'ALL_SEVERITIES') where.severity = severity;
      
      if (resourceType) where.resourceType = { contains: resourceType, mode: 'insensitive' };
      if (resourceId) where.resourceId = { contains: resourceId, mode: 'insensitive' };
      if (userId) where.userId = userId;
      if (action) where.action = { contains: action, mode: 'insensitive' };
      if (verified !== undefined) where.verified = verified === 'true';
      
      // Date range filtering
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate as string);
        if (endDate) where.timestamp.lte = new Date(endDate as string);
      }

      // For non-admin users, limit what they can see
      if (!isAdmin) {
        // Non-admins can only see their own logs or non-sensitive logs
        where.OR = [
          { userId: user.id },
          { type: { in: ['USER_ACTIVITY', 'SYSTEM_EVENT'] } }
        ];
      }

      // Get total count for pagination
      const totalCount = await prisma.auditLog.count({ where });

      // Get paginated results with proper logging
      console.log('Fetching audit logs with filters:', JSON.stringify(where));
      
      // Only force refresh when explicitly requested
      if (forceRefresh === 'true') {
        await prisma.$disconnect();
        await prisma.$connect();
      }
      
      // Always order by timestamp descending for consistency
      const orderBy = { timestamp: 'desc' };
      
      const logs = await prisma.auditLog.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
      });
      
      console.log(`Found ${logs.length} audit logs`);

      return res.status(200).json({
        logs,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalCount / limitNum)
        }
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      // Log more details about the request for debugging
      console.error('Request query parameters:', JSON.stringify(req.query));
      
      // Return a more descriptive error message if possible
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({ 
        error: 'Failed to fetch audit logs', 
        details: errorMessage 
      });
    }
  } else if (req.method === 'POST') {
    try {
      const {
        action,
        resourceType,
        resourceId,
        details,
        changes,
        type = 'USER_ACTIVITY',
        severity = 'INFO',
        ipAddress,
        userAgent,
        metadata
      } = req.body;

      // Validate required fields
      if (!action || !resourceType) {
        return res.status(400).json({ error: 'Missing required fields: action and resourceType are required' });
      }

      // Create the audit log
      const log = await prisma.auditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          action,
          resourceType,
          resourceId,
          details,
          changes,
          type: type as AuditLogType,
          severity: severity as AuditLogSeverity,
          ipAddress: ipAddress || req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress,
          userAgent: userAgent || req.headers['user-agent'],
          metadata,
          timestamp: new Date() // Ensure timestamp is current
        }
      });

      return res.status(201).json(log);
    } catch (error) {
      console.error('Error creating audit log:', error);
      return res.status(500).json({ error: 'Failed to create audit log' });
    }
  } else if (req.method === 'PUT' && isAdmin) {
    // Only admins can verify logs
    try {
      const { id } = req.query;
      const { verified } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Log ID is required' });
      }

      const updatedLog = await prisma.auditLog.update({
        where: { id: id as string },
        data: {
          verified: !!verified,
          verifiedAt: verified ? new Date() : null,
          verifiedBy: verified ? user.id : null
        }
      });

      return res.status(200).json(updatedLog);
    } catch (error) {
      console.error('Error updating audit log:', error);
      return res.status(500).json({ error: 'Failed to update audit log' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}