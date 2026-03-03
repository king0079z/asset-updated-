/**
 * One-shot admin endpoint: clears any imageUrl values in the Asset table
 * that are not valid http/https URLs (e.g. values stored when the bucket
 * name had a trailing \r\n which produced malformed URLs).
 *
 * GET /api/admin/fix-image-urls   → preview what would be cleared
 * POST /api/admin/fix-image-urls  → actually clear them
 */
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";

function isValidUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const t = url.trim();
  if (!t || /[\r\n\t]/.test(t)) return false;
  try {
    const p = new URL(t);
    return p.protocol === "http:" || p.protocol === "https:";
  } catch { return false; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).end();
  }

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  // Find all assets that have a non-null imageUrl
  const assets = await prisma.asset.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, name: true, imageUrl: true },
  });

  const broken = assets.filter(a => !isValidUrl(a.imageUrl));

  if (req.method === "GET") {
    return res.status(200).json({
      totalWithImage: assets.length,
      brokenCount: broken.length,
      broken: broken.map(a => ({ id: a.id, name: a.name, imageUrl: a.imageUrl })),
    });
  }

  // POST — clear broken URLs
  if (broken.length === 0) {
    return res.status(200).json({ cleared: 0, message: "Nothing to fix" });
  }

  await prisma.asset.updateMany({
    where: { id: { in: broken.map(a => a.id) } },
    data: { imageUrl: null },
  });

  return res.status(200).json({
    cleared: broken.length,
    ids: broken.map(a => a.id),
  });
}
