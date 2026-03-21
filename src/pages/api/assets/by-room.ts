import type { NextApiRequest, NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getSessionSafe } from '@/util/supabase/require-auth';
import { getUserRoleData } from '@/util/roleCheck';

/** Match handheld `normalizeLoc` for floor/room comparison */
function normLoc(s: string | null | undefined): string {
  const t = String(s ?? '').trim().toLowerCase();
  const num = t.replace(/^0+(\d+)$/, '$1');
  return num || t;
}

function looseMatch(
  floorQ: string,
  roomQ: string,
  floorDb: string | null | undefined,
  roomDb: string | null | undefined,
): boolean {
  const nf = normLoc(floorQ);
  const nr = normLoc(roomQ);
  if (normLoc(floorDb) === nf && normLoc(roomDb) === nr) return true;
  const a = String(floorDb ?? '').trim().toLowerCase();
  const b = String(roomDb ?? '').trim().toLowerCase();
  return a === floorQ.trim().toLowerCase() && b === roomQ.trim().toLowerCase();
}

/**
 * String variants for floors so DB values like "03" / "3" still match session "3"
 * (same idea as handheld normalizeLoc for pure numeric floors).
 */
function addNumericFloorVariants(raw: string, into: Set<string>) {
  const t = raw.trim();
  into.add(t);
  if (/^\s*0*\d+\s*$/.test(t)) {
    const n = parseInt(t, 10);
    if (!Number.isNaN(n)) {
      into.add(String(n));
      for (let w = 2; w <= 5; w++) into.add(String(n).padStart(w, '0'));
    }
  }
}

/**
 * Build Prisma OR of (floor × room) exact pairs for DB-side filtering.
 * Previously we loaded only the first 12k assets by name and filtered in memory — rooms
 * whose assets sorted after that cap never appeared (0 results while UI showed "in room").
 */
function buildFloorRoomWhere(floorQ: string, roomQ: string): Prisma.AssetWhereInput {
  const fTrim = floorQ.trim();
  const rTrim = roomQ.trim();
  const nf = normLoc(floorQ);
  const nr = normLoc(roomQ);

  const floors = new Set<string>();
  addNumericFloorVariants(fTrim, floors);
  addNumericFloorVariants(nf, floors);

  const rooms = new Set<string>([rTrim, nr]);
  rooms.add(rTrim.toLowerCase());
  rooms.add(rTrim.toUpperCase());

  const orList: Prisma.AssetWhereInput[] = [];
  for (const f of floors) {
    for (const r of rooms) {
      orList.push({
        AND: [
          { floorNumber: { equals: f, mode: 'insensitive' } },
          { roomNumber: { equals: r, mode: 'insensitive' } },
        ],
      });
    }
  }
  return { OR: orList };
}

function buildAccessWhere(
  user: { id: string },
  roleData: Awaited<ReturnType<typeof getUserRoleData>>,
  organizationId: string | null,
  isAdminOrManagerUser: boolean,
  role: string,
): Prisma.AssetWhereInput | null {
  // HANDHELD and ADMIN/MANAGER get the same scan-level broad access — no org filter.
  // This mirrors the scan API fallback that lets HANDHELD read assets from any org,
  // ensuring the room roster shows the same assets that appear as "In this room" in the UI.
  if (role === 'HANDHELD' || (roleData && (roleData.isAdmin === true || roleData.email === 'admin@example.com'))) {
    return {};
  }
  if (isAdminOrManagerUser && organizationId) {
    return { organizationId };
  }
  if (user && organizationId) {
    return { userId: user.id, OR: [{ organizationId }, { organizationId: null }] };
  }
  if (user) {
    return { userId: user.id };
  }
  return null;
}

/**
 * GET /api/assets/by-room?floorNumber=3&roomNumber=ADM-01
 * Returns assets whose registered floor/room match this room (normalized + loose fallback).
 * Includes legacy assets with organizationId null when the user is HANDHELD (same as scan fallback).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const floorQ = req.query.floorNumber;
  const roomQ = req.query.roomNumber;
  if (typeof floorQ !== 'string' || typeof roomQ !== 'string' || !floorQ.trim() || !roomQ.trim()) {
    return res.status(400).json({ error: 'floorNumber and roomNumber query params are required' });
  }

  const fTrim = floorQ.trim();
  const rTrim = roomQ.trim();

  try {
    const { user } = await getSessionSafe(req, res);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const roleData = await getUserRoleData(user.id);

    const role = roleData?.role ?? '';
    const isAdminOrManagerUser =
      role === 'ADMIN' || role === 'MANAGER' || role === 'HANDHELD' || roleData?.isAdmin === true;
    const organizationId = roleData?.organizationId ?? null;

    const accessWhere = buildAccessWhere(user, roleData, organizationId, isAdminOrManagerUser, role);
    if (!accessWhere) {
      return res.status(200).json([]);
    }

    const locationWhere = buildFloorRoomWhere(fTrim, rTrim);

    const assetSelect = {
      id: true,
      assetId: true,
      name: true,
      barcode: true,
      status: true,
      floorNumber: true,
      roomNumber: true,
      imageUrl: true,
      organizationId: true,
    } as const;

    // debug=1: return raw DB matches without client-side re-filter so caller can see exact stored values
    const debugMode = req.query.debug === '1';

    let assets = await prisma.asset.findMany({
      where: {
        AND: [accessWhere, locationWhere],
      },
      select: assetSelect,
      orderBy: { name: 'asc' },
      take: 25000,
    });

    /** Final pass: handheld-normalized equality (handles edge cases Prisma equals might miss) */
    let filtered = assets.filter((a) => looseMatch(fTrim, rTrim, a.floorNumber, a.roomNumber));

    // If DB-side filter returned rows but normalized pass is empty, skip normalization filter
    // (shouldn't happen, but guard against edge case)
    if (filtered.length === 0 && assets.length > 0) {
      const nf = normLoc(fTrim);
      const nr = normLoc(rTrim);
      filtered = assets.filter((a) => normLoc(a.floorNumber) === nf && normLoc(a.roomNumber) === nr);
      // Last resort — return all DB-matched assets (the DB Prisma OR already filtered by floor/room)
      if (filtered.length === 0) filtered = assets;
    }

    if (debugMode) {
      // Return raw result with org info for diagnosis
      console.log(`[by-room debug] floor="${fTrim}" room="${rTrim}" accessWhere=${JSON.stringify(accessWhere)} dbHits=${assets.length} filtered=${filtered.length}`);
      return res.status(200).json({
        _debug: true,
        query: { floor: fTrim, room: rTrim },
        accessWhere,
        locationWhere,
        dbHits: assets.length,
        filtered: filtered.length,
        sample: assets.slice(0, 5).map((a) => ({ id: a.id, name: a.name, floorNumber: a.floorNumber, roomNumber: a.roomNumber, organizationId: a.organizationId })),
      });
    }

    const out = filtered.map(({ organizationId: _o, ...rest }) => rest);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(out);
  } catch (e) {
    console.error('by-room error:', e);
    return res.status(500).json({ error: 'Failed to load assets for room' });
  }
}
