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
  assignedToName: true,
  assignedToEmail: true,
  vendor: { select: { id: true, name: true } },
  rfidTag: {
    select: {
      id: true,
      lastZone: {
        select: {
          id: true,
          name: true,
          floorNumber: true,
          roomNumber: true,
          building: true,
          mapX: true,
          mapY: true,
          mapWidth: true,
          mapHeight: true,
          floorPlanId: true,
        },
      },
    },
  },
} as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Missing search query' });
  }
  // Normalize: trim, collapse spaces, remove control chars (from camera/QR noise)
  const term = (q as string).replace(/\s+/g, ' ').replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (!term) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  // ── Fast auth: read JWT from cookie, no Supabase network call ──────────────
  let orgId: string | null = null;
  let isAdmin = false;
  let isHandheld = false;

  try {
    const supabase = createClient(req, res);
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user?.id) {
      const userData = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { organizationId: true, role: true, isAdmin: true },
      });
      orgId      = userData?.organizationId ?? null;
      isAdmin    = !!(userData?.isAdmin || userData?.role === 'ADMIN' || userData?.role === 'MANAGER');
      isHandheld = (userData?.role === 'HANDHELD');
    }
  } catch {
    // Auth failure is non-fatal for scan: fall through with no org scope
  }

  // ── Build search: exact then partial (barcode, assetId, name) ──────────────
  const searchConditions = [
    { barcode: term },
    { assetId: term },
    { barcode: { contains: term, mode: 'insensitive' as const } },
    { assetId: { contains: term, mode: 'insensitive' as const } },
    { name:    { contains: term, mode: 'insensitive' as const } },
  ];

  try {
    // 1) Try with org scope when user has an org and is not admin
    let asset = (orgId && !isAdmin)
      ? await prisma.asset.findFirst({
          where: { OR: searchConditions, organizationId: orgId },
          select: SCAN_SELECT,
        })
      : await prisma.asset.findFirst({
          where: { OR: searchConditions },
          select: SCAN_SELECT,
        });

    // 2) Fallback: assets with no org (legacy / unassigned)
    if (!asset && orgId && !isAdmin) {
      asset = await prisma.asset.findFirst({
        where: { OR: searchConditions, organizationId: null },
        select: SCAN_SELECT,
      });
    }

    // 3) Admin fallback: any org
    if (!asset && isAdmin && orgId) {
      asset = await prisma.asset.findFirst({
        where: { OR: searchConditions },
        select: SCAN_SELECT,
      });
    }

    // 4) HANDHELD fallback: allow audit scan of any asset (field use)
    if (!asset && isHandheld) {
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
