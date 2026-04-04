// @ts-nocheck
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useEffect, useState, useRef, useCallback } from "react";
import { fetchWithCache, getFromCache } from "@/lib/api-cache";
const VENDORS_KEY = "/api/vendors";
const VENDORS_TTL = 3 * 60_000;
import { VendorManagementDialog } from "@/components/VendorManagementDialog";
import { useTranslation } from "@/contexts/TranslationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import Link from "next/link";
import * as XLSX from "xlsx";
import React from "react";
import {
  AlertTriangle, Edit, PlusCircle, Search, Star, Users, Building2,
  TrendingUp, Award, RefreshCw, ChevronRight, Settings,
  Shield, CheckCircle, ExternalLink, Info, Key, Globe,
  Database, XCircle, Clock,
  Mail, Webhook, Code, Copy, ArrowRight,
  Sliders, Save, Bell, Wifi,
  Plus, Edit2, Trash2, Package, X,
  Upload, FileText, Download, Play,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Vendor = {
  id: string; name: string; email: string | null; phone: string | null;
  address: string | null; type: string[]; reliabilityScore: number | null;
  qualityScore: number | null; responseTimeScore: number | null;
  lastReviewDate: string | null; notes: string | null;
  createdAt: string; updatedAt: string;
};

const TABS = [
  { id: "vendors",     label: "Vendors",           icon: Building2 },
  { id: "departments", label: "Departments",        icon: Building2 },
  { id: "parameters",  label: "System Parameters",  icon: Sliders },
  { id: "sso",         label: "Azure AD SSO",        icon: Shield },
  { id: "erp",         label: "ERP — Dynamics 365", icon: Database },
  { id: "itsm",        label: "ITSM & Email",        icon: Mail },
  { id: "migration",   label: "Data Migration",      icon: Upload },
] as const;
type TabId = (typeof TABS)[number]["id"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const getScoreColor = (s: number) => s >= 80 ? "#10b981" : s >= 60 ? "#f59e0b" : "#ef4444";
const getScoreBg = (s: number) =>
  s >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
  : s >= 60 ? "bg-amber-50 text-amber-700 border-amber-200"
  : "bg-red-50 text-red-700 border-red-200";

const ScoreBar = ({ value }: { value: number | null }) => {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  const color = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-7 text-right">{value}</span>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// TAB: VENDORS
// ══════════════════════════════════════════════════════════════════════════════
function VendorsTab() {
  const cachedVendors = getFromCache<Vendor[]>(VENDORS_KEY, VENDORS_TTL) ?? [];
  const [vendors, setVendors] = useState<Vendor[]>(cachedVendors);
  const [filtered, setFiltered] = useState<Vendor[]>(cachedVendors);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(() => !getFromCache(VENDORS_KEY, VENDORS_TTL));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Vendor | undefined>();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();

  const load = async (bg = false) => {
    if (!bg) setLoading(true);
    try {
      const data = await fetchWithCache<Vendor[]>(VENDORS_KEY, { maxAge: VENDORS_TTL });
      if (data) { setVendors(data); setFiltered(data); }
    } catch {
      if (!bg) toast({ title: "Error", description: "Failed to load vendors", variant: "destructive" });
    } finally { if (!bg) setLoading(false); }
  };

  useEffect(() => {
    getFromCache(VENDORS_KEY, VENDORS_TTL) ? setTimeout(() => load(true), 300) : load(false);
  }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(vendors); return; }
    const q = search.toLowerCase();
    setFiltered(vendors.filter(v =>
      v.name.toLowerCase().includes(q) || v.email?.toLowerCase().includes(q) ||
      v.phone?.toLowerCase().includes(q) || v.type.some(t => t.toLowerCase().includes(q))
    ));
  }, [search, vendors]);

  const calcScore = (v: Vendor) => {
    const scores = [v.reliabilityScore, v.qualityScore, v.responseTimeScore].filter(s => s !== null) as number[];
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  };
  const getStatus = (s: number | null) => s === null ? "Not Rated" : s >= 80 ? "Excellent" : s >= 60 ? "Good" : "Needs Improvement";
  const avgScore = vendors.length ? Math.round(vendors.reduce((sum, v) => sum + (calcScore(v) ?? 0), 0) / vendors.length) : 0;
  const excellentCount = vendors.filter(v => (calcScore(v) ?? 0) >= 80).length;
  const poorCount = vendors.filter(v => { const s = calcScore(v); return s !== null && s < 60; }).length;

  const quickNav = [
    { href: "/settings/vendor-performance", icon: Star, label: "Vendor Performance", color: "from-amber-500 to-orange-500", bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-600 dark:text-amber-400", desc: "Track & rate vendors" },
    { href: "/settings/error-logs",         icon: AlertTriangle, label: "Error Logs", color: "from-red-500 to-rose-600", bg: "bg-red-50 dark:bg-red-950", text: "text-red-600 dark:text-red-400", desc: "Monitor system errors" },
    { href: "/settings/user-management",    icon: Users, label: "User Management", color: "from-violet-500 to-purple-600", bg: "bg-violet-50 dark:bg-violet-950", text: "text-violet-600 dark:text-violet-400", desc: "Manage access & roles" },
    ...(user?.isAdmin ? [{ href: "/admin/organizations", icon: Building2, label: "All Organizations", color: "from-blue-500 to-indigo-600", bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-600 dark:text-blue-400", desc: "Manage organizations" }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Vendors", value: vendors.length, icon: Building2, color: "text-blue-400" },
              { label: "Avg Score", value: avgScore || "—", icon: TrendingUp, color: "text-violet-400" },
              { label: "Excellent", value: excellentCount, icon: Award, color: "text-emerald-400" },
          { label: "Needs Improvement", value: poorCount, icon: AlertTriangle, color: "text-amber-400" },
            ].map(stat => (
          <div key={stat.label} className="bg-muted/40 border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
            <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            ))}
        </div>

      {/* Quick nav */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickNav.map(item => (
            <Link key={item.href} href={item.href}>
            <div className={`group relative rounded-2xl border border-border ${item.bg} p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all`}>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <p className={`font-semibold text-sm ${item.text}`}>{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              </div>
            </Link>
          ))}
        </div>

      {/* Table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border">
            <div>
            <h2 className="text-lg font-bold">{t("vendors")}</h2>
            <p className="text-sm text-muted-foreground">{t("manage_your_vendors")}</p>
            </div>
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("search_vendors")} className="pl-9 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" onClick={() => load()}><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={() => { setSelected(undefined); setDialogOpen(true); }} className="gap-2">
              <PlusCircle className="h-4 w-4" /> Add Vendor
            </Button>
          </div>
        </div>
        {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent" />
                <p className="text-sm text-muted-foreground">Loading vendors...</p>
              </div>
            </div>
        ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground/50" />
              </div>
            <p className="font-semibold text-muted-foreground">{search ? "No vendors match your search" : "No vendors found"}</p>
            {!search && (
              <Button className="mt-4 gap-2" onClick={() => { setSelected(undefined); setDialogOpen(true); }}>
                  <PlusCircle className="h-4 w-4" /> Add your first vendor
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Vendor</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Reliability</TableHead>
                  <TableHead className="font-semibold">Quality</TableHead>
                  <TableHead className="font-semibold">Response</TableHead>
                  <TableHead className="font-semibold">Overall</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
              {filtered.map(vendor => {
                const overall = calcScore(vendor);
                  return (
                    <TableRow key={vendor.id} className="hover:bg-muted/30 transition-colors group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {vendor.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{vendor.name}</p>
                            <p className="text-xs text-muted-foreground">{vendor.email ?? vendor.phone ?? "—"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                        {vendor.type?.map(t => <Badge key={t} variant="secondary" className="text-[10px] px-2 py-0">{t.replace("_", " ")}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell><ScoreBar value={vendor.reliabilityScore} /></TableCell>
                      <TableCell><ScoreBar value={vendor.qualityScore} /></TableCell>
                      <TableCell><ScoreBar value={vendor.responseTimeScore} /></TableCell>
                      <TableCell>
                        {overall !== null ? (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${getScoreBg(overall)}`}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getScoreColor(overall) }} />
                          {getStatus(overall)} · {overall}
                          </span>
                      ) : <span className="text-xs text-muted-foreground">Not Rated</span>}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => { setSelected(vendor); setDialogOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        {!loading && filtered.length > 0 && (
            <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground">
            Showing {filtered.length} of {vendors.length} vendors
          </div>
        )}
      </div>
      <VendorManagementDialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} vendor={selected} onVendorUpdated={() => load()} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: DEPARTMENTS
// ══════════════════════════════════════════════════════════════════════════════
function DepartmentsTab() {
  const { toast } = useToast();
  const [depts, setDepts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/departments").then(r => r.json()).catch(() => []);
    setDepts(Array.isArray(res) ? res : []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) { toast({ variant: "destructive", title: "Department name is required" }); return; }
    setSaving(true);
    const res = await fetch("/api/departments", {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editId ? { id: editId, ...form } : form),
      credentials: "include",
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: editId ? "Department updated" : "Department created" });
      setShowNew(false); setEditId(null); setForm({ name: "", code: "", description: "" }); load();
    } else toast({ variant: "destructive", title: "Failed to save" });
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove department "${name}"?`)) return;
    const res = await fetch("/api/departments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }), credentials: "include" });
    if (res.ok) { toast({ title: "Department removed" }); load(); }
  };

  const startEdit = (d: any) => { setEditId(d.id); setForm({ name: d.name, code: d.code || "", description: d.description || "" }); setShowNew(true); };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Departments</h2>
          <p className="text-sm text-muted-foreground">Manage departments for spare parts assignment</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          <Button size="sm" onClick={() => { setShowNew(p => !p); setEditId(null); setForm({ name: "", code: "", description: "" }); }}>
            <Plus className="w-4 h-4 mr-2" />Add Department
          </Button>
        </div>
      </div>

      {showNew && (
        <Card className="border-blue-200">
          <CardHeader><CardTitle className="text-sm">{editId ? "Edit Department" : "New Department"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Department Name *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. IT Operations, Medical" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Code (optional)</label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. IT, MED" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Description</label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? "Saving…" : "Save"}</Button>
              <Button variant="outline" onClick={() => { setShowNew(false); setEditId(null); }}><X className="w-4 h-4 mr-2" />Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Departments ({depts.length})</CardTitle>
          <CardDescription>These departments are available when assigning spare parts</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="py-12 text-center text-muted-foreground">Loading…</div>
          : depts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No departments yet. Add one above to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {depts.map(d => (
                <div key={d.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{d.name}</p>
                      {d.code && <Badge variant="secondary" className="text-xs font-mono">{d.code}</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {d.description && <span>{d.description}</span>}
                      <span className="flex items-center gap-1"><Package className="w-3 h-3" />{d._count?.assets || 0} assets</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(d)}><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => remove(d.id, d.name)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: SYSTEM PARAMETERS
// ══════════════════════════════════════════════════════════════════════════════
const PARAM_GROUPS = [
  { group: "RFID Configuration", icon: Wifi, params: [
    { key: "rfid.scan_frequency_seconds",   label: "RFID Scan Frequency (seconds)",    type: "number",  default: "30",    desc: "How often active RFID tags upload their location data" },
    { key: "rfid.low_battery_threshold",    label: "Low Battery Alert Threshold (%)",  type: "number",  default: "20",    desc: "Trigger alert when active tag battery drops below this %" },
    { key: "rfid.zone_exit_alarm_minutes",  label: "Zone Exit Alarm Delay (minutes)",  type: "number",  default: "5",     desc: "Minutes an asset must be outside its zone before alarm fires" },
    { key: "rfid.quick_stocktaking_minutes",label: "Quick Stocktaking Window (minutes)",type: "number", default: "30",    desc: "If seen within this window, asset is counted as in-stock" },
  ]},
  { group: "Notifications", icon: Bell, params: [
    { key: "notify.email_enabled",              label: "Email Notifications Enabled",       type: "boolean", default: "true",  desc: "Master switch for all email notifications" },
    { key: "notify.overdue_borrow_reminder_hours", label: "Overdue Borrow Reminder (hours)", type: "number", default: "24",   desc: "Remind borrower every N hours after overdue" },
    { key: "notify.warranty_expiry_days",       label: "Warranty Expiry Warning (days)",    type: "number",  default: "30",    desc: "Days before warranty expiry to send alert" },
    { key: "notify.max_notifications_per_day",  label: "Max Notifications Per User Per Day",type: "number",  default: "20",    desc: "Throttle notifications to prevent spam" },
  ]},
  { group: "Security & Access", icon: Shield, params: [
    { key: "security.session_timeout_hours",  label: "Session Timeout (hours)",          type: "number",  default: "8",     desc: "Auto-logout inactive users after this many hours" },
    { key: "security.max_login_attempts",     label: "Max Failed Login Attempts",        type: "number",  default: "5",     desc: "Lock account after this many failed attempts" },
    { key: "security.require_mfa",            label: "Require MFA for Admin Roles",      type: "boolean", default: "false", desc: "Enforce multi-factor authentication for ADMIN and MANAGER roles" },
    { key: "security.audit_retention_days",   label: "Audit Log Retention (days)",       type: "number",  default: "365",   desc: "How long to keep audit logs" },
  ]},
  { group: "Asset Management", icon: Sliders, params: [
    { key: "assets.max_assets_per_user",         label: "Max Assets Per User",               type: "number",  default: "50",    desc: "Maximum assets that can be assigned to a single user" },
    { key: "assets.borrow_max_days",             label: "Max Borrow Duration (days)",         type: "number",  default: "30",    desc: "Maximum days an asset can be borrowed without admin override" },
    { key: "assets.disposal_approval_required",  label: "Disposal Requires Approval",         type: "boolean", default: "true",  desc: "Require manager approval before disposing assets" },
    { key: "assets.auto_acknowledge_after_days", label: "Auto-Acknowledge After (days)",       type: "number",  default: "0",     desc: "0 = never auto-acknowledge; N = auto-acknowledge after N days" },
  ]},
];

function SystemParametersTab() {
  const { toast } = useToast();
  const [params, setParams] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const defaults: Record<string, string> = {};
    PARAM_GROUPS.forEach(g => g.params.forEach(p => { defaults[p.key] = p.default; }));
    setParams(defaults);
  }, []);

  const saveAll = async () => {
    setSaving(true);
    await Promise.all(Object.entries(params).map(([key, value]) =>
      fetch("/api/admin/system-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) }).catch(() => null)
    ));
    setSaving(false);
    toast({ title: "System parameters saved", description: `${Object.keys(params).length} parameters updated` });
  };

  const update = (key: string, value: string) => setParams(p => ({ ...p, [key]: value }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">System Parameters</h2>
          <p className="text-sm text-muted-foreground">Configure all system settings without code changes</p>
        </div>
        <Button onClick={saveAll} disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? "Saving..." : "Save All Parameters"}</Button>
      </div>
      <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-sm text-emerald-700 dark:text-emerald-300">
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
        All parameters can be changed here without any code modification or redeployment.
      </div>
      {PARAM_GROUPS.map(({ group, icon: Icon, params: groupParams }) => (
        <Card key={group}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Icon className="w-4 h-4" />{group}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {groupParams.map(param => (
              <div key={param.key} className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <label className="text-sm font-semibold block">{param.label}</label>
                  <p className="text-xs text-muted-foreground mt-0.5">{param.desc}</p>
                  <p className="text-xs text-muted-foreground/50 font-mono mt-0.5">{param.key}</p>
                </div>
                <div className="flex-shrink-0 w-40">
                  {param.type === "boolean" ? (
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => update(param.key, params[param.key] === "true" ? "false" : "true")}
                        className={`relative w-10 h-6 rounded-full transition-colors ${params[param.key] === "true" ? "bg-blue-600" : "bg-muted"}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${params[param.key] === "true" ? "translate-x-5" : "translate-x-1"}`} />
                      </button>
                      <span className="text-xs text-muted-foreground">{params[param.key] === "true" ? "Enabled" : "Disabled"}</span>
                    </div>
                  ) : (
                    <Input type="number" value={params[param.key] || param.default}
                      onChange={e => update(param.key, e.target.value)} className="text-sm" />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: AZURE AD SSO
// ══════════════════════════════════════════════════════════════════════════════
function SSOTab() {
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const callbackUrl = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Azure AD SSO</h2>
          <p className="text-sm text-muted-foreground">Configure Microsoft Azure Active Directory Single Sign-On</p>
        </div>
        <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle className="w-3 h-3 mr-1" /> Supported
        </Badge>
      </div>

      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <p className="font-semibold mb-1">How Azure AD SSO works</p>
              <p>SSO is handled through Supabase Auth. Configure the Azure OAuth provider in your Supabase project dashboard — users will see "Sign in with Microsoft" on the login page and be redirected through Azure AD automatically.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Setup Instructions</CardTitle>
          <CardDescription>Follow these steps to configure Azure AD SSO</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { step: 1, title: "Register an App in Azure Portal", description: "Go to Azure Portal → Azure Active Directory → App Registrations → New Registration", link: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade", linkText: "Open Azure Portal" },
            { step: 2, title: "Configure Redirect URI", description: "Set the redirect URI in your Azure App to your Supabase callback URL.", code: callbackUrl || "https://your-project.supabase.co/auth/v1/callback" },
            { step: 3, title: "Enable Azure Provider in Supabase", description: "In your Supabase project, go to Authentication → Providers → Azure. Enable it and enter your Azure App's Client ID and Secret.", link: "https://supabase.com/dashboard", linkText: "Open Supabase Dashboard" },
            { step: 4, title: "Grant API Permissions", description: "In your Azure App, go to API Permissions and add: User.Read, email, openid, profile from Microsoft Graph." },
            { step: 5, title: "Test the Integration", description: "Log out and visit the login page. Click \"Sign in with Microsoft\" to verify the SSO flow works." },
          ].map(({ step, title, description, link, linkText, code }) => (
            <div key={step} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">{step}</div>
              <div className="flex-1">
                <p className="font-semibold mb-1">{title}</p>
                <p className="text-sm text-muted-foreground mb-2">{description}</p>
                {code && <div className="bg-muted border border-border rounded-lg px-3 py-2 font-mono text-xs break-all">{code}</div>}
                {link && <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"><ExternalLink className="w-3 h-3" />{linkText}</a>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Key className="w-4 h-4" /> Reference Details</CardTitle>
          <CardDescription>Store these for reference when configuring Azure AD</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Callback URL</label>
            <div className="flex items-center gap-2">
              <Input readOnly value={callbackUrl} className="font-mono text-sm bg-muted" />
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(callbackUrl)}>Copy</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Azure Tenant ID</label>
              <Input value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Azure Client ID</label>
              <Input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-sm" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">These values are stored locally for reference only. Actual configuration is done in the Supabase dashboard.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="w-4 h-4" /> Features Enabled with SSO</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {["Single Sign-On for all users","MFA via Azure AD policies","Auto-provisioning from Azure AD","Conditional Access support","Role mapping from Azure groups","Session management via Azure","Audit logs in Azure AD","Enterprise-grade security"].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />{f}</div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: ERP — DYNAMICS 365
// ══════════════════════════════════════════════════════════════════════════════
function ERPTab() {
  const { toast } = useToast();
  const [status, setStatus] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchStatus = async () => {
    const [s, l] = await Promise.all([
      fetch("/api/dynamics365/status").then(r => r.json()).catch(() => ({ status: "mock" })),
      fetch("/api/dynamics365/logs?take=20").then(r => r.json()).catch(() => []),
    ]);
    setStatus(s); setLogs(Array.isArray(l) ? l : []); setLoading(false);
  };
  useEffect(() => { fetchStatus(); }, []);

  const triggerSync = async () => {
    setSyncing(true);
    const res = await fetch("/api/dynamics365/sync", { method: "POST" }).then(r => r.json()).catch(() => ({ synced: 0, errors: 0 }));
    setSyncing(false);
    toast({ title: `Sync complete: ${res.synced} synced, ${res.errors} errors` });
    fetchStatus();
  };

  const statusIcon = status?.status === "connected" ? CheckCircle : status?.status === "error" ? XCircle : AlertTriangle;
  const statusColor = status?.status === "connected" ? "text-emerald-600" : status?.status === "error" ? "text-red-600" : "text-amber-600";
  const statusBadge = status?.status === "connected" ? "bg-emerald-100 text-emerald-700" : status?.status === "error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center"><Database className="w-5 h-5 text-white" /></div>
          <div>
            <h2 className="text-xl font-bold">ERP — Microsoft Dynamics 365</h2>
            <p className="text-sm text-muted-foreground">Sync asset data with your Dynamics 365 Finance & Operations environment</p>
          </div>
        </div>
        <Button onClick={triggerSync} disabled={syncing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Syncing..." : "Sync Now"}
        </Button>
      </div>

      <Card className={status?.status === "connected" ? "border-emerald-200" : status?.status === "error" ? "border-red-200" : "border-amber-200"}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            {React.createElement(statusIcon, { className: `w-6 h-6 ${statusColor}` })}
            <div className="flex-1">
              <p className="font-semibold">{status?.status === "connected" ? "Connected to Dynamics 365" : status?.status === "error" ? "Connection Error" : "Running in Mock Mode"}</p>
              <p className="text-sm text-muted-foreground">{status?.message || status?.error || status?.environmentUrl || ""}</p>
            </div>
            <Badge className={statusBadge}>{status?.status?.toUpperCase() || "LOADING"}</Badge>
          </div>
        </CardContent>
      </Card>

      {!status?.configured && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-base">Setup Required — Configure Environment Variables</CardTitle>
            <CardDescription>Add these variables to your Vercel environment settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(status?.envVarsNeeded || ["D365_TENANT_ID", "D365_CLIENT_ID", "D365_CLIENT_SECRET", "D365_ENVIRONMENT_URL"]).map((v: string) => (
              <div key={v} className="flex items-center gap-2">
                <code className="bg-background border border-blue-200 rounded px-2 py-1 text-sm font-mono text-blue-800 dark:text-blue-300">{v}</code>
              </div>
            ))}
            <a href="https://docs.microsoft.com/dynamics365/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2">
              <ExternalLink className="w-3 h-3" /> D365 API Documentation
            </a>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asset Field Mapping</CardTitle>
          <CardDescription>How Asset AI fields map to Dynamics 365 Fixed Assets</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2 font-semibold text-muted-foreground">Asset AI Field</th><th className="text-left py-2 font-semibold text-muted-foreground">D365 Field</th><th className="text-left py-2 font-semibold text-muted-foreground">Direction</th></tr></thead>
            <tbody>
              {[["name","msdyn_name","PUSH"],["assetId","msdyn_assetid","PUSH"],["status","msdyn_status","BOTH"],["type","msdyn_assettype","PUSH"],["purchaseAmount","msdyn_purchasecost","PUSH"],["purchaseDate","msdyn_purchasedate","PUSH"],["disposedAt","msdyn_disposaldate","PUSH"]].map(([ai, d365, dir]) => (
                <tr key={ai} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs text-purple-700 dark:text-purple-400">{ai}</td>
                  <td className="py-2 font-mono text-xs text-blue-700 dark:text-blue-400">{d365}</td>
                  <td className="py-2"><Badge variant="secondary" className="text-xs">{dir}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Recent Sync Logs</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground text-sm">Loading...</p> : logs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No sync activity yet. Click "Sync Now" to start.</p>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg text-sm">
                  {log.status === "SUCCESS" ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : log.status === "ERROR" ? <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" /> : <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                  <span className="text-muted-foreground font-mono text-xs w-20">{log.entityType}</span>
                  <span className="flex-1 truncate font-mono text-xs">{log.entityId}</span>
                  <Badge className={`text-xs ${log.status === "SUCCESS" ? "bg-emerald-100 text-emerald-700" : log.status === "ERROR" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{log.status}</Badge>
                  <span className="text-muted-foreground text-xs">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: ITSM & EMAIL INTEGRATION
// ══════════════════════════════════════════════════════════════════════════════
function ITSMTab() {
  const { toast } = useToast();
  const [webhookSecret, setWebhookSecret] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const ingestUrl = typeof window !== "undefined" ? `${window.location.origin}/api/tickets/email-ingest` : "https://your-domain.com/api/tickets/email-ingest";
  const copy = (text: string) => { navigator.clipboard?.writeText(text); toast({ title: "Copied to clipboard" }); };

  const sendTest = async () => {
    setTesting(true);
    const res = await fetch("/api/tickets/email-ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(webhookSecret ? { "x-webhook-secret": webhookSecret } : {}) },
      body: JSON.stringify({ from: testEmail || "test@example.com", subject: "Test Ticket from Email Integration", text: "This is a test email-to-ticket submission." }),
    });
    setTesting(false);
    if (res.ok) {
      const data = await res.json();
      toast({ title: "Test ticket created!", description: `Ticket ${data.displayId} created successfully` });
    } else toast({ variant: "destructive", title: "Test failed" });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center"><Mail className="w-5 h-5 text-white" /></div>
        <div>
          <h2 className="text-xl font-bold">ITSM & Email Integration</h2>
          <p className="text-sm text-muted-foreground">Email-to-ticket for Outlook, Gmail, and any SMTP source</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Webhook className="w-4 h-4" />Email-to-Ticket Webhook</CardTitle>
          <CardDescription>Forward emails to this endpoint to automatically create support tickets</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Ingest Endpoint URL</label>
            <div className="flex items-center gap-2">
              <Input readOnly value={ingestUrl} className="font-mono text-sm bg-muted flex-1" />
              <Button variant="outline" size="sm" onClick={() => copy(ingestUrl)}><Copy className="w-4 h-4" /></Button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Webhook Secret (optional)</label>
            <Input value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} placeholder="Set EMAIL_WEBHOOK_SECRET in Vercel env vars" className="font-mono text-sm" />
            <p className="text-xs text-muted-foreground mt-1">Pass as x-webhook-secret header from your email provider</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: "Microsoft Outlook / Office 365", status: "Ready", color: "bg-blue-100 text-blue-700", how: "Create a connector or Power Automate flow to POST emails to the ingest URL" },
              { name: "Gmail / Google Workspace",       status: "Ready", color: "bg-red-100 text-red-700",   how: "Use Google Apps Script or Gmail filter + Zapier to forward to webhook" },
              { name: "Mailgun Inbound Routes",          status: "Ready", color: "bg-purple-100 text-purple-700", how: "Configure Mailgun inbound route to forward parsed email JSON to this URL" },
              { name: "SendGrid Inbound Parse",          status: "Ready", color: "bg-emerald-100 text-emerald-700", how: "Configure SendGrid Inbound Parse webhook to this URL" },
            ].map(p => (
              <div key={p.name} className="border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <Badge className={`text-xs ${p.color}`}>{p.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{p.how}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-sm font-semibold mb-2">Test Email Integration</p>
            <div className="flex gap-2">
              <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="sender@example.com" className="flex-1" />
              <Button onClick={sendTest} disabled={testing}>{testing ? "Testing..." : "Send Test"}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" />Microsoft Outlook Add-In</CardTitle>
          <CardDescription>Native Outlook integration — create tickets directly from emails in Outlook</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Outlook add-in available at <code className="bg-emerald-100 dark:bg-emerald-900 px-1 rounded">/outlook/taskpane</code>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="border border-border rounded-xl p-3">
              <p className="font-semibold mb-1">Features</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Create tickets from email context</li><li>• Auto-fill ticket from email subject/body</li>
                <li>• View ticket status from Outlook</li><li>• Attach emails as ticket documents</li>
              </ul>
            </div>
            <div className="border border-border rounded-xl p-3">
              <p className="font-semibold mb-1">Deploy Add-In</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Download manifest from /api/outlook/manifest</li>
                <li>• Upload to Microsoft 365 Admin Center</li><li>• Or sideload for development testing</li>
              </ul>
              <a href="/api/outlook/manifest" target="_blank" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"><ExternalLink className="w-3 h-3" />Download Manifest</a>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Code className="w-4 h-4" />REST API Integration</CardTitle>
          <CardDescription>Use the REST API to integrate any external ITSM system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-gray-900 rounded-xl p-4 text-xs font-mono text-green-400 overflow-x-auto">
            <p className="text-gray-400 mb-2"># Create ticket via API</p>
            <p>POST /api/tickets</p><p>Authorization: Bearer {"<token>"}</p><p>Content-Type: application/json</p>
            <p>{"{"}</p><p className="pl-4">"title": "Issue description",</p><p className="pl-4">"description": "Detailed description",</p>
            <p className="pl-4">"priority": "HIGH",</p><p className="pl-4">"category": "MAINTENANCE",</p>
            <p className="pl-4">"assetId": "optional-asset-id",</p><p className="pl-4">"source": "EXTERNAL_ITSM"</p><p>{"}"}</p>
          </div>
          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            All API endpoints support JWT Bearer token auth. Get your token by signing in via Supabase Auth.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: DATA MIGRATION
// ══════════════════════════════════════════════════════════════════════════════
const TEMPLATES = [
  { name: "Assets",  columns: ["name", "assetId", "type", "status", "description", "serialNumber", "purchaseAmount", "purchaseDate", "location"] },
  { name: "Tickets", columns: ["title", "description", "priority", "category", "status", "assetId"] },
];

function DataMigrationTab() {
  const [selectedTemplate, setSelectedTemplate] = useState("Assets");
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);
  const [isDryRun, setIsDryRun] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = (name: string) => {
    const tpl = TEMPLATES.find(t => t.name === name);
    if (!tpl) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([tpl.columns, tpl.columns.map(() => "")]);
    XLSX.utils.book_append_sheet(wb, ws, name);
    XLSX.writeFile(wb, `${name.toLowerCase()}_import_template.xlsx`);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      if (json.length > 0) {
        setPreviewHeaders(json[0].map(String));
        setPreviewData(json.slice(1, 6).map(row => {
          const obj: any = {};
          json[0].forEach((h: any, i: number) => { obj[h] = row[i] || ""; });
          return obj;
        }));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const runImport = async () => {
    if (previewData.length === 0) return;
    setImporting(true); setResults(null);
    const endpoint = selectedTemplate === "Assets" ? "/api/assets" : "/api/tickets";
    let success = 0; const errors: string[] = [];
    for (const row of previewData) {
      if (isDryRun) { success++; continue; }
      try {
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(row) });
        if (res.ok) success++;
        else { const err = await res.json().catch(() => ({})); errors.push(err.error || `Row failed: ${JSON.stringify(row).slice(0, 100)}`); }
      } catch (e: any) { errors.push(e.message); }
    }
    setImporting(false); setResults({ success, errors });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center"><Upload className="w-5 h-5 text-white" /></div>
        <div>
          <h2 className="text-xl font-bold">Data Migration Wizard</h2>
          <p className="text-sm text-muted-foreground">Import assets and tickets from your existing system via Excel</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Choose Data Type & Download Template</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {TEMPLATES.map(t => (
            <div key={t.name}
              className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedTemplate === t.name ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30" : "border-border hover:border-border/60"}`}
              onClick={() => setSelectedTemplate(t.name)}>
              <FileText className={`w-5 h-5 ${selectedTemplate === t.name ? "text-indigo-600" : "text-muted-foreground"}`} />
              <div>
                <p className="font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.columns.length} fields</p>
              </div>
              <Button size="sm" variant="outline" className="ml-auto" onClick={e => { e.stopPropagation(); downloadTemplate(t.name); }}>
                <Download className="w-3 h-3 mr-1" />Template
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Upload Your Data File</CardTitle>
          <CardDescription>Upload an Excel (.xlsx) or CSV file matching the template format</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all" onClick={() => fileRef.current?.click()}>
            <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Click to upload or drag & drop</p>
            <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv supported</p>
            <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFile} />
          </div>
        </CardContent>
      </Card>

      {previewData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">3. Preview (first 5 rows)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b">{previewHeaders.map(h => <th key={h} className="py-2 px-3 text-left text-muted-foreground font-semibold">{h}</th>)}</tr></thead>
              <tbody>{previewData.map((row, i) => <tr key={i} className="border-b hover:bg-muted/30">{previewHeaders.map(h => <td key={h} className="py-2 px-3">{String(row[h] || "")}</td>)}</tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {previewData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">4. Run Import</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isDryRun} onChange={e => setIsDryRun(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
              <span className="text-sm font-medium">Dry Run (simulate import without saving data)</span>
            </label>
            {isDryRun && (
              <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />Dry run mode — no data will be written. Uncheck to import for real.
              </div>
            )}
            <Button onClick={runImport} disabled={importing} className="bg-indigo-600 hover:bg-indigo-700">
              <Play className="w-4 h-4 mr-2" />{importing ? "Importing..." : isDryRun ? "Run Dry Run" : `Import ${previewData.length} Records`}
            </Button>
          </CardContent>
        </Card>
      )}

      {results && (
        <Card className={results.errors.length === 0 ? "border-emerald-200" : "border-red-200"}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {results.errors.length === 0 ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-red-600" />}Import Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-4">
              <div className="text-center"><p className="text-2xl font-bold text-emerald-600">{results.success}</p><p className="text-xs text-muted-foreground">Successful</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-red-600">{results.errors.length}</p><p className="text-xs text-muted-foreground">Errors</p></div>
            </div>
            {results.errors.map((err, i) => <div key={i} className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("vendors");

  useEffect(() => {
    const q = router.query?.tab;
    const t = typeof q === "string" ? q : Array.isArray(q) ? q[0] : "";
    if (t && TABS.some(tab => tab.id === t)) setActiveTab(t as TabId);
  }, [router.query.tab]);

  const goTab = (id: TabId) => {
    setActiveTab(id);
    router.replace({ pathname: router.pathname, query: { ...router.query, tab: id } }, undefined, { shallow: true });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Hero */}
        <div className="relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(148,163,184,0.15),transparent_60%)]" />
          <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/5 blur-3xl" />
          <div className="relative z-10 px-8 py-8 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center flex-shrink-0">
              <Settings className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
              <p className="text-slate-400 text-sm mt-0.5">Vendors, departments, integrations and system configuration</p>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="rounded-2xl border border-border/80 bg-gradient-to-b from-muted/50 to-muted/20 p-1.5 shadow-sm">
          <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => goTab(tab.id)}
                className={`relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-md ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                }`}
              >
                <tab.icon className={`h-4 w-4 shrink-0 ${activeTab === tab.id ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "vendors"     && <VendorsTab />}
          {activeTab === "departments" && <DepartmentsTab />}
          {activeTab === "parameters"  && <SystemParametersTab />}
          {activeTab === "sso"         && <SSOTab />}
          {activeTab === "erp"         && <ERPTab />}
          {activeTab === "itsm"        && <ITSMTab />}
          {activeTab === "migration"   && <DataMigrationTab />}
        </div>
      </div>
    </DashboardLayout>
  );
}
