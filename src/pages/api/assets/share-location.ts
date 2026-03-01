import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { user } } = await supabase.auth.getSession();

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { assetId } = req.body;

    if (!assetId) {
      return res.status(400).json({ error: 'Asset ID is required' });
    }

    // Get the asset with its location
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { location: true }
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    if (!asset.location) {
      return res.status(400).json({ error: 'Asset has no location data' });
    }

    // Generate a shareable URL with the location coordinates
    const shareableUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase', '')}/asset-location/shared?lat=${asset.location.latitude}&lng=${asset.location.longitude}&id=${asset.id}`;

    // Log the sharing action
    await prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        action: 'LOCATION_SHARED',
        details: JSON.stringify({
          message: `Location shared by ${user.email}`,
          timestamp: new Date().toISOString()
        }),
        userId: user.id
      }
    });

    return res.status(200).json({ 
      success: true, 
      url: shareableUrl,
      assetName: asset.name,
      location: {
        latitude: asset.location.latitude,
        longitude: asset.location.longitude,
        address: asset.location.address
      }
    });
  } catch (error) {
    console.error('Error sharing asset location:', error);
    return res.status(500).json({ error: 'Failed to share asset location' });
  }
}