import { useState, useEffect, useRef } from "react";
import { fetchWithCache, getFromCache } from "@/lib/api-cache";
const REPORTS_HISTORY_KEY = "/api/reports/history";
const REPORTS_TTL = 2 * 60_000;
import { useTranslation } from "@/contexts/TranslationContext";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrintReportDialog, ReportOptions } from "@/components/PrintReportDialog";
import { ConsumptionSummaryCard } from "@/components/ConsumptionSummaryCard";
import { ConsumptionSummaryReport } from "@/components/ConsumptionSummaryReport";
import {
  Printer, FileText, Package, Utensils, Car, BrainCircuit, Calendar, User,
  TrendingUp, ChevronRight, Download, Clock, ArrowUpRight, Sparkles,
  BarChart3, Shield,
} from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/router";
import { useToast } from "@/components/ui/use-toast";
import dynamic from "next/dynamic";
import ReactDOMServer from "react-dom/server";
import { printContent, printContentWithIframe } from '@/util/print';

interface ReportHistoryItem {
  id: string;
  userId: string;
  userEmail: string;
  reportType: string;
  itemScope: string;
  specificItemId: string | null;
  dateRange: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

/* ── World-class report card ──────────────────────────────────────────────── */
function ReportCard({
  title, description, icon: Icon, gradient, iconBg, badge, onClick, isPrinting,
}: {
  title: string;
  description: string;
  icon: any;
  gradient: string;
  iconBg: string;
  badge?: string;
  onClick: () => void;
  isPrinting?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isPrinting}
      className="group relative rounded-2xl overflow-hidden text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 ${gradient}`} />
      {/* Hover shimmer */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%)' }} />

      <div className="relative z-10 p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${iconBg} shadow-lg`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex items-center gap-1.5">
            {badge && (
              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/15 text-white/90 border border-white/20">
                {badge}
              </span>
            )}
            <ArrowUpRight className="h-4 w-4 text-white/40 group-hover:text-white/80 transition-colors" />
          </div>
        </div>

        {/* Title & description */}
        <p className="text-base font-bold text-white leading-tight mb-1">{title}</p>
        <p className="text-xs text-white/60 leading-snug">{description}</p>

        {/* Print button */}
        <div className="mt-4 flex items-center gap-2">
          <div className="flex-1 h-px bg-white/10" />
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/70 group-hover:text-white transition-colors">
            {isPrinting ? (
              <><span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Generating…</>
            ) : (
              <><Printer className="h-3 w-3" /> Generate Report</>
            )}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function PrintReportPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const printFrameRef = useRef<HTMLIFrameElement>(null);
  
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>(
    () => getFromCache<ReportHistoryItem[]>(REPORTS_HISTORY_KEY, REPORTS_TTL) ?? []
  );
  const [loading, setLoading] = useState(() => !getFromCache(REPORTS_HISTORY_KEY, REPORTS_TTL));
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [currentReportType, setCurrentReportType] = useState<"asset" | "food" | "vehicle" | "ai">("asset");
  const [reportData, setReportData] = useState<any[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [options, setOptions] = useState<ReportOptions | null>(null);

  useEffect(() => {
    const load = async (background = false) => {
      if (!background) setLoading(true);
      try {
        const data = await fetchWithCache<ReportHistoryItem[]>(REPORTS_HISTORY_KEY, { maxAge: REPORTS_TTL });
        if (data) setReportHistory(data);
      } catch {}
      finally { if (!background) setLoading(false); }
    };
    if (getFromCache(REPORTS_HISTORY_KEY, REPORTS_TTL)) {
      setTimeout(() => load(true), 300);
    } else {
      load(false);
    }
  }, []);

  const handleReportIconClick = (reportType: "asset" | "food" | "vehicle" | "ai") => {
    setCurrentReportType(reportType);
    setReportDialogOpen(true);
  };

  const handleGenerateReport = async (reportOptions: ReportOptions) => {
    setIsPrinting(true);
    setActiveType(reportOptions.reportType);
    setOptions(reportOptions);
    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportOptions),
      });

      if (!response.ok) {
        let errorMessage = "Failed to generate report. Please try again.";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {}
        toast({ title: "Error generating report", description: errorMessage, variant: "destructive" });
        setIsPrinting(false);
        return;
      }
      
      let data;
      try {
        data = await response.json();
      } catch {
        toast({ title: "Error processing report data", description: "The server returned invalid data.", variant: "destructive" });
        setIsPrinting(false);
        return;
      }
      
      if (!data || (Array.isArray(data) && data.length === 0)) {
        toast({ title: "No data available", description: "No data found for the selected report criteria.", variant: "destructive" });
        setIsPrinting(false);
        return;
      }
      
      setReportData(data);

      // Refresh history (non-blocking)
      fetch("/api/reports/history")
        .then((r) => r.ok ? r.json() : null)
        .then((historyData) => { if (historyData) setReportHistory(historyData); })
        .catch(() => {});

      const reportTitle = getReportTypeName(reportOptions.reportType);
      const reportContent = formatReportContent(data, reportOptions);
      
      if (reportContent) {
        try {
            await printContentWithIframe(reportContent, reportTitle);
          toast({ title: t("report_generated"), description: format(new Date(), "PPP p") });
        } catch (printError) {
          toast({ title: "Error printing report", description: "There was a problem printing the report.", variant: "destructive" });
        }
      }
    } catch (error) {
      toast({ title: "Error generating report", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsPrinting(false);
      setActiveType(null);
    }
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case "asset": return <Package className="h-4 w-4" />;
      case "food": return <Utensils className="h-4 w-4" />;
      case "vehicle": return <Car className="h-4 w-4" />;
      case "ai": return <BrainCircuit className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getReportTypeName = (type: string) => {
    switch (type) {
      case "asset": return t("asset_reports");
      case "food": return t("food_reports");
      case "vehicle": return t("vehicle_reports");
      case "ai": return t("ai_reports");
      default: return type;
    }
  };

  const AssetReportDetailed = dynamic(() => import('@/components/AssetReportDetailed').then(mod => mod.AssetReportDetailed), { ssr: false });
  const FoodSupplyReportDetailed = dynamic(() => import('@/components/FoodSupplyReportDetailed').then(mod => mod.FoodSupplyReportDetailed), { ssr: false });

  const renderConsumptionSummaryReport = (data: any) =>
    ReactDOMServer.renderToString(<ConsumptionSummaryReport data={data} isPrintMode={true} />);

  /* ────────────────────────────────────────────────────────────────────────
     World-class printed HTML generator
  ─────────────────────────────────────────────────────────────────────── */
  const formatReportContent = (dataOverride?: any, optOverride?: ReportOptions) => {
    const source = dataOverride ?? reportData;
    if (source == null) return null;
    const dataArray = Array.isArray(source) ? source : [source];
    if (dataArray.length === 0) return null;

    const opts = optOverride ?? options;
    const reportTitle = getReportTypeName(currentReportType);
    const dateStr = format(new Date(), "PPP p");
    const reportId = `RPT-${Date.now().toString(36).toUpperCase().slice(-8)}`;

    /* ── Shared inline CSS for the printed document ────────────────────── */
    const css = `
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;background:#fff;padding:0}
      @page{size:A4;margin:15mm}
      @media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}

      /* ─ Typography ─ */
      h1{font-size:22px;font-weight:800;letter-spacing:-.02em}
      h2{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#475569;margin-bottom:10px}
      h3{font-size:13px;font-weight:600;color:#1e293b}

      /* ─ Hero header ─ */
      .hero{background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);color:#fff;padding:24px 28px;border-radius:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start}
      .hero-left{}
      .hero-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;opacity:.7;margin-bottom:4px}
      .hero-title{font-size:22px;font-weight:800;letter-spacing:-.02em}
      .hero-meta{font-size:11px;opacity:.65;margin-top:6px}
      .hero-right{text-align:right}
      .hero-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:999px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);font-size:10px;font-weight:700;color:#fff;margin-bottom:6px}
      .hero-id{font-size:10px;opacity:.5;font-family:monospace}

      /* ─ Summary cards ─ */
      .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
      .stat-card{border-radius:10px;padding:14px 16px;border:1px solid}
      .stat-card .stat-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px}
      .stat-card .stat-value{font-size:22px;font-weight:900;letter-spacing:-.02em}

      /* ─ Section card ─ */
      .card{border-radius:10px;border:1px solid #e2e8f0;margin-bottom:16px;overflow:hidden;page-break-inside:avoid}
      .card-hdr{padding:10px 16px;border-bottom:1px solid;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em}
      .card-body{padding:14px 16px;background:#fff}

      /* ─ Info grid ─ */
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .info-item .lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:2px}
      .info-item .val{font-size:13px;font-weight:600;color:#0f172a}
      .mono{font-family:monospace}

      /* ─ Assignment box ─ */
      .assign-box{border-radius:8px;padding:12px 14px;margin-bottom:16px;border:1px solid}
      .assign-assigned{background:#f0fdf4;border-color:#bbf7d0}
      .assign-none{background:#f8fafc;border-color:#e2e8f0;border-style:dashed}
      .assign-name{font-size:14px;font-weight:700;color:#065f46;margin-bottom:2px}
      .assign-email{font-size:12px;color:#047857}
      .assign-since{font-size:10px;color:#94a3b8;margin-top:4px}
      .assign-none-text{font-size:12px;color:#94a3b8;font-style:italic}

      /* ─ Health bar ─ */
      .health-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
      .health-score-badge{padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700}
      .hbar-bg{height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-bottom:16px}
      .hbar-fill{height:8px;border-radius:999px}
      .factor-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .factor .factor-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:4px}
      .factor .mini-bar-bg{height:4px;background:#e2e8f0;border-radius:999px;overflow:hidden;flex:1}
      .factor .mini-bar-fill{height:4px;background:#6366f1;border-radius:999px}
      .factor .factor-row{display:flex;align-items:center;gap:8px}
      .factor .factor-pct{font-size:11px;font-weight:700;color:#334155;min-width:28px;text-align:right}

      /* ─ Timeline ─ */
      .timeline{position:relative;padding-left:36px}
      .timeline::before{content:'';position:absolute;left:11px;top:0;bottom:0;width:2px;background:#e2e8f0}
      .tl-item{position:relative;margin-bottom:14px;page-break-inside:avoid}
      .tl-dot{position:absolute;left:-36px;width:24px;height:24px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;font-size:11px;background:#fff}
      .tl-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}
      .tl-action{display:inline-flex;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;margin-bottom:4px}
      .tl-date{font-size:10px;color:#94a3b8}
      .tl-by{font-size:10px;color:#94a3b8;margin-top:4px}
      .tl-details{font-size:11px;color:#334155;margin-top:6px;border-top:1px solid #e2e8f0;padding-top:6px}

      /* ─ Tables ─ */
      table{width:100%;border-collapse:collapse}
      thead tr{background:#f1f5f9}
      th{padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;border-bottom:2px solid #e2e8f0;text-align:left}
      td{padding:8px 10px;font-size:12px;color:#1e293b;border-bottom:1px solid #f1f5f9}
      tr:nth-child(even) td{background:#f8fafc}
      .badge{display:inline-flex;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700}

      /* ─ RFID table ─ */
      .rfid-exit td{background:#fef2f2!important}

      /* ─ Footer ─ */
      .compliance{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 14px;margin-top:20px}
      .compliance h4{font-size:10px;font-weight:700;color:#1e40af;margin-bottom:6px;text-transform:uppercase;letter-spacing:.08em}
      .comp-badges{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}
      .comp-badge{padding:2px 8px;border-radius:999px;font-size:9px;font-weight:700;background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe}
      .comp-note{font-size:10px;color:#3730a3}
      .footer{display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}

      /* ─ Empty state ─ */
      .empty{background:#f8fafc;border-radius:8px;padding:16px;text-align:center;color:#94a3b8;font-size:12px}
    `;

    /* ── Helper to build status badge ───────────────────────────────────── */
    const statusBadge = (s?: string) => {
      if (!s) return `<span class="badge" style="background:#f1f5f9;color:#64748b">Unknown</span>`;
      const map: Record<string, string> = {
        ACTIVE: 'background:#dcfce7;color:#166534',
        IN_TRANSIT: 'background:#fef3c7;color:#92400e',
        DISPOSED: 'background:#fee2e2;color:#991b1b',
        MAINTENANCE: 'background:#ede9fe;color:#5b21b6',
        AVAILABLE: 'background:#dcfce7;color:#166534',
        RENTED: 'background:#dbeafe;color:#1e40af',
        OPEN: 'background:#fef3c7;color:#92400e',
        CLOSED: 'background:#dcfce7;color:#166534',
        IN_PROGRESS: 'background:#dbeafe;color:#1e40af',
      };
      const style = map[s.toUpperCase()] ?? 'background:#f1f5f9;color:#64748b';
      return `<span class="badge" style="${style}">${s}</span>`;
    };

    const priorityBadge = (p?: string) => {
      if (!p) return `<span class="badge" style="background:#f1f5f9;color:#64748b">—</span>`;
      const map: Record<string, string> = {
        HIGH: 'background:#fee2e2;color:#991b1b',
        MEDIUM: 'background:#fef3c7;color:#92400e',
        LOW: 'background:#dcfce7;color:#166534',
        CRITICAL: 'background:#fce7f3;color:#831843',
      };
      const style = map[p.toUpperCase()] ?? 'background:#f1f5f9;color:#64748b';
      return `<span class="badge" style="${style}">${p}</span>`;
    };

    const fmtDate = (d?: string) => {
      if (!d) return 'N/A';
      try { return format(new Date(d), 'dd MMM yyyy'); } catch { return 'N/A'; }
    };

    /* ── Asset: single or full inventory ─────────────────────────────── */
    let bodyHtml = '';

    if (currentReportType === 'asset') {
      const isSingle = opts?.itemScope === 'specific' && dataArray.length === 1;

      if (isSingle) {
          const asset = dataArray[0];
          
        // History timeline
          let historyHtml = '';
          if (asset.history && asset.history.length > 0) {
          const actionMap: Record<string, { dot: string; label: string; icon: string }> = {
            CREATED:        { dot: 'border-color:#86efac;color:#166534', label: 'ASSET CREATED',  icon: '✚' },
            UPDATED:        { dot: 'border-color:#93c5fd;color:#1e40af', label: 'ASSET UPDATED',  icon: '✎' },
            MOVED:          { dot: 'border-color:#fde047;color:#854d0e', label: 'ASSET MOVED',    icon: '↹' },
            DISPOSED:       { dot: 'border-color:#fca5a5;color:#991b1b', label: 'ASSET DISPOSED', icon: '✕' },
            MAINTENANCE:    { dot: 'border-color:#d8b4fe;color:#6b21a8', label: 'MAINTENANCE',    icon: '⚙' },
            TICKET_CREATED: { dot: 'border-color:#a5b4fc;color:#3730a3', label: 'TICKET CREATED', icon: '🎫' },
          };
          const actionBgMap: Record<string, string> = {
            CREATED: 'background:#dcfce7;color:#166534',
            UPDATED: 'background:#dbeafe;color:#1e40af',
            MOVED: 'background:#fef9c3;color:#854d0e',
            DISPOSED: 'background:#fee2e2;color:#991b1b',
            MAINTENANCE: 'background:#f3e8ff;color:#6b21a8',
            TICKET_CREATED: 'background:#e0e7ff;color:#3730a3',
          };

          const rows = asset.history.slice(0, 20).map((rec: any) => {
            const a = actionMap[rec.action] ?? { dot: 'border-color:#e2e8f0;color:#64748b', label: rec.action, icon: '●' };
            const bg = actionBgMap[rec.action] ?? 'background:#f1f5f9;color:#64748b';

            let details = 'No additional details';
            if (rec.action === 'MOVED' && rec.details) {
              details = `From Floor ${rec.details.fromFloor ?? 'N/A'}, Room ${rec.details.fromRoom ?? 'N/A'} → Floor ${rec.details.toFloor ?? 'N/A'}, Room ${rec.details.toRoom ?? 'N/A'}`;
            } else if (rec.action === 'TICKET_CREATED' && rec.details?.ticketTitle) {
              details = `Ticket "${rec.details.ticketTitle}" created`;
            } else if (rec.action === 'DISPOSED' && rec.details?.reason) {
              details = `Reason: ${rec.details.reason}`;
            } else if (rec.action === 'MAINTENANCE' && rec.details?.notes) {
              details = rec.details.notes;
            } else if (rec.action === 'UPDATED' && rec.details && typeof rec.details === 'object') {
              details = `Updated: ${Object.keys(rec.details).join(', ')}`;
            } else if (rec.details && typeof rec.details === 'string') {
              details = rec.details;
            }

                    return `
              <div class="tl-item">
                <div class="tl-dot" style="${a.dot}">${a.icon}</div>
                <div class="tl-card">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
                    <span class="tl-action" style="${bg}">${a.label}</span>
                    <span class="tl-date">${fmtDate(rec.createdAt)}</span>
                        </div>
                  <div class="tl-details">${details}</div>
                  ${rec.user?.email ? `<div class="tl-by">By: ${rec.user.email}</div>` : ''}
                            </div>
              </div>`;
          }).join('');
          historyHtml = `
            <div class="card">
              <div class="card-hdr" style="background:#f0f9ff;border-color:#bae6fd;color:#0369a1">Asset History</div>
              <div class="card-body">
                <div class="timeline">${rows}</div>
                            </div>
            </div>`;
          } else {
            historyHtml = `
            <div class="card">
              <div class="card-hdr" style="background:#f0f9ff;border-color:#bae6fd;color:#0369a1">Asset History</div>
              <div class="card-body"><div class="empty">No history records for this asset.</div></div>
            </div>`;
        }

        // Tickets
          let ticketsHtml = '';
          if (asset.tickets && asset.tickets.length > 0) {
          const trows = asset.tickets.map((t: any, i: number) => `
            <tr>
              <td style="font-weight:600">${t.title || 'N/A'}</td>
              <td>${statusBadge(t.status)}</td>
              <td>${priorityBadge(t.priority)}</td>
              <td>${fmtDate(t.createdAt)}</td>
              <td>${t.user?.email || 'Unassigned'}</td>
            </tr>`).join('');
            ticketsHtml = `
            <div class="card">
              <div class="card-hdr" style="background:#faf5ff;border-color:#e9d5ff;color:#6b21a8">Asset Tickets (${asset.tickets.length})</div>
              <div class="card-body" style="padding:0">
                <table>
                  <thead><tr><th>Title</th><th>Status</th><th>Priority</th><th>Created</th><th>Raised By</th></tr></thead>
                  <tbody>${trows}</tbody>
              </table>
              </div>
            </div>`;
          } else {
            ticketsHtml = `
            <div class="card">
              <div class="card-hdr" style="background:#faf5ff;border-color:#e9d5ff;color:#6b21a8">Asset Tickets</div>
              <div class="card-body"><div class="empty">No tickets for this asset.</div></div>
            </div>`;
        }

        // RFID
        let rfidHtml = '';
        if (asset.rfidMovements && asset.rfidMovements.length > 0) {
          const rfidRows = asset.rfidMovements.slice(0, 20).map((mv: any) => {
            const isExit = mv.eventType === 'ENTERPRISE_EXIT' || mv.toZoneIsExit;
            const evtStyle = isExit
              ? 'background:#fee2e2;color:#991b1b'
              : mv.eventType === 'ZONE_ENTRY' ? 'background:#dcfce7;color:#166534' : 'background:#dbeafe;color:#1e40af';
            const evtLabel = mv.eventType === 'ENTERPRISE_EXIT' ? 'EXIT' : mv.eventType === 'ZONE_MOVE' ? 'MOVE' : mv.eventType === 'ZONE_ENTRY' ? 'ENTRY' : mv.eventType;
            return `<tr class="${isExit ? 'rfid-exit' : ''}">
              <td>${new Date(mv.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
              <td><span class="badge" style="${evtStyle}">${evtLabel}</span></td>
              <td>${mv.fromZoneName || '—'}</td>
              <td style="${isExit ? 'font-weight:700;color:#991b1b' : ''}">${mv.toZoneName || '—'}${isExit ? ' ⚠' : ''}</td>
              <td>${mv.rssi != null ? `${mv.rssi} dBm` : '—'}</td>
            </tr>`;
          }).join('');
          rfidHtml = `
            <div class="card">
              <div class="card-hdr" style="background:#eef2ff;border-color:#c7d2fe;color:#3730a3">RFID Movement History${asset.rfidTag ? ` · <span style="font-family:monospace;font-size:10px">${asset.rfidTag.tagId ?? ''}</span>` : ''}</div>
              <div class="card-body" style="padding:0">
                <table>
                  <thead><tr><th>Time</th><th>Event</th><th>From Zone</th><th>To Zone</th><th>RSSI</th></tr></thead>
                  <tbody>${rfidRows}</tbody>
                </table>
              </div>
            </div>`;
        }

        // Health
        let healthHtml = '';
        if (asset.healthScore != null && asset.healthScore >= 0) {
          const hs = asset.healthScore;
          const hColor = hs >= 80 ? '#059669' : hs >= 60 ? '#3b82f6' : hs >= 40 ? '#f59e0b' : '#ef4444';
          const hLabel = hs >= 80 ? 'Excellent' : hs >= 60 ? 'Good' : hs >= 40 ? 'Fair' : 'Poor';
          const hBadgeBg = hs >= 80 ? 'background:#dcfce7;color:#166534' : hs >= 60 ? 'background:#dbeafe;color:#1e40af' : hs >= 40 ? 'background:#fef3c7;color:#92400e' : 'background:#fee2e2;color:#991b1b';

          let factorsHtml = '';
          if (asset.healthFactors && typeof asset.healthFactors === 'object') {
            const factors = [
              { label: 'Age', key: 'age', color: '#3b82f6' },
              { label: 'Maintenance', key: 'maintenance', color: '#8b5cf6' },
              { label: 'Usage', key: 'usage', color: '#10b981' },
              { label: 'Condition', key: 'condition', color: '#f59e0b' },
            ];
            factorsHtml = `<div class="factor-grid">
              ${factors.map(f => {
                const v = typeof asset.healthFactors[f.key] === 'number' ? asset.healthFactors[f.key] : 0;
                return `<div class="factor">
                  <div class="factor-label">${f.label}</div>
                  <div class="factor-row">
                    <div class="mini-bar-bg"><div class="mini-bar-fill" style="width:${v}%;background:${f.color}"></div></div>
                    <span class="factor-pct">${v}%</span>
                  </div>
                </div>`;
              }).join('')}
            </div>`;
          }

          healthHtml = `
            <div class="card">
              <div class="card-hdr" style="background:#faf5ff;border-color:#e9d5ff;color:#6b21a8">Asset Health Score</div>
              <div class="card-body">
                <div class="health-row">
                  <h3>Overall Health</h3>
                  <span class="health-score-badge" style="${hBadgeBg}">${hs}% — ${hLabel}</span>
                  </div>
                <div class="hbar-bg"><div class="hbar-fill" style="width:${hs}%;background:${hColor}"></div></div>
                ${factorsHtml}
                  </div>
            </div>`;
        }

        // Stat chips
        const locText = asset.location
          ? `${asset.location.building ? asset.location.building + ' · ' : ''}Floor ${asset.location.floorNumber ?? 'N/A'}, Room ${asset.location.roomNumber ?? 'N/A'}`
          : (asset.floorNumber ? `Floor ${asset.floorNumber}, Room ${asset.roomNumber ?? 'N/A'}` : 'N/A');

        bodyHtml = `
          <!-- Asset image + info -->
          <div style="display:grid;grid-template-columns:${asset.imageUrl ? '160px 1fr' : '1fr'};gap:14px;margin-bottom:16px">
            ${asset.imageUrl ? `<img src="${asset.imageUrl}" style="width:160px;height:160px;object-fit:cover;border-radius:10px;border:1px solid #e2e8f0" alt="">` : ''}
            <div class="card" style="margin-bottom:0">
              <div class="card-hdr" style="background:#eef2ff;border-color:#c7d2fe;color:#3730a3">Asset Information</div>
              <div class="card-body">
                <div class="info-grid">
                  <div class="info-item"><div class="lbl">Asset ID</div><div class="val mono">${asset.assetId || asset.id}</div></div>
                  <div class="info-item"><div class="lbl">Name</div><div class="val">${asset.name || 'N/A'}</div></div>
                  <div class="info-item"><div class="lbl">Type</div><div class="val">${asset.type || 'N/A'}</div></div>
                  <div class="info-item"><div class="lbl">Status</div><div class="val">${statusBadge(asset.status)}</div></div>
                  <div class="info-item"><div class="lbl">Location</div><div class="val">${locText}</div></div>
                  <div class="info-item"><div class="lbl">Vendor</div><div class="val">${asset.vendor?.name || 'N/A'}</div></div>
                  <div class="info-item"><div class="lbl">Purchase Amount</div><div class="val">QAR ${asset.purchaseAmount ? Number(asset.purchaseAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'N/A'}</div></div>
                  <div class="info-item"><div class="lbl">Purchase Date</div><div class="val">${fmtDate(asset.purchaseDate)}</div></div>
                  </div>
                ${asset.description ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #f1f5f9"><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:2px">Description</div><div style="font-size:12px;color:#334155">${asset.description}</div></div>` : ''}
                  </div>
                  </div>
                  </div>

          <!-- Assignment -->
          <div class="assign-box ${asset.assignedToName ? 'assign-assigned' : 'assign-none'}">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:4px">Assigned To</div>
            ${asset.assignedToName
              ? `<div class="assign-name">${asset.assignedToName}</div>
                 ${asset.assignedToEmail ? `<div class="assign-email">${asset.assignedToEmail}</div>` : ''}
                 ${asset.assignedAt ? `<div class="assign-since">Since ${fmtDate(asset.assignedAt)}</div>` : ''}`
              : `<div class="assign-none-text">Not assigned to anyone</div>`}
              </div>
              
          ${healthHtml}
              ${historyHtml}
              ${ticketsHtml}
          ${rfidHtml}
          `;

        } else {
        /* ── Full inventory ────────────────────────────────────────────── */
        const totalVal = dataArray.reduce((s: number, a: any) => s + (a.purchaseAmount || 0), 0);
        const activeCount = dataArray.filter((a: any) => a.status?.toUpperCase() === 'ACTIVE').length;
        const typeCount = new Set(dataArray.map((a: any) => a.type)).size;

        const rows = dataArray.map((asset: any, i: number) => {
          const loc = asset.location
            ? `Floor ${asset.location.floorNumber ?? 'N/A'}, Rm ${asset.location.roomNumber ?? 'N/A'}`
            : (asset.floorNumber ? `Floor ${asset.floorNumber}` : 'N/A');
          return `<tr>
            <td class="mono" style="font-size:11px">${asset.assetId || asset.id}</td>
            <td style="font-weight:600">${asset.name || 'N/A'}</td>
            <td>${asset.type || 'N/A'}</td>
            <td>${loc}</td>
            <td>${statusBadge(asset.status)}</td>
            <td>QAR ${asset.purchaseAmount ? Number(asset.purchaseAmount).toLocaleString() : 'N/A'}</td>
            <td>${fmtDate(asset.purchaseDate)}</td>
          </tr>`;
        }).join('');

        bodyHtml = `
          <div class="stat-grid">
            <div class="stat-card" style="background:#eef2ff;border-color:#c7d2fe">
              <div class="stat-label" style="color:#4338ca">Total Assets</div>
              <div class="stat-value" style="color:#312e81">${dataArray.length}</div>
            </div>
            <div class="stat-card" style="background:#f0fdf4;border-color:#bbf7d0">
              <div class="stat-label" style="color:#15803d">Portfolio Value</div>
              <div class="stat-value" style="color:#14532d;font-size:16px">QAR ${totalVal.toLocaleString('en-US', { minimumFractionDigits: 0 })}</div>
            </div>
            <div class="stat-card" style="background:#faf5ff;border-color:#e9d5ff">
              <div class="stat-label" style="color:#7e22ce">Active Assets</div>
              <div class="stat-value" style="color:#581c87">${activeCount}</div>
            </div>
          </div>
          <div class="card">
            <div class="card-hdr" style="background:#eef2ff;border-color:#c7d2fe;color:#3730a3">Complete Asset Inventory (${dataArray.length} assets)</div>
            <div class="card-body" style="padding:0">
              <table>
                <thead><tr><th>Asset ID</th><th>Name</th><th>Type</th><th>Location</th><th>Status</th><th>Value</th><th>Purchase Date</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            </div>
          `;
        }

    } else if (currentReportType === 'food') {
      const totalVal = dataArray.reduce((s: number, i: any) => s + ((i.quantity || 0) * (i.pricePerUnit || 0)), 0);
      const lowStockItems = dataArray.filter((i: any) => i.quantity <= 10);
      const expiredItems = dataArray.filter((i: any) => i.expirationDate && new Date(i.expirationDate) < new Date());
      const expiringItems = dataArray.filter((i: any) => {
        if (!i.expirationDate) return false;
        const days = Math.ceil((new Date(i.expirationDate).getTime() - Date.now()) / 86400000);
        return days >= 0 && days <= 7;
      });

      // Category breakdown
      const catMap: Record<string, { count: number; value: number }> = {};
      dataArray.forEach((i: any) => {
        const cat = i.category || 'other';
        if (!catMap[cat]) catMap[cat] = { count: 0, value: 0 };
        catMap[cat].count++;
        catMap[cat].value += (i.quantity || 0) * (i.pricePerUnit || 0);
      });

      const catColors: Record<string, string> = {
        dairy: '#3b82f6', meat: '#ef4444', vegetables: '#22c55e', fruits: '#f97316',
        grains: '#f59e0b', beverages: '#8b5cf6', spices: '#eab308', seafood: '#06b6d4', other: '#64748b',
      };

      const catRowsHtml = Object.entries(catMap).sort((a, b) => b[1].value - a[1].value).map(([cat, d]) => {
        const pct = totalVal > 0 ? Math.round((d.value / totalVal) * 100) : 0;
        const color = catColors[cat] ?? '#64748b';
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
              <span style="font-size:12px;font-weight:600;text-transform:capitalize">${cat}</span>
              <span style="font-size:10px;color:#94a3b8">(${d.count} items)</span>
                </div>
            <div style="text-align:right">
              <span style="font-size:11px;font-weight:700;color:#1e293b">QAR ${d.value.toFixed(0)}</span>
              <span style="font-size:10px;color:#94a3b8;margin-left:4px">${pct}%</span>
              </div>
          </div>
          <div style="height:5px;background:#e2e8f0;border-radius:999px;overflow:hidden">
            <div style="height:5px;background:${color};border-radius:999px;width:${pct}%"></div>
          </div>
        </div>`;
      }).join('');

      const alertsHtml = [
        ...expiredItems.slice(0, 3).map((i: any) => `<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;margin-bottom:4px">
          <span style="font-size:10px;font-weight:700;color:#991b1b;background:#fee2e2;padding:1px 6px;border-radius:999px">EXPIRED</span>
          <span style="font-size:12px;font-weight:600;color:#991b1b">${i.name}</span>
          <span style="font-size:10px;color:#94a3b8;margin-left:auto">${i.quantity} ${i.unit}</span>
        </div>`),
        ...expiringItems.slice(0, 3).map((i: any) => {
          const days = Math.ceil((new Date(i.expirationDate).getTime() - Date.now()) / 86400000);
          return `<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:#fefce8;border:1px solid #fde047;border-radius:6px;margin-bottom:4px">
            <span style="font-size:10px;font-weight:700;color:#854d0e;background:#fef9c3;padding:1px 6px;border-radius:999px">EXPIRING</span>
            <span style="font-size:12px;font-weight:600;color:#854d0e">${i.name}</span>
            <span style="font-size:10px;color:#94a3b8;margin-left:auto">${days}d left · ${i.quantity} ${i.unit}</span>
          </div>`;
        }),
        ...lowStockItems.slice(0, 3).map((i: any) => `<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;margin-bottom:4px">
          <span style="font-size:10px;font-weight:700;color:#c2410c;background:#ffedd5;padding:1px 6px;border-radius:999px">LOW STOCK</span>
          <span style="font-size:12px;font-weight:600;color:#c2410c">${i.name}</span>
          <span style="font-size:10px;color:#94a3b8;margin-left:auto">${i.quantity} ${i.unit} remaining</span>
        </div>`),
      ].join('') || `<div style="text-align:center;padding:12px;color:#94a3b8;font-size:12px">No active alerts — inventory levels are healthy ✓</div>`;

      const rows = dataArray.map((item: any) => {
        const val = ((item.quantity || 0) * (item.pricePerUnit || 0));
        const isLow = item.quantity <= 10;
        const isExpired = item.expirationDate && new Date(item.expirationDate) < new Date();
        const daysLeft = item.expirationDate ? Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / 86400000) : null;
        const expBadge = isExpired
          ? `<span style="display:inline-flex;padding:1px 6px;border-radius:999px;font-size:9px;font-weight:700;background:#fee2e2;color:#991b1b">EXPIRED</span>`
          : (daysLeft !== null && daysLeft <= 7
            ? `<span style="display:inline-flex;padding:1px 6px;border-radius:999px;font-size:9px;font-weight:700;background:#fef9c3;color:#854d0e">${daysLeft}d</span>`
            : (daysLeft !== null ? `<span style="font-size:11px;color:#64748b">${daysLeft}d</span>` : '<span style="color:#94a3b8">—</span>'));
        return `<tr${isExpired ? ' style="background:#fef2f2"' : isLow ? ' style="background:#fff7ed"' : ''}>
          <td style="font-weight:600">${item.name || 'N/A'}</td>
          <td style="text-transform:capitalize">${item.category || 'other'}</td>
          <td>${isLow
            ? `<span style="font-weight:700;color:#c2410c">${item.quantity} ${item.unit}</span>`
            : `${item.quantity} ${item.unit || ''}`}</td>
          <td>QAR ${item.pricePerUnit?.toFixed(2) ?? 'N/A'}</td>
          <td style="font-weight:600">QAR ${val.toFixed(2)}</td>
          <td>${expBadge}</td>
          <td>${Array.isArray(item.consumption) ? item.consumption.length : 0}</td>
        </tr>`;
      }).join('');

      bodyHtml = `
        <div class="stat-grid" style="grid-template-columns:repeat(4,1fr)">
          <div class="stat-card" style="background:#f0fdf4;border-color:#bbf7d0">
            <div class="stat-label" style="color:#15803d">Total Items</div>
            <div class="stat-value" style="color:#14532d">${dataArray.length}</div>
          </div>
          <div class="stat-card" style="background:#eef2ff;border-color:#c7d2fe">
            <div class="stat-label" style="color:#4338ca">Total Value</div>
            <div class="stat-value" style="color:#312e81;font-size:16px">QAR ${totalVal.toFixed(0)}</div>
          </div>
          <div class="stat-card" style="background:#fff7ed;border-color:#fed7aa">
            <div class="stat-label" style="color:#c2410c">Low Stock</div>
            <div class="stat-value" style="color:#7c2d12">${lowStockItems.length}</div>
          </div>
          <div class="stat-card" style="background:#fef2f2;border-color:#fecaca">
            <div class="stat-label" style="color:#991b1b">Expiring Soon</div>
            <div class="stat-value" style="color:#7f1d1d">${expiredItems.length + expiringItems.length}</div>
          </div>
              </div>
              
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div class="card" style="margin-bottom:0">
            <div class="card-hdr" style="background:#f0fdf4;border-color:#bbf7d0;color:#15803d">Category Breakdown</div>
            <div class="card-body">${catRowsHtml || '<div style="color:#94a3b8;font-size:12px">No data</div>'}</div>
            </div>
          <div class="card" style="margin-bottom:0">
            <div class="card-hdr" style="background:#fef2f2;border-color:#fecaca;color:#991b1b">Stock & Expiry Alerts</div>
            <div class="card-body">${alertsHtml}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-hdr" style="background:#f0fdf4;border-color:#bbf7d0;color:#15803d">Complete Food Inventory (${dataArray.length} items)</div>
          <div class="card-body" style="padding:0">
            <table>
              <thead><tr><th>Name</th><th>Category</th><th>Quantity</th><th>Price/Unit</th><th>Total Value</th><th>Expiry</th><th>Uses</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;

    } else if (currentReportType === 'vehicle') {
      const rows = dataArray.map((v: any) => `
        <tr>
          <td style="font-weight:600">${v.make || 'N/A'} ${v.model || ''}</td>
          <td>${v.year || 'N/A'}</td>
          <td class="mono">${v.plateNumber || 'N/A'}</td>
          <td>${statusBadge(v.status)}</td>
          <td>QAR ${v.rentalAmount?.toFixed(2) ?? 'N/A'}</td>
        </tr>`).join('');
      bodyHtml = `
        <div class="card">
          <div class="card-hdr" style="background:#eff6ff;border-color:#bfdbfe;color:#1e40af">Vehicle Fleet</div>
          <div class="card-body" style="padding:0">
            <table>
              <thead><tr><th>Vehicle</th><th>Year</th><th>Plate</th><th>Status</th><th>Rental Amount</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;

    } else if (currentReportType === 'ai') {
      const rows = dataArray.map((a: any) => `
        <tr>
          <td>${a.type || 'N/A'}</td>
          <td>${statusBadge(a.severity)}</td>
          <td style="font-weight:600">${a.title || 'N/A'}</td>
          <td style="font-size:11px;color:#64748b">${a.description || 'N/A'}</td>
          <td>${fmtDate(a.createdAt)}</td>
        </tr>`).join('');
      bodyHtml = `
        <div class="card">
          <div class="card-hdr" style="background:#faf5ff;border-color:#e9d5ff;color:#6b21a8">AI Analysis Alerts</div>
          <div class="card-body" style="padding:0">
            <table>
              <thead><tr><th>Type</th><th>Severity</th><th>Title</th><th>Description</th><th>Date</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    }

    /* ── Final assembled HTML ────────────────────────────────────────── */
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${reportTitle}</title>
<style>${css}</style>
</head>
<body>
  <!-- Hero header -->
  <div class="hero">
    <div class="hero-left">
      <div class="hero-label">${currentReportType.toUpperCase()} REPORT</div>
      <div class="hero-title">${reportTitle}</div>
      <div class="hero-meta">Generated: ${dateStr} &nbsp;·&nbsp; By: ${user?.email || 'System'}</div>
          </div>
    <div class="hero-right">
      <div class="hero-badge">
        <span style="width:6px;height:6px;border-radius:50%;background:#a5f3fc;display:inline-block"></span>
            Enterprise Asset Management
          </div>
      <div class="hero-id">Report ID: ${reportId}</div>
      </div>
  </div>

  <!-- Body content -->
  ${bodyHtml}

  <!-- Compliance footer -->
  <div class="compliance">
    <h4>Global Standards Compliance</h4>
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
    <span>Report ID: ${reportId} &nbsp;·&nbsp; Retention: 7 years</span>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 600);
    };
  </script>
</body>
</html>`;
  };

  /* ── Page UI ──────────────────────────────────────────────────────────── */
  const reportCards = [
    {
      type: 'asset' as const,
      title: 'Asset Reports',
      description: 'Detailed inventory, health scores, history timelines & RFID movement data',
      icon: Package,
      gradient: 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700',
      iconBg: 'bg-indigo-500/60',
      badge: 'RFID Ready',
    },
    {
      type: 'food' as const,
      title: 'Food Supply Reports',
      description: 'Inventory levels, consumption trends, low-stock alerts & valuations',
      icon: Utensils,
      gradient: 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700',
      iconBg: 'bg-emerald-500/60',
      badge: 'Live Data',
    },
    {
      type: 'vehicle' as const,
      title: 'Vehicle Fleet Reports',
      description: 'Fleet status, rental records, maintenance history & driver summaries',
      icon: Car,
      gradient: 'bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-700',
      iconBg: 'bg-blue-500/60',
    },
    {
      type: 'ai' as const,
      title: 'AI Analysis Reports',
      description: 'Machine-learning insights, predictive alerts & recommendation summaries',
      icon: BrainCircuit,
      gradient: 'bg-gradient-to-br from-violet-600 via-purple-700 to-fuchsia-700',
      iconBg: 'bg-violet-500/60',
      badge: 'AI Powered',
    },
  ];

  const getHistoryTypeColors = (type: string) => {
    const map: Record<string, { dot: string; text: string }> = {
      asset: { dot: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400' },
      food: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
      vehicle: { dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
      ai: { dot: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400' },
    };
    return map[type] ?? { dot: 'bg-slate-400', text: 'text-slate-600' };
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-400" />
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Reports Center</p>
                </div>
            <h1 className="text-2xl font-black tracking-tight">{t("print_reports")}</h1>
            <p className="text-sm text-muted-foreground mt-1">Generate, preview and print enterprise-grade reports</p>
              </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
            <Shield className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">ISO 27001 Compliant</span>
                </div>
              </div>

        {/* ── Report type cards ────────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4">Select Report Type</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {reportCards.map((card) => (
              <ReportCard
                key={card.type}
                title={card.title}
                description={card.description}
                icon={card.icon}
                gradient={card.gradient}
                iconBg={card.iconBg}
                badge={card.badge}
                onClick={() => handleReportIconClick(card.type)}
                isPrinting={isPrinting && activeType === card.type}
              />
            ))}
                </div>
              </div>

        {/* ── Consumption Summary ──────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Consumption Analytics</h2>
            <button
              disabled={isPrinting && activeType === 'consumption'}
              onClick={() => {
            setIsPrinting(true);
                setActiveType('consumption');
            fetch("/api/reports/consumption-summary")
                  .then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); })
              .then(async (data) => {
                setReportData(data);
                const bodyHtml = `<div id="consumption-report">${renderConsumptionSummaryReport(data)}</div>`;
                    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${t("consumption_summary")}</title><style>body{font-family:system-ui,sans-serif;margin:1rem;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #e5e7eb;padding:8px;text-align:left;}th{background:#f9fafb;}</style></head><body>${bodyHtml}</body></html>`;
                  await printContentWithIframe(fullHtml, t("consumption_summary"));
                  toast({ title: t("report_generated"), description: format(new Date(), "PPP p") });
                  })
                  .catch(() => toast({ title: "Error", description: "Failed to fetch consumption data.", variant: "destructive" }))
                  .finally(() => { setIsPrinting(false); setActiveType(null); });
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-2 disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" />
              {isPrinting && activeType === 'consumption' ? 'Generating…' : 'Print Summary'}
            </button>
                </div>
          <ConsumptionSummaryCard />
              </div>

        {/* ── Report History ───────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Report History</h2>
            {reportHistory.length > 0 && (
              <span className="text-[10px] font-bold bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                {reportHistory.length} reports
              </span>
            )}
        </div>
        
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-indigo-600 animate-spin" />
                  <span className="text-sm">Loading history…</span>
                </div>
              </div>
            ) : reportHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <FileText className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">{t("no_reports_found")}</p>
                <p className="text-xs opacity-60 mt-1">Generate a report above to see it here</p>
              </div>
            ) : (
                <Table>
                  <TableHeader>
                  <TableRow className="border-b border-border/60 bg-muted/30">
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">{t("report_type")}</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">{t("report_details")}</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">{t("report_date")}</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">{t("report_user")}</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {reportHistory.map((report) => {
                    const colors = getHistoryTypeColors(report.reportType);
                    return (
                      <TableRow key={report.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                            <span className={`text-xs font-semibold ${colors.text}`}>
                              {getReportTypeName(report.reportType)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <span className="font-semibold text-foreground">
                              {report.itemScope === "all" ? t("all_items") : t("specific_item")}
                            </span>
                            <span className="text-muted-foreground ml-1.5">
                              {report.dateRange === "full" ? t("full_date_range") : t("custom_date_range")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(report.createdAt), "d MMM yyyy, HH:mm")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span className="truncate max-w-[140px]">{report.userEmail}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            onClick={() => {
                              setCurrentReportType(report.reportType as any);
                              handleGenerateReport({
                                reportType: report.reportType as any,
                                itemScope: report.itemScope as any,
                                specificItemId: report.specificItemId || undefined,
                                dateRange: report.dateRange as any,
                                startDate: report.startDate ? new Date(report.startDate) : undefined,
                                endDate: report.endDate ? new Date(report.endDate) : undefined,
                              });
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 px-2 py-1 rounded-lg transition-colors"
                          >
                            <Printer className="h-3 w-3" /> Re-print
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  </TableBody>
                </Table>
            )}
          </div>
        </div>
      </div>

      <PrintReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        reportType={currentReportType}
        onGenerateReport={handleGenerateReport}
      />
    </DashboardLayout>
  );
}
