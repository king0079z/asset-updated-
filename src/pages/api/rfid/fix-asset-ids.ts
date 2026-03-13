// @ts-nocheck
/**
 * POST /api/rfid/fix-asset-ids
 *
 * One-time fix: finds all assets that were created by seed-demo and have
 * a cuid-style assetId (e.g. cmmm6za3100al52zp7934sylg) and updates them
 * to the proper application format (e.g. EL672401001).
 *
 * Identifies demo assets by checking if their assetId matches the cuid
 * pattern (starts with 'c', all lowercase alphanumeric, 20+ chars).
 * Only processes assets that are linked to an RFID tag in this org.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getUserRoleData } from '@/util/roleCheck';

// Same format as create.ts and the fixed seed-demo.ts
function generateAssetId(type: string, counter: number): string {
  const prefix  = type.substring(0, 2).toUpperCase();
  const ts      = Date.now().toString().slice(-6);
  const seq     = counter.toString().padStart(3, '0');
  return `${prefix}${ts}${seq}`;
}

function generateBarcode(assetId: string): string {
  const clean = assetId.replace(/[^A-Z0-9]/g, '');
  return clean.length < 8 ? clean + '0'.repeat(8 - clean.length) : clean;
}

// Detects a Prisma cuid: starts with 'c', 20–30 lowercase alphanumeric chars
function isCuid(id: string): boolean {
  return /^c[a-z0-9]{19,29}$/.test(id ?? '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const roleData = await getUserRoleData(session.user.id);
  const orgId    = roleData?.organizationId ?? null;

  try {
    // Find all RFID tags for this org, including their linked asset
    const tags = await prisma.rFIDTag.findMany({
      where: { organizationId: orgId ?? undefined },
      select: {
        id: true,
        asset: { select: { id: true, assetId: true, type: true } },
      },
    });

    // Collect assets that still have cuid-style IDs
    const toFix = tags
      .map(t => t.asset)
      .filter(Boolean)
      .filter(a => isCuid(a.assetId ?? ''));

    if (toFix.length === 0) {
      return res.status(200).json({
        message: 'No assets with cuid-style IDs found — nothing to fix.',
        fixed: 0,
      });
    }

    // Deduplicate by asset DB id (a tag might share an asset)
    const seen = new Set<string>();
    const unique = toFix.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });

    const results: Array<{ assetDbId: string; oldId: string; newId: string }> = [];

    for (let i = 0; i < unique.length; i++) {
      const asset    = unique[i];
      const newId    = generateAssetId(asset.type ?? 'ASSET', i + 1);
      const newBar   = generateBarcode(newId);

      await prisma.asset.update({
        where: { id: asset.id },
        data:  { assetId: newId, barcode: newBar },
      });

      results.push({ assetDbId: asset.id, oldId: asset.assetId ?? '', newId });
    }

    return res.status(200).json({
      message: `Fixed ${results.length} asset IDs.`,
      fixed: results.length,
      changes: results,
    });
  } catch (err: any) {
    console.error('fix-asset-ids error:', err);
    return res.status(500).json({ error: err.message ?? 'Unknown error' });
  }
}
