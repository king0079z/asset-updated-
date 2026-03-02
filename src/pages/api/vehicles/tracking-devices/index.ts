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

  // Get the user's organization
  const userWithOrg = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  if (!userWithOrg?.organizationId) {
    return res.status(400).json({ error: 'User not associated with an organization' });
  }

  // Handle GET request - List all tracking devices
  if (req.method === 'GET') {
    try {
      const devices = await prisma.trackingDevice.findMany({
        where: {
          organizationId: userWithOrg.organizationId,
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
        orderBy: {
          createdAt: 'desc',
        },
      });

      await logDataAccess(
        'trackingDevice',
        'all',
        { action: 'LIST_TRACKING_DEVICES', description: 'User listed all tracking devices' }
      );

      return res.status(200).json({ devices });
    } catch (error) {
      console.error('Error fetching tracking devices:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Handle POST request - Create a new tracking device
  if (req.method === 'POST') {
    try {
      const { name, deviceId, type } = req.body;

      // Validate required fields
      if (!name || !deviceId) {
        return res.status(400).json({ error: 'Name and Device ID are required' });
      }

      // Check if device ID already exists
      const existingDevice = await prisma.trackingDevice.findUnique({
        where: {
          deviceId,
        },
      });

      if (existingDevice) {
        return res.status(400).json({ error: 'A device with this ID already exists' });
      }

      // Create the new tracking device
      const newDevice = await prisma.trackingDevice.create({
        data: {
          name,
          deviceId,
          type: type || 'GPS_TRACKER',
          status: 'ACTIVE',
          organizationId: userWithOrg.organizationId,
          apiKey: `dev_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
        },
      });

      await logDataAccess(
        'trackingDevice',
        newDevice.id,
        { action: 'CREATE_TRACKING_DEVICE', description: `User created tracking device: ${name}` }
      );

      return res.status(201).json({ device: newDevice });
    } catch (error) {
      console.error('Error creating tracking device:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}