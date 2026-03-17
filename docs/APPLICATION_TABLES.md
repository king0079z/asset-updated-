# Application Tables & World-Class Operations

This document lists main application tables, their indexes, which APIs use limits/pagination, and required environment for production.

## 1. Required environment

| Variable | Purpose |
|----------|--------|
| `DATABASE_URL` | Prisma connection (PostgreSQL). Use pooled URL if using Supabase connection pooler. |
| `DIRECT_URL` | Prisma direct connection for migrations / push. Required when using Supabase pooler. |
| Supabase env vars | Auth and optional Supabase-backed User/org data (`NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` if used). |

Ensure **Supabase Site URL** and **Redirect URLs** include your production domain (e.g. `https://assetxai.live`) to avoid 403 on auth.

---

## 2. Tables and indexes (Prisma schema)

Tables used for list/report/dashboard queries have indexes on filter and sort columns. After schema changes run:

```bash
npx prisma db push
# or
npx prisma migrate dev --name your_migration_name
```

| Table | Indexes | Notes |
|-------|---------|--------|
| **Asset** | userId, organizationId, status, createdAt | Core list/dashboard/reports |
| **AssetHistory** | assetId, createdAt | History per asset |
| **AssetMovement** | assetId, movedAt | Movement history |
| **AuditLog** | organizationId, userId, timestamp | Staff activity, audit report |
| **FoodConsumption** | date, foodSupplyId, kitchenId | Dashboard, consumption reports |
| **FoodDisposal** | foodSupplyId, kitchenId, createdAt | Waste and kitchen reports |
| **FoodSupply** | organizationId, userId, kitchenId, createdAt | Lists, kitchen consumption |
| **Kitchen** | organizationId, locationId | Lists by org/location |
| **Location** | organizationId | Lists by org |
| **Notification** | userId, createdAt | User notifications |
| **PlannerTask** | userId, assignedToUserId, organizationId, startDate, status | Planner lists/KPI |
| **Recipe** | organizationId, userId | Recipe lists |
| **ReportHistory** | userId, createdAt | Report history |
| **StockTransfer** | requestedById, createdAt, status | Transfer lists |
| **Ticket** | organizationId, userId, assignedToId, status, createdAt | Ticket lists/dashboard |
| **TicketHistory** | ticketId, createdAt | Ticket detail history |
| **Vehicle** | organizationId, status | Vehicle lists |
| **VehicleMaintenance** | vehicleId, maintenanceDate, organizationId | Maintenance history |
| **VehicleRental** | status, startDate, userId, vehicleId | Rentals, dashboard |
| **VehicleTrip** | vehicleId, userId, startTime | Trip history |
| **Vendor** | organizationId | Vendor lists |

Other tables (e.g. Subscription, Organization, User, junction tables) use primary/unique keys; add indexes if you introduce new high-volume query patterns.

---

## 3. APIs: limits and pagination

| API / area | Limit / pagination | Notes |
|------------|--------------------|--------|
| **Dashboard** | One batched call `/api/dashboard/full` | 2 min cache; single round-trip. |
| **Assets list** | `GET /api/assets` default limit 500, max 2000 via `?limit=`, optional `?offset=` | Headers: `X-Total-Count`, `X-Has-More`. |
| **Tickets list** | `take: 200`, 60 s cache | `/api/tickets`, `/api/portal/data`. |
| **Vehicles list** | No explicit limit | Bounded by org; consider adding `take` if orgs grow large. |
| **Kitchens list** | No explicit limit | Same as above. |
| **Locations list** | No explicit limit | Same as above. |
| **Vendors** | No explicit limit | Same as above. |
| **Food supply list** | No explicit limit | Filtered by org/kitchen; consider `take` for very large datasets. |
| **Stock transfers** | No explicit limit | Consider `take` + optional cursor/offset. |
| **Staff activity / audit** | Check API for `take` | `/api/staff-activity`, `/api/audit/report`; recommend limit (e.g. 100–500). |
| **Error logs (admin)** | Check API for `take` | Recommend limit for list. |
| **Planner tasks** | Filtered by user/org | Consider `take` if task volume grows. |
| **Reports generate** | Scoped by filters | Report-specific; ensure date/scope limits. |

Adding `take` (and optional offset/cursor) to unbounded list endpoints is recommended as data grows; see `docs/PERFORMANCE.md` for caching and diagnostics.

---

## 4. World-class operations checklist

- [x] **Indexes** on hot paths (assets, tickets, food supply, vehicles, rentals, consumption, audit, history tables).
- [x] **Batched dashboard** (single `/api/dashboard/full` call with short cache).
- [x] **Assets list** pagination/limit and total-count headers.
- [x] **Tickets list** limited (200) and cached.
- [ ] **Supabase** Site URL and Redirect URLs set for production domain.
- [ ] **DIRECT_URL** set in production when using Supabase connection pooler.
- [ ] **Optional:** Add `take`/limit to vehicles, kitchens, locations, vendors, stock-transfers, staff-activity, error-logs.
- [ ] **Optional:** Single Supabase RPC for org context to reduce auth round-trips.

Use **Supabase Dashboard → Database → Query Performance** (and your DB metrics) to find any remaining slow queries and add indexes or limits as needed.
