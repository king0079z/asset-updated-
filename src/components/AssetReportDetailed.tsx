import React from 'react';
import { format } from 'date-fns';
import { ComplianceFooter } from './ComplianceFooter';

type Asset = {
  id: string;
  assetId?: string;
  name: string;
  description?: string;
  barcode?: string;
  type?: string;
  imageUrl?: string;
  status?: string;
  purchaseAmount?: number;
  purchaseDate?: string;
  lastMovedAt?: string | Date;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  assignedAt?: string | null;
  location?: {
    id: string;
    building?: string;
    floorNumber?: string;
    roomNumber?: string;
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  vendor?: { id: string; name: string };
  history?: AssetHistory[];
  tickets?: Ticket[];
  healthScore?: number;
  healthFactors?: { age: number; maintenance: number; usage: number; condition: number };
  rfidMovements?: Array<{
    id: string;
    eventType: string;
    fromZoneName?: string;
    toZoneName?: string;
    toZoneFloor?: string;
    toZoneIsExit?: boolean;
    rssi?: number;
    battery?: number;
    durationInPreviousZone?: number;
    timestamp: string;
  }>;
  rfidTag?: {
    tagId?: string;
    tagType?: string;
    status?: string;
    batteryLevel?: number;
    lastRssi?: number;
    lastSeenAt?: string;
    lastZone?: { name: string; floorNumber?: string };
  } | null;
};

type AssetHistory = {
  id: string;
  action: string;
  details?: any;
  createdAt: string;
  user: { email: string };
};

type Ticket = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  user?: { email: string };
  history?: any[];
};

interface AssetReportDetailedProps {
  assets: Asset[];
  isFullReport: boolean;
}

/* ── Section card wrapper (world-class) ─────────────────────────────────── */
const SectionCard = ({
  title,
  children,
  accent = 'indigo',
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  accent?: 'indigo' | 'emerald' | 'violet' | 'amber' | 'red';
  className?: string;
}) => {
  const borderClass =
    accent === 'indigo' ? 'border-indigo-200 print:border-indigo-300' :
    accent === 'emerald' ? 'border-emerald-200 print:border-emerald-300' :
    accent === 'violet' ? 'border-violet-200 print:border-violet-300' :
    accent === 'amber' ? 'border-amber-200 print:border-amber-300' :
    'border-red-200 print:border-red-300';
  const headerBg =
    accent === 'indigo' ? 'bg-indigo-50 print:bg-indigo-100' :
    accent === 'emerald' ? 'bg-emerald-50 print:bg-emerald-100' :
    accent === 'violet' ? 'bg-violet-50 print:bg-violet-100' :
    accent === 'amber' ? 'bg-amber-50 print:bg-amber-100' :
    'bg-red-50 print:bg-red-100';
  const titleColor =
    accent === 'indigo' ? 'text-indigo-800' :
    accent === 'emerald' ? 'text-emerald-800' :
    accent === 'violet' ? 'text-violet-800' :
    accent === 'amber' ? 'text-amber-800' :
    'text-red-800';
  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden print:shadow-none ${borderClass} ${className}`}>
      <div className={`px-5 py-3 border-b ${headerBg} ${borderClass}`}>
        <h2 className={`text-base font-bold uppercase tracking-wide ${titleColor}`}>{title}</h2>
      </div>
      <div className="p-5 bg-white">{children}</div>
    </div>
  );
};

/* ── Label / value row ─────────────────────────────────────────────────── */
const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">{children}</p>
);
const Value = ({ children, mono }: { children: React.ReactNode; mono?: boolean }) => (
  <p className={`text-sm font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>{children}</p>
);

export const AssetReportDetailed: React.FC<AssetReportDetailedProps> = ({ assets, isFullReport }) => {
  let assetsArray = Array.isArray(assets) ? assets : assets ? [assets] : [];
  assetsArray = assetsArray.map(asset => ({
    ...asset,
    history: Array.isArray(asset.history) ? asset.history : [],
    tickets: Array.isArray(asset.tickets) ? asset.tickets : [],
  }));

  if (!assetsArray.length) {
    return (
      <div className="p-8 max-w-5xl mx-auto print-content bg-white">
        <div
          className="rounded-t-xl px-6 py-5 mb-6 text-white"
          style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
        >
          <p className="text-[10px] uppercase tracking-widest opacity-90 mb-1">
            {isFullReport ? 'Asset Inventory Report' : 'Asset Detailed Report'}
          </p>
          <p className="text-slate-300 text-sm">Generated on {format(new Date(), 'PPP')}</p>
        </div>
        <div className="text-center py-12 text-slate-500">No asset data available for this report.</div>
      </div>
    );
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'PPP');
    } catch {
      return 'Invalid Date';
    }
  };

  const formatDetails = (details: any): string => {
    if (!details) return 'N/A';
    if (typeof details === 'string') return details;
    if (typeof details === 'object') {
      return Object.entries(details)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }
    return String(details);
  };

  const totalAssetValue = assetsArray.reduce((sum, asset) => sum + (asset.purchaseAmount || 0), 0);
  const assetsByType = isFullReport
    ? assetsArray.reduce((acc, asset) => {
        const type = asset.type || 'Uncategorized';
        if (!acc[type]) acc[type] = [];
        acc[type].push(asset);
        return acc;
      }, {} as Record<string, Asset[]>)
    : {};

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-slate-100 text-slate-700';
    switch (status.toUpperCase()) {
      case 'ACTIVE': return 'bg-emerald-100 text-emerald-800 print:bg-emerald-200';
      case 'IN_TRANSIT': return 'bg-amber-100 text-amber-800 print:bg-amber-200';
      case 'DISPOSED': return 'bg-red-100 text-red-800 print:bg-red-200';
      case 'MAINTENANCE': return 'bg-indigo-100 text-indigo-800 print:bg-indigo-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getPriorityColor = (priority?: string) => {
    if (!priority) return 'bg-slate-100 text-slate-700';
    switch (priority.toUpperCase()) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-amber-100 text-amber-800';
      case 'LOW': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getActionStyles = (action: string) => {
    const map: Record<string, { color: string; icon: string; label: string }> = {
      CREATED: { color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: '✚', label: 'ASSET CREATED' },
      UPDATED: { color: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: '✎', label: 'ASSET UPDATED' },
      MOVED: { color: 'bg-amber-100 text-amber-800 border-amber-300', icon: '↹', label: 'ASSET MOVED' },
      DISPOSED: { color: 'bg-red-100 text-red-800 border-red-300', icon: '✕', label: 'ASSET DISPOSED' },
      MAINTENANCE: { color: 'bg-violet-100 text-violet-800 border-violet-300', icon: '⚙', label: 'MAINTENANCE' },
      TICKET_CREATED: { color: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: '🎫', label: 'TICKET CREATED' },
    };
    return map[action] ?? { color: 'bg-slate-100 text-slate-800 border-slate-300', icon: '●', label: action };
  };

  const formatActionDetails = (record: AssetHistory) => {
    if (!record.details) return 'N/A';
    if (record.action === 'MOVED' && record.details) {
      return `From Floor ${record.details.fromFloor ?? 'N/A'}, Room ${record.details.fromRoom ?? 'N/A'} → Floor ${record.details.toFloor ?? 'N/A'}, Room ${record.details.toRoom ?? 'N/A'}`;
    }
    if (record.action === 'TICKET_CREATED' && record.details) {
      return `Ticket "${record.details.ticketTitle ?? ''}" created`;
    }
    if (record.action === 'DISPOSED' && record.details) {
      return `Reason: ${record.details.reason ?? 'Not specified'}`;
    }
    if (record.action === 'MAINTENANCE' && record.details) {
      return record.details.notes ?? 'Not specified';
    }
    if (record.action === 'UPDATED' && record.details && typeof record.details === 'object') {
      return `Updated: ${Object.keys(record.details).join(', ')}`;
    }
    return formatDetails(record.details);
  };

  const reportId = Math.random().toString(36).substring(2, 10).toUpperCase();

  const locationText = (asset: Asset) => {
    const loc = asset.location;
    if (!loc) return 'N/A';
    let t = '';
    if (loc.building || loc.floorNumber != null || loc.roomNumber != null) {
      t += `${loc.building || ''} · Floor ${loc.floorNumber ?? 'N/A'}, Room ${loc.roomNumber ?? 'N/A'}`;
    }
    if (loc.address) t += (t ? ' · ' : '') + loc.address;
    if (loc.latitude != null && loc.longitude != null && !loc.address) {
      t += (t ? ' · ' : '') + `GPS ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
    }
    return t || 'N/A';
  };

  return (
    <div className="p-6 max-w-5xl mx-auto print-content bg-white print:p-4">
      {/* ── Full report: inventory view ─────────────────────────────────── */}
      {isFullReport ? (
        <>
          <div
            className="rounded-t-xl px-6 py-5 mb-6 text-white flex justify-between items-start"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
          >
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-90 mb-1">Asset Inventory Report</p>
              <h1 className="text-2xl font-bold">Complete Asset Inventory</h1>
              <p className="text-white/80 text-sm mt-1">Generated {format(new Date(), 'PPP')} · Report ID: {reportId}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:grid-cols-3">
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-1">Total Assets</p>
              <p className="text-2xl font-black text-indigo-900">{assetsArray.length}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Total Value</p>
              <p className="text-2xl font-black text-emerald-900">QAR {totalAssetValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 mb-1">Categories</p>
              <p className="text-2xl font-black text-violet-900">{Object.keys(assetsByType).length}</p>
            </div>
          </div>

          {Object.keys(assetsByType).length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-2 mb-4">Assets by Category</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 print:grid-cols-2">
                {Object.entries(assetsByType).map(([type, list]) => (
                  <div key={type} className="rounded-xl border border-slate-200 p-4 bg-white">
                    <p className="font-semibold text-slate-900">{type}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Count: <span className="font-semibold text-slate-700">{list.length}</span>
                      {' · '}
                      Value: <span className="font-semibold text-slate-700">QAR {list.reduce((s, a) => s + (a.purchaseAmount || 0), 0).toLocaleString()}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <SectionCard title="Complete Asset Inventory" accent="indigo" className="mb-6">
            <div className="overflow-x-auto -mx-5 -mb-5">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Asset ID</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Name</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Type</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Location</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Value</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Purchase Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assetsArray.map((asset, i) => (
                    <tr key={asset.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-slate-900">{asset.assetId || asset.id}</td>
                      <td className="px-4 py-3 text-sm text-slate-900">{asset.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{asset.type || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{locationText(asset)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(asset.status)}`}>
                          {asset.status || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">QAR {asset.purchaseAmount?.toFixed(2) ?? 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{formatDate(asset.purchaseDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      ) : (
        /* ── Single asset: world-class hero + sections ───────────────────── */
        <>
          {assetsArray.map((asset) => (
            <div key={asset.id} className="mb-8">
              {/* Hero header (matches previous world-class inline report) */}
              <div
                className="rounded-t-xl px-6 py-5 mb-5 flex flex-wrap justify-between items-start gap-4 text-white"
                style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-widest opacity-90 mb-1">Asset Report</p>
                  <h1 className="text-2xl font-bold truncate">{asset.name}</h1>
                  <p className="text-white/80 text-sm mt-1">
                    ID: {asset.assetId || asset.id} · Generated {format(new Date(), 'PP')}
                  </p>
                </div>
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-white/95 text-slate-800 print:bg-white print:text-slate-800 print:border print:border-slate-300">
                  {asset.status || 'Unknown'}
                </span>
              </div>

              {/* Asset info + optional image */}
              <div className={`grid gap-4 mb-5 ${asset.imageUrl ? 'grid-cols-[180px_1fr]' : 'grid-cols-1'} print:grid-cols-1`}>
                {asset.imageUrl && (
                  <img
                    src={asset.imageUrl}
                    alt=""
                    className="w-[180px] h-[180px] object-cover rounded-xl border border-slate-200 print:w-24 print:h-24"
                  />
                )}
                <SectionCard title="Asset Information" accent="indigo">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 print:grid-cols-2">
                    <div><Label>Asset ID</Label><Value mono>{asset.assetId || asset.id}</Value></div>
                    <div><Label>Name</Label><Value>{asset.name || 'N/A'}</Value></div>
                    <div><Label>Type</Label><Value>{asset.type || 'N/A'}</Value></div>
                    <div><Label>Status</Label>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(asset.status)}`}>
                        {asset.status || 'Unknown'}
                      </span>
                    </div>
                    <div><Label>Location</Label><Value>{locationText(asset)}</Value></div>
                    <div><Label>Vendor</Label><Value>{asset.vendor?.name || 'N/A'}</Value></div>
                    <div><Label>Purchase Amount</Label><Value>QAR {asset.purchaseAmount?.toFixed(2) ?? 'N/A'}</Value></div>
                    <div><Label>Purchase Date</Label><Value>{formatDate(asset.purchaseDate)}</Value></div>
                  </div>
                  {asset.description && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <Label>Description</Label>
                      <p className="text-sm text-slate-700 mt-0.5">{asset.description}</p>
                    </div>
                  )}
                </SectionCard>
              </div>

              {/* Assignment (green highlight when assigned) */}
              <div className={`rounded-xl border p-4 mb-5 ${asset.assignedToName ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 border-dashed'}`}>
                <Label>Assigned To</Label>
                {asset.assignedToName ? (
                  <div className="mt-1">
                    <p className="font-bold text-emerald-800">{asset.assignedToName}</p>
                    {asset.assignedToEmail && <p className="text-sm text-emerald-700">{asset.assignedToEmail}</p>}
                    {asset.assignedAt && <p className="text-xs text-slate-500 mt-0.5">Since {formatDate(asset.assignedAt)}</p>}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-sm mt-0.5">Not assigned</p>
                )}
              </div>

              {/* Health */}
              <div className="mb-5">
                <SectionCard title="Asset Health" accent="violet">
                  {asset.healthScore !== undefined && asset.healthScore >= 0 ? (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-semibold text-slate-700">Health Score</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                          asset.healthScore >= 80 ? 'bg-emerald-100 text-emerald-800' :
                          asset.healthScore >= 60 ? 'bg-indigo-100 text-indigo-800' :
                          asset.healthScore >= 40 ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {asset.healthScore}% — {
                            asset.healthScore >= 80 ? 'Excellent' :
                            asset.healthScore >= 60 ? 'Good' :
                            asset.healthScore >= 40 ? 'Fair' : 'Poor'
                          }
                        </span>
                      </div>
                      <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            asset.healthScore >= 80 ? 'bg-emerald-500' :
                            asset.healthScore >= 60 ? 'bg-indigo-500' :
                            asset.healthScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${asset.healthScore}%` }}
                        />
                      </div>
                      {asset.healthFactors && typeof asset.healthFactors === 'object' && (
                        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                          {(['age', 'maintenance', 'usage', 'condition'] as const).map((k) => {
                            const v = asset.healthFactors![k];
                            const num = typeof v === 'number' ? v : 0;
                            return (
                              <div key={k}>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{k}</p>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${num}%` }} />
                                  </div>
                                  <span className="text-xs font-semibold text-slate-700 w-8 text-right">{num}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-500 text-sm">No health data available.</p>
                  )}
                </SectionCard>
              </div>

              {/* History timeline */}
              <div className="mb-5">
                <SectionCard title="Asset History" accent="indigo">
                  {asset.history && asset.history.length > 0 ? (
                    <div className="relative pl-8">
                      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200" />
                      <div className="space-y-4">
                        {asset.history.map((record) => {
                          const st = getActionStyles(record.action);
                          return (
                            <div key={record.id} className="relative flex gap-4">
                              <div className={`absolute left-0 w-6 h-6 -ml-8 rounded-full border-2 flex items-center justify-center text-xs ${st.color}`}>
                                {st.icon}
                              </div>
                              <div className="flex-1 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                                <div className="flex flex-wrap justify-between items-start gap-2">
                                  <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${st.color}`}>{st.label}</span>
                                  <span className="text-[10px] text-slate-500">{formatDate(record.createdAt)}</span>
                                </div>
                                <p className="text-xs text-slate-600 mt-1">{formatActionDetails(record)}</p>
                                {record.user?.email && <p className="text-[10px] text-slate-400 mt-0.5">By: {record.user.email}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">No history records.</p>
                  )}
                </SectionCard>
              </div>

              {/* Tickets */}
              <div className="mb-5">
                <SectionCard title="Asset Tickets" accent="indigo">
                  {asset.tickets && asset.tickets.length > 0 ? (
                    <div className="overflow-x-auto -mx-5 -mb-5">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Title</th>
                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Priority</th>
                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {asset.tickets.map((t, i) => (
                            <tr key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="px-4 py-2 text-sm font-medium text-slate-900">{t.title}</td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(t.status)}`}>{t.status}</span>
                              </td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getPriorityColor(t.priority)}`}>{t.priority}</span>
                              </td>
                              <td className="px-4 py-2 text-sm text-slate-700">{formatDate(t.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">No tickets for this asset.</p>
                  )}
                </SectionCard>
              </div>

              {/* RFID Movement History */}
              {asset.rfidMovements && asset.rfidMovements.length > 0 && (
                <div className="mb-5">
                  <SectionCard title="RFID Movement History" accent="indigo">
                    {asset.rfidTag && (
                      <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                        <span className="text-xs font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {asset.rfidTag.tagId}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Status: {asset.rfidTag.status?.replace('_', ' ')} · Battery: {asset.rfidTag.batteryLevel ?? '—'}% · Last zone: {asset.rfidTag.lastZone?.name ?? '—'}
                        </span>
                      </div>
                    )}
                    <div className="overflow-x-auto -mx-5 -mb-5">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Time</th>
                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Event</th>
                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">From → To</th>
                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">RSSI</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(asset.rfidMovements ?? []).slice(0, 20).map((mv, idx) => {
                            const isExit = mv.eventType === 'ENTERPRISE_EXIT' || mv.toZoneIsExit;
                            return (
                              <tr key={mv.id} className={isExit ? 'bg-red-50/70' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                <td className="px-4 py-2 text-xs text-slate-700 whitespace-nowrap">
                                  {new Date(mv.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-4 py-2">
                                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isExit ? 'bg-red-100 text-red-800' :
                                    mv.eventType === 'ZONE_ENTRY' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                                  }`}>
                                    {mv.eventType === 'ENTERPRISE_EXIT' ? 'EXIT' : mv.eventType === 'ZONE_MOVE' ? 'MOVE' : mv.eventType === 'ZONE_ENTRY' ? 'ENTRY' : mv.eventType}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-xs text-slate-700">
                                  {mv.fromZoneName || '—'} → <span className={isExit ? 'font-semibold text-red-700' : ''}>{mv.toZoneName || '—'}</span>
                                  {isExit && ' ⚠'}
                                </td>
                                <td className="px-4 py-2 text-xs text-slate-600">{mv.rssi != null ? `${mv.rssi} dBm` : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {(asset.rfidMovements?.length ?? 0) > 20 && (
                      <p className="text-[10px] text-slate-500 mt-2">Showing 20 of {asset.rfidMovements!.length} events</p>
                    )}
                  </SectionCard>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      <ComplianceFooter reportId={reportId} complianceStandards={['ISO 27001', 'GDPR', 'SOC2', 'ISO 9001']} />

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4; margin: 1.5cm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          table { border-collapse: collapse; }
          th, td { border: 1px solid #e2e8f0; }
          .asset-card, .history-item, tr { page-break-inside: avoid; }
          h2, h3 { page-break-after: avoid; }
        }
      `}</style>
    </div>
  );
};
