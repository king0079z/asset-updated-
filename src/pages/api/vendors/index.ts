import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";
import { VendorType } from "@prisma/client";

// Server-side cache for vendor list (no type filter), 5-min TTL
let _vendorsCache: { data: any[]; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (req.method === "GET") {
    try {
      const { type } = req.query;

      // Use cache only for unfiltered list
      if (!type && _vendorsCache && Date.now() - _vendorsCache.ts < CACHE_TTL) {
        res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=60');
        return res.status(200).json(_vendorsCache.data);
      }

      const vendors = await prisma.vendor.findMany({
        where: type ? { type: { has: type as VendorType } } : undefined,
        orderBy: { name: "asc" },
      });

      if (!type) {
        _vendorsCache = { data: vendors, ts: Date.now() };
      }

      res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=60');
      return res.status(200).json(vendors);
    } catch (error) {
      console.error("[Vendors API] Error fetching vendors:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  // Non-GET requires auth
  if (authError || !user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.method === "POST") {
    try {
      const vendor = await prisma.vendor.create({ data: req.body });
      // Invalidate cache on write
      _vendorsCache = null;
      return res.status(201).json(vendor);
    } catch (error) {
      console.error("Error creating vendor:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
