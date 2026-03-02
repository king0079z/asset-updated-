import { NextApiRequest, NextApiResponse } from 'next';

// Simplified version to reduce file dependencies
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(503).json({ error: 'Document upload service temporarily unavailable' });
}