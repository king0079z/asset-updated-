/**
 * Background data prefetcher — wave-based strategy.
 *
 * Instead of firing all 20 endpoints simultaneously (which creates ~20 concurrent
 * cold-start DB connections and overwhelms the connection pool), we fire them in
 * small waves with 700 ms gaps. Each wave is fire-and-forget so the UI is never
 * blocked and errors are silently swallowed.
 *
 * Wave 1 (immediate)  — shown on the dashboard landing page
 * Wave 2 (+700 ms)    — pages the user is most likely to visit next
 * Wave 3 (+1400 ms)   — secondary pages
 * Wave 4 (+2100 ms)   — heavy / infrequent endpoints
 */
import { fetchWithCache } from './api-cache';

type Endpoint = { url: string; maxAge: number };

const WAVES: Endpoint[][] = [
  // ── Wave 1: Critical — dashboard shows these immediately ─────────────────
  [
    { url: '/api/dashboard/stats',    maxAge: 2 * 60_000 },
    { url: '/api/assets',             maxAge: 60_000 },
    { url: '/api/vendors',            maxAge: 3 * 60_000 },
  ],

  // ── Wave 2: Likely-next pages ─────────────────────────────────────────────
  [
    { url: '/api/tickets',            maxAge: 60_000 },
    { url: '/api/rfid/dashboard',     maxAge: 15_000 },
    { url: '/api/kitchens',           maxAge: 5 * 60_000 },
    { url: '/api/drivers',            maxAge: 60_000 },
  ],

  // ── Wave 3: Secondary pages ────────────────────────────────────────────────
  [
    { url: '/api/vehicles',           maxAge: 60_000 },
    { url: '/api/vehicles/rentals',   maxAge: 60_000 },
    { url: '/api/planner',            maxAge: 60_000 },
    { url: '/api/food-supply',        maxAge: 60_000 },
    { url: '/api/dashboard/total-spent', maxAge: 2 * 60_000 },
  ],

  // ── Wave 4: Heavy / infrequent ─────────────────────────────────────────────
  [
    { url: '/api/reports/history',         maxAge: 2 * 60_000 },
    { url: '/api/admin/custom-roles',      maxAge: 5 * 60_000 },
    { url: '/api/vehicles/tracking',       maxAge: 30_000 },
    { url: '/api/vehicles/my-vehicle',     maxAge: 60_000 },
    { url: '/api/rfid/zones',              maxAge: 30_000 },
    { url: '/api/admin/users?status=PENDING', maxAge: 2 * 60_000 },
    // Heaviest endpoints last so earlier waves complete first
    { url: '/api/ai-analysis',             maxAge: 5 * 60_000 },
    { url: '/api/food-supply/stats',       maxAge: 5 * 60_000 },
  ],
];

const WAVE_DELAY_MS = 700; // gap between each wave

let prefetchDone = false;

/** Fire all waves in sequence, non-blocking, swallowing all errors. */
export function prefetchAllData(): void {
  if (prefetchDone) return;
  prefetchDone = true;

  WAVES.forEach((wave, index) => {
    setTimeout(() => {
      wave.forEach(({ url, maxAge }) => {
        fetchWithCache(url, { maxAge }).catch(() => null);
      });
    }, index * WAVE_DELAY_MS);
  });
}

export function resetPrefetch(): void {
  prefetchDone = false;
}
