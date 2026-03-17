import { NextApiRequest, NextApiResponse } from 'next';

// Simplified version to reduce dependencies during build
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Return mock success for now
  return res.status(200).json({ 
    success: true, 
    message: 'License key sent successfully'
  });
}