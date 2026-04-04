/**
 * POST /api/notifications/register-token
 * Stores an Expo push token for a user so the server can send native push notifications.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const user = await getServerSession(req, res);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { token } = req.body as { token?: string };
  if (!token || !token.startsWith('ExponentPushToken[')) {
    return res.status(400).json({ error: 'Invalid push token' });
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { expoPushToken: token },
    });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to register token' });
  }
}
