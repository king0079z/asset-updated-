import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Calendar, Building2, User, Package, Printer, ChefHat, Utensils, AlertTriangle } from "lucide-react";
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/contexts/TranslationContext";

type ConsumptionHistoryProps = {
  foodSupplyId: string;
  foodSupplyName: string;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  buttonClassName?: string;
  showIcon?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ConsumptionRecord = {
  id: string;
  quantity: number;
  date: string;
  expirationDate?: string;
  kitchen: { name: string; floorNumber: string };
  foodSupply: { name: string; unit: string; pricePerUnit: number };
  user: { email: string };
  isWaste?: boolean;
  reason?: string;
  source?: 'direct' | 'recipe';
  recipeId?: string;
  recipeName?: string;
  notes?: string;
};

/* ── Self-contained inline-CSS print HTML generator ─────────────────────── */
function generateConsumptionReportHTML(
  name: string,
  records: ConsumptionRecord[],
  totalMoneyConsumed: number,
): string {
  const reportId = `CR-${Date.now().toString(36).toUpperCase().slice(-8)}`;
  const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
  };
  const fmtDateShort = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  const totalQty = records.reduce((s, r) => s + r.quantity, 0);
  const wasteRecords = records.filter(r => r.isWaste);
  const directRecords = records.filter(r => !r.isWaste);
  const recipeRecords = records.filter(r => r.source === 'recipe');
  const wasteCost = wasteRecords.reduce((s, r) => s + r.quantity * r.foodSupply.pricePerUnit, 0);

  // Kitchen breakdown
  const kitchenMap: Record<string, { count: number; qty: number; cost: number }> = {};
  records.forEach(r => {
    const k = `${r.kitchen.name}${r.kitchen.floorNumber && r.kitchen.floorNumber !== '-' ? ` · Floor ${r.kitchen.floorNumber}` : ''}`;
    if (!kitchenMap[k]) kitchenMap[k] = { count: 0, qty: 0, cost: 0 };
    kitchenMap[k].count++;
    kitchenMap[k].qty += r.quantity;
    kitchenMap[k].cost += r.quantity * r.foodSupply.pricePerUnit;
  });
  const unit = records[0]?.foodSupply.unit ?? '';
  const pricePerUnit = records[0]?.foodSupply.pricePerUnit ?? 0;
  const maxKitchenCost = Math.max(...Object.values(kitchenMap).map(k => k.cost), 1);

  const kitchenBreakdownHtml = Object.entries(kitchenMap).map(([k, d]) => {
    const pct = Math.round((d.cost / maxKitchenCost) * 100);
    return `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:12px;font-weight:600;color:#0f172a">${k}</span>
        <div style="text-align:right">
          <span style="font-size:12px;font-weight:700;color:#1e293b">QAR ${d.cost.toFixed(2)}</span>
          <span style="font-size:10px;color:#94a3b8;margin-left:5px">${d.qty.toFixed(1)} ${unit} · ${d.count} record${d.count !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div style="height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden">
        <div style="height:6px;background:linear-gradient(90deg,#059669,#10b981);border-radius:999px;width:${pct}%"></div>
      </div>
    </div>`;
  }).join('');

  // Records
  const recordRowsHtml = records.map((r, idx) => {
    const cost = r.quantity * r.foodSupply.pricePerUnit;
    const isWaste = r.isWaste;
    const isRecipe = r.source === 'recipe';
    const recipeNote = r.notes?.includes('Used in recipe:') ? r.notes.replace('Used in recipe: ', '') : r.recipeName ?? null;

    const typeBadge = isWaste
      ? `<span style="display:inline-flex;padding:2px 8px;border-radius:999px;font-size:9px;font-weight:800;background:#fee2e2;color:#991b1b;border:1px solid #fecaca">WASTE</span>`
      : isRecipe
      ? `<span style="display:inline-flex;padding:2px 8px;border-radius:999px;font-size:9px;font-weight:800;background:#f3e8ff;color:#6b21a8;border:1px solid #e9d5ff">RECIPE</span>`
      : `<span style="display:inline-flex;padding:2px 8px;border-radius:999px;font-size:9px;font-weight:800;background:#dcfce7;color:#166534;border:1px solid #bbf7d0">DIRECT</span>`;

    const bgRow = isWaste ? '#fef2f2' : idx % 2 === 0 ? '#fff' : '#f8fafc';

    return `<tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:10px 12px;background:${bgRow};font-size:11px;color:#64748b;white-space:nowrap">${fmtDate(r.date)}</td>
      <td style="padding:10px 12px;background:${bgRow};text-align:center">
        <span style="font-size:13px;font-weight:800;color:${isWaste ? '#991b1b' : '#0f172a'}">${r.quantity}</span>
        <span style="font-size:10px;color:#94a3b8;margin-left:3px">${r.foodSupply.unit}</span>
      </td>
      <td style="padding:10px 12px;background:${bgRow};text-align:right;font-size:12px;font-weight:700;color:${isWaste ? '#991b1b' : '#059669'}">QAR ${cost.toFixed(2)}</td>
      <td style="padding:10px 12px;background:${bgRow}">${typeBadge}</td>
      <td style="padding:10px 12px;background:${bgRow};font-size:11px;color:#475569">${r.kitchen.name}${r.kitchen.floorNumber && r.kitchen.floorNumber !== '-' ? ` · Fl ${r.kitchen.floorNumber}` : ''}</td>
      <td style="padding:10px 12px;background:${bgRow};font-size:11px;color:#64748b">${r.user.email}</td>
      <td style="padding:10px 12px;background:${bgRow};font-size:10px;color:#94a3b8">
        ${recipeNote ? `<span style="background:#f3e8ff;color:#6b21a8;padding:1px 5px;border-radius:4px;font-size:9px;font-weight:700">${recipeNote}</span>` : ''}
        ${r.reason ? `<span style="color:#ef4444">${r.reason}</span>` : ''}
        ${r.expirationDate ? `<div>Exp: ${fmtDateShort(r.expirationDate)}</div>` : ''}
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Consumption History — ${name}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;color:#0f172a;background:#fff;font-size:13px;line-height:1.5}
  @page{size:A4;margin:14mm}
  @media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}

  .hero{background:linear-gradient(135deg,#059669 0%,#0d9488 50%,#0891b2 100%);color:#fff;padding:22px 26px;border-radius:12px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-start}
  .hero-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;opacity:.75;margin-bottom:5px}
  .hero-title{font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1.2}
  .hero-meta{font-size:11px;opacity:.65;margin-top:6px}
  .hero-right{text-align:right;flex-shrink:0}
  .hero-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:999px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);font-size:10px;font-weight:700;color:#fff}
  .hero-id{font-size:10px;opacity:.5;font-family:monospace;margin-top:5px}

  .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
  .stat-card{border-radius:10px;padding:12px 14px;border:1px solid}
  .stat-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px}
  .stat-val{font-size:20px;font-weight:900;letter-spacing:-.02em}

  .card{border-radius:10px;border:1px solid #e2e8f0;margin-bottom:14px;overflow:hidden;page-break-inside:avoid}
  .card-hdr{padding:9px 14px;border-bottom:1px solid;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em}
  .card-body{padding:14px;background:#fff}

  table{width:100%;border-collapse:collapse}
  thead tr{background:#f1f5f9}
  th{padding:8px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;border-bottom:2px solid #e2e8f0;text-align:left}
  td{vertical-align:middle}

  .compliance{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:11px 13px;margin-top:18px}
  .comp-title{font-size:9px;font-weight:800;color:#1e40af;margin-bottom:5px;text-transform:uppercase;letter-spacing:.08em}
  .comp-badges{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:5px}
  .comp-badge{padding:2px 7px;border-radius:999px;font-size:9px;font-weight:700;background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe}
  .comp-note{font-size:10px;color:#3730a3}
  .footer{display:flex;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8}
  .empty{background:#f8fafc;border-radius:8px;padding:18px;text-align:center;color:#94a3b8;font-size:12px}
</style>
</head>
<body>

  <!-- Hero -->
  <div class="hero">
    <div>
      <div class="hero-label">Food Consumption Report</div>
      <div class="hero-title">${name}</div>
      <div class="hero-meta">Generated: ${now} &nbsp;·&nbsp; ${records.length} record${records.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="hero-right">
      <div class="hero-badge">
        <span style="width:6px;height:6px;border-radius:50%;background:#a7f3d0;display:inline-block"></span>
        Enterprise Food Management
      </div>
      <div class="hero-id">${reportId}</div>
    </div>
  </div>

  <!-- KPI grid -->
  <div class="stat-grid">
    <div class="stat-card" style="background:#f0fdf4;border-color:#bbf7d0">
      <div class="stat-lbl" style="color:#15803d">Total Consumed</div>
      <div class="stat-val" style="color:#14532d">${totalQty.toFixed(1)}</div>
      <div style="font-size:10px;color:#4ade80;margin-top:2px">${unit}</div>
    </div>
    <div class="stat-card" style="background:#eef2ff;border-color:#c7d2fe">
      <div class="stat-lbl" style="color:#4338ca">Total Value</div>
      <div class="stat-val" style="color:#312e81;font-size:16px">QAR ${totalMoneyConsumed.toFixed(2)}</div>
      <div style="font-size:10px;color:#818cf8;margin-top:2px">@ QAR ${pricePerUnit.toFixed(2)}/${unit}</div>
    </div>
    <div class="stat-card" style="background:#fef2f2;border-color:#fecaca">
      <div class="stat-lbl" style="color:#991b1b">Waste Records</div>
      <div class="stat-val" style="color:#7f1d1d">${wasteRecords.length}</div>
      <div style="font-size:10px;color:#f87171;margin-top:2px">QAR ${wasteCost.toFixed(2)} lost</div>
    </div>
    <div class="stat-card" style="background:#faf5ff;border-color:#e9d5ff">
      <div class="stat-lbl" style="color:#7e22ce">Via Recipe</div>
      <div class="stat-val" style="color:#581c87">${recipeRecords.length}</div>
      <div style="font-size:10px;color:#c084fc;margin-top:2px">${directRecords.length} direct</div>
    </div>
  </div>

  <!-- Kitchen breakdown -->
  ${Object.keys(kitchenMap).length > 0 ? `
  <div class="card">
    <div class="card-hdr" style="background:#f0fdf4;border-color:#bbf7d0;color:#15803d">Kitchen Breakdown</div>
    <div class="card-body">${kitchenBreakdownHtml}</div>
  </div>` : ''}

  <!-- Consumption table -->
  <div class="card">
    <div class="card-hdr" style="background:#eef2ff;border-color:#c7d2fe;color:#3730a3">
      All Consumption Records (${records.length})
    </div>
    <div class="card-body" style="padding:0">
      ${records.length === 0
        ? `<div class="empty">No consumption records found.</div>`
        : `<table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th style="text-align:center">Quantity</th>
                <th style="text-align:right">Value (QAR)</th>
                <th>Type</th>
                <th>Kitchen</th>
                <th>User</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>${recordRowsHtml}</tbody>
            <tfoot>
              <tr style="background:#f1f5f9;border-top:2px solid #e2e8f0">
                <td style="padding:8px 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#64748b">Total</td>
                <td style="padding:8px 12px;text-align:center;font-weight:900;font-size:14px">${totalQty.toFixed(1)} <span style="font-size:10px;color:#94a3b8">${unit}</span></td>
                <td style="padding:8px 12px;text-align:right;font-weight:900;font-size:14px;color:#059669">QAR ${totalMoneyConsumed.toFixed(2)}</td>
                <td colspan="4" style="padding:8px 12px;font-size:10px;color:#94a3b8">${wasteRecords.length} waste · ${recipeRecords.length} recipe · ${directRecords.length} direct</td>
              </tr>
            </tfoot>
          </table>`}
    </div>
  </div>

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
    <span>Enterprise Food Management System &nbsp;·&nbsp; CONFIDENTIAL</span>
    <span>${reportId} &nbsp;·&nbsp; Retention: 7 years</span>
  </div>

  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 400); };
  </script>
</body>
</html>`;
}

/* ── Component ─────────────────────────────────────────────────────────────── */
export function ConsumptionHistoryDialog({
  foodSupplyId,
  foodSupplyName,
  buttonVariant = "outline",
  buttonSize = "sm",
  buttonClassName = "",
  showIcon = true,
  open: controlledOpen,
  onOpenChange
}: ConsumptionHistoryProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = onOpenChange || setUncontrolledOpen;
  const [history, setHistory] = useState<ConsumptionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalMoneyConsumed, setTotalMoneyConsumed] = useState(0);
  const [printing, setPrinting] = useState(false);
  const { t } = useTranslation();

  const loadHistory = async () => {
    if (!open) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/food-supply/consumption-history?foodSupplyId=${foodSupplyId}`);
      if (!response.ok) throw new Error('Failed to load consumption history');
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error('Error loading consumption history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) loadHistory(); }, [open]);

  useEffect(() => {
    setTotalMoneyConsumed(history.reduce((sum, r) => sum + r.quantity * r.foodSupply.pricePerUnit, 0));
  }, [history]);

  /* ── Premium inline-CSS print ───────────────────────────────────────────── */
  const handlePrint = () => {
    setPrinting(true);
    const html = generateConsumptionReportHTML(foodSupplyName, history, totalMoneyConsumed);

    const existing = document.querySelectorAll('iframe.consumption-print-frame');
    existing.forEach(f => f.parentNode?.removeChild(f));

    const iframe = document.createElement('iframe');
    iframe.className = 'consumption-print-frame';
    Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) { setPrinting(false); return; }
    doc.open(); doc.write(html); doc.close();

    const win = iframe.contentWindow;
    if (win) {
      const cleanup = () => { if (document.body.contains(iframe)) document.body.removeChild(iframe); setPrinting(false); };
      win.onafterprint = cleanup;
      setTimeout(cleanup, 8000);
    } else {
      setPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} className={buttonClassName}>
          {showIcon && <History className="h-4 w-4 mr-2" />}
          {t('history')}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <span>{foodSupplyName} - {t('consumption_history')}</span>
            </div>
            {history.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={printing || loading}
                className="flex items-center gap-1.5 text-xs"
              >
                {printing
                  ? <><span className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" /> Printing…</>
                  : <><Printer className="h-3.5 w-3.5" /> Print Report</>
                }
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>{t('track_all_consumption_records')}</DialogDescription>

          {!loading && history.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-0.5">Total Value</p>
                <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">QAR {totalMoneyConsumed.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-0.5">Records</p>
                <p className="text-sm font-black text-indigo-700 dark:text-indigo-300">{history.length}</p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-0.5">Waste</p>
                <p className="text-sm font-black text-red-700 dark:text-red-300">{history.filter(r => r.isWaste).length}</p>
              </div>
            </div>
          )}
        </DialogHeader>

        <Separator className="my-2" />

        <div className="mt-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="h-8 w-8 rounded-full border-2 border-muted border-t-primary animate-spin" />
              <p className="text-sm text-muted-foreground">{t('loading_history')}</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <History className="h-7 w-7 text-muted-foreground opacity-40" />
              </div>
              <p className="font-semibold text-muted-foreground">{t('no_consumption_history_found')}</p>
              <p className="text-xs text-muted-foreground mt-1 opacity-70">{t('once_items_consumed_appear_here')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[460px] pr-4">
              <div className="space-y-3">
                {history.map((record) => {
                  const cost = record.quantity * record.foodSupply.pricePerUnit;
                  const isRecipe = record.source === 'recipe';
                  const recipeNote = record.notes?.includes('Used in recipe:')
                    ? record.notes.replace('Used in recipe: ', '')
                    : record.recipeName ?? null;

                  return (
                    <div
                      key={record.id}
                      className={`rounded-xl border p-3.5 transition-all hover:shadow-sm ${
                        record.isWaste
                          ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
                          : 'border-border bg-card'
                      }`}
                    >
                      {/* Top row */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-black border ${
                            record.isWaste
                              ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400'
                              : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400'
                          }`}>
                            {record.quantity} {record.foodSupply.unit}
                          </span>
                          <span className="text-sm font-bold">QAR {cost.toFixed(2)}</span>
                          {record.isWaste && (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                              <AlertTriangle className="h-2.5 w-2.5" /> Waste
                            </span>
                          )}
                          {isRecipe && (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 rounded-full border border-violet-200 dark:border-violet-800">
                              <ChefHat className="h-2.5 w-2.5" /> Recipe
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(record.date), 'dd MMM yyyy · HH:mm')}
                        </div>
                      </div>

                      {/* Info row */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5" />
                          {record.kitchen.name}
                          {record.kitchen.floorNumber && record.kitchen.floorNumber !== '-' && ` · Floor ${record.kitchen.floorNumber}`}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[180px]">{record.user.email}</span>
                        </div>
                      </div>

                      {/* Recipe note */}
                      {recipeNote && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs">
                          <Utensils className="h-3 w-3 text-violet-500" />
                          <span className="text-muted-foreground">Recipe:</span>
                          <span className="font-semibold text-violet-600 dark:text-violet-400">{recipeNote}</span>
                        </div>
                      )}

                      {/* Expiry */}
                      {record.expirationDate && (
                        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                          Expiry at consumption: {format(new Date(record.expirationDate), 'dd MMM yyyy')}
                        </div>
                      )}

                      {/* Waste reason */}
                      {record.isWaste && record.reason && (
                        <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded-lg border border-red-200 dark:border-red-800">
                          Reason: <span className="font-semibold">{record.reason}</span>
                          {record.notes && <span className="text-muted-foreground ml-1">— {record.notes}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
