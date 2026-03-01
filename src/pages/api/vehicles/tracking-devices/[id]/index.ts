import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Authenticate the user
  const supabase = createClient(req, res);
  const { data: { session }, error } = await supabase.auth.getSession();
    const user = session?.user ?? null;

  if (error || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get the device ID from the URL
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid device ID' });
  }

  // Get the user's organization
  const userWithOrg = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  if (!userWithOrg?.organizationId) {
    return res.status(400).json({ error: 'User not associated with an organization' });
  }

  // Find the device and verify it belongs to the user's organization
  const device = await prisma.trackingDevice.findFirst({
    where: {
      id,
      organizationId: userWithOrg.organizationId,
    },
  });

  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }

  // Handle GET request - Get device details
  if (req.method === 'GET') {
    try {
      const deviceWithDetails = await prisma.trackingDevice.findUnique({
        where: {
          id,
        },
        include: {
          vehicle: {
            select: {
              id: true,
              name: true,
              plateNumber: true,
            },
          },
        },
      });

      await logDataAccess(
        'trackingDevice',
        id,
        { action: 'VIEW_TRACKING_DEVICE', description: `User viewed tracking device: ${device.name}` }
      );

      return res.status(200).json({ device: deviceWithDetails });
    } catch (error) {
      console.error('Error fetching tracking device:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Handle PUT request - Update device details
  if (req.method === 'PUT') {
    try {
      const { name, status, firmwareVersion } = req.body;

      const updatedDevice = await prisma.trackingDevice.update({
        where: {
          id,
        },
        data: {
          name: name !== undefined ? name : undefined,
          status: status !== undefined ? status : undefined,
          firmwareVersion: firmwareVersion !== undefined ? firmwareVersion : undefined,
        },
      });

      await logDataAccess(
        'trackingDevice',
        id,
        { action: 'UPDATE_TRACKING_DEVICE', description: `User updated tracking device: ${device.name}` }
      );

      return res.status(200).json({ device: updatedDevice });
    } catch (error) {
      console.error('Error updating tracking device:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Handle DELETE request - Delete a device
  if (req.method === 'DELETE') {
    try {
      await prisma.trackingDevice.delete({
        where: {
          id,
        },
      });

      await logDataAccess(
        'trackingDevice',
        id,
        { action: 'DELETE_TRACKING_DEVICE', description: `User deleted tracking device: ${device.name}` }
      );

      return res.status(200).json({ message: 'Device deleted successfully' });
    } catch (error) {
      console.error('Error deleting tracking device:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}