import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getSessionSafe } from "@/util/supabase/require-auth";
import { getUserRoleData } from "@/util/roleCheck";

// Server-side cache: per-user asset list, 1-min TTL
const assetsCache = new Map<string, { data: any[]; ts: number }>();
const ASSETS_CACHE_TTL = 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { user } = await getSessionSafe(req, res);
    if (req.method !== "GET" && !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.method === "GET") {
        const { search, barcode, assetId } = req.query;
        const searchTerm = search || barcode || assetId;
        
      // Single cached DB call for user data (role + orgId + isAdmin)
      let roleData: Awaited<ReturnType<typeof getUserRoleData>> = null;
        let isAdminOrManagerUser = false;
      let organizationId: string | null = null;
        
        if (user) {
        roleData = await getUserRoleData(user.id);
        if (roleData) {
          isAdminOrManagerUser = roleData.role === 'ADMIN' || roleData.role === 'MANAGER' || roleData.isAdmin === true;
          organizationId = roleData.organizationId;
        }
      }

      // --- Search path ---
      if (searchTerm) {
        let searchConditions: any[];
          if (barcode) {
            searchConditions = [{ barcode: String(barcode) }];
          } else if (assetId) {
            searchConditions = [{ assetId: String(assetId) }];
          } else {
            searchConditions = [
              { barcode: String(searchTerm) },
              { assetId: String(searchTerm) },
              { barcode: { contains: String(searchTerm), mode: 'insensitive' } },
              { assetId: { contains: String(searchTerm), mode: 'insensitive' } },
              { name: { contains: String(searchTerm), mode: 'insensitive' } }
            ];
          }
          
        let asset = await prisma.asset.findFirst({
            where: {
              OR: searchConditions,
              ...(organizationId ? { organizationId } : {}),
              ...(isAdminOrManagerUser || !user ? {} : { userId: user.id })
            },
          include: { vendor: { select: { id: true, name: true } } },
        });

        if (!asset && isAdminOrManagerUser) {
          asset = await prisma.asset.findFirst({
            where: { OR: searchConditions },
            include: { vendor: { select: { id: true, name: true } } },
          });
        }

        if (!asset && !user) {
          asset = await prisma.asset.findFirst({
            where: { OR: searchConditions },
            include: { vendor: { select: { id: true, name: true } } },
          });
        }

        if (!asset) return res.status(404).json({ error: "Asset not found" });
        res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
        return res.status(200).json({ asset });
      }

      // --- List path: check server cache (skip cache when explicitly refreshing or when pagination params differ from default) ---
      const limit = Math.min(Math.max(1, Number(req.query.limit) || 500), 2000);
      const skip = Math.max(0, Number(req.query.offset) || 0);
      const cacheKey = user?.id ?? '__anon__';
      const bypassCache = req.headers['cache-control'] === 'no-cache' || req.query.refresh === '1' || skip > 0 || limit !== 500;
      const cached = assetsCache.get(cacheKey);
      if (!bypassCache && cached && Date.now() - cached.ts < ASSETS_CACHE_TTL) {
        res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
        return res.status(200).json(cached.data);
      }

      const assetSelect = {
        id: true, assetId: true, name: true, description: true, barcode: true,
        type: true, imageUrl: true, floorNumber: true, roomNumber: true,
        status: true, purchaseAmount: true, purchaseDate: true,
        userId: true, vendorId: true,
        vendor: { select: { id: true, name: true } },
        createdAt: true,
        assignedToName: true,
        assignedToEmail: true,
        assignedToId: true,
        assignedAt: true,
        organizationId: true,
      } as const;

      const whereAdmin = {};
      const whereOrg = organizationId ? { organizationId } : {};
      const whereUser = user ? { userId: user.id, OR: organizationId ? [{ organizationId }, { organizationId: null }] : undefined } : {};

      let assets: any[] = [];
      let total = 0;

      if (roleData && (roleData.isAdmin === true || roleData.email === 'admin@example.com')) {
        [total, assets] = await Promise.all([
          prisma.asset.count(),
          prisma.asset.findMany({ where: whereAdmin, select: assetSelect, orderBy: { createdAt: 'desc' }, take: limit, skip }),
        ]);
      } else if (isAdminOrManagerUser && organizationId) {
        [total, assets] = await Promise.all([
          prisma.asset.count({ where: whereOrg }),
          prisma.asset.findMany({ where: whereOrg, select: assetSelect, orderBy: { createdAt: 'desc' }, take: limit, skip }),
        ]);
      } else if (user && organizationId) {
        const where = { userId: user.id, OR: [{ organizationId }, { organizationId: null }] };
        [total, assets] = await Promise.all([
          prisma.asset.count({ where }),
          prisma.asset.findMany({ where, select: assetSelect, orderBy: { createdAt: 'desc' }, take: limit, skip }),
        ]);
      } else if (user) {
        const where = { userId: user.id };
        [total, assets] = await Promise.all([
          prisma.asset.count({ where }),
          prisma.asset.findMany({ where, select: assetSelect, orderBy: { createdAt: 'desc' }, take: limit, skip }),
        ]);
      }

      const formattedAssets = assets.map(asset => ({
        ...asset,
        purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString() : null,
        createdAt: asset.createdAt.toISOString(),
      }));

      assetsCache.set(cacheKey, { data: formattedAssets, ts: Date.now() });
      res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
      res.setHeader('X-Total-Count', String(total));
      if (total > limit + skip) {
        res.setHeader('X-Has-More', 'true');
      }
      return res.status(200).json(formattedAssets);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Assets API error:", error instanceof Error ? error.message : error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
