import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`Path: ${req.url} START RequestId: ${req.headers['x-vercel-id'] || 'unknown'}`);
  
  try {
    const supabase = createClient(req, res);
    
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getSession();
    
    if (!user) {
      console.log(`Path: ${req.url} Unauthorized access attempt`);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`Path: ${req.url} User authenticated: ${user.id}`);
    
    // GET - Retrieve all users for assignment
    if (req.method === 'GET') {
      console.log(`Path: ${req.url} Fetching users for task assignment`);
      
      try {
        // Get all users from the database
        const users = await prisma.user.findMany({
          select: {
            id: true,
            email: true,
          },
          orderBy: {
            email: 'asc',
          },
        });
        
        console.log(`Path: ${req.url} Successfully fetched ${users.length} users`);
        return res.status(200).json({ users: users });
      } catch (error) {
        console.error(`Path: ${req.url} Error fetching users:`, error);
        return res.status(500).json({ error: 'Failed to fetch users', details: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    
    console.log(`Path: ${req.url} Method not allowed: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(`Path: ${req.url} Error in users API:`, error);
    return res.status(500).json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' });
  } finally {
    console.log(`Path: ${req.url} END RequestId: ${req.headers['x-vercel-id'] || 'unknown'}`);
  }
}