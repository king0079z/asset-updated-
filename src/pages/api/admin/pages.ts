import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

// Define the list of pages that can be controlled for access
const availablePages = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/assets', name: 'Assets' },
  { path: '/asset-location', name: 'Asset Location' },
  { path: '/food-supply', name: 'Food Supply' },
  { path: '/food-supply/barcodes', name: 'Food Supply Barcodes' },
  { path: '/tickets', name: 'Tickets' },
  { path: '/tickets/dashboard', name: 'Tickets Dashboard' },
  { path: '/tickets/kanban', name: 'Tickets Kanban' },
  { path: '/vehicles', name: 'Vehicles' },
  { path: '/vehicles/rentals', name: 'Vehicle Rentals' },
  { path: '/vehicle-tracking', name: 'Vehicle Tracking' },
  { path: '/vehicle-tracking/movement-analysis', name: 'Vehicle Movement Analysis' },
  { path: '/my-vehicle', name: 'My Vehicle' },
  { path: '/planner', name: 'Planner' },
  { path: '/staff-activity', name: 'Staff Activity' },
  { path: '/ai-analysis', name: 'AI Analysis' },
  { path: '/kitchens', name: 'Kitchens' },
  { path: '/settings', name: 'Settings' },
  { path: '/settings/compliance', name: 'Compliance Settings' },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check if user is authenticated and is admin
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is admin
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true }
  });

  if (!dbUser?.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  // Only allow GET method
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return res.status(200).json(availablePages);
  } catch (error) {
    console.error('Error fetching pages:', error);
    return res.status(500).json({ error: 'Failed to fetch pages' });
  }
}