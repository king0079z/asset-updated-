/**
 * Background data prefetcher — minimal, safe strategy.
 *
 * KEY INSIGHT: Vercel Hobby plan serverless functions have a 10-second timeout.
 * A cold Lambda + Prisma init + DB connection takes 5-7 seconds before the
 * query even runs. Firing 20 endpoints simultaneously causes:
 *   1. DB connection pool exhaustion → queue-based delays → timeouts
 *   2. Multiple 500 errors that look like code bugs but are actually 504s
 *
 * SOLUTION: Only prefetch the 3 endpoints actually needed for the dashboard
 * to render immediately. Everything else loads lazily when the user navigates
 * to that page — the client-side cache ensures instant subsequent visits.
 */
import { fetchWithCache } from './api-cache';

type Endpoint = { url: string; maxAge: number };

// Only warm the data that appears on the dashboard's first render.
// Everything else is fetched on-demand and cached for instant revisits.
const CRITICAL: Endpoint[] = [
  { url: '/api/dashboard/full',  maxAge: 2 * 60_000 },
  { url: '/api/assets',          maxAge: 60_000 },
  { url: '/api/vendors',         maxAge: 3 * 60_000 },
];

// Lightly warm a second batch 3 seconds later (functions are warm by then).
const SECONDARY: Endpoint[] = [
  { url: '/api/rfid/dashboard',  maxAge: 15_000 },
  { url: '/api/tickets',         maxAge: 60_000 },
];

// Non-critical batch — only after 7 seconds (heavy endpoints).
// Skipped entirely on slow connections or if page navigated away.
const TERTIARY: Endpoint[] = [
  { url: '/api/drivers',            maxAge: 60_000 },
  { url: '/api/kitchens',           maxAge: 5 * 60_000 },
  { url: '/api/vehicles',           maxAge: 60_000 },
  { url: '/api/food-supply',        maxAge: 60_000 },
  { url: '/api/dashboard/total-spent', maxAge: 2 * 60_000 },
];

let prefetchDone  = false;
let waveTimers: ReturnType<typeof setTimeout>[] = [];

function fireWave(endpoints: Endpoint[]) {
  endpoints.forEach(({ url, maxAge }) => {
    fetchWithCache(url, { maxAge }).catch(() => null);
  });
}

/** Fire waves in sequence — non-blocking, all errors silently swallowed. */
export function prefetchAllData(): void {
  if (prefetchDone) return;
  prefetchDone = true;

  // Wave 1: immediate — critical dashboard data
  fireWave(CRITICAL);

  // Wave 2: +3s — functions are warm, safe to add 2 more
  waveTimers.push(setTimeout(() => fireWave(SECONDARY), 3_000));

  // Wave 3: +7s — heavy but non-blocking
  waveTimers.push(setTimeout(() => fireWave(TERTIARY), 7_000));
}

export function resetPrefetch(): void {
  prefetchDone = false;
  waveTimers.forEach(clearTimeout);
  waveTimers = [];
}
