import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/contexts/TranslationContext";
import { calculateDepreciation, USEFUL_LIFE_BY_TYPE, SALVAGE_RATE } from "@/lib/depreciation";

interface Asset {
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
    id?: string;
    building?: string;
    floorNumber?: string;
    roomNumber?: string;
  };
  vendor?: {
    id?: string;
    name: string;
  };
  floorNumber?: string;
  roomNumber?: string;
}

interface PrintAssetReportButtonProps {
  asset: Asset;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}

/* ── Shared CSS for the self-contained print document ─────────────────────── */
const PRINT_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;color:#0f172a;background:#fff;padding:0;font-size:13px;line-height:1.5}
  @page{size:A4;margin:14mm}
  @media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}

  /* Hero */
  .hero{background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);color:#fff;padding:22px 26px;border-radius:12px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-start}
  .hero-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;opacity:.75;margin-bottom:5px}
  .hero-title{font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1.15}
  .hero-meta{font-size:11px;opacity:.65;margin-top:6px}
  .hero-right{text-align:right;flex-shrink:0}
  .hero-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:999px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);font-size:10px;font-weight:700;color:#fff}
  .hero-id{font-size:10px;opacity:.5;font-family:monospace;margin-top:5px}
  .status-pill{display:inline-flex;padding:4px 12px;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;background:rgba(255,255,255,.95);color:#1e293b;margin-top:8px}

  /* Layout */
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
  .image-info{display:grid;gap:14px;margin-bottom:14px}

  /* Section card */
  .card{border-radius:10px;border:1px solid #e2e8f0;margin-bottom:14px;overflow:hidden;page-break-inside:avoid}
  .card-hdr{padding:9px 14px;border-bottom:1px solid;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em}
  .card-body{padding:14px;background:#fff}

  /* Info grid */
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:2px}
  .val{font-size:13px;font-weight:600;color:#0f172a}
  .mono{font-family:monospace}
  .desc-area{margin-top:10px;padding-top:10px;border-top:1px solid #f1f5f9}

  /* Assignment */
  .assign{border-radius:8px;padding:12px 14px;margin-bottom:14px;border:1px solid}
  .assign-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:4px}
  .assign-name{font-size:14px;font-weight:700;color:#065f46}
  .assign-email{font-size:11px;color:#047857;margin-top:2px}
  .assign-since{font-size:10px;color:#94a3b8;margin-top:3px}
  .assign-none{font-size:12px;color:#94a3b8;font-style:italic}

  /* Badge */
  .badge{display:inline-flex;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700}

  /* Health */
  .health-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
  .hbar-bg{height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-bottom:14px}
  .hbar-fill{height:8px;border-radius:999px}
  .factor-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .factor-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:4px}
  .fbar-row{display:flex;align-items:center;gap:8px}
  .fbar-bg{flex:1;height:4px;background:#e2e8f0;border-radius:999px;overflow:hidden}
  .fbar-fill{height:4px;border-radius:999px}
  .fbar-pct{font-size:11px;font-weight:700;color:#334155;min-width:28px;text-align:right}

  /* Timeline */
  .timeline{position:relative;padding-left:34px}
  .timeline::before{content:'';position:absolute;left:10px;top:0;bottom:0;width:2px;background:#e2e8f0}
  .tl-item{position:relative;margin-bottom:12px;page-break-inside:avoid}
  .tl-dot{position:absolute;left:-34px;width:22px;height:22px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;font-size:10px;background:#fff;z-index:1}
  .tl-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:9px 11px}
  .tl-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px}
  .tl-action{display:inline-flex;padding:2px 8px;border-radius:999px;font-size:9px;font-weight:800;text-transform:uppercase}
  .tl-date{font-size:9px;color:#94a3b8}
  .tl-by{font-size:9px;color:#94a3b8;margin-top:3px}
  .tl-details{font-size:11px;color:#334155;margin-top:5px;border-top:1px solid #e2e8f0;padding-top:5px}

  /* Tables */
  table{width:100%;border-collapse:collapse}
  thead tr{background:#f1f5f9}
  th{padding:7px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;border-bottom:2px solid #e2e8f0;text-align:left}
  td{padding:7px 10px;font-size:12px;color:#1e293b;border-bottom:1px solid #f1f5f9;vertical-align:top}
  tr:nth-child(even) td{background:#f8fafc}

  /* RFID exit row */
  .rfid-exit td{background:#fef2f2!important}

  /* Compliance footer */
  .compliance{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:11px 13px;margin-top:18px}
  .comp-title{font-size:9px;font-weight:800;color:#1e40af;margin-bottom:5px;text-transform:uppercase;letter-spacing:.08em}
  .comp-badges{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:5px}
  .comp-badge{padding:2px 7px;border-radius:999px;font-size:9px;font-weight:700;background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe}
  .comp-note{font-size:10px;color:#3730a3}
  .footer{display:flex;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8}

  /* Empty state */
  .empty{background:#f8fafc;border-radius:8px;padding:14px;text-align:center;color:#94a3b8;font-size:12px}

  /* Asset image */
  .asset-img{width:160px;height:160px;object-fit:cover;border-radius:10px;border:1px solid #e2e8f0;flex-shrink:0}

  /* Depreciation */
  .dep-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
  .dep-kpi-item{border-radius:8px;padding:10px 12px;border:1px solid}
  .dep-kpi-lbl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px}
  .dep-kpi-val{font-size:14px;font-weight:900;line-height:1.1}
  .dep-kpi-sub{font-size:9px;margin-top:2px;opacity:.7}
  .dep-bar-bg{height:14px;background:#f1f5f9;border-radius:999px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:3px}
  .dep-bar-fill{height:100%;border-radius:999px}
  .dep-meta{display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;margin-bottom:14px}
  .dep-cond{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:8px;border:1px solid;margin-bottom:12px}
  .dep-cond-label{font-size:11px;font-weight:900}
  .dep-insights{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px}
  .dep-insight{background:#f8fafc;border-radius:6px;padding:8px 10px;border:1px solid #e2e8f0}
  .dep-insight-lbl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:2px}
  .dep-insight-val{font-size:12px;font-weight:700;color:#0f172a}
  .dep-method-cmp{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
  .dep-method{border-radius:6px;padding:8px 10px;border:1px solid}
  .dep-method-name{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
  .dep-method-bv{font-size:12px;font-weight:900}
  .dep-method-acc{font-size:9px;opacity:.7}
`;

/* ── HTML generator — no React/Tailwind dependency ─────────────────────────── */
function generateReportHTML(asset: any, opts: {
  history: any[];
  tickets: any[];
  rfidMovements: any[];
  rfidTag: any;
  healthScore: number;
  healthFactors: { age: number; maintenance: number; usage: number; condition: number };
  depreciation: ReturnType<typeof calculateDepreciation> | null;
}): string {
  const { history, tickets, rfidMovements, rfidTag, healthScore, healthFactors, depreciation } = opts;

  const reportId = `AR-${Date.now().toString(36).toUpperCase().slice(-8)}`;
  const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const fmtDate = (d?: string | Date | null) => {
    if (!d) return 'N/A';
    try { return new Date(d as string).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return 'N/A'; }
  };

  /* ── Status badge ─────────────────────────────────────────────────────── */
  const statusBadge = (s?: string) => {
    const styles: Record<string, string> = {
      ACTIVE: 'background:#dcfce7;color:#166534',
      IN_TRANSIT: 'background:#fef3c7;color:#92400e',
      DISPOSED: 'background:#fee2e2;color:#991b1b',
      MAINTENANCE: 'background:#ede9fe;color:#5b21b6',
      AVAILABLE: 'background:#dcfce7;color:#166534',
      RENTED: 'background:#dbeafe;color:#1e40af',
    };
    const st = s?.toUpperCase() ?? '';
    return `<span class="badge" style="${styles[st] ?? 'background:#f1f5f9;color:#64748b'}">${s ?? 'Unknown'}</span>`;
  };

  const priorityBadge = (p?: string) => {
    const styles: Record<string, string> = {
      HIGH: 'background:#fee2e2;color:#991b1b',
      MEDIUM: 'background:#fef3c7;color:#92400e',
      LOW: 'background:#dcfce7;color:#166534',
      CRITICAL: 'background:#fce7f3;color:#831843',
    };
    const pt = p?.toUpperCase() ?? '';
    return `<span class="badge" style="${styles[pt] ?? 'background:#f1f5f9;color:#64748b'}">${p ?? '—'}</span>`;
  };

  /* ── Location string ──────────────────────────────────────────────────── */
  const loc = asset.location
    ? [asset.location.building, asset.location.floorNumber ? `Floor ${asset.location.floorNumber}` : null, asset.location.roomNumber ? `Rm ${asset.location.roomNumber}` : null].filter(Boolean).join(' · ')
    : asset.floorNumber ? `Floor ${asset.floorNumber}${asset.roomNumber ? ` · Rm ${asset.roomNumber}` : ''}` : 'N/A';

  /* ── Asset info section ───────────────────────────────────────────────── */
  const infoHTML = `
    <div class="card">
      <div class="card-hdr" style="background:#eef2ff;border-color:#c7d2fe;color:#3730a3">Asset Information</div>
      <div class="card-body">
        <div style="display:flex;gap:14px;align-items:flex-start">
          ${asset.imageUrl ? `<img class="asset-img" src="${asset.imageUrl}" alt="" onerror="this.style.display='none'">` : ''}
          <div class="info-grid" style="flex:1">
            <div><div class="lbl">Asset ID</div><div class="val mono">${asset.assetId || asset.id}</div></div>
            <div><div class="lbl">Name</div><div class="val">${asset.name || 'N/A'}</div></div>
            <div><div class="lbl">Type</div><div class="val">${asset.type || 'N/A'}</div></div>
            <div><div class="lbl">Status</div><div class="val">${statusBadge(asset.status)}</div></div>
            <div><div class="lbl">Location</div><div class="val">${loc || 'N/A'}</div></div>
            <div><div class="lbl">Vendor</div><div class="val">${asset.vendor?.name || 'N/A'}</div></div>
            <div><div class="lbl">Purchase Amount</div><div class="val">QAR ${asset.purchaseAmount != null ? Number(asset.purchaseAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'N/A'}</div></div>
            <div><div class="lbl">Purchase Date</div><div class="val">${fmtDate(asset.purchaseDate)}</div></div>
            ${asset.barcode ? `<div><div class="lbl">Barcode</div><div class="val mono">${asset.barcode}</div></div>` : ''}
            ${asset.lastMovedAt ? `<div><div class="lbl">Last Activity</div><div class="val">${fmtDate(asset.lastMovedAt as string)}</div></div>` : ''}
          </div>
        </div>
        ${asset.description ? `<div class="desc-area"><div class="lbl">Description</div><div style="font-size:12px;color:#334155;margin-top:2px">${asset.description}</div></div>` : ''}
      </div>
    </div>`;

  /* ── Assignment section ───────────────────────────────────────────────── */
  const assignHTML = asset.assignedToName
    ? `<div class="assign" style="background:#f0fdf4;border-color:#bbf7d0">
         <div class="assign-lbl">Assigned To</div>
         <div class="assign-name">${asset.assignedToName}</div>
         ${asset.assignedToEmail ? `<div class="assign-email">${asset.assignedToEmail}</div>` : ''}
         ${asset.assignedAt ? `<div class="assign-since">Since ${fmtDate(asset.assignedAt)}</div>` : ''}
       </div>`
    : `<div class="assign" style="background:#f8fafc;border-color:#e2e8f0;border-style:dashed">
         <div class="assign-lbl">Assigned To</div>
         <div class="assign-none">Not assigned to anyone</div>
       </div>`;

  /* ── Health section ───────────────────────────────────────────────────── */
  let healthHTML = '';
  if (healthScore > 0) {
    const hColor = healthScore >= 80 ? '#059669' : healthScore >= 60 ? '#3b82f6' : healthScore >= 40 ? '#f59e0b' : '#ef4444';
    const hLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : healthScore >= 40 ? 'Fair' : 'Poor';
    const hBadgeSt = healthScore >= 80 ? 'background:#dcfce7;color:#166534' : healthScore >= 60 ? 'background:#dbeafe;color:#1e40af' : healthScore >= 40 ? 'background:#fef3c7;color:#92400e' : 'background:#fee2e2;color:#991b1b';

    const factors = [
      { label: 'Age',         key: 'age',         color: '#3b82f6' },
      { label: 'Maintenance', key: 'maintenance',  color: '#8b5cf6' },
      { label: 'Usage',       key: 'usage',        color: '#10b981' },
      { label: 'Condition',   key: 'condition',    color: '#f59e0b' },
    ];
    const factorsHTML = healthFactors && typeof healthFactors === 'object'
      ? `<div class="factor-grid">${factors.map(f => {
          const v = typeof (healthFactors as any)[f.key] === 'number' ? (healthFactors as any)[f.key] : 0;
          return `<div>
            <div class="factor-lbl">${f.label}</div>
            <div class="fbar-row">
              <div class="fbar-bg"><div class="fbar-fill" style="width:${v}%;background:${f.color}"></div></div>
              <span class="fbar-pct">${v}%</span>
            </div>
          </div>`;
        }).join('')}</div>` : '';

    healthHTML = `
      <div class="card">
        <div class="card-hdr" style="background:#faf5ff;border-color:#e9d5ff;color:#6b21a8">Asset Health Score</div>
        <div class="card-body">
          <div class="health-row">
            <span style="font-size:13px;font-weight:600;color:#1e293b">Overall Health</span>
            <span class="badge" style="${hBadgeSt};padding:4px 12px;font-size:11px">${healthScore}% — ${hLabel}</span>
          </div>
          <div class="hbar-bg"><div class="hbar-fill" style="width:${healthScore}%;background:${hColor}"></div></div>
          ${factorsHTML}
        </div>
      </div>`;
  }

  /* ── Depreciation section ─────────────────────────────────────────────── */
  let depreciationHTML = '';
  if (depreciation) {
    const dep = depreciation;
    const depPct = Math.min(dep.depreciationPercent, 100);
    const barColor = depPct > 75 ? '#ef4444' : depPct > 50 ? '#f97316' : depPct > 25 ? '#f59e0b' : '#8b5cf6';
    const condBg    = dep.condition === 'EXCELLENT' ? '#dcfce7' : dep.condition === 'GOOD' ? '#dbeafe' : dep.condition === 'FAIR' ? '#fef3c7' : dep.condition === 'POOR' ? '#ffedd5' : '#fee2e2';
    const condColor = dep.condition === 'EXCELLENT' ? '#166534' : dep.condition === 'GOOD' ? '#1e40af' : dep.condition === 'FAIR' ? '#92400e' : dep.condition === 'POOR' ? '#9a3412' : '#991b1b';
    const condBorder = dep.condition === 'EXCELLENT' ? '#86efac' : dep.condition === 'GOOD' ? '#93c5fd' : dep.condition === 'FAIR' ? '#fde047' : dep.condition === 'POOR' ? '#fdba74' : '#fca5a5';
    const replDate  = dep.recommendedReplacement.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

    const scheduleRows = dep.schedule.map((row: any) => {
      const isCurrent = row.year === dep.ageYearsInt + 1;
      const isPast    = row.year <= dep.ageYearsInt;
      const bg = isCurrent ? 'background:#ede9fe' : isPast ? 'background:#f8fafc' : 'background:#fff';
      const fontW = isCurrent ? '700' : '400';
      return `<tr style="${bg}">
        <td style="font-weight:${fontW};color:${isCurrent ? '#6d28d9' : '#334155'};font-size:11px">${isCurrent ? '▶ ' : ''}Y${row.year} (${row.calendarYear})</td>
        <td style="font-family:monospace;font-size:11px">QAR ${fmt(row.openingBookValue)}</td>
        <td style="font-family:monospace;font-size:11px;color:#dc2626;font-weight:600">QAR ${fmt(row.depreciation)}</td>
        <td style="font-family:monospace;font-size:11px">QAR ${fmt(row.accumulatedDepreciation)}</td>
        <td style="font-family:monospace;font-size:11px;color:#059669;font-weight:600">QAR ${fmt(row.closingBookValue)}</td>
        <td style="font-size:11px;font-weight:700">${row.percentDepreciated.toFixed(0)}%</td>
      </tr>`;
    }).join('');

    depreciationHTML = `
    <div class="card" style="break-inside:avoid">
      <div class="card-hdr" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-color:#4338ca;padding:10px 16px">
        ◆ &nbsp;AI Depreciation &amp; Valuation Analysis &nbsp;·&nbsp; IAS 16 / IFRS Compliant &nbsp;·&nbsp; Straight-Line Method
      </div>
      <div class="card-body">

        <!-- KPI row -->
        <div class="dep-kpi">
          <div class="dep-kpi-item" style="background:#eef2ff;border-color:#c7d2fe">
            <div class="dep-kpi-lbl" style="color:#6366f1">Purchase Cost</div>
            <div class="dep-kpi-val" style="color:#312e81">QAR ${fmt(dep.cost)}</div>
            <div class="dep-kpi-sub" style="color:#818cf8">${fmtDate(dep.purchaseDate)}</div>
          </div>
          <div class="dep-kpi-item" style="background:#fdf2f8;border-color:#fbcfe8">
            <div class="dep-kpi-lbl" style="color:#be185d">Current Book Value</div>
            <div class="dep-kpi-val" style="color:#831843">QAR ${fmt(dep.currentBookValue)}</div>
            <div class="dep-kpi-sub" style="color:#f472b6">${depPct.toFixed(1)}% depreciated</div>
          </div>
          <div class="dep-kpi-item" style="background:#fff7ed;border-color:#fed7aa">
            <div class="dep-kpi-lbl" style="color:#c2410c">Depreciation To Date</div>
            <div class="dep-kpi-val" style="color:#7c2d12">QAR ${fmt(dep.accumulatedDepreciation)}</div>
            <div class="dep-kpi-sub" style="color:#fb923c">QAR ${fmt(dep.annualDepreciation)}/yr</div>
          </div>
          <div class="dep-kpi-item" style="background:#f0fdf4;border-color:#bbf7d0">
            <div class="dep-kpi-lbl" style="color:#15803d">Remaining Life</div>
            <div class="dep-kpi-val" style="color:#14532d">${dep.remainingLife.toFixed(1)} yrs</div>
            <div class="dep-kpi-sub" style="color:#4ade80">Replace by ${replDate}</div>
          </div>
        </div>

        <!-- Decay bar -->
        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;font-size:9px;font-weight:700;color:#64748b;margin-bottom:4px">
            <span>Value Decay — ${dep.ageYears.toFixed(1)} of ${dep.usefulLifeYears} years elapsed (${dep.depreciationRate.toFixed(1)}%/yr)</span>
            <span>${depPct.toFixed(1)}% depreciated</span>
          </div>
          <div class="dep-bar-bg"><div class="dep-bar-fill" style="width:${depPct}%;background:${barColor}"></div></div>
          <div class="dep-meta">
            <span>Original: QAR ${fmt(dep.cost)}</span>
            <span>Book Value: QAR ${fmt(dep.currentBookValue)}</span>
            <span>Salvage: QAR ${fmt(dep.salvageValue)}</span>
          </div>
        </div>

        <!-- Condition badge + insights -->
        <div class="dep-cond" style="background:${condBg};border-color:${condBorder}">
          <span class="dep-cond-label" style="color:${condColor}">${dep.condition} CONDITION</span>
          <span style="font-size:9px;color:${condColor};opacity:.7">AI Score: ${dep.conditionScore}/100</span>
        </div>

        <div class="dep-insights">
          <div class="dep-insight">
            <div class="dep-insight-lbl">Annual Depreciation Rate</div>
            <div class="dep-insight-val">${dep.depreciationRate.toFixed(1)}% per year &nbsp;|&nbsp; QAR ${fmt(dep.annualDepreciation)}/yr</div>
          </div>
          <div class="dep-insight">
            <div class="dep-insight-lbl">Salvage / Residual Value</div>
            <div class="dep-insight-val">QAR ${fmt(dep.salvageValue)} &nbsp;(${(SALVAGE_RATE * 100).toFixed(0)}% of cost)</div>
          </div>
          <div class="dep-insight">
            <div class="dep-insight-lbl">Replacement Budget (est.)</div>
            <div class="dep-insight-val">QAR ${fmt(dep.replacementBudget)} &nbsp;<span style="font-size:9px;font-weight:400;color:#64748b">3% p.a. inflation</span></div>
          </div>
          <div class="dep-insight">
            <div class="dep-insight-lbl">Useful Life Configured</div>
            <div class="dep-insight-val">${dep.usefulLifeYears} years &nbsp;·&nbsp; ${dep.ageYearsInt} years elapsed</div>
          </div>
        </div>

        <!-- Annual schedule table -->
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6d28d9;margin-bottom:6px">Annual Depreciation Schedule</div>
        <table>
          <thead><tr style="background:#ede9fe">
            <th style="color:#5b21b6">Year</th>
            <th style="color:#5b21b6">Opening Value</th>
            <th style="color:#5b21b6">Annual Dep.</th>
            <th style="color:#5b21b6">Accumulated</th>
            <th style="color:#5b21b6">Closing Value</th>
            <th style="color:#5b21b6">Dep. %</th>
          </tr></thead>
          <tbody>${scheduleRows}</tbody>
        </table>

        <!-- 3-method comparison -->
        <div style="margin-top:12px">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#475569;margin-bottom:6px">Multi-Method Comparison (Current Book Value)</div>
          <div class="dep-method-cmp">
            <div class="dep-method" style="background:#eef2ff;border-color:#c7d2fe">
              <div class="dep-method-name" style="color:#6366f1">Straight-Line (SL)</div>
              <div class="dep-method-bv" style="color:#312e81">QAR ${fmt(dep.comparison.sl.bookValue)}</div>
              <div class="dep-method-acc" style="color:#6366f1">Accum.: QAR ${fmt(dep.comparison.sl.accumulatedDepreciation)}</div>
            </div>
            <div class="dep-method" style="background:#fff1f2;border-color:#fecdd3">
              <div class="dep-method-name" style="color:#e11d48">Double Declining (DDB)</div>
              <div class="dep-method-bv" style="color:#881337">QAR ${fmt(dep.comparison.ddb.bookValue)}</div>
              <div class="dep-method-acc" style="color:#e11d48">Accum.: QAR ${fmt(dep.comparison.ddb.accumulatedDepreciation)}</div>
            </div>
            <div class="dep-method" style="background:#fffbeb;border-color:#fde68a">
              <div class="dep-method-name" style="color:#d97706">Sum-of-Years' Digits (SYD)</div>
              <div class="dep-method-bv" style="color:#78350f">QAR ${fmt(dep.comparison.syd.bookValue)}</div>
              <div class="dep-method-acc" style="color:#d97706">Accum.: QAR ${fmt(dep.comparison.syd.accumulatedDepreciation)}</div>
            </div>
          </div>
        </div>

      </div>
    </div>`;
  }

  /* ── History timeline ─────────────────────────────────────────────────── */
  const actionMap: Record<string, { dot: string; action: string; icon: string }> = {
    CREATED:        { dot: 'border-color:#86efac;color:#166534', action: 'background:#dcfce7;color:#166534', icon: '✚' },
    UPDATED:        { dot: 'border-color:#93c5fd;color:#1e40af', action: 'background:#dbeafe;color:#1e40af', icon: '✎' },
    MOVED:          { dot: 'border-color:#fde047;color:#854d0e', action: 'background:#fef9c3;color:#854d0e', icon: '↹' },
    DISPOSED:       { dot: 'border-color:#fca5a5;color:#991b1b', action: 'background:#fee2e2;color:#991b1b', icon: '✕' },
    MAINTENANCE:    { dot: 'border-color:#d8b4fe;color:#6b21a8', action: 'background:#f3e8ff;color:#6b21a8', icon: '⚙' },
    TICKET_CREATED: { dot: 'border-color:#a5b4fc;color:#3730a3', action: 'background:#e0e7ff;color:#3730a3', icon: '🎫' },
    AUDIT_COMMENT:  { dot: 'border-color:#818cf8;color:#3730a3', action: 'background:#e0e7ff;color:#3730a3', icon: '💬' },
  };

  let historyHTML = '';
  if (history.length > 0) {
    const rows = history.slice(0, 20).map((rec: any) => {
      const a = actionMap[rec.action] ?? { dot: 'border-color:#e2e8f0;color:#64748b', action: 'background:#f1f5f9;color:#64748b', icon: '●' };
      const label = rec.action === 'TICKET_CREATED' ? 'TICKET CREATED' : rec.action?.replace(/_/g, ' ') ?? 'EVENT';

      let details = '';
      if (rec.action === 'MOVED' && rec.details) {
        details = `From Floor ${rec.details.fromFloor ?? 'N/A'}, Room ${rec.details.fromRoom ?? 'N/A'} → Floor ${rec.details.toFloor ?? 'N/A'}, Room ${rec.details.toRoom ?? 'N/A'}`;
      } else if (rec.action === 'TICKET_CREATED' && rec.details?.ticketTitle) {
        details = `Ticket "${rec.details.ticketTitle}" created`;
      } else if (rec.action === 'DISPOSED' && rec.details?.reason) {
        details = `Reason: ${rec.details.reason}`;
      } else if (rec.action === 'MAINTENANCE' && rec.details?.notes) {
        details = rec.details.notes;
      } else if (rec.action === 'AUDIT_COMMENT' && rec.details) {
        const d = rec.details;
        details = (d.comment || '').trim();
        if (d.imageUrl) details += ` [Photo attached]`;
      } else if (rec.action === 'UPDATED' && rec.details && typeof rec.details === 'object') {
        details = `Updated: ${Object.keys(rec.details).join(', ')}`;
      } else if (rec.details && typeof rec.details === 'string') {
        details = rec.details;
      }

      const labelText = rec.action === 'AUDIT_COMMENT' ? 'AUDIT COMMENT' : (rec.action === 'TICKET_CREATED' ? 'TICKET CREATED' : rec.action?.replace(/_/g, ' ') ?? 'EVENT');

      return `
        <div class="tl-item">
          <div class="tl-dot" style="${a.dot}">${a.icon}</div>
          <div class="tl-card">
            <div class="tl-top">
              <span class="tl-action" style="${a.action}">${labelText}</span>
              <span class="tl-date">${fmtDate(rec.createdAt)}</span>
            </div>
            ${details ? `<div class="tl-details">${details}</div>` : ''}
            ${rec.details?.imageUrl ? `<div class="tl-details" style="margin-top:6px"><img src="${rec.details.imageUrl}" alt="Audit photo" style="max-width:100%;max-height:200px;object-fit:contain;border-radius:8px;border:1px solid #e2e8f0" /></div>` : ''}
            ${rec.user?.email ? `<div class="tl-by">By: ${rec.user.email}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    historyHTML = `
      <div class="card">
        <div class="card-hdr" style="background:#f0f9ff;border-color:#bae6fd;color:#0369a1">Asset History (${history.length} events)</div>
        <div class="card-body">
          <div class="timeline">${rows}</div>
          ${history.length > 20 ? `<p style="font-size:10px;color:#94a3b8;margin-top:8px;text-align:center">Showing 20 of ${history.length} events</p>` : ''}
        </div>
      </div>`;
  } else {
    historyHTML = `
      <div class="card">
        <div class="card-hdr" style="background:#f0f9ff;border-color:#bae6fd;color:#0369a1">Asset History</div>
        <div class="card-body"><div class="empty">No history records for this asset.</div></div>
      </div>`;
  }

  /* ── Tickets table ────────────────────────────────────────────────────── */
  let ticketsHTML = '';
  if (Array.isArray(tickets) && tickets.length > 0) {
    const rows = tickets.map((t: any) => `
      <tr>
        <td style="font-weight:600">${t.title || 'N/A'}</td>
        <td>${statusBadge(t.status)}</td>
        <td>${priorityBadge(t.priority)}</td>
        <td>${fmtDate(t.createdAt)}</td>
        <td style="font-size:11px;color:#64748b">${t.user?.email || 'Unassigned'}</td>
      </tr>`).join('');

    ticketsHTML = `
      <div class="card">
        <div class="card-hdr" style="background:#faf5ff;border-color:#e9d5ff;color:#6b21a8">Asset Tickets (${tickets.length})</div>
        <div class="card-body" style="padding:0">
          <table>
            <thead><tr><th>Title</th><th>Status</th><th>Priority</th><th>Created</th><th>Raised By</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  } else {
    ticketsHTML = `
      <div class="card">
        <div class="card-hdr" style="background:#faf5ff;border-color:#e9d5ff;color:#6b21a8">Asset Tickets</div>
        <div class="card-body"><div class="empty">No tickets for this asset.</div></div>
      </div>`;
  }

  /* ── RFID movement table ──────────────────────────────────────────────── */
  let rfidHTML = '';
  if (Array.isArray(rfidMovements) && rfidMovements.length > 0) {
    const rows = rfidMovements.slice(0, 20).map((mv: any) => {
      const isExit = mv.eventType === 'ENTERPRISE_EXIT' || mv.toZoneIsExit;
      const evtSt = isExit
        ? 'background:#fee2e2;color:#991b1b'
        : mv.eventType === 'ZONE_ENTRY' ? 'background:#dcfce7;color:#166534' : 'background:#dbeafe;color:#1e40af';
      const evtLabel = mv.eventType === 'ENTERPRISE_EXIT' ? 'EXIT' : mv.eventType === 'ZONE_MOVE' ? 'MOVE' : mv.eventType === 'ZONE_ENTRY' ? 'ENTRY' : mv.eventType ?? '—';
      const ts = mv.timestamp ? new Date(mv.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
      return `<tr class="${isExit ? 'rfid-exit' : ''}">
        <td style="font-size:11px;white-space:nowrap">${ts}</td>
        <td><span class="badge" style="${evtSt}">${evtLabel}</span></td>
        <td style="font-size:11px">${mv.fromZoneName || '—'}</td>
        <td style="font-size:11px;${isExit ? 'font-weight:700;color:#991b1b' : ''}">${mv.toZoneName || '—'}${isExit ? ' ⚠' : ''}</td>
        <td style="font-size:11px">${mv.rssi != null ? `${mv.rssi} dBm` : '—'}</td>
      </tr>`;
    }).join('');

    const tagInfo = rfidTag
      ? `<span style="font-size:10px;font-family:monospace;margin-left:6px;background:#e0e7ff;color:#3730a3;padding:1px 7px;border-radius:999px;border:1px solid #c7d2fe">${rfidTag.tagId ?? ''}</span>
         <span style="font-size:10px;color:#64748b;margin-left:6px">Battery: ${rfidTag.batteryLevel ?? '—'}% · Last zone: ${rfidTag.lastZone?.name ?? '—'}</span>`
      : '';

    rfidHTML = `
      <div class="card">
        <div class="card-hdr" style="background:#eef2ff;border-color:#c7d2fe;color:#3730a3;display:flex;align-items:center;flex-wrap:wrap;gap:4px">
          RFID Movement History${tagInfo}
        </div>
        <div class="card-body" style="padding:0">
          <table>
            <thead><tr><th>Time</th><th>Event</th><th>From Zone</th><th>To Zone</th><th>Signal</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          ${rfidMovements.length > 20 ? `<p style="font-size:10px;color:#94a3b8;padding:8px 10px">Showing 20 of ${rfidMovements.length} events</p>` : ''}
        </div>
      </div>`;
  }

  /* ── Final HTML ───────────────────────────────────────────────────────── */
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Asset Report - ${asset.name}</title>
<style>${PRINT_CSS}</style>
</head>
<body>

  <!-- Hero -->
  <div class="hero">
    <div>
      <div class="hero-label">Asset Report</div>
      <div class="hero-title">${asset.name}</div>
      <div class="hero-meta">ID: ${asset.assetId || asset.id} &nbsp;·&nbsp; Generated: ${now}</div>
      <div class="status-pill">${asset.status || 'Unknown'}</div>
    </div>
    <div class="hero-right">
      <div class="hero-badge">
        <span style="width:6px;height:6px;border-radius:50%;background:#a5f3fc;display:inline-block"></span>
        Enterprise Asset Management
      </div>
      <div class="hero-id">${reportId}</div>
    </div>
  </div>

  <!-- Asset info -->
  ${infoHTML}

  <!-- Assignment -->
  ${assignHTML}

  <!-- Depreciation & Valuation -->
  ${depreciationHTML}

  <!-- Health -->
  ${healthHTML}

  <!-- History -->
  ${historyHTML}

  <!-- Tickets -->
  ${ticketsHTML}

  <!-- RFID -->
  ${rfidHTML}

  <!-- Compliance -->
  <div class="compliance">
    <div class="comp-title">Global Standards Compliance</div>
    <div class="comp-badges">
      <span class="comp-badge">ISO 27001</span>
      <span class="comp-badge">GDPR</span>
      <span class="comp-badge">SOC 2</span>
      <span class="comp-badge">ISO 9001</span>
    </div>
    <div class="comp-note">This report complies with international data protection and information security standards. All data handling follows approved security protocols and retention policies.</div>
  </div>

  <div class="footer">
    <span>Enterprise Asset Management System &nbsp;·&nbsp; CONFIDENTIAL</span>
    <span>${reportId} &nbsp;·&nbsp; Retention: 7 years</span>
  </div>

  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 400); };
  </script>
</body>
</html>`;
}

/* ── Component ─────────────────────────────────────────────────────────────── */
export function PrintAssetReportButton({
  asset,
  variant = "outline",
  size = "sm",
  className = "",
  children,
  onClick
}: PrintAssetReportButtonProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isPrinting, setIsPrinting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  const handlePrintReport = async (e: React.MouseEvent) => {
    if (onClick) onClick(e);
    if (!asset) return;

    try {
      setIsPrinting(true);
      setShowPrintDialog(true);
      setProgress(10);

      // Fetch history
      setProgress(20);
      let history: any[] = [];
      try {
        const r = await fetch(`/api/assets/${asset.id}/history`);
        if (r.ok) {
          const d = await r.json();
          history = d.history ?? [];
        }
      } catch {}
      setProgress(35);

      // Fetch tickets
      let tickets: any[] = [];
      try {
        const r = await fetch(`/api/assets/${asset.id}/tickets`);
        if (r.ok) tickets = await r.json() ?? [];
      } catch {}
      setProgress(50);

      // Fetch RFID movements
      let rfidMovements: any[] = [];
      let rfidTag: any = null;
      try {
        const r = await fetch(`/api/rfid/movement-history?assetId=${asset.id}&hours=168&limit=30`);
        if (r.ok) {
          const d = await r.json();
          rfidMovements = d.movements ?? [];
          const tr = await fetch('/api/rfid/tags');
          if (tr.ok) {
            const td = await tr.json();
            rfidTag = (td.tags ?? []).find((t: any) => t.assetId === asset.id) ?? null;
          }
        }
      } catch {}
      setProgress(65);

      // Fetch health
      let healthScore = 0;
      let healthFactors = { age: 0, maintenance: 0, usage: 0, condition: 0 };
      try {
        const r = await fetch(`/api/assets/${asset.id}/health`);
        if (r.ok) {
          const d = await r.json();
          if (d && typeof d.healthScore === 'object' && d.healthScore !== null) {
            healthScore = d.healthScore.score ?? 0;
            healthFactors = d.healthScore.factors ?? healthFactors;
          } else if (d && typeof d.healthScore === 'number') {
            healthScore = d.healthScore;
            healthFactors = d.healthFactors ?? healthFactors;
          }
        }
      } catch {}
      setProgress(75);

      // Calculate depreciation (client-side, no API needed)
      let depreciation: ReturnType<typeof calculateDepreciation> | null = null;
      try {
        const cost = asset.purchaseAmount;
        if (cost && cost > 0) {
          const type = asset.type ?? 'OTHER';
          const usefulLife = USEFUL_LIFE_BY_TYPE[type] ?? 7;
          const purchaseDate = asset.purchaseDate
            ? new Date(asset.purchaseDate)
            : asset.createdAt ? new Date(asset.createdAt) : null;
          if (purchaseDate && !isNaN(purchaseDate.getTime())) {
            depreciation = calculateDepreciation({ cost, purchaseDate, usefulLifeYears: usefulLife });
          }
        }
      } catch {}
      setProgress(85);

      // Generate self-contained HTML (no Tailwind dependency)
      const html = generateReportHTML(asset, {
        history, tickets, rfidMovements, rfidTag, healthScore, healthFactors, depreciation,
      });
      setProgress(90);

      // Print via hidden iframe
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelectorAll('iframe.asset-print-frame');
        existing.forEach(f => f.parentNode?.removeChild(f));

        const iframe = document.createElement('iframe');
        iframe.className = 'asset-print-frame';
        Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
        if (!doc) { reject(new Error('Cannot access iframe')); return; }

        doc.open();
        doc.write(html);
        doc.close();

        const win = iframe.contentWindow;
        if (win) {
          const cleanup = () => { if (document.body.contains(iframe)) document.body.removeChild(iframe); };
          win.onafterprint = () => { cleanup(); resolve(); };
          setTimeout(() => { cleanup(); resolve(); }, 8000);
        } else {
          reject(new Error('Cannot access iframe window'));
        }
      });

      setProgress(100);
      toast({
        title: t('report_generated'),
        description: t('asset_report_has_been_generated_successfully'),
      });
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_generate_asset_report'),
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        setIsPrinting(false);
        setShowPrintDialog(false);
        setProgress(0);
      }, 600);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handlePrintReport}
        disabled={isPrinting}
      >
        {children || (
          <>
            <Printer className="h-4 w-4 mr-2" />
            <span>{t('print_report')}</span>
          </>
        )}
      </Button>

      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('generating_asset_report')}</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <p className="text-sm text-muted-foreground text-center mb-4">
              {progress < 90
                ? t('please_wait_while_we_prepare_your_detailed_asset_report')
                : t('report_generated_successfully_printing')}
            </p>
            <Progress value={progress} className="h-2 mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('collecting_data')}</span>
              <span>{progress}%</span>
              <span>{t('printing')}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
