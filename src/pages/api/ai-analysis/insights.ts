// @ts-nocheck
/**
 * Fast rule-based AI insights endpoint.
 * Returns actionable insights in < 2 seconds using lightweight, scoped Prisma queries.
 * No heavy ML computation — pure data-driven heuristics.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/util/supabase/require-auth';

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
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const today = new Date();

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

    // ── Batch 2: tickets + vehicles (after first batch frees connections) ─────
    const [
      openHighTickets,
      openTicketCount,
      vehiclesByStatus,
      disposedAssetsRecent,
    ] = await Promise.all([
      prisma.ticket.count({
        where: {
          status: 'OPEN',
          priority: { in: ['HIGH', 'CRITICAL'] },
          createdAt: { gte: thirtyDaysAgo },
        },
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
    ]);

    // ── Compute summary ────────────────────────────────────────────────────────
    const statusMap: Record<string, number> = {};
    for (const row of assetsByStatus) {
      statusMap[row.status] = row._count.id;
    }
    const activeAssets = statusMap['ACTIVE'] ?? 0;
    const maintenanceAssets = statusMap['MAINTENANCE'] ?? 0;
    const inactiveAssets = statusMap['INACTIVE'] ?? 0;
    const disposedAssets = statusMap['DISPOSED'] ?? 0;
    const totalAssets = activeAssets + maintenanceAssets + inactiveAssets + disposedAssets;
    const nonDisposed = activeAssets + maintenanceAssets + inactiveAssets;
    const assetHealthPct = nonDisposed > 0 ? Math.round((activeAssets / nonDisposed) * 100) : 0;
    const totalPortfolioValue = Number(assetValue._sum.purchaseAmount ?? 0);

    const vehicleMap: Record<string, number> = {};
    for (const row of vehiclesByStatus) {
      vehicleMap[row.status] = row._count.id;
    }
    const activeVehicles = vehicleMap['AVAILABLE'] ?? 0;
    const rentedVehicles = vehicleMap['RENTED'] ?? 0;

    const summary: InsightsSummary = {
      totalAssets: nonDisposed,
      activeAssets,
      maintenanceAssets,
      assetHealthPct,
      totalPortfolioValue,
      openTickets: openTicketCount,
      lowStockItems: lowStockItems.length,
      activeVehicles: activeVehicles + rentedVehicles,
      newAssignmentsLast30d: recentAssignments,
    };

    // ── Generate alerts ────────────────────────────────────────────────────────
    const alerts: InsightAlert[] = [];

    // 1. Asset health
    if (assetHealthPct < 70) {
      alerts.push({
        id: 'asset-health-critical',
        category: 'Asset Health',
        severity: 'critical',
        title: 'Low Asset Health Rate',
        message: `Only ${assetHealthPct}% of assets are active. ${maintenanceAssets} assets are in maintenance and ${inactiveAssets} are inactive. Investigate and schedule corrective action.`,
        metric: { value: `${assetHealthPct}%`, label: 'Health Rate', trend: 'down' },
        action: { label: 'View Assets', href: '/assets' },
      });
    } else if (assetHealthPct < 85) {
      alerts.push({
        id: 'asset-health-warning',
        category: 'Asset Health',
        severity: 'warning',
        title: 'Asset Health Below Target',
        message: `Asset health is at ${assetHealthPct}%. ${maintenanceAssets} asset${maintenanceAssets !== 1 ? 's' : ''} currently in maintenance. Consider preventive maintenance scheduling.`,
        metric: { value: `${assetHealthPct}%`, label: 'Health Rate', trend: 'stable' },
        action: { label: 'View Assets', href: '/assets' },
      });
    } else {
      alerts.push({
        id: 'asset-health-good',
        category: 'Asset Health',
        severity: 'success',
        title: 'Excellent Asset Health',
        message: `${assetHealthPct}% of assets are active and operational. Your fleet is in great shape with only ${maintenanceAssets} asset${maintenanceAssets !== 1 ? 's' : ''} in maintenance.`,
        metric: { value: `${assetHealthPct}%`, label: 'Health Rate', trend: 'up' },
        action: { label: 'View Assets', href: '/assets' },
      });
    }

    // 2. High-priority tickets
    if (openHighTickets > 0) {
      alerts.push({
        id: 'high-priority-tickets',
        category: 'Ticket Management',
        severity: openHighTickets >= 5 ? 'critical' : 'warning',
        title: `${openHighTickets} High-Priority Ticket${openHighTickets !== 1 ? 's' : ''} Open`,
        message: `${openHighTickets} high or critical priority ticket${openHighTickets !== 1 ? 's' : ''} created in the last 30 days remain${openHighTickets === 1 ? 's' : ''} open. Immediate attention required to maintain service levels.`,
        metric: { value: openHighTickets, label: 'Critical/High Tickets', trend: 'up' },
        action: { label: 'Manage Tickets', href: '/tickets' },
      });
    } else if (openTicketCount > 0) {
      alerts.push({
        id: 'open-tickets',
        category: 'Ticket Management',
        severity: 'info',
        title: `${openTicketCount} Active Ticket${openTicketCount !== 1 ? 's' : ''}`,
        message: `${openTicketCount} ticket${openTicketCount !== 1 ? 's' : ''} are currently open or in progress. No critical priority items detected in the last 30 days.`,
        metric: { value: openTicketCount, label: 'Open Tickets', trend: 'stable' },
        action: { label: 'View Tickets', href: '/tickets' },
      });
    }

    // 3. Low food stock
    if (lowStockItems.length > 0) {
      const names = lowStockItems.slice(0, 3).map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ');
      alerts.push({
        id: 'low-stock',
        category: 'Supply Management',
        severity: lowStockItems.length >= 5 ? 'critical' : 'warning',
        title: `${lowStockItems.length} Supply Item${lowStockItems.length !== 1 ? 's' : ''} Running Low`,
        message: `The following supplies need reordering: ${names}${lowStockItems.length > 3 ? ` and ${lowStockItems.length - 3} more` : ''}.`,
        metric: { value: lowStockItems.length, label: 'Low Stock Items', trend: 'up' },
        action: { label: 'View Supplies', href: '/food-supply' },
      });
    }

    // 4. Recent asset assignments
    if (recentAssignments > 0) {
      const trend = recentAssignments > 10 ? 'up' : 'stable';
      alerts.push({
        id: 'recent-assignments',
        category: 'Asset Deployment',
        severity: 'info',
        title: `${recentAssignments} New Asset Assignment${recentAssignments !== 1 ? 's' : ''}`,
        message: `${recentAssignments} asset${recentAssignments !== 1 ? 's' : ''} assigned to staff members in the last 30 days${recentAssignments > 10 ? ' — above-average deployment activity' : ''}.`,
        metric: { value: recentAssignments, label: 'New Assignments (30d)', trend },
        action: { label: 'View Assignments', href: '/assets' },
      });
    }

    // 5. Portfolio value insight
    if (totalPortfolioValue > 0) {
      const fmtVal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'QAR', maximumFractionDigits: 0 }).format(totalPortfolioValue);
      const avgValue = nonDisposed > 0 ? totalPortfolioValue / nonDisposed : 0;
      const fmtAvg = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'QAR', maximumFractionDigits: 0 }).format(avgValue);
      alerts.push({
        id: 'portfolio-value',
        category: 'Financial Overview',
        severity: 'info',
        title: 'Asset Portfolio Valuation',
        message: `Total active asset portfolio is valued at ${fmtVal} across ${nonDisposed.toLocaleString()} assets. Average asset value: ${fmtAvg}.`,
        metric: { value: fmtVal, label: 'Portfolio Value', trend: 'stable' },
        action: { label: 'Full Analysis', href: '/ai-analysis' },
      });
    }

    // 6. Disposed assets alert
    if (disposedAssetsRecent > 0) {
      alerts.push({
        id: 'disposed-assets',
        category: 'Asset Lifecycle',
        severity: disposedAssetsRecent > 5 ? 'warning' : 'info',
        title: `${disposedAssetsRecent} Asset${disposedAssetsRecent !== 1 ? 's' : ''} Disposed This Month`,
        message: `${disposedAssetsRecent} asset${disposedAssetsRecent !== 1 ? 's' : ''} ${disposedAssetsRecent === 1 ? 'was' : 'were'} disposed in the last 30 days. Review disposal records to ensure proper asset lifecycle management.`,
        metric: { value: disposedAssetsRecent, label: 'Disposed (30d)', trend: disposedAssetsRecent > 3 ? 'up' : 'stable' },
        action: { label: 'View Assets', href: '/assets' },
      });
    }

    // 7. Maintenance ratio
    if (maintenanceAssets > 0) {
      const maintenancePct = nonDisposed > 0 ? Math.round((maintenanceAssets / nonDisposed) * 100) : 0;
      if (maintenancePct > 15) {
        alerts.push({
          id: 'maintenance-high',
          category: 'Maintenance',
          severity: 'warning',
          title: 'High Maintenance Load',
          message: `${maintenancePct}% of assets are in maintenance (${maintenanceAssets} assets). This is above the recommended 10% threshold. Schedule preventive maintenance to reduce reactive repairs.`,
          metric: { value: `${maintenancePct}%`, label: 'In Maintenance', trend: 'up' },
          action: { label: 'View Assets', href: '/assets' },
        });
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const result = {
      alerts,
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
      alerts: [],
      summary: null,
      _error: true,
      meta: { generatedAt: new Date().toISOString() },
    });
  }
}
