import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { logDataAccess } from '@/lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get API key from request header or query parameter
    const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string;

    if (!apiKey) {
      return res.status(401).json({ error: 'API key is required' });
    }

    // Find the device associated with this API key
    const device = await prisma.trackingDevice.findUnique({
      where: {
        apiKey: apiKey,
      },
      include: {
        vehicle: true,
      },
    });

    if (!device) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Get location data from request body
    const { 
      latitude, 
      longitude, 
      altitude = null,
      speed = null,
      heading = null,
      accuracy = null,
      timestamp = new Date(),
      batteryLevel = null,
      metadata = {}
    } = req.body;

    // Validate location data
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'Invalid location data. Latitude and longitude must be numbers.' });
    }

    // Parse coordinates to ensure they're numbers
    const parsedLatitude = parseFloat(latitude.toString());
    const parsedLongitude = parseFloat(longitude.toString());

    // Validate coordinates are within valid ranges
    if (isNaN(parsedLatitude) || isNaN(parsedLongitude) ||
        parsedLatitude < -90 || parsedLatitude > 90 ||
        parsedLongitude < -180 || parsedLongitude > 180) {
      return res.status(400).json({ 
        error: 'Invalid coordinates',
        message: 'The provided coordinates are outside valid ranges.'
      });
    }

    // Parse timestamp
    const locationTimestamp = timestamp instanceof Date ? timestamp : new Date(timestamp);

    // Update device last ping and battery level if provided
    await prisma.trackingDevice.update({
      where: {
        id: device.id,
      },
      data: {
        lastPing: new Date(),
        batteryLevel: batteryLevel !== null ? batteryLevel : undefined,
      },
    });

    // Create a new device location record
    const deviceLocation = await prisma.deviceLocation.create({
      data: {
        deviceId: device.id,
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        altitude,
        speed,
        heading,
        accuracy,
        timestamp: locationTimestamp,
        metadata,
      },
    });

    // If the device is associated with a vehicle, also create a vehicle location record
    if (device.vehicleId) {
      await prisma.vehicleLocation.create({
        data: {
          vehicleId: device.vehicleId,
          latitude: parsedLatitude,
          longitude: parsedLongitude,
          timestamp: locationTimestamp,
          metadata: {
            source: 'external_device',
            deviceId: device.deviceId,
            deviceType: device.type,
            accuracy,
            speed,
            heading,
            altitude,
            batteryLevel,
            ...metadata
          },
        },
      });

      // Log the action
      await logDataAccess(
        'vehicle',
        device.vehicleId,
        { 
          action: 'VEHICLE_LOCATION_UPDATE', 
          description: `Location updated for vehicle via external device ${device.name} (${device.deviceId})` 
        }
      );
    }

    return res.status(200).json({ 
      success: true,
      message: 'Location data received successfully',
      deviceId: device.deviceId,
      locationId: deviceLocation.id,
      timestamp: locationTimestamp
    });
  } catch (error) {
    console.error('Error processing device location data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}