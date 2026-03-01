import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate the user
  const supabase = createClient(req, res);
  const { data: { user }, error } = await supabase.auth.getSession();

  if (error || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get the device ID from the URL
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid device ID' });
  }

  // Get the vehicle ID from the request body
  const { vehicleId } = req.body;

  if (!vehicleId) {
    return res.status(400).json({ error: 'Vehicle ID is required' });
  }

  // Get the user's organization
  const userWithOrg = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  if (!userWithOrg?.organizationId) {
    return res.status(400).json({ error: 'User not associated with an organization' });
  }

  try {
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

    // Find the vehicle and verify it belongs to the user's organization
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        organizationId: userWithOrg.organizationId,
      },
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // Update the device with the new vehicle assignment
    const updatedDevice = await prisma.trackingDevice.update({
      where: {
        id,
      },
      data: {
        vehicleId,
        installDate: new Date(),
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
      { 
        action: 'ASSIGN_TRACKING_DEVICE', 
        description: `User assigned tracking device ${device.name} to vehicle ${vehicle.name}` 
      }
    );

    return res.status(200).json({ 
      device: updatedDevice,
      message: `Device ${device.name} successfully assigned to vehicle ${vehicle.name}`
    });
  } catch (error) {
    console.error('Error assigning tracking device:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}