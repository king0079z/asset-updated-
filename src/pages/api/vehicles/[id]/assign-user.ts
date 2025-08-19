import { NextApiRequest, NextApiResponse } from 'next';

// Simplified version to reduce file dependencies
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(503).json({ error: 'Vehicle assignment service temporarily unavailable' });
}