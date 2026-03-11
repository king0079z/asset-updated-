// @ts-nocheck
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useEffect, useState } from "react";
import { fetchWithCache, getFromCache } from "@/lib/api-cache";
const VENDORS_KEY = "/api/vendors";
const VENDORS_TTL = 3 * 60_000;
import { VendorManagementDialog } from "@/components/VendorManagementDialog";
import { useTranslation } from "@/contexts/TranslationContext";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import {
  AlertTriangle, Edit, PlusCircle, Search, Star, Users, Building2,
  TrendingUp, Award, RefreshCw, ChevronRight, Settings,
} from "lucide-react";

type Vendor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  type: string[];
  reliabilityScore: number | null;
  qualityScore: number | null;
  responseTimeScore: number | null;
  lastReviewDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const getScoreColor = (score: number) => {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
};

const getScoreBg = (score: number) => {
  if (score >= 80) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 60) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
};

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

export default function SettingsPage() {
  const cachedVendors = getFromCache<Vendor[]>(VENDORS_KEY, VENDORS_TTL) ?? [];
  const [vendors, setVendors] = useState<Vendor[]>(cachedVendors);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>(cachedVendors);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(() => !getFromCache(VENDORS_KEY, VENDORS_TTL));
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | undefined>(undefined);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();

  const loadVendors = async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const data = await fetchWithCache<Vendor[]>(VENDORS_KEY, { maxAge: VENDORS_TTL });
      if (data) { setVendors(data); setFilteredVendors(data); }
    } catch {
      if (!background) toast({ title: "Error", description: "Failed to load vendors", variant: "destructive" });
    } finally {
      if (!background) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (getFromCache(VENDORS_KEY, VENDORS_TTL)) { setTimeout(() => loadVendors(true), 300); }
    else { loadVendors(false); }
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setFilteredVendors(vendors); return; }
    const q = searchQuery.toLowerCase();
    setFilteredVendors(vendors.filter(v =>
      v.name.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q) ||
      v.phone?.toLowerCase().includes(q) ||
      v.type.some(t => t.toLowerCase().includes(q))
    ));
  }, [searchQuery, vendors]);

  const calculateOverallScore = (v: Vendor): number | null => {
    const scores = [v.reliabilityScore, v.qualityScore, v.responseTimeScore].filter(s => s !== null) as number[];
    if (!scores.length) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  const getPerformanceStatus = (score: number | null) => {
    if (score === null) return 'Not Rated';
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Improvement';
  };

  const avgScore = vendors.length
    ? Math.round(vendors.reduce((sum, v) => sum + (calculateOverallScore(v) ?? 0), 0) / vendors.length)
    : 0;
  const excellentCount = vendors.filter(v => (calculateOverallScore(v) ?? 0) >= 80).length;
  const needsImprovementCount = vendors.filter(v => {
    const s = calculateOverallScore(v);
    return s !== null && s < 60;
  }).length;

  const navItems = [
    { href: "/settings/vendor-performance", icon: Star, label: "Vendor Performance", color: "from-amber-500 to-orange-500", bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-600 dark:text-amber-400", desc: "Track & rate vendors" },
    { href: "/settings/error-logs", icon: AlertTriangle, label: "Error Logs", color: "from-red-500 to-rose-600", bg: "bg-red-50 dark:bg-red-950", text: "text-red-600 dark:text-red-400", desc: "Monitor system errors" },
    { href: "/settings/user-management", icon: Users, label: "User Management", color: "from-violet-500 to-purple-600", bg: "bg-violet-50 dark:bg-violet-950", text: "text-violet-600 dark:text-violet-400", desc: "Manage access & roles" },
    ...(user?.isAdmin ? [{ href: "/admin/organizations", icon: Building2, label: "All Organizations", color: "from-blue-500 to-indigo-600", bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-600 dark:text-blue-400", desc: "Manage organizations" }] : []),
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">

        {/* ── Hero Banner ──────────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(148,163,184,0.15),transparent_60%)]" />
          <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-64 h-32 rounded-full bg-white/5 blur-2xl" />

          <div className="relative z-10 px-8 py-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center flex-shrink-0">
                <Settings className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
                <p className="text-slate-400 text-sm mt-0.5">Vendors, users, permissions and system configuration</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={loadVendors} className="text-white/70 hover:text-white hover:bg-white/10">
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
              </Button>
              <Button onClick={() => { setSelectedVendor(undefined); setIsDialogOpen(true); }}
                className="bg-white text-slate-900 hover:bg-slate-100 font-semibold gap-2">
                <PlusCircle className="h-4 w-4" /> Add Vendor
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="relative z-10 px-8 pb-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Vendors", value: vendors.length, icon: Building2, color: "text-blue-400" },
              { label: "Avg Score", value: avgScore || "—", icon: TrendingUp, color: "text-violet-400" },
              { label: "Excellent", value: excellentCount, icon: Award, color: "text-emerald-400" },
              { label: "Needs Improvement", value: needsImprovementCount, icon: AlertTriangle, color: "text-amber-400" },
            ].map(stat => (
              <div key={stat.label} className="bg-white/8 backdrop-blur border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 font-medium">{stat.label}</span>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick Nav Cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {navItems.map(item => (
            <Link key={item.href} href={item.href}>
              <div className={`group relative rounded-2xl border border-border ${item.bg} p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}>
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

        {/* ── Vendor Table ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border">
            <div>
              <h2 className="text-lg font-bold">{t('vendors')}</h2>
              <p className="text-sm text-muted-foreground">{t('manage_your_vendors')}</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search_vendors')}
                className="pl-9 rounded-xl"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent" />
                <p className="text-sm text-muted-foreground">Loading vendors...</p>
              </div>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="font-semibold text-muted-foreground">
                {searchQuery ? "No vendors match your search" : "No vendors found"}
              </p>
              {!searchQuery && (
                <Button className="mt-4 gap-2" onClick={() => { setSelectedVendor(undefined); setIsDialogOpen(true); }}>
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
                {filteredVendors.map(vendor => {
                  const overall = calculateOverallScore(vendor);
                  const status = getPerformanceStatus(overall);
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
                          {vendor.type?.map(t => (
                            <Badge key={t} variant="secondary" className="text-[10px] px-2 py-0">
                              {t.replace("_", " ")}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell><ScoreBar value={vendor.reliabilityScore} /></TableCell>
                      <TableCell><ScoreBar value={vendor.qualityScore} /></TableCell>
                      <TableCell><ScoreBar value={vendor.responseTimeScore} /></TableCell>
                      <TableCell>
                        {overall !== null ? (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${getScoreBg(overall)}`}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getScoreColor(overall) }} />
                            {status} · {overall}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not Rated</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => { setSelectedVendor(vendor); setIsDialogOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {!isLoading && filteredVendors.length > 0 && (
            <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground">
              Showing {filteredVendors.length} of {vendors.length} vendors
            </div>
          )}
        </div>
      </div>

      <VendorManagementDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        vendor={selectedVendor}
        onVendorUpdated={loadVendors}
      />
    </DashboardLayout>
  );
}
