import { NextApiRequest, NextApiResponse } from 'next';

// Simplified version to reduce file dependencies
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Check if this is just a validation check or an actual activation
  const isValidationCheck = req.query.check === 'true';

  if (isValidationCheck) {
    return res.status(200).json({
      valid: true,
      role: 'STAFF',
      plan: 'BASIC',
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  // Return mock success for activation
  return res.status(200).json({ 
    success: true, 
    message: 'Account activated successfully',
    role: 'STAFF',
    plan: 'BASIC',
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  });
}