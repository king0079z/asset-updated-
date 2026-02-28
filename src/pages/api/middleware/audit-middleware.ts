import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { AuditLogType, AuditLogSeverity } from '@prisma/client';

type NextApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

/**
 * Middleware to automatically log API requests for compliance and security purposes
 * 
 * @param handler The API route handler
 * @param options Configuration options for the middleware
 * @returns The wrapped handler function
 */
export function withAuditLog(
  handler: NextApiHandler,
  options: {
    resourceType: string;
    skipMethods?: string[];
    logRequestBody?: boolean;
    logResponseBody?: boolean;
    type?: AuditLogType;
    severity?: AuditLogSeverity;
    customActionName?: string | ((req: NextApiRequest) => string);
    customResourceId?: string | ((req: NextApiRequest) => string | null);
    alwaysLogUserActivity?: boolean;
  }
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Skip logging for specified methods
    if (options.skipMethods?.includes(req.method || '')) {
      return handler(req, res);
    }

    const startTime = Date.now();
    const originalEnd = res.end;
    const originalJson = res.json;
    const chunks: Buffer[] = [];
    let responseBody: any = null;

    // Get user information from session
    const supabase = createClient(req, res);
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    const userId = user?.id;
    const userEmail = user?.email;

    // Override res.json to capture response body if needed
    if (options.logResponseBody) {
      res.json = function(body: any) {
        responseBody = body;
        return originalJson.call(this, body);
      };
    }

    // Override res.end to log after response is sent
    res.end = function(chunk?: any) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const statusCode = res.statusCode;
      
      // Determine severity based on status code
      let severity = options.severity || 'INFO';
      if (statusCode >= 500) {
        severity = 'ERROR';
      } else if (statusCode >= 400) {
        severity = 'WARNING';
      }

      // Prepare log details
      const logDetails: any = {
        method: req.method,
        url: req.url,
        statusCode,
        duration,
        headers: {
          userAgent: req.headers['user-agent'],
          contentType: req.headers['content-type'],
        }
      };

      // Add request body if configured (and not a GET request)
      if (options.logRequestBody && req.method !== 'GET') {
        // Sanitize sensitive data
        const sanitizedBody = { ...req.body };
        
        // Remove sensitive fields
        if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
        if (sanitizedBody.token) sanitizedBody.token = '[REDACTED]';
        if (sanitizedBody.apiKey) sanitizedBody.apiKey = '[REDACTED]';
        
        logDetails.requestBody = sanitizedBody;
      }

      // Add response body if configured
      if (options.logResponseBody && responseBody) {
        logDetails.responseBody = responseBody;
      }

      // Extract resource ID from URL if possible or use custom function
      let resourceId: string | null = null;
      
      if (options.customResourceId) {
        if (typeof options.customResourceId === 'function') {
          resourceId = options.customResourceId(req);
        } else {
          resourceId = options.customResourceId;
        }
      } else {
        // Default extraction from URL
        const urlParts = (req.url || '').split('/');
        const potentialResourceId = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
        if (potentialResourceId && !/^(api|index)/.test(potentialResourceId)) {
          resourceId = potentialResourceId;
        }
      }

      // Determine action name
      let actionName: string;
      if (options.customActionName) {
        if (typeof options.customActionName === 'function') {
          actionName = options.customActionName(req);
        } else {
          actionName = options.customActionName;
        }
      } else {
        actionName = `${req.method}_${options.resourceType}`;
      }

      // Create the audit log
      prisma.auditLog.create({
        data: {
          userId: userId || null,
          userEmail: userEmail || null,
          ipAddress: req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || null,
          userAgent: req.headers['user-agent']?.toString() || null,
          action: actionName,
          resourceType: options.resourceType,
          resourceId: resourceId,
          details: logDetails,
          status: statusCode.toString(),
          type: options.type || 'DATA_ACCESS',
          severity: severity as AuditLogSeverity,
        }
      }).catch(error => {
        console.error('Error creating audit log:', error);
      });
      
      // Log as user activity for the user activity tab
      // Either for non-GET methods or if alwaysLogUserActivity is true
      if (userId && (req.method !== 'GET' || options.alwaysLogUserActivity)) {
        // Create a more descriptive action name for better readability in the User Activity tab
        const userFriendlyAction = actionName
          .replace('POST_', 'CREATE_')
          .replace('PUT_', 'UPDATE_')
          .replace('PATCH_', 'UPDATE_')
          .replace('DELETE_', 'DELETE_')
          .replace('GET_', 'VIEW_');
        
        console.log(`Creating user activity log: ${userFriendlyAction} for user ${userId}`);
        
        // Create a direct database entry for user activity to ensure it's immediately visible
        prisma.auditLog.create({
          data: {
            userId: userId,
            userEmail: userEmail || null,
            ipAddress: req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || null,
            userAgent: req.headers['user-agent']?.toString() || null,
            action: userFriendlyAction,
            resourceType: options.resourceType,
            resourceId: resourceId,
            details: {
              ...logDetails,
              timestamp: new Date().toISOString(),
              userId,
              userEmail
            },
            type: 'USER_ACTIVITY',
            severity: 'INFO',
            timestamp: new Date(), // Ensure timestamp is current
          }
        }).then(() => {
          console.log(`Successfully created user activity log: ${userFriendlyAction}`);
        }).catch(error => {
          console.error('Error creating direct user activity log:', error);
        });
      }

      return originalEnd.apply(this, arguments as any);
    };

    try {
      // Call the original handler
      await handler(req, res);
    } catch (error) {
      // Log error if handler throws
      prisma.auditLog.create({
        data: {
          userId: userId || null,
          userEmail: userEmail || null,
          ipAddress: req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || null,
          userAgent: req.headers['user-agent']?.toString() || null,
          action: `${req.method}_${options.resourceType}_ERROR`,
          resourceType: options.resourceType,
          details: {
            method: req.method,
            url: req.url,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          },
          status: '500',
          type: 'SYSTEM_EVENT',
          severity: 'ERROR',
        }
      }).catch(logError => {
        console.error('Error creating error audit log:', logError);
      });

      // Re-throw the error
      throw error;
    }
  };
}