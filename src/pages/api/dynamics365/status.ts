// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import { isD365Configured, getD365AccessToken } from '@/lib/dynamics365/d365Client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const configured = isD365Configured();
  if (!configured) {
    return res.status(200).json({
      status: 'mock',
      configured: false,
      message: 'D365 credentials not configured. Running in mock mode.',
      envVarsNeeded: ['D365_TENANT_ID', 'D365_CLIENT_ID', 'D365_CLIENT_SECRET', 'D365_ENVIRONMENT_URL'],
    });
  }

  try {
    const token = await getD365AccessToken();
    return res.status(200).json({
      status: 'connected',
      configured: true,
      hasToken: !!token,
      environmentUrl: process.env.D365_ENVIRONMENT_URL,
    });
  } catch (err: any) {
    return res.status(200).json({
      status: 'error',
      configured: true,
      error: err.message,
    });
  }
}
