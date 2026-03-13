import { useState, useEffect, useCallback } from "react";
import { NextPage } from "next";
import Head from "next/head";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AuditLogViewer } from "@/components/AuditLogViewer";
import { AuditLogAdvancedSearch } from "@/components/AuditLogAdvancedSearch";
import { AuditLogReportGenerator } from "@/components/AuditLogReportGenerator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import {
  AlertTriangle, CheckCircle2, ClipboardList, Download, FileText,
  Lock, RefreshCw, Shield, ShieldAlert, User, Search,
  Calendar, Clock, Database, Archive, Activity, TrendingUp,
  ShieldCheck, Globe, Zap, ChevronRight,
} from "lucide-react";
import { logComplianceEvent, getAuditLogs } from "@/lib/audit";

// ── Types ─────────────────────────────────────────────────────────────────────

type SearchFilters = {
  resourceType: string;
  resourceId: string;
  type: string;
  severity: string;
  startDate: string;
  endDate: string;
  action: string;
  verified: boolean | undefined;
  userEmail: string;
  ipAddress: string;
};

const DEFAULT_FILTERS: SearchFilters = {
  resourceType: "", resourceId: "", type: "", severity: "",
  startDate: "", endDate: "", action: "", verified: undefined,
  userEmail: "", ipAddress: "",
};

// ── Small UI atoms ─────────────────────────────────────────────────────────────

const CompliantBadge = () => (
  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
    <CheckCircle2 className="h-3 w-3" /> Compliant
  </span>
);

const ComplianceItem = ({ label }: { label: string }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
    <div className="flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      <span className="text-sm text-foreground">{label}</span>
    </div>
    <CompliantBadge />
  </div>
);

type RetentionBand = "short" | "medium" | "long" | "permanent";
const BAND_STYLES: Record<RetentionBand, string> = {
  short:     "bg-blue-500",
  medium:    "bg-violet-500",
  long:      "bg-amber-500",
  permanent: "bg-emerald-500",
};
const BAND_WIDTHS: Record<RetentionBand, string> = {
  short: "w-1/4", medium: "w-2/4", long: "w-3/4", permanent: "w-full",
};

const RetentionRow = ({ label, period, band }: { label: string; period: string; band: RetentionBand }) => (
  <div className="flex items-center gap-4 py-3 border-b border-border last:border-0 group">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium">{label}</p>
    </div>
    <div className="w-32 hidden sm:flex items-center h-1.5 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${BAND_STYLES[band]} ${BAND_WIDTHS[band]}`} />
    </div>
    <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap bg-muted px-2.5 py-1 rounded-full">
      {period}
    </span>
  </div>
);

// ── Main Page ──────────────────────────────────────────────────────────────────

const CompliancePage: NextPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("audit-logs");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [savedSearches, setSavedSearches] = useState<{ name: string; filters: any }[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use the proper isAdmin field from AuthContext
  const isAdmin = user?.isAdmin === true;

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchAuditLogs = useCallback(async (filters: any) => {
    try {
      const result = await getAuditLogs(filters, true);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
        setAuditLogs([]);
      } else {
        setAuditLogs(result.logs ?? []);
      }
    } catch {
      toast({ title: "Error", description: "Failed to fetch audit logs", variant: "destructive" });
      setAuditLogs([]);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("auditLogSavedSearches");
    if (stored) {
      try { setSavedSearches(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  // Log page access
  useEffect(() => {
    if (!user) return;
    logComplianceEvent("COMPLIANCE_PAGE_ACCESS", { page: "compliance", timestamp: new Date().toISOString() })
      .catch(console.error);
  }, [user]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleFilterChange = (key: string, value: any) =>
    setSearchFilters(prev => ({ ...prev, [key]: value }));

  const handleSearch = () => fetchAuditLogs(searchFilters);

  const handleResetFilters = () => setSearchFilters(DEFAULT_FILTERS);

  const handleSaveSearch = (name: string) => {
    const updated = [...savedSearches, { name, filters: { ...searchFilters } }];
    setSavedSearches(updated);
    localStorage.setItem("auditLogSavedSearches", JSON.stringify(updated));
    toast({ title: "Search Saved", description: `"${name}" saved successfully.` });
  };

  const handleLoadSavedSearch = (filters: any) => {
    setSearchFilters(filters);
    fetchAuditLogs(filters);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshKey(k => k + 1);
    await new Promise(r => setTimeout(r, 500));
    setIsRefreshing(false);
    toast({ title: "Refreshed", description: "Audit logs refreshed." });
  };

  const handleGenerateReport = async (format: string, options: any) => {
    try {
      toast({ title: "Generating Report", description: "Please wait…" });
      const res = await fetch("/api/audit/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: searchFilters, options: { ...options, format } }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed to generate report");
      }
      const data = await res.json();
      await logComplianceEvent("AUDIT_REPORT_GENERATED", { format, logCount: data.logs.length });

      if (format === "csv" || format === "excel") {
        const headers = options.columns.map((c: string) =>
          ({ timestamp: "Timestamp", userEmail: "User", action: "Action", resourceType: "Resource Type",
            resourceId: "Resource ID", type: "Type", severity: "Severity", verified: "Verified",
            ipAddress: "IP Address", id: "Log ID" }[c] ?? c));
        const rows = data.logs.map((log: any) =>
          options.columns.map((col: string) => {
            let v = log[col];
            if (col === "timestamp") v = new Date(v).toISOString();
            else if (col === "verified") v = v ? "Yes" : "No";
            else if (v == null) v = "";
            if (typeof v === "string" && (v.includes(",") || v.includes('"')))
              v = `"${v.replace(/"/g, '""')}"`;
            return v;
          }).join(","));
        const csv = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csv], { type: format === "csv" ? "text/csv;charset=utf-8;" : "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `audit_logs_${new Date().toISOString().split("T")[0]}.${format}`;
        a.style.visibility = "hidden"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        toast({ title: "Downloaded", description: `${format.toUpperCase()} report downloaded.` });
      } else if (format === "pdf") {
        localStorage.setItem("auditReportOptions", JSON.stringify(options));
        localStorage.setItem("auditReportFilters", JSON.stringify(searchFilters));
        localStorage.setItem("auditReportData", JSON.stringify(data.logs));
        window.open("/reports/audit-print", "_blank");
        toast({ title: "PDF Ready", description: "Report opened in a new tab for printing." });
      } else if (format === "json") {
        const blob = new Blob([JSON.stringify(data.logs, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `audit_logs_${new Date().toISOString().split("T")[0]}.json`;
        a.style.visibility = "hidden"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        toast({ title: "Downloaded", description: "JSON report downloaded." });
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to generate report", variant: "destructive" });
    }
  };

  const handleGenerateComplianceReport = async (reportType: string) => {
    try {
      await logComplianceEvent("COMPLIANCE_REPORT_GENERATED", {
        reportType, generatedBy: user?.email, timestamp: new Date().toISOString(),
      });
      toast({ title: `${reportType} Report`, description: "Report generation logged successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to generate compliance report", variant: "destructive" });
    }
  };

  // ── Tab definitions ────────────────────────────────────────────────────────

  const TABS = [
    { id: "audit-logs",        label: "Audit Logs",         icon: Activity },
    { id: "compliance-status", label: "Compliance Status",  icon: ShieldCheck },
    { id: "data-retention",    label: "Data Retention",     icon: Archive },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Head>
        <title>Compliance & Audit | Asset AI</title>
      </Head>
      <DashboardLayout>
        <div className="space-y-8">

          {/* ── Hero Banner ───────────────────────────────────────────── */}
          <div className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-blue-950 to-indigo-900" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.25),transparent_55%)]" />
            <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-80 h-40 rounded-full bg-blue-500/10 blur-2xl" />

            <div className="relative z-10 px-8 py-8 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center flex-shrink-0">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-3xl font-bold text-white tracking-tight">Compliance & Audit</h1>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ISO · GDPR · SOC2
                    </span>
                  </div>
                  <p className="text-blue-200 text-sm">
                    Monitor system activity and ensure compliance with global standards
                  </p>
                </div>
              </div>

              {/* Admin report buttons */}
              {isAdmin && (
                <div className="flex flex-wrap gap-2 lg:flex-shrink-0">
                  {[
                    { label: "GDPR Report",    icon: Globe,        type: "GDPR Compliance",   color: "from-emerald-500 to-teal-500" },
                    { label: "SOC2 Report",    icon: Lock,         type: "SOC2 Compliance",   color: "from-blue-500 to-indigo-500" },
                    { label: "ISO 27001",      icon: ShieldAlert,  type: "ISO 27001",         color: "from-violet-500 to-purple-600" },
                  ].map(btn => (
                    <button key={btn.type}
                      onClick={() => handleGenerateComplianceReport(btn.type)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r ${btn.color} text-white text-sm font-semibold shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all`}>
                      <btn.icon className="h-4 w-4" />
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="relative z-10 px-8 pb-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Standards Covered",   value: "3",      sub: "ISO · GDPR · SOC2",     icon: ShieldCheck, color: "text-emerald-400" },
                { label: "Compliance Status",   value: "100%",   sub: "All checks passing",    icon: CheckCircle2, color: "text-blue-400" },
                { label: "Retention Policies",  value: "12",     sub: "Categories defined",    icon: Archive,     color: "text-violet-400" },
                { label: "Next Review",         value: "90d",    sub: "Scheduled review",      icon: Calendar,    color: "text-amber-400" },
              ].map(s => (
                <div key={s.label} className="bg-white/8 backdrop-blur border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-blue-200 font-medium">{s.label}</span>
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-xs text-blue-300/70 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Info Notice ───────────────────────────────────────────── */}
          <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-blue-900 dark:text-blue-200 text-sm">Compliance Information</p>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-0.5">
                This system maintains comprehensive audit logs compliant with ISO 27001, GDPR, and SOC2 standards.
                All user actions, data access, and system events are recorded and available to authorized personnel.
              </p>
            </div>
          </div>

          {/* ── Tab Navigation ────────────────────────────────────────── */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}>
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "audit-logs" && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-xl gap-2"
                  onClick={() => setShowAdvancedSearch(v => !v)}>
                  <Search className="h-4 w-4" />
                  {showAdvancedSearch ? "Hide Search" : "Advanced Search"}
                </Button>
                <AuditLogReportGenerator
                  logs={auditLogs}
                  filters={searchFilters}
                  onGenerateReport={handleGenerateReport}
                />
                <Button variant="outline" size="sm" className="rounded-xl gap-2"
                  onClick={handleRefresh} disabled={isRefreshing}>
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            )}
          </div>

          {/* ── Tab Content ───────────────────────────────────────────── */}

          {/* Audit Logs */}
          {activeTab === "audit-logs" && (
            <div className="space-y-5">
              {showAdvancedSearch && (
                <div className="rounded-2xl border border-border overflow-hidden">
                  <div className="px-5 py-3 bg-muted/50 border-b border-border">
                    <h3 className="text-sm font-semibold">Advanced Search</h3>
                  </div>
                  <div className="p-1">
                    <AuditLogAdvancedSearch
                      filters={searchFilters}
                      onFilterChange={handleFilterChange}
                      onSearch={handleSearch}
                      onReset={handleResetFilters}
                      onSaveSearch={handleSaveSearch}
                      savedSearches={savedSearches}
                      onLoadSavedSearch={handleLoadSavedSearch}
                      isAdmin={isAdmin}
                    />
                  </div>
                </div>
              )}
              <div className="rounded-2xl border border-border overflow-hidden">
                <AuditLogViewer
                  key={refreshKey}
                  showFilters={!showAdvancedSearch}
                  showPagination={true}
                  limit={15}
                />
              </div>
            </div>
          )}

          {/* Compliance Status */}
          {activeTab === "compliance-status" && (
            <div className="space-y-6">
              {/* Overall score banner */}
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-900 dark:text-emerald-200 text-lg">All Systems Compliant</p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">3 standards · 15 controls verified</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">100%</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Compliance rate</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* GDPR */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                          <Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="font-bold">GDPR Compliance</h3>
                          <p className="text-xs text-muted-foreground">General Data Protection Regulation</p>
                        </div>
                      </div>
                      <CompliantBadge />
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    {["Data Processing Agreement", "Right to Access", "Right to be Forgotten", "Data Portability", "Privacy by Design"].map(item => (
                      <ComplianceItem key={item} label={item} />
                    ))}
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">Last check</p>
                        <p className="text-sm font-semibold">March 10, 2025</p>
                      </div>
                      <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">Next review</p>
                        <p className="text-sm font-semibold">June 10, 2025</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SOC2 */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-bold">SOC2 Compliance</h3>
                          <p className="text-xs text-muted-foreground">Service Organization Control 2</p>
                        </div>
                      </div>
                      <CompliantBadge />
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    {["Security", "Availability", "Processing Integrity", "Confidentiality", "Privacy"].map(item => (
                      <ComplianceItem key={item} label={item} />
                    ))}
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">Last audit</p>
                        <p className="text-sm font-semibold">Feb 15, 2025</p>
                      </div>
                      <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">Valid until</p>
                        <p className="text-sm font-semibold">Feb 15, 2026</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ISO 27001 */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-violet-50/50 to-transparent dark:from-violet-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                          <ShieldAlert className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                          <h3 className="font-bold">ISO 27001</h3>
                          <p className="text-xs text-muted-foreground">Information Security Management System</p>
                        </div>
                      </div>
                      <CompliantBadge />
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    {["Security Policy", "Asset Management", "Access Control", "Incident Management", "Business Continuity"].map(item => (
                      <ComplianceItem key={item} label={item} />
                    ))}
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">Certified</p>
                        <p className="text-sm font-semibold">Jan 20, 2025</p>
                      </div>
                      <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">Next assessment</p>
                        <p className="text-sm font-semibold">Jan 20, 2026</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Data Subject Rights */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                          <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <h3 className="font-bold">Data Subject Rights</h3>
                          <p className="text-xs text-muted-foreground">Data Subject Access Requests</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                        0 Pending
                      </span>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    {[
                      { label: "Access Requests",        count: 0 },
                      { label: "Deletion Requests",      count: 0 },
                      { label: "Rectification Requests", count: 0 },
                      { label: "Portability Requests",   count: 0 },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-sm">{item.label}</span>
                        </div>
                        <span className="text-sm font-semibold text-muted-foreground">{item.count} pending</span>
                      </div>
                    ))}
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">Avg response time</p>
                        <p className="text-sm font-semibold">24 hours</p>
                      </div>
                      <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">Compliance rate</p>
                        <p className="text-sm font-semibold text-emerald-600">100%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Data Retention */}
          {activeTab === "data-retention" && (
            <div className="space-y-5">
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 px-1">
                <p className="text-sm font-semibold text-muted-foreground">Retention period:</p>
                {[
                  { band: "short",     label: "≤ 90 days",  color: "bg-blue-500" },
                  { band: "medium",    label: "1 – 2 years", color: "bg-violet-500" },
                  { band: "long",      label: "5 – 7 years", color: "bg-amber-500" },
                  { band: "permanent", label: "10 years+",  color: "bg-emerald-500" },
                ].map(l => (
                  <div key={l.band} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                    {l.label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* User Data */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="px-6 py-4 border-b border-border flex items-center gap-3 bg-muted/30">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">User Data</h3>
                      <p className="text-xs text-muted-foreground">Account & activity records</p>
                    </div>
                  </div>
                  <div className="px-6 py-3">
                    <RetentionRow label="Account Information"  period="Until deletion" band="permanent" />
                    <RetentionRow label="Authentication Logs"  period="90 days"        band="short" />
                    <RetentionRow label="Activity Logs"        period="1 year"         band="medium" />
                  </div>
                </div>

                {/* Asset Data */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="px-6 py-4 border-b border-border flex items-center gap-3 bg-muted/30">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                      <Database className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">Asset Data</h3>
                      <p className="text-xs text-muted-foreground">Physical asset records</p>
                    </div>
                  </div>
                  <div className="px-6 py-3">
                    <RetentionRow label="Asset Records"    period="7 years (post-disposal)" band="long" />
                    <RetentionRow label="Movement History" period="5 years"                  band="long" />
                    <RetentionRow label="Location Data"    period="2 years"                  band="medium" />
                  </div>
                </div>

                {/* Vehicle Data */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="px-6 py-4 border-b border-border flex items-center gap-3 bg-muted/30">
                    <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                      <Activity className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">Vehicle Data</h3>
                      <p className="text-xs text-muted-foreground">Fleet management records</p>
                    </div>
                  </div>
                  <div className="px-6 py-3">
                    <RetentionRow label="Vehicle Records"     period="10 years"  band="permanent" />
                    <RetentionRow label="Rental History"      period="7 years"   band="long" />
                    <RetentionRow label="Maintenance Records" period="5 years"   band="long" />
                  </div>
                </div>

                {/* Compliance Data */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="px-6 py-4 border-b border-border flex items-center gap-3 bg-muted/30">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">Compliance Data</h3>
                      <p className="text-xs text-muted-foreground">Audit logs & incident records</p>
                    </div>
                  </div>
                  <div className="px-6 py-3">
                    <RetentionRow label="Audit Logs"         period="7 years"   band="long" />
                    <RetentionRow label="Security Incidents" period="10 years"  band="permanent" />
                    <RetentionRow label="Compliance Reports" period="7 years"   band="long" />
                  </div>
                </div>
              </div>

              {/* Notice */}
              <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl px-5 py-4">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm">Data Retention Notice</p>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                    Retention periods may be extended for legal holds or ongoing investigations.
                    Contact your compliance officer for exceptions or special circumstances.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  );
};

export default CompliancePage;
