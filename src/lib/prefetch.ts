/**
 * Background data prefetcher.
 * Called once after login to warm every page's cache so navigation is instant.
 * All fetches run in parallel and errors are silently swallowed.
 */
import { fetchWithCache } from './api-cache';

const ENDPOINTS: Array<{ url: string; maxAge: number }> = [
  { url: '/api/dashboard/stats',          maxAge: 2 * 60_000 },
  { url: '/api/dashboard/total-spent',    maxAge: 2 * 60_000 },
  { url: '/api/assets',                   maxAge: 60_000 },
  { url: '/api/vendors',                  maxAge: 3 * 60_000 },
  { url: '/api/tickets',                  maxAge: 60_000 },
  { url: '/api/drivers',                  maxAge: 60_000 },
  { url: '/api/planner',                  maxAge: 60_000 },
  { url: '/api/vehicles',                 maxAge: 60_000 },
  { url: '/api/vehicles/rentals',         maxAge: 60_000 },
  { url: '/api/vehicles/tracking',        maxAge: 30_000 },
  { url: '/api/vehicles/my-vehicle',      maxAge: 60_000 },
  { url: '/api/kitchens',                 maxAge: 5 * 60_000 },
  { url: '/api/food-supply',              maxAge: 60_000 },
  { url: '/api/food-supply/stats',        maxAge: 3 * 60_000 },
  { url: '/api/rfid/dashboard',           maxAge: 15_000 },
  { url: '/api/rfid/zones',               maxAge: 30_000 },
  { url: '/api/ai-analysis',              maxAge: 5 * 60_000 },
  { url: '/api/reports/history',          maxAge: 2 * 60_000 },
  { url: '/api/admin/custom-roles',       maxAge: 5 * 60_000 },
  { url: '/api/admin/users?status=PENDING', maxAge: 2 * 60_000 },
];

let prefetchDone = false;

export async function prefetchAllData(): Promise<void> {
  if (prefetchDone) return;
  prefetchDone = true;

  await Promise.allSettled(
    ENDPOINTS.map(({ url, maxAge }) =>
      fetchWithCache(url, { maxAge }).catch(() => null)
    )
  );
}

export function resetPrefetch(): void {
  prefetchDone = false;
}
