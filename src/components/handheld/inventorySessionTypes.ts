export type HandheldCountScanItem = {
  id: string;
  barcode?: string;
  name: string;
  imageUrl?: string | null;
  status?: string;
  floorNumber?: string | null;
  roomNumber?: string | null;
};

export type HandheldInventoryItemMeta = {
  addedAt: number;
  syncStatus?: 'synced' | 'pending' | 'failed';
};

export type HandheldUnifiedInventoryItem =
  | { type: 'asset'; data: HandheldCountScanItem; meta?: HandheldInventoryItemMeta }
  | { type: 'food'; supply: any; meta?: HandheldInventoryItemMeta }
  | { type: 'ticket'; ticket: any; meta?: HandheldInventoryItemMeta }
  | { type: 'pending_scan'; localKey: string; code: string; queuedAt: number; error?: string };

export function handheldInventoryItemsEqual(a: HandheldUnifiedInventoryItem, b: HandheldUnifiedInventoryItem): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'pending_scan' && b.type === 'pending_scan') return a.localKey === b.localKey;
  if (a.type === 'asset' && b.type === 'asset') return a.data.id === b.data.id && a.data.barcode === b.data.barcode;
  if (a.type === 'food' && b.type === 'food') return a.supply?.id === b.supply?.id;
  if (a.type === 'ticket' && b.type === 'ticket') return a.ticket?.id === b.ticket?.id;
  return false;
}
