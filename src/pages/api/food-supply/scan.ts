// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

/**
 * POST /api/food-supply/scan
 * Fast barcode lookup — all DB queries run in PARALLEL in a single request.
 * Replaces the 3-4 sequential /api/food-supply?barcode=... calls the scanner
 * was making before (each with its own network round-trip).
 *
 * Body: { barcode: string; kitchenId?: string }
 * Response: { supply } | { recipe } | { error }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const { barcode, kitchenId } = req.body as { barcode?: string; kitchenId?: string };
  if (!barcode?.trim()) return res.status(400).json({ error: 'barcode is required' });

  const code = barcode.trim().toUpperCase();

  // ── Build prefix-based fallback params for KIT{4}SUP{4}{ts} format ──────
  const supIdx = code.includes('SUP') ? code.indexOf('SUP') : -1;
  const kitPrefix  = (supIdx > 3 && code.startsWith('KIT'))
    ? code.substring(3, supIdx).toLowerCase()       // e.g. "cm75"
    : null;
  const supPrefix  = supIdx >= 0
    ? code.substring(supIdx + 3, supIdx + 7).toLowerCase() // e.g. "cma0"
    : null;
  const barcodePrefix = (kitPrefix && supPrefix)
    ? code.substring(0, supIdx + 7)                 // e.g. "KITCM75SUPCMA0"
    : null;

  // ── Fire ALL DB lookups in parallel ─────────────────────────────────────
  const [
    directSupply,
    kitchenSpecificBarcode,
    crossKitchenBarcode,
    prefixBarcode,
    recipe,
  ] = await Promise.all([
    // 1. FoodSupply.barcode exact match
    prisma.foodSupply.findFirst({
      where: { barcode: { equals: code, mode: 'insensitive' } },
      include: { kitchen: true },
    }),

    // 2. KitchenBarcode exact match — kitchen-specific
    kitchenId
      ? prisma.kitchenBarcode.findFirst({
          where: {
            barcode: { equals: code, mode: 'insensitive' },
            kitchenId,
          },
          include: { foodSupply: true, kitchen: true },
        })
      : Promise.resolve(null),

    // 3. KitchenBarcode exact match — any kitchen
    prisma.kitchenBarcode.findFirst({
      where: { barcode: { equals: code, mode: 'insensitive' } },
      include: { foodSupply: true, kitchen: true },
    }),

    // 4. Prefix-based fallback (handles barcodes that were regenerated)
    barcodePrefix
      ? prisma.kitchenBarcode.findFirst({
          where: { barcode: { startsWith: barcodePrefix, mode: 'insensitive' } },
          include: { foodSupply: true, kitchen: true },
        }).then(async (found) => {
          if (found) return found;
          // Also try by embedded IDs
          if (kitPrefix && supPrefix) {
            return prisma.kitchenBarcode.findFirst({
              where: {
                kitchen:    { id: { startsWith: kitPrefix } },
                foodSupply: { id: { startsWith: supPrefix } },
              },
              include: { foodSupply: true, kitchen: true },
            });
          }
          return null;
        })
      : Promise.resolve(null),

    // 5. Recipe barcode
    prisma.recipe.findFirst({
      where: { barcode: { equals: code, mode: 'insensitive' } },
      include: { ingredients: { include: { foodSupply: true } } },
    }),
  ]);

  // ── Return first match in priority order ─────────────────────────────────

  // Priority 1 — kitchen-specific KitchenBarcode (most precise)
  const bestKitchenBarcode = kitchenSpecificBarcode || crossKitchenBarcode || prefixBarcode;
  if (bestKitchenBarcode?.foodSupply) {
    const kb = bestKitchenBarcode;
    return res.status(200).json({
      supply: {
        id:             kb.foodSupply.id,
        name:           kb.foodSupply.name,
        quantity:       kb.foodSupply.quantity,
        unit:           kb.foodSupply.unit,
        expirationDate: kb.foodSupply.expirationDate,
        category:       kb.foodSupply.category,
        pricePerUnit:   kb.foodSupply.pricePerUnit,
        kitchenId:      kb.kitchenId,
        kitchenName:    kb.kitchen?.name ?? 'Kitchen',
      },
    });
  }

  // Priority 2 — direct FoodSupply barcode match
  if (directSupply) {
    // If it has a matching kitchen or no kitchen requirement, return it
    if (!kitchenId || directSupply.kitchenId === kitchenId || !directSupply.kitchenId) {
      return res.status(200).json({
        supply: {
          id:             directSupply.id,
          name:           directSupply.name,
          quantity:       directSupply.quantity,
          unit:           directSupply.unit,
          expirationDate: directSupply.expirationDate,
          category:       directSupply.category,
          pricePerUnit:   directSupply.pricePerUnit,
          kitchenId:      directSupply.kitchenId ?? kitchenId ?? '',
          kitchenName:    directSupply.kitchen?.name ?? 'Kitchen',
        },
      });
    }
  }

  // Priority 3 — Recipe
  if (recipe) {
    return res.status(200).json({ recipe });
  }

  return res.status(404).json({ error: 'No item found for this barcode', barcode: code });
}
