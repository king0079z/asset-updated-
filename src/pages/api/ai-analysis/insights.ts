// @ts-nocheck
/**
 * Fast rule-based AI insights endpoint — now includes depreciation analysis.
 * Returns actionable insights in < 2 seconds using lightweight, scoped Prisma queries.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/util/supabase/require-auth';
import { calculatePortfolioDepreciation, USEFUL_LIFE_BY_TYPE } from '@/lib/depreciation';

const CACHE_TTL = 3 * 60 * 1000; // 3 minutes
const insightsCache = new Map<string, { data: any; ts: number }>();

export interface InsightAlert {
  id: string;
  category: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  metric?: { value: number | string; label: string; trend?: 'up' | 'down' | 'stable' };
  action?: { label: string; href: string };
  isDepreciation?: boolean;
}

export interface DepreciationSummary {
  totalCost: number;
  totalCurrentValue: number;
  totalAccumulatedDepreciation: number;
  overallDepreciationPercent: number;
  byType: Array<{
    type: string;
    count: number;
    totalCost: number;
    totalBookValue: number;
    totalDepreciation: number;
    depreciationPercent: number;
  }>;
  criticalAssets: Array<{ name: string; depreciationPercent: number; bookValue: number }>;
  nearEndOfLifeCount: number;
  heavilyDepreciatedCount: number;
}

export interface InsightsSummary {
  totalAssets: number;
  activeAssets: number;
  maintenanceAssets: number;
  assetHealthPct: number;
  totalPortfolioValue: number;
  openTickets: number;
  lowStockItems: number;
  activeVehicles: number;
  newAssignmentsLast30d: number;
  depreciation?: DepreciationSummary;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { user } = auth;

    const cacheKey = `insights_${user.id}`;
    const cached = insightsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      res.setHeader('Cache-Control', 'private, max-age=180, stale-while-revalidate=60');
      return res.status(200).json(cached.data);
    }

    // Resolve org for scoping
    let organizationId: string | null = null;
    try {
      const orgRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { organizationId: true },
      });
      organizationId = orgRecord?.organizationId ?? null;
    } catch { /* non-critical */ }

    const orgFilter = organizationId ? { organizationId } : {};
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ── Batch 1: lightweight aggregate + count queries ────────────────────────
    const [
      assetsByStatus,
      assetValue,
      lowStockItems,
      recentAssignments,
    ] = await Promise.all([
      prisma.asset.groupBy({
        by: ['status'],
        _count: { id: true },
        where: orgFilter,
      }),
      prisma.asset.aggregate({
        _sum: { purchaseAmount: true },
        _count: { id: true },
        where: { ...orgFilter, status: { not: 'DISPOSED' } },
      }),
      prisma.foodSupply.findMany({
        where: { ...orgFilter, quantity: { lte: 10 } },
        select: { id: true, name: true, quantity: true, unit: true },
        take: 8,
        orderBy: { quantity: 'asc' },
      }),
      prisma.asset.count({
        where: { ...orgFilter, assignedAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    // ── Batch 2: tickets + vehicles + assets for depreciation ─────────────────
    const [
      openHighTickets,
      openTicketCount,
      vehiclesByStatus,
      disposedAssetsRecent,
      assetsForDepreciation,
    ] = await Promise.all([
      prisma.ticket.count({
        where: { status: 'OPEN', priority: { in: ['HIGH', 'CRITICAL'] }, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.ticket.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      prisma.vehicle.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.asset.count({
        where: { ...orgFilter, status: 'DISPOSED', updatedAt: { gte: thirtyDaysAgo } },
      }),
      prisma.asset.findMany({
        where: { ...orgFilter, status: { not: 'DISPOSED' }, purchaseAmount: { not: null } },
        select: { id: true, name: true, type: true, purchaseAmount: true, purchaseDate: true, createdAt: true },
        take: 500,
      }),
    ]);

    // ── Compute base summary ──────────────────────────────────────────────────
    const statusMap: Record<string, number> = {};
    for (const row of assetsByStatus) statusMap[row.status] = row._count.id;
    const activeAssets      = statusMap['ACTIVE'] ?? 0;
    const maintenanceAssets = statusMap['MAINTENANCE'] ?? 0;
    const inactiveAssets    = statusMap['INACTIVE'] ?? 0;
    const disposedAssets    = statusMap['DISPOSED'] ?? 0;
    const nonDisposed       = activeAssets + maintenanceAssets + inactiveAssets;
    const assetHealthPct    = nonDisposed > 0 ? Math.round((activeAssets / nonDisposed) * 100) : 0;
    const totalPortfolioValue = Number(assetValue._sum.purchaseAmount ?? 0);

    const vehicleMap: Record<string, number> = {};
    for (const row of vehiclesByStatus) vehicleMap[row.status] = row._count.id;
    const activeVehicles  = (vehicleMap['AVAILABLE'] ?? 0) + (vehicleMap['RENTED'] ?? 0);

    // ── Depreciation analysis ─────────────────────────────────────────────────
    let depreciationSummary: DepreciationSummary | null = null;
    const depreciationAlerts: InsightAlert[] = [];

    try {
      const portfolio = calculatePortfolioDepreciation(assetsForDepreciation.map(a => ({
        id: a.id, name: a.name, type: a.type,
        purchaseAmount: a.purchaseAmount, purchaseDate: a.purchaseDate, createdAt: a.createdAt,
      })));

      if (portfolio.totalCost > 0) {
        // Identify near-end-of-life and heavily depreciated assets
        const { calculateDepreciation } = await import('@/lib/depreciation');
        const criticalAssets: Array<{ name: string; depreciationPercent: number; bookValue: number }> = [];
        let nearEndOfLifeCount = 0;
        let heavilyDepreciatedCount = 0;

        for (const asset of assetsForDepreciation.slice(0, 100)) {
          if (!asset.purchaseAmount || asset.purchaseAmount <= 0) continue;
          try {
            const d = calculateDepreciation({
              cost: Number(asset.purchaseAmount),
              purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate) : new Date(asset.createdAt),
              usefulLifeYears: USEFUL_LIFE_BY_TYPE[asset.type ?? 'OTHER'] ?? 7,
            });
            if (d.depreciationPercent >= 75) {
              heavilyDepreciatedCount++;
              criticalAssets.push({ name: asset.name, depreciationPercent: d.depreciationPercent, bookValue: d.currentBookValue });
            }
            if (d.remainingLife < 1) nearEndOfLifeCount++;
          } catch {}
        }

        criticalAssets.sort((a, b) => b.depreciationPercent - a.depreciationPercent);

        depreciationSummary = {
          totalCost: portfolio.totalCost,
          totalCurrentValue: portfolio.totalCurrentValue,
          totalAccumulatedDepreciation: portfolio.totalAccumulatedDepreciation,
          overallDepreciationPercent: portfolio.overallDepreciationPercent,
          byType: portfolio.byType,
          criticalAssets: criticalAssets.slice(0, 5),
          nearEndOfLifeCount,
          heavilyDepreciatedCount,
        };

        const fmt = (n: number) => n >= 1_000_000 ? `QAR ${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `QAR ${(n/1_000).toFixed(0)}K` : `QAR ${n.toFixed(0)}`;
        const depPct = portfolio.overallDepreciationPercent;
        const lostValue = portfolio.totalAccumulatedDepreciation;
        const bookValue = portfolio.totalCurrentValue;

        // Alert 1: Overall depreciation level
        if (depPct >= 70) {
          depreciationAlerts.push({
            id: 'dep-critical',
            category: 'Depreciation',
            severity: 'critical',
            title: `Portfolio ${depPct.toFixed(1)}% Depreciated`,
            message: `Your asset portfolio has depreciated significantly. Current book value is ${fmt(bookValue)} against original cost of ${fmt(portfolio.totalCost)}. Replacement planning is urgent.`,
            metric: { value: `${depPct.toFixed(1)}%`, label: 'Portfolio Depreciated', trend: 'down' },
            action: { label: 'View Assets', href: '/assets' },
            isDepreciation: true,
          });
        } else if (depPct >= 45) {
          depreciationAlerts.push({
            id: 'dep-warning',
            category: 'Depreciation',
            severity: 'warning',
            title: `Portfolio ${depPct.toFixed(1)}% Depreciated`,
            message: `${fmt(lostValue)} in accumulated depreciation. Book value at ${fmt(bookValue)}. Begin budget planning for asset replacement cycles.`,
            metric: { value: `${depPct.toFixed(1)}%`, label: 'Portfolio Depreciated', trend: 'stable' },
            action: { label: 'View Assets', href: '/assets' },
            isDepreciation: true,
          });
        } else {
          depreciationAlerts.push({
            id: 'dep-good',
            category: 'Depreciation',
            severity: 'info',
            title: `Portfolio ${depPct.toFixed(1)}% Depreciated`,
            message: `Asset portfolio is in good shape. Book value: ${fmt(bookValue)} (${(100 - depPct).toFixed(1)}% retained). Accumulated depreciation: ${fmt(lostValue)}.`,
            metric: { value: `${depPct.toFixed(1)}%`, label: 'Portfolio Depreciated', trend: 'stable' },
            action: { label: 'View Assets', href: '/assets' },
            isDepreciation: true,
          });
        }

        // Alert 2: Near end-of-life assets
        if (nearEndOfLifeCount > 0) {
          depreciationAlerts.push({
            id: 'dep-eol',
            category: 'Depreciation',
            severity: nearEndOfLifeCount >= 5 ? 'critical' : 'warning',
            title: `${nearEndOfLifeCount} Asset${nearEndOfLifeCount !== 1 ? 's' : ''} Past Useful Life`,
            message: `${nearEndOfLifeCount} asset${nearEndOfLifeCount !== 1 ? 's' : ''} ${nearEndOfLifeCount === 1 ? 'has' : 'have'} exceeded their useful life and should be reviewed for replacement or disposal.`,
            metric: { value: nearEndOfLifeCount, label: 'Past Useful Life', trend: 'up' },
            action: { label: 'Review Assets', href: '/assets' },
            isDepreciation: true,
          });
        }

        // Alert 3: Heavily depreciated (>75%)
        if (heavilyDepreciatedCount > 0) {
          depreciationAlerts.push({
            id: 'dep-heavy',
            category: 'Depreciation',
            severity: heavilyDepreciatedCount >= 3 ? 'warning' : 'info',
            title: `${heavilyDepreciatedCount} Asset${heavilyDepreciatedCount !== 1 ? 's' : ''} >75% Depreciated`,
            message: `${heavilyDepreciatedCount} asset${heavilyDepreciatedCount !== 1 ? 's' : ''} ${heavilyDepreciatedCount === 1 ? 'is' : 'are'} over 75% depreciated with minimal residual value. Prioritise replacement budgeting.`,
            metric: { value: heavilyDepreciatedCount, label: 'Heavily Depreciated', trend: 'up' },
            action: { label: 'View Assets', href: '/assets' },
            isDepreciation: true,
          });
        }

        // Alert 4: Book value insight
        depreciationAlerts.push({
          id: 'dep-bookvalue',
          category: 'Depreciation',
          severity: 'info',
          title: 'Portfolio Book Value',
          message: `Current book value: ${fmt(bookValue)} across ${assetsForDepreciation.length} assets. ${fmt(lostValue)} in accumulated depreciation (IAS 16 straight-line method).`,
          metric: { value: fmt(bookValue), label: 'Current Book Value', trend: 'stable' },
          action: { label: 'Full Analysis', href: '/ai-analysis' },
          isDepreciation: true,
        });
      }
    } catch (depErr) {
      console.warn('[Insights] Depreciation calc warning:', depErr?.message);
    }

    const summary: InsightsSummary = {
      totalAssets: nonDisposed,
      activeAssets,
      maintenanceAssets,
      assetHealthPct,
      totalPortfolioValue,
      openTickets: openTicketCount,
      lowStockItems: lowStockItems.length,
      activeVehicles,
      newAssignmentsLast30d: recentAssignments,
      depreciation: depreciationSummary,
    };

    // ── Generate operational alerts ───────────────────────────────────────────
    const operationalAlerts: InsightAlert[] = [];

    // 1. Asset health
    if (assetHealthPct < 70) {
      operationalAlerts.push({
        id: 'asset-health-critical', category: 'Asset Health', severity: 'critical',
        title: 'Low Asset Health Rate',
        message: `Only ${assetHealthPct}% of assets are active. ${maintenanceAssets} in maintenance, ${inactiveAssets} inactive. Schedule corrective action.`,
        metric: { value: `${assetHealthPct}%`, label: 'Health Rate', trend: 'down' },
        action: { label: 'View Assets', href: '/assets' },
      });
    } else if (assetHealthPct < 85) {
      operationalAlerts.push({
        id: 'asset-health-warning', category: 'Asset Health', severity: 'warning',
        title: 'Asset Health Below Target',
        message: `Asset health at ${assetHealthPct}%. ${maintenanceAssets} asset${maintenanceAssets !== 1 ? 's' : ''} in maintenance. Consider preventive maintenance scheduling.`,
        metric: { value: `${assetHealthPct}%`, label: 'Health Rate', trend: 'stable' },
        action: { label: 'View Assets', href: '/assets' },
      });
    } else {
      operationalAlerts.push({
        id: 'asset-health-good', category: 'Asset Health', severity: 'success',
        title: 'Excellent Asset Health',
        message: `${assetHealthPct}% of assets are active. Only ${maintenanceAssets} in maintenance. Fleet is in great shape.`,
        metric: { value: `${assetHealthPct}%`, label: 'Health Rate', trend: 'up' },
        action: { label: 'View Assets', href: '/assets' },
      });
    }

    // 2. High-priority tickets
    if (openHighTickets > 0) {
      operationalAlerts.push({
        id: 'high-priority-tickets', category: 'Ticket Management',
        severity: openHighTickets >= 5 ? 'critical' : 'warning',
        title: `${openHighTickets} High-Priority Ticket${openHighTickets !== 1 ? 's' : ''} Open`,
        message: `${openHighTickets} critical/high ticket${openHighTickets !== 1 ? 's' : ''} opened in the last 30 days remain open. Immediate attention required.`,
        metric: { value: openHighTickets, label: 'Critical Tickets', trend: 'up' },
        action: { label: 'Manage Tickets', href: '/tickets' },
      });
    } else if (openTicketCount > 0) {
      operationalAlerts.push({
        id: 'open-tickets', category: 'Ticket Management', severity: 'info',
        title: `${openTicketCount} Active Ticket${openTicketCount !== 1 ? 's' : ''}`,
        message: `${openTicketCount} ticket${openTicketCount !== 1 ? 's' : ''} open or in progress. No critical items in the last 30 days.`,
        metric: { value: openTicketCount, label: 'Open Tickets', trend: 'stable' },
        action: { label: 'View Tickets', href: '/tickets' },
      });
    }

    // 3. Low food stock
    if (lowStockItems.length > 0) {
      const names = lowStockItems.slice(0, 3).map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ');
      operationalAlerts.push({
        id: 'low-stock', category: 'Supply Management',
        severity: lowStockItems.length >= 5 ? 'critical' : 'warning',
        title: `${lowStockItems.length} Supply Item${lowStockItems.length !== 1 ? 's' : ''} Running Low`,
        message: `Reorder needed: ${names}${lowStockItems.length > 3 ? ` + ${lowStockItems.length - 3} more` : ''}.`,
        metric: { value: lowStockItems.length, label: 'Low Stock Items', trend: 'up' },
        action: { label: 'View Supplies', href: '/food-supply' },
      });
    }

    // 4. Recent assignments
    if (recentAssignments > 0) {
      operationalAlerts.push({
        id: 'recent-assignments', category: 'Asset Deployment', severity: 'info',
        title: `${recentAssignments} New Asset Assignment${recentAssignments !== 1 ? 's' : ''}`,
        message: `${recentAssignments} asset${recentAssignments !== 1 ? 's' : ''} assigned in the last 30 days${recentAssignments > 10 ? ' — above-average activity' : ''}.`,
        metric: { value: recentAssignments, label: 'New Assignments (30d)', trend: recentAssignments > 10 ? 'up' : 'stable' },
        action: { label: 'View Assignments', href: '/assets' },
      });
    }

    // 5. Portfolio value
    if (totalPortfolioValue > 0) {
      const fmtVal = (v: number) => v >= 1_000_000 ? `QAR ${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `QAR ${(v/1_000).toFixed(0)}K` : `QAR ${v.toFixed(0)}`;
      const avgValue = nonDisposed > 0 ? totalPortfolioValue / nonDisposed : 0;
      operationalAlerts.push({
        id: 'portfolio-value', category: 'Financial Overview', severity: 'info',
        title: 'Asset Portfolio Valuation',
        message: `Total portfolio: ${fmtVal(totalPortfolioValue)} across ${nonDisposed.toLocaleString()} assets. Average value: ${fmtVal(avgValue)}.`,
        metric: { value: fmtVal(totalPortfolioValue), label: 'Portfolio Value', trend: 'stable' },
        action: { label: 'Full Analysis', href: '/ai-analysis' },
      });
    }

    // 6. Disposed assets
    if (disposedAssetsRecent > 0) {
      operationalAlerts.push({
        id: 'disposed-assets', category: 'Asset Lifecycle',
        severity: disposedAssetsRecent > 5 ? 'warning' : 'info',
        title: `${disposedAssetsRecent} Asset${disposedAssetsRecent !== 1 ? 's' : ''} Disposed This Month`,
        message: `${disposedAssetsRecent} asset${disposedAssetsRecent !== 1 ? 's' : ''} disposed in the last 30 days. Review records for compliance.`,
        metric: { value: disposedAssetsRecent, label: 'Disposed (30d)', trend: disposedAssetsRecent > 3 ? 'up' : 'stable' },
        action: { label: 'View Assets', href: '/assets' },
      });
    }

    // 7. Maintenance ratio
    if (maintenanceAssets > 0) {
      const maintenancePct = nonDisposed > 0 ? Math.round((maintenanceAssets / nonDisposed) * 100) : 0;
      if (maintenancePct > 15) {
        operationalAlerts.push({
          id: 'maintenance-high', category: 'Maintenance', severity: 'warning',
          title: 'High Maintenance Load',
          message: `${maintenancePct}% of assets in maintenance (${maintenanceAssets} assets). Above 10% threshold. Schedule preventive maintenance.`,
          metric: { value: `${maintenancePct}%`, label: 'In Maintenance', trend: 'up' },
          action: { label: 'View Assets', href: '/assets' },
        });
      }
    }

    // ── Combine and sort alerts ────────────────────────────────────────────────
    const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
    const allAlerts = [
      ...depreciationAlerts,
      ...operationalAlerts,
    ].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const result = {
      alerts: allAlerts,
      summary,
      meta: {
        generatedAt: new Date().toISOString(),
        cached: false,
        dataScope: organizationId ? 'organization' : 'global',
      },
    };

    insightsCache.set(cacheKey, { data: result, ts: Date.now() });
    res.setHeader('Cache-Control', 'private, max-age=180, stale-while-revalidate=60');
    return res.status(200).json(result);
  } catch (error) {
    console.error('[AI Insights] Error:', error);
    return res.status(200).json({
      alerts: [], summary: null, _error: true,
      meta: { generatedAt: new Date().toISOString() },
    });
  }
}
