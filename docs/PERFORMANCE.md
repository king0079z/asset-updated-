# Database & Data Fetching Performance (assetxai.live)

This document summarizes how the portal stays fast and what to check when things feel slow.

## 1. Framework & data sources

- **Framework:** Next.js (Pages Router) with React.
- **Database (main app data):** PostgreSQL via **Prisma** (Asset, Ticket, Vehicle, FoodSupply, Kitchen, etc.). Connection string: `DATABASE_URL` (often same DB as Supabase or separate).
- **Auth & org data:** **Supabase** (User, Organization, OrganizationMember, Subscription, CustomRole).

## 2. What we’ve implemented

### 2.1 Database indexes (Prisma / PostgreSQL)

Indexes were added so common filters and sorts are fast. Full list is in `docs/APPLICATION_TABLES.md`. Summary:

- **Asset:** `userId`, `organizationId`, `status`, `createdAt`
- **Ticket:** `organizationId`, `userId`, `assignedToId`, `status`, `createdAt`
- **FoodSupply:** `organizationId`, `userId`, `kitchenId`, `createdAt`
- **VehicleRental:** `status`, `startDate`, `userId`, `vehicleId`
- **FoodConsumption:** `date`, `foodSupplyId`, `kitchenId`
- **AssetMovement:** `assetId`, `movedAt`
- **AssetHistory:** `assetId`, `createdAt`
- **TicketHistory:** `ticketId`, `createdAt`
- **AuditLog:** `organizationId`, `userId`, `timestamp`
- **VehicleTrip:** `vehicleId`, `userId`, `startTime`
- **VehicleMaintenance:** `vehicleId`, `maintenanceDate`, `organizationId`
- **Vehicle:** `organizationId`, `status`
- **PlannerTask:** `userId`, `assignedToUserId`, `organizationId`, `startDate`, `status`
- **Recipe, Location, Kitchen, Vendor:** `organizationId` (and Kitchen: `locationId`)
- **Notification, ReportHistory:** `userId`, `createdAt`
- **FoodDisposal:** `foodSupplyId`, `kitchenId`, `createdAt`
- **StockTransfer:** `requestedById`, `createdAt`, `status`

After pulling, run:

```bash
npx prisma db push
# or
npx prisma migrate dev --name add_performance_indexes
```

Then in **Supabase Dashboard → Database → Query Performance** (or your DB tool), check that slow queries use these indexes.

### 2.2 Fewer round-trips: batched dashboard (inline)

- **Before:** Dashboard did 5 HTTP calls; `/api/dashboard/full` itself called 5 internal APIs (each a serverless cold start).
- **After:** One call to `/api/dashboard/full` computes everything **in-process** with Prisma/raw SQL (no internal fetch). Single cold start, single DB round-trip batch, 2‑minute per-user cache.

The dashboard page tries `/api/dashboard/full` first. Other slow APIs were optimized: drivers (N+1 removed, single trip query), rental-costs/total-spent (aggregates), RFID dashboard (limits + 12s timeout), vehicles/food-supply/vendors (take limits + cache), ML predictions (smaller TAKE + cache).

### 2.3 Pagination / limit on assets list

- **Before:** Assets list could load the whole table.
- **After:** Default limit 500, max 2000 via `?limit=`. Optional `?offset=` for paging. Response is still a JSON array; `X-Total-Count` and `X-Has-More` headers support future “Load more” or pagination UI.

### 2.4 Server-side caches

- **Dashboard stats:** Per-user in-memory cache, 2 min TTL.
- **Dashboard full:** Per-user cache for the batched payload, 2 min TTL.
- **Tickets list:** Per-user cache, 60 s TTL.
- **Assets list:** Per-user cache when using default limit/offset, 60 s TTL.

### 2.5 Tickets list

- Tickets API already uses `take: 200` and a 60 s server cache.

## 3. Supabase region and latency

If your **Supabase** project is in a region far from users (e.g. US/EU while users are in Qatar/Middle East), auth and Supabase-backed pages will feel slower.

- **Check:** Supabase Dashboard → Project Settings → General → Region.
- **Improve:** Create or move the project to the region closest to your users (e.g. Middle East if available).

## 4. Row Level Security (RLS) on Supabase

Complex RLS policies can slow every Supabase query.

- Prefer simple checks (e.g. `user_id = auth.uid()`) over heavy subqueries.
- Use **Supabase Dashboard → Database → Query Performance** to see which policies are expensive.

## 5. Realtime

The app does **not** use Supabase Realtime for assets/tickets/dashboard. Only auth state and a limited use (e.g. update-location) use subscriptions. No change needed for general “slow DB” issues.

## 6. Quick diagnostics

| Symptom | What to check |
|--------|----------------|
| Dashboard slow | 1) Use Network tab: one request to `/api/dashboard/full`? 2) Supabase Dashboard → Query Performance for Prisma queries hitting your DB. |
| Assets list slow | 1) Ensure indexes exist (`prisma db push` / migrations). 2) Check `X-Total-Count`: if very large, consider UI pagination. |
| Tickets slow | Already limited to 200 and cached; check Query Performance for Ticket queries. |
| Auth/org slow | Supabase region and RLS (sections 3 and 4). |

## 7. Optional: one RPC for org context

`OrganizationContext` currently does 2 Supabase round-trips (memberships, then subscription). You can replace them with a single Supabase RPC that returns both (e.g. `get_user_org_context(user_id)`). Not required for the current performance work but can reduce latency further.

---

**Summary:** We added indexes, a batched dashboard API, and assets list limits/caching. For world-class feel, also confirm Supabase region and keep RLS simple; use Query Performance to catch any remaining slow queries.
