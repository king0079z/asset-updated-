import { NextApiRequest, NextApiResponse } from 'next';

// Simplified version to reduce dependencies during build
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Return mock data for now
  return res.status(200).json({ 
    success: true, 
    licenseKey: 'XXXX-XXXX-XXXX-XXXX',
    id: 'mock-id',
    message: 'License key generated successfully'
  });
}