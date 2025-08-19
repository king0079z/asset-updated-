import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logError, analyzePossibleSolutions } from '@/lib/errorLogger';
import { ErrorSeverity } from '@prisma/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get the Supabase client
  const supabase = createClient(req, res);
  
  // Allow POST requests without authentication for client-side error logging
  if (req.method === 'POST') {
    try {
      // Get user from session if available
      let user = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        user = session?.user || null;
      } catch (sessionError) {
        console.error('Error getting session:', sessionError);
        // Continue without session data
      }
      
      const { message, stack, context, url, userAgent, userId, userEmail, severity, timestamp } = req.body;
      
      // Determine severity based on error message if not provided
      let errorSeverity: ErrorSeverity = severity || 'MEDIUM';
      
      if (!severity) {
        if (message?.includes('crash') || message?.includes('fatal') || stack?.includes('crash')) {
          errorSeverity = 'CRITICAL';
        } else if (message?.includes('error') || stack?.includes('error')) {
          errorSeverity = 'HIGH';
        } else if (message?.includes('warning') || stack?.includes('warning')) {
          errorSeverity = 'MEDIUM';
        } else {
          errorSeverity = 'LOW';
        }
      }
      
      // Ensure message is a string and not too long
      const safeMessage = typeof message === 'string' ? message.substring(0, 1000) : 'Unknown error';
      
      // Log the error with a timeout
      const logPromise = logError({
        message: safeMessage,
        stack,
        context,
        url,
        userAgent,
        userId: userId || user?.id,
        userEmail: userEmail || user?.email,
        severity: errorSeverity,
      });
      
      // Set a timeout for the logging operation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Logging operation timed out')), 3000);
      });
      
      // Race the logging operation against the timeout
      await Promise.race([logPromise, timeoutPromise]).catch(err => {
        console.error('Error or timeout in logging operation:', err);
        // Continue despite error
      });
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error logging error:', error);
      // Return success anyway to prevent client-side retries that might cause more errors
      return res.status(200).json({ success: true, note: 'Error was logged to console only' });
    }
  }
  
  // For all other methods, require authentication
  // Get user from session
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user || null;
  
  if (!user) {
    console.warn('Unauthorized access attempt to error logs API');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // For GET requests, check if user is admin
  if (req.method === 'GET' && user) {
    // First try to get user data from the 'users' table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, isAdmin')
      .eq('id', user.id)
      .single();
    
    // If that fails, try the 'User' table (note the capital 'U')
    const { data: userDataCapital, error: userErrorCapital } = await supabase
      .from('User')
      .select('role, isAdmin')
      .eq('id', user.id)
      .single();
    
    // Use whichever data we found
    const finalUserData = userData || userDataCapital;
    
    console.log(`User data check for ${user.id} (${user.email}): users table data:`, userData, 'User table data:', userDataCapital);
    
    // Check if user is admin or manager by role OR has isAdmin flag set to true
    if (!finalUserData || ((finalUserData.role !== 'ADMIN' && finalUserData.role !== 'MANAGER') && !finalUserData.isAdmin)) {
      // Special case for admin@example.com - automatically grant access
      if (user.email === 'admin@example.com') {
        console.log(`Granting access to admin@example.com despite role/flag issues`);
      } else {
        console.log(`Access denied for user ${user.id}. Role: ${finalUserData?.role}, isAdmin: ${finalUserData?.isAdmin}`);
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }
    }

    try {
      const { status, severity, limit = '50', page = '1' } = req.query;
      
      // Build the query
      const where: any = {};
      
      if (status) {
        where.status = status;
      }
      
      if (severity) {
        where.severity = severity;
      }
      
      // Parse pagination parameters
      const pageNumber = parseInt(page as string, 10);
      const pageSize = parseInt(limit as string, 10);
      
      // Get total count for pagination
      const totalCount = await prisma.errorLog.count({ where });
      
      // Get error logs with pagination
      const errorLogs = await prisma.errorLog.findMany({
        where,
        orderBy: { lastOccurredAt: 'desc' },
        take: pageSize,
        skip: (pageNumber - 1) * pageSize,
      });
      
      return res.status(200).json({
        data: errorLogs,
        pagination: {
          total: totalCount,
          page: pageNumber,
          pageSize,
          pageCount: Math.ceil(totalCount / pageSize),
        },
      });
    } catch (error) {
      console.error('Error fetching error logs:', error);
      return res.status(500).json({ error: 'Failed to fetch error logs' });
    }
  } 
  // POST requests are already handled above
  // For PATCH requests, update error status or add solution
  else if (req.method === 'PATCH' && user) {
    // First try to get user data from the 'users' table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, isAdmin')
      .eq('id', user.id)
      .single();
    
    // If that fails, try the 'User' table (note the capital 'U')
    const { data: userDataCapital, error: userErrorCapital } = await supabase
      .from('User')
      .select('role, isAdmin')
      .eq('id', user.id)
      .single();
    
    // Use whichever data we found
    const finalUserData = userData || userDataCapital;
    
    console.log(`PATCH - User data check for ${user.id} (${user.email}): users table data:`, userData, 'User table data:', userDataCapital);
    
    // Check if user is admin or manager by role OR has isAdmin flag set to true
    if (!finalUserData || ((finalUserData.role !== 'ADMIN' && finalUserData.role !== 'MANAGER') && !finalUserData.isAdmin)) {
      // Special case for admin@example.com - automatically grant access
      if (user.email === 'admin@example.com') {
        console.log(`PATCH - Granting access to admin@example.com despite role/flag issues`);
      } else {
        console.log(`Access denied for user ${user.id}. Role: ${finalUserData?.role}, isAdmin: ${finalUserData?.isAdmin}`);
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }
    }

    try {
      const { id } = req.query;
      const { status, solution } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'Error ID is required' });
      }
      
      // Update the error log
      const updatedError = await prisma.errorLog.update({
        where: { id: id as string },
        data: {
          status: status || undefined,
          solution: solution || undefined,
          ...(status === 'RESOLVED' ? {
            resolvedAt: new Date(),
            resolvedBy: user.id,
          } : {}),
        },
      });
      
      return res.status(200).json(updatedError);
    } catch (error) {
      console.error('Error updating error log:', error);
      return res.status(500).json({ error: 'Failed to update error log' });
    }
  }
  // For DELETE requests, delete an error log
  else if (req.method === 'DELETE' && user) {
    // First try to get user data from the 'users' table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, isAdmin')
      .eq('id', user.id)
      .single();
    
    // If that fails, try the 'User' table (note the capital 'U')
    const { data: userDataCapital, error: userErrorCapital } = await supabase
      .from('User')
      .select('role, isAdmin')
      .eq('id', user.id)
      .single();
    
    // Use whichever data we found
    const finalUserData = userData || userDataCapital;
    
    console.log(`DELETE - User data check for ${user.id} (${user.email}): users table data:`, userData, 'User table data:', userDataCapital);
    
    // For DELETE, we're more strict - require either ADMIN role or isAdmin flag
    if (!finalUserData || (finalUserData.role !== 'ADMIN' && !finalUserData.isAdmin)) {
      // Special case for admin@example.com - automatically grant access
      if (user.email === 'admin@example.com') {
        console.log(`DELETE - Granting access to admin@example.com despite role/flag issues`);
      } else {
        console.log(`Delete access denied for user ${user.id}. Role: ${finalUserData?.role}, isAdmin: ${finalUserData?.isAdmin}`);
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }
    }

    try {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Error ID is required' });
      }
      
      // Delete the error log
      await prisma.errorLog.delete({
        where: { id: id as string },
      });
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting error log:', error);
      return res.status(500).json({ error: 'Failed to delete error log' });
    }
  }
  // Handle unsupported methods
  else {
    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}