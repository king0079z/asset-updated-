/**
 * /api/assets/scan  — purpose-built barcode/QR lookup endpoint
 *
 * Why this is fast:
 *  1. Uses getSession() instead of getUser() — reads the JWT from the cookie
 *     with no network call to Supabase auth servers.
 *  2. A single Prisma OR query covers all identifier fields at once.
 *  3. Only selects the fields the scanner UI actually needs.
 *  4. No heavy role-determination / admin-check overhead.
 *  5. Short-circuits on empty / missing query immediately.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

// Only the fields the scanner card displays
const SCAN_SELECT = {
  id: true,
  name: true,
  type: true,
  status: true,
  barcode: true,
  assetId: true,
  imageUrl: true,
  floorNumber: true,
  roomNumber: true,
  description: true,
  organizationId: true,
  vendor: { select: { id: true, name: true } },
} as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;
  if (!q || typeof q !== 'string' || !q.trim()) {
    return res.status(400).json({ error: 'Missing search query' });
  }
  const term = q.trim();

  // ── Fast auth: read JWT from cookie, no Supabase network call ──────────────
  let orgId: string | null = null;
  let isAdmin = false;

  try {
    const supabase = createClient(req, res);
    // getSession decodes the cookie locally — no external HTTP request
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user?.id) {
      // One small indexed lookup to get org + role
      const userData = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { organizationId: true, role: true, isAdmin: true },
      });
      orgId   = userData?.organizationId ?? null;
      isAdmin = !!(userData?.isAdmin || userData?.role === 'ADMIN' || userData?.role === 'MANAGER');
    }
  } catch {
    // Auth failure is non-fatal for scan: fall through with no org scope
  }

  // ── Single DB query with all matchers combined ──────────────────────────────
  try {
    // Exact matches first (cheaper, hits index if one exists), then partial
    const searchConditions = [
      { barcode: term },
      { assetId: term },
      { barcode: { contains: term, mode: 'insensitive' as const } },
      { assetId: { contains: term, mode: 'insensitive' as const } },
      { name:    { contains: term, mode: 'insensitive' as const } },
    ];

    // Scope to org when known (and user is not admin spanning all orgs)
    const where = orgId && !isAdmin
      ? { OR: searchConditions, organizationId: orgId }
      : { OR: searchConditions };

    let asset = await prisma.asset.findFirst({ where, select: SCAN_SELECT });

    // Admin fallback: retry without org scope in case asset belongs to no org
    if (!asset && isAdmin && orgId) {
      asset = await prisma.asset.findFirst({
        where: { OR: searchConditions },
        select: SCAN_SELECT,
      });
    }

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found', code: term });
    }

    // No caching — barcode results must always be fresh
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ asset });
  } catch (err) {
    console.error('[/api/assets/scan]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
