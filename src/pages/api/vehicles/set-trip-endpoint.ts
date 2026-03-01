import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate the user
    const supabase = createClient(req, res);
    const { data: { session }, error } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (error || !user) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get trip data from request body
    const { 
      tripId,
      targetEndLatitude,
      targetEndLongitude
    } = req.body;

    // Validate required fields
    if (!tripId) {
      return res.status(400).json({ error: 'Missing required trip ID' });
    }

    // Find the trip and verify ownership
    const trip = await prisma.vehicleTrip.findUnique({
      where: {
        id: tripId
      }
    });

    if (!trip) {
      return res.status(404).json({ 
        error: 'Trip not found',
        message: 'The specified trip could not be found.'
      });
    }

    // Verify that the user owns this trip
    if (trip.userId !== user.id) {
      return res.status(403).json({ 
        error: 'Permission denied',
        message: 'You do not have permission to modify this trip.'
      });
    }

    // Verify that the trip is still active
    if (trip.endTime) {
      return res.status(400).json({ 
        error: 'Trip already ended',
        message: 'Cannot set end point for a trip that has already ended.'
      });
    }

    // Update the trip with the target end location
    const updatedTrip = await prisma.vehicleTrip.update({
      where: { id: tripId },
      data: {
        targetEndLatitude: targetEndLatitude !== null ? parseFloat(targetEndLatitude.toString()) : null,
        targetEndLongitude: targetEndLongitude !== null ? parseFloat(targetEndLongitude.toString()) : null,
      }
    });
    
    // Log the action
    try {
      let actionDescription = '';
      if (targetEndLatitude === null || targetEndLongitude === null) {
        actionDescription = 'Trip end point cleared';
      } else {
        actionDescription = `Trip end point set to ${targetEndLatitude.toFixed(6)}, ${targetEndLongitude.toFixed(6)}`;
      }
      
      await logDataAccess(
        'vehicleTrip',
        tripId,
        { 
          action: 'VEHICLE_TRIP_ENDPOINT_SET', 
          description: actionDescription
        }
      );
    } catch (logError) {
      console.error('Error creating audit log:', logError);
      // Continue execution even if logging fails
    }

    return res.status(200).json({ 
      message: targetEndLatitude === null ? 'Trip end point cleared' : 'Trip end point set successfully',
      trip: {
        id: updatedTrip.id,
        targetEndLatitude: updatedTrip.targetEndLatitude,
        targetEndLongitude: updatedTrip.targetEndLongitude
      }
    });
  } catch (error) {
    console.error('Error setting trip end point:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}