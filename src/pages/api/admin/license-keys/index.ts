import { NextApiRequest, NextApiResponse } from 'next';

// Simplified version to reduce dependencies during build
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Return mock data for now
  if (req.method === 'GET') {
    return res.status(200).json({ 
      licenseKeys: [] 
    });
  }

  res.setHeader('Allow', ['GET']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}