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
  const { data: { user }, error } = await supabase.auth.getUser();

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

  try {
    // Find the device and verify it belongs to the user's organization
    const device = await prisma.trackingDevice.findFirst({
      where: {
        id,
        organizationId: userWithOrg.organizationId,
      },
      include: {
        vehicle: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (!device.vehicleId) {
      return res.status(400).json({ error: 'Device is not assigned to any vehicle' });
    }

    const vehicleName = device.vehicle?.name || 'Unknown vehicle';

    // Update the device to remove the vehicle assignment
    const updatedDevice = await prisma.trackingDevice.update({
      where: {
        id,
      },
      data: {
        vehicleId: null,
      },
    });

    await logDataAccess(
      'trackingDevice',
      id,
      { 
        action: 'UNASSIGN_TRACKING_DEVICE', 
        description: `User unassigned tracking device ${device.name} from vehicle ${vehicleName}` 
      }
    );

    return res.status(200).json({ 
      device: updatedDevice,
      message: `Device ${device.name} successfully unassigned from vehicle ${vehicleName}`
    });
  } catch (error) {
    console.error('Error unassigning tracking device:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}