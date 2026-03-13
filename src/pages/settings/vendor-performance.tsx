import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useEffect, useState } from "react";
import { fetchWithCache, getFromCache } from "@/lib/api-cache";
const VENDORS_KEY = "/api/vendors";
const VENDORS_TTL = 3 * 60_000;
import { useTranslation } from "@/contexts/TranslationContext";
import { VendorPerformanceCard } from "@/components/VendorPerformanceCard";
import Link from "next/link";
import {
  ArrowLeft, Search, AlertTriangle, Users, Star, TrendingUp,
  Award, Clock, RefreshCw, Building2
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

const getDaysSinceLastReview = (lastReviewDate: string | null): number | null => {
  if (!lastReviewDate) return null;
  const diff = Math.abs(new Date().getTime() - new Date(lastReviewDate).getTime());
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const needsReview = (lastReviewDate: string | null): boolean => {
  const days = getDaysSinceLastReview(lastReviewDate);
  return days === null || days > 90;
};

const calcAvg = (v: Vendor): number | null => {
  const s = [v.reliabilityScore, v.qualityScore, v.responseTimeScore].filter(x => x !== null) as number[];
  return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
};

type TabValue = "all" | "needs-review" | "reviewed";

export default function VendorPerformancePage() {
  const [vendors, setVendors] = useState<Vendor[]>(() => getFromCache<Vendor[]>(VENDORS_KEY, VENDORS_TTL) ?? []);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(() => !getFromCache(VENDORS_KEY, VENDORS_TTL));
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const { toast } = useToast();
  const { t } = useTranslation();

  const loadVendors = async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const data = await fetchWithCache<Vendor[]>(VENDORS_KEY, { maxAge: VENDORS_TTL });
      if (data) setVendors(data);
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

  const tabs: { value: TabValue; label: string }[] = [
    { value: "all", label: "All Vendors" },
    { value: "needs-review", label: "Needs Review" },
    { value: "reviewed", label: "Reviewed" },
  ];

  const vendorsNeedingReview = vendors.filter(v => needsReview(v.lastReviewDate));
  const reviewedVendors = vendors.filter(v => !needsReview(v.lastReviewDate));
  const avgScore = vendors.length
    ? Math.round(vendors.reduce((s, v) => s + (calcAvg(v) ?? 0), 0) / vendors.length) : 0;

  const getTabVendors = () => {
    let list = activeTab === "needs-review" ? vendorsNeedingReview
      : activeTab === "reviewed" ? reviewedVendors : vendors;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.email?.toLowerCase().includes(q) ||
        v.type.some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  };

  const filtered = getTabVendors();

  const tabCount: Record<TabValue, number> = {
    all: vendors.length,
    "needs-review": vendorsNeedingReview.length,
    reviewed: reviewedVendors.length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_55%)]" />
          <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/10 blur-3xl" />

          <div className="relative z-10 px-8 py-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <Link href="/settings">
                <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/15 rounded-xl">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
                <Star className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Vendor Performance</h1>
                <p className="text-orange-100 text-sm mt-0.5">Monitor and evaluate vendor performance metrics</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/settings/error-logs">
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/15">
                  <AlertTriangle className="h-4 w-4 mr-2" /> Error Logs
                </Button>
              </Link>
              <Link href="/settings/user-management">
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/15">
                  <Users className="h-4 w-4 mr-2" /> Users
                </Button>
              </Link>
              <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/15" onClick={loadVendors}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="relative z-10 px-8 pb-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Vendors", value: vendors.length, icon: Building2 },
              { label: "Avg Performance", value: avgScore ? `${avgScore}%` : "—", icon: TrendingUp },
              { label: "Need Review", value: vendorsNeedingReview.length, icon: Clock },
              { label: "Reviewed", value: reviewedVendors.length, icon: Award },
            ].map(s => (
              <div key={s.label} className="bg-white/15 backdrop-blur border border-white/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-orange-100 font-medium">{s.label}</span>
                  <s.icon className="h-4 w-4 text-white/60" />
                </div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Alert ────────────────────────────────────────────────────── */}
        {vendorsNeedingReview.length > 0 && (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                {vendorsNeedingReview.length} vendor{vendorsNeedingReview.length > 1 ? "s" : ""} need{vendorsNeedingReview.length === 1 ? "s" : ""} review
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                These vendors haven't been reviewed in over 90 days. Click the "Needs Review" tab to see them.
              </p>
            </div>
          </div>
        )}

        {/* ── Toolbar ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
            {tabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                <Badge
                  className={`text-[10px] px-1.5 py-0 h-5 ${
                    activeTab === tab.value ? "bg-orange-500 text-white border-0" : "bg-muted-foreground/20 text-muted-foreground border-0"
                  }`}
                >
                  {tabCount[tab.value]}
                </Badge>
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("search_vendors")}
              className="pl-9 rounded-xl"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent mb-3" />
            <p className="text-sm text-muted-foreground">Loading vendor performance data...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 rounded-2xl border-2 border-dashed border-muted">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Star className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="font-semibold text-muted-foreground">
              {searchQuery ? "No vendors match your search"
                : activeTab === "needs-review" ? "No vendors need review right now"
                : activeTab === "reviewed" ? "No vendors have been reviewed yet"
                : "No vendors found"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(vendor => (
              <VendorPerformanceCard
                key={vendor.id}
                vendor={vendor}
                onPerformanceUpdated={loadVendors}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
