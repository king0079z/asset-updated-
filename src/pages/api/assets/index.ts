import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";
import { getUserRoleData } from "@/util/roleCheck";

// Server-side cache: per-user asset list, 1-min TTL
const assetsCache = new Map<string, { data: any[]; ts: number }>();
const ASSETS_CACHE_TTL = 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    // GET: allow unauthenticated for scanner fallback; non-GET requires auth
    if (req.method !== "GET") {
      if (authError || !user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
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

      // --- List path: check server cache ---
      const cacheKey = user?.id ?? '__anon__';
      const cached = assetsCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < ASSETS_CACHE_TTL) {
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
      } as const;

      let assets: any[] = [];

      // Global admin or admin@example.com: all assets
      if (roleData && (roleData.isAdmin === true || roleData.email === 'admin@example.com')) {
        assets = await prisma.asset.findMany({ select: assetSelect, orderBy: { createdAt: 'desc' } });
      } else if (isAdminOrManagerUser && organizationId) {
        assets = await prisma.asset.findMany({
          where: { organizationId },
          select: assetSelect,
          orderBy: { createdAt: 'desc' },
        });
      } else if (user && organizationId) {
        assets = await prisma.asset.findMany({
          where: { userId: user.id, organizationId },
          select: assetSelect,
          orderBy: { createdAt: 'desc' },
        });
      }

      const formattedAssets = assets.map(asset => ({
        ...asset,
        purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString() : null,
        createdAt: asset.createdAt.toISOString(),
      }));

      assetsCache.set(cacheKey, { data: formattedAssets, ts: Date.now() });
      res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
      return res.status(200).json(formattedAssets);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Assets API error:", error instanceof Error ? error.message : error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
