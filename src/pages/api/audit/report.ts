import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { AuditLogType, AuditLogSeverity } from '@prisma/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user has admin role for certain operations
  const isAdmin = user.email?.endsWith('@admin.com') || false; // Replace with your actual admin check logic

  if (req.method === 'POST') {
    try {
      const {
        filters,
        options
      } = req.body;

      if (!filters || !options) {
        return res.status(400).json({ error: 'Missing required parameters: filters and options' });
      }

      // Build filter conditions
      const where: any = {};
      
      if (filters.type) where.type = filters.type;
      if (filters.severity) where.severity = filters.severity;
      if (filters.resourceType) where.resourceType = { contains: filters.resourceType, mode: 'insensitive' };
      if (filters.resourceId) where.resourceId = { contains: filters.resourceId, mode: 'insensitive' };
      if (filters.userEmail) where.userEmail = { contains: filters.userEmail, mode: 'insensitive' };
      if (filters.action) where.action = { contains: filters.action, mode: 'insensitive' };
      if (filters.verified !== undefined) where.verified = filters.verified === true;
      if (filters.ipAddress) where.ipAddress = { contains: filters.ipAddress, mode: 'insensitive' };
      
      // Date range filtering
      if (options.dateRange) {
        where.timestamp = {};
        if (options.startDate) where.timestamp.gte = new Date(options.startDate);
        if (options.endDate) where.timestamp.lte = new Date(options.endDate);
      } else if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) where.timestamp.gte = new Date(filters.startDate);
        if (filters.endDate) where.timestamp.lte = new Date(filters.endDate);
      }

      // For non-admin users, limit what they can see
      if (!isAdmin) {
        // Non-admins can only see their own logs or non-sensitive logs
        where.OR = [
          { userId: user.id },
          { type: { in: ['USER_ACTIVITY', 'SYSTEM_EVENT'] } }
        ];
      }

      console.log('Generating report with filters:', JSON.stringify(where));
      
      // Determine sort order
      const orderBy: any = {};
      orderBy[options.sortBy || 'timestamp'] = options.sortOrder || 'desc';
      
      // Get logs with proper sorting
      const logs = await prisma.auditLog.findMany({
        where,
        orderBy,
        take: 1000, // Limit to 1000 logs for performance
      });
      
      console.log(`Found ${logs.length} audit logs for report`);

      // Log the report generation in the audit logs
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          action: 'GENERATE_AUDIT_REPORT',
          resourceType: 'REPORT',
          details: {
            reportType: 'AUDIT_LOG',
            filters,
            options,
            logCount: logs.length,
            timestamp: new Date().toISOString()
          },
          type: 'USER_ACTIVITY',
          severity: 'INFO',
          ipAddress: req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          timestamp: new Date()
        }
      });

      // Also record in the report history table
      await prisma.reportHistory.create({
        data: {
          userId: user.id,
          userEmail: user.email || '',
          reportType: 'AUDIT_LOG',
          itemScope: filters.type || 'ALL',
          dateRange: options.dateRange ? 'CUSTOM' : 'ALL',
          startDate: options.startDate ? new Date(options.startDate) : null,
          endDate: options.endDate ? new Date(options.endDate) : null,
        }
      });

      // Return the logs for the report
      return res.status(200).json({
        logs,
        reportInfo: {
          generatedAt: new Date().toISOString(),
          generatedBy: user.email,
          totalLogs: logs.length,
          filters,
          options
        }
      });
    } catch (error) {
      console.error('Error generating audit report:', error);
      return res.status(500).json({ error: 'Failed to generate audit report' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}