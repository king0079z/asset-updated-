// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

/**
 * POST /api/assets/[id]/audit-comment
 * Add an audit comment (with optional image) to an asset. Stored as asset history
 * and shown in asset reports and history.
 * Body: { comment: string, imageUrl?: string }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() || null : null;

    if (!comment) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    const asset = await prisma.asset.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const details: { comment: string; imageUrl?: string } = { comment };
    if (imageUrl) details.imageUrl = imageUrl;

    const history = await prisma.assetHistory.create({
      data: {
        assetId: id,
        userId: user.id,
        action: 'AUDIT_COMMENT',
        details,
      },
      include: {
        user: { select: { email: true } },
      },
    });

    return res.status(201).json({
      success: true,
      history: {
        id: history.id,
        action: history.action,
        details: history.details,
        createdAt: history.createdAt,
        user: history.user,
      },
    });
  } catch (err) {
    console.error('Audit comment error:', err);
    return res.status(500).json({
      error: 'Failed to add audit comment',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
