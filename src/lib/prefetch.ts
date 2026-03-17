/**
 * Background data prefetcher — ultra-minimal strategy.
 *
 * CRITICAL CONSTRAINT: Supabase connection pooler (pgbouncer) on the Hobby
 * plan allows ~15 concurrent connections. Each serverless function invocation
 * grabs a connection. Firing many endpoints at once saturates the pool,
 * causing ALL queries (including the dashboard's own) to queue and timeout.
 *
 * STRATEGY: Only prefetch the ONE batched endpoint the dashboard actually uses.
 * Everything else loads lazily when the user navigates to that page — the
 * client-side cache ensures instant subsequent visits. One function warms
 * Prisma and the DB connection; subsequent page-specific calls benefit.
 */
import { fetchWithCache } from './api-cache';

type Endpoint = { url: string; maxAge: number };

// ONLY the batched dashboard endpoint. It warms Prisma + DB connection
// and returns all stats the dashboard needs in a single round-trip.
const CRITICAL: Endpoint[] = [
  { url: '/api/dashboard/full', maxAge: 2 * 60_000 },
];

// After 10s: warm assets + vendors (used by sidebar counters / dashboard cards).
// By this time the dashboard/full function has completed and released its connection.
const SECONDARY: Endpoint[] = [
  { url: '/api/assets',  maxAge: 60_000 },
  { url: '/api/vendors', maxAge: 3 * 60_000 },
];

let prefetchDone = false;
let waveTimers: ReturnType<typeof setTimeout>[] = [];

function fireWave(endpoints: Endpoint[]) {
  endpoints.forEach(({ url, maxAge }) => {
    fetchWithCache(url, { maxAge }).catch(() => null);
  });
}

export function prefetchAllData(): void {
  if (prefetchDone) return;
  prefetchDone = true;

  // Wave 1: immediate — only the batched dashboard endpoint
  fireWave(CRITICAL);

  // Wave 2: +10s — after dashboard/full has completed, warm secondary data
  waveTimers.push(setTimeout(() => fireWave(SECONDARY), 10_000));
}

export function resetPrefetch(): void {
  prefetchDone = false;
  waveTimers.forEach(clearTimeout);
  waveTimers = [];
}
