// GET: list notifications for current user (optional ?unreadOnly=1)
// PATCH: mark notification(s) as read (body: { id } or { ids: string[] })
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user } = auth;

  if (req.method === 'GET') {
    const unreadOnly = req.query.unreadOnly === '1';
    const take = Math.min(Number(req.query.limit) || 50, 100);
    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return res.status(200).json(notifications.map(n => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt?.toISOString() ?? null,
    })));
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const id = body.id as string | undefined;
    const ids = (body.ids as string[] | undefined) || (id ? [id] : []);
    if (!ids.length) {
      return res.status(400).json({ error: 'Provide id or ids to mark as read' });
    }
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId: user.id },
      data: { readAt: new Date() },
    });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
