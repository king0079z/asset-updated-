import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';

interface Notification {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  relatedEntityId?: string;
  relatedEntityType?: string;
  actionRequired?: boolean;
  actionUrl?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle different HTTP methods
  if (req.method === 'GET') {
    return getNotifications(req, res);
  } else if (req.method === 'POST') {
    return createNotification(req, res);
  } else if (req.method === 'PUT') {
    return updateNotification(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getNotifications(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Authenticate the user
    const supabase = createClient(req, res);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // For now, return mock notifications
    // In a real implementation, these would be stored in the database
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'route_optimization',
        severity: 'high',
        title: 'Inefficient Route Detected',
        message: 'Driver John Doe has taken an inefficient route that increased fuel consumption by 15%.',
        timestamp: new Date().toISOString(),
        isRead: false,
        relatedEntityId: 'driver-123',
        relatedEntityType: 'driver',
        actionRequired: true,
        actionUrl: '/drivers/driver-123'
      },
      {
        id: '2',
        type: 'irregular_stops',
        severity: 'medium',
        title: 'Unusual Stops Detected',
        message: 'Vehicle XYZ-123 made 3 unscheduled stops during its last trip.',
        timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        isRead: false,
        relatedEntityId: 'vehicle-456',
        relatedEntityType: 'vehicle',
        actionRequired: true,
        actionUrl: '/vehicles/vehicle-456'
      },
      {
        id: '3',
        type: 'fuel_consumption',
        severity: 'low',
        title: 'Increased Fuel Consumption',
        message: 'Vehicle ABC-789 shows 10% higher fuel consumption than average.',
        timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        isRead: true,
        relatedEntityId: 'vehicle-789',
        relatedEntityType: 'vehicle',
        actionRequired: false
      },
      {
        id: '4',
        type: 'maintenance',
        severity: 'info',
        title: 'Maintenance Reminder',
        message: 'Vehicle DEF-456 is due for maintenance in 5 days.',
        timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        isRead: true,
        relatedEntityId: 'vehicle-101',
        relatedEntityType: 'vehicle',
        actionRequired: false
      }
    ];

    // Log the access
    try {
      await logDataAccess(
        'user',
        user.id,
        { 
          action: 'NOTIFICATIONS_VIEW', 
          description: `User viewed AI analysis notifications` 
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    return res.status(200).json({ 
      success: true,
      notifications: mockNotifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function createNotification(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Authenticate the user
    const supabase = createClient(req, res);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // In a real implementation, this would create a notification in the database
    // For now, just return success
    return res.status(200).json({ 
      success: true,
      message: 'Notification created successfully'
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function updateNotification(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Authenticate the user
    const supabase = createClient(req, res);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.query;
    const { isRead } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Notification ID is required' });
    }

    // In a real implementation, this would update a notification in the database
    // For now, just return success
    return res.status(200).json({ 
      success: true,
      message: `Notification ${id} updated successfully`
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}