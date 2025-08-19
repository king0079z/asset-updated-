import { AuditLogType, AuditLogSeverity } from '@prisma/client';

interface AuditLogParams {
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: any;
  changes?: any;
  type?: AuditLogType;
  severity?: AuditLogSeverity;
  metadata?: any;
}

/**
 * Creates an audit log entry
 * 
 * @param params Audit log parameters
 * @returns Promise with the created log or error
 */
export async function createAuditLog(params: AuditLogParams): Promise<any> {
  try {
    // Determine if we're running on the client or server
    const isServer = typeof window === 'undefined';
    const baseUrl = isServer 
      ? process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      : window.location.origin;
    
    // Ensure baseUrl has protocol (http:// or https://)
    const formattedBaseUrl = baseUrl.startsWith('http') 
      ? baseUrl 
      : `https://${baseUrl}`;
    
    const url = `${formattedBaseUrl}/api/audit`;
    
    // Add credentials to ensure cookies are sent with the request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
      credentials: 'include', // This ensures cookies are sent with the request
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error creating audit log:', errorData);
      return { error: errorData.error || 'Failed to create audit log' };
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating audit log:', error);
    return { error: 'Failed to create audit log' };
  }
}

/**
 * Fetches audit logs with optional filtering
 * 
 * @param filters Optional filters for the logs
 * @returns Promise with the logs or error
 */
export async function getAuditLogs(filters: Record<string, any> = {}, forceRefresh: boolean = false): Promise<any> {
  try {
    // Determine if we're running on the client or server
    const isServer = typeof window === 'undefined';
    const baseUrl = isServer 
      ? process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      : window.location.origin;
    
    // Ensure baseUrl has protocol (http:// or https://)
    const formattedBaseUrl = baseUrl.startsWith('http') 
      ? baseUrl 
      : `https://${baseUrl}`;
    
    // Convert filters to query string
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
    
    // Add forceRefresh parameter if needed
    if (forceRefresh || filters.type === 'USER_ACTIVITY') {
      queryParams.append('forceRefresh', 'true');
    }

    // Only add cache-busting parameter when explicitly requested
    if (forceRefresh) {
      queryParams.append('_t', Date.now().toString());
    }

    console.log(`Fetching audit logs with URL: /api/audit?${queryParams.toString()}`);
    const response = await fetch(`${formattedBaseUrl}/api/audit?${queryParams.toString()}`);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching audit logs:', errorData);
      return { error: errorData.error || 'Failed to fetch audit logs' };
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return { error: 'Failed to fetch audit logs' };
  }
}

/**
 * Verifies an audit log (admin only)
 * 
 * @param id Audit log ID
 * @param verified Verification status
 * @returns Promise with the updated log or error
 */
export async function verifyAuditLog(id: string, verified: boolean): Promise<any> {
  try {
    // Determine if we're running on the client or server
    const isServer = typeof window === 'undefined';
    const baseUrl = isServer 
      ? process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      : window.location.origin;
    
    // Ensure baseUrl has protocol (http:// or https://)
    const formattedBaseUrl = baseUrl.startsWith('http') 
      ? baseUrl 
      : `https://${baseUrl}`;
    
    const response = await fetch(`${formattedBaseUrl}/api/audit?id=${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ verified }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error verifying audit log:', errorData);
      return { error: errorData.error || 'Failed to verify audit log' };
    }

    return await response.json();
  } catch (error) {
    console.error('Error verifying audit log:', error);
    return { error: 'Failed to verify audit log' };
  }
}

/**
 * Helper function to create a standardized audit log for data access events
 */
export function logDataAccess(resourceType: string, resourceId: string, details?: any): Promise<any> {
  return createAuditLog({
    action: 'DATA_ACCESS',
    resourceType,
    resourceId,
    details,
    type: 'DATA_ACCESS',
    severity: 'INFO',
  });
}

/**
 * Helper function to create a standardized audit log for data modification events
 */
export function logDataModification(
  resourceType: string, 
  resourceId: string, 
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  changes?: any,
  details?: any
): Promise<any> {
  return createAuditLog({
    action: `DATA_${action}`,
    resourceType,
    resourceId,
    changes,
    details,
    type: 'DATA_MODIFICATION',
    severity: 'INFO',
  });
}

/**
 * Helper function to create a standardized audit log for security events
 */
export function logSecurityEvent(
  action: string,
  details: any,
  severity: AuditLogSeverity = 'WARNING'
): Promise<any> {
  return createAuditLog({
    action,
    resourceType: 'SECURITY',
    details,
    type: 'SECURITY_EVENT',
    severity,
  });
}

/**
 * Helper function to create a standardized audit log for compliance events
 */
export function logComplianceEvent(
  action: string,
  details: any,
  resourceType?: string,
  resourceId?: string
): Promise<any> {
  return createAuditLog({
    action,
    resourceType: resourceType || 'COMPLIANCE',
    resourceId,
    details,
    type: 'COMPLIANCE_EVENT',
    severity: 'INFO',
  });
}

/**
 * Helper function to create a standardized audit log for user activity events
 * This function ensures all user activities are properly captured in the audit logs
 */
export function logUserActivity(
  action: string,
  resourceType: string,
  details: any,
  resourceId?: string,
  severity: AuditLogSeverity = 'INFO'
): Promise<any> {
  // Ensure timestamp is included in details
  const enhancedDetails = {
    ...details,
    timestamp: details.timestamp || new Date().toISOString(),
  };
  
  // Make sure action is properly formatted for user activity tab
  const formattedAction = action
    .replace('POST_', 'CREATE_')
    .replace('PUT_', 'UPDATE_')
    .replace('PATCH_', 'UPDATE_')
    .replace('DELETE_', 'DELETE_')
    .replace('GET_', 'VIEW_');
  
  console.log(`Creating user activity log via helper: ${formattedAction}`);
  
  return createAuditLog({
    action: formattedAction,
    resourceType,
    resourceId,
    details: enhancedDetails,
    type: 'USER_ACTIVITY',
    severity,
  });
}