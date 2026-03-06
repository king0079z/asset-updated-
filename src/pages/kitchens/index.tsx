// @ts-nocheck
import { DashboardLayout } from "@/components/DashboardLayout";
import { UserKitchenPageSimplified } from "@/components/UserKitchenPageSimplified";
import { KitchenAssignmentManager } from "@/components/KitchenAssignmentManager";
import { useAuth } from '@/contexts/AuthContext';
import { usePageAccess } from '@/hooks/usePageAccess';
import { useState, useEffect } from "react";
import { useTranslation } from "@/contexts/TranslationContext";
import { Building2, Users, ChefHat, Package, Utensils, ArrowRight, AlertTriangle, TrendingDown, BarChart3, RefreshCw } from "lucide-react";
import { useRouter } from "next/router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type KitchenStats = {
  totalKitchens: number;
  totalItems: number;
  expiringCount: number;
  lowStockCount: number;
};

export default function KitchensPage() {
  const { user } = useAuth();
  const { isAdmin, isManager, loading } = usePageAccess();
  const [isAdminOrManager, setIsAdminOrManager] = useState(false);
  const [kitchenStats, setKitchenStats] = useState<KitchenStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"my-kitchens" | "assignments">("my-kitchens");
  const { t } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    if (!loading) setIsAdminOrManager(isAdmin || isManager);
  }, [isAdmin, isManager, loading]);

  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const [kitchensRes, statsRes] = await Promise.all([
          fetch('/api/kitchens'),
          fetch('/api/food-supply/stats'),
        ]);
        const kitchens = await kitchensRes.json();
        const stats = await statsRes.json();
        setKitchenStats({
          totalKitchens: Array.isArray(kitchens) ? kitchens.length : 0,
          totalItems: stats?.totalSupplies ?? 0,
          expiringCount: stats?.expiringSupplies ?? 0,
          lowStockCount: 0,
        });
      } catch {}
      finally { setStatsLoading(false); }
    };
    loadStats();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="rounded-3xl h-52 bg-emerald-100/50 dark:bg-emerald-900/20" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
          <Skeleton className="h-[500px] rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── World-Class Hero ── */}
        <div className="relative rounded-3xl overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.12),transparent_60%)]" />
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-52 h-52 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute top-6 right-32 w-24 h-24 rounded-full bg-teal-400/15" />

          <div className="relative z-10 px-7 py-8">
            {/* Title row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg ring-1 ring-white/30 flex-shrink-0">
                  <ChefHat className="h-7 w-7 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h1 className="text-3xl font-black text-white tracking-tight">Kitchen Management</h1>
                    <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm text-xs px-2.5 py-0.5">
                      {isAdminOrManager ? "Admin View" : "My Kitchens"}
                    </Badge>
                    {kitchenStats && kitchenStats.expiringCount > 0 && (
                      <Badge className="bg-red-500/80 text-white border-0 text-xs px-2.5 py-0.5 flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="h-3 w-3" />{kitchenStats.expiringCount} Alerts
                      </Badge>
                    )}
                  </div>
                  <p className="text-emerald-100/80 text-sm">
                    Manage inventory, consumption, waste and recipes across all kitchen locations
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => router.push('/food-supply')}
                  className="bg-white/15 border-white/30 text-white hover:bg-white/25 backdrop-blur-sm gap-2 shadow-sm">
                  <Package className="h-4 w-4" />Food Supply<ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Aggregate KPI tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {statsLoading ? (
                [...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl bg-white/10" />)
              ) : kitchenStats ? [
                { label: "Kitchens", value: kitchenStats.totalKitchens, icon: Building2, border: "border-white/20 bg-white/12" },
                { label: "Total Items", value: kitchenStats.totalItems, icon: Package, border: "border-white/20 bg-white/12" },
                { label: "Expiring Soon", value: kitchenStats.expiringCount, icon: AlertTriangle, border: kitchenStats.expiringCount > 0 ? "border-red-300/40 bg-red-500/25" : "border-white/20 bg-white/12" },
                { label: "Managed by", value: isAdminOrManager ? "Admin" : "You", icon: Users, border: "border-white/20 bg-white/12" },
              ].map(({ label, value, icon: Icon, border }) => (
                <div key={label} className={`rounded-2xl px-4 py-3.5 border ${border} backdrop-blur-sm`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3.5 w-3.5 text-white/70" />
                    <p className="text-[10px] uppercase tracking-widest text-white/70 font-semibold">{label}</p>
                  </div>
                  <p className="text-2xl font-black text-white">{value}</p>
                </div>
              )) : null}
            </div>
          </div>

          {/* Bottom strip */}
          <div className="relative z-10 border-t border-white/20 grid grid-cols-3 divide-x divide-white/20">
            {[
              { label: "Locations",  icon: Building2, value: `${kitchenStats?.totalKitchens ?? '—'} Kitchens` },
              { label: "Track Daily", icon: Utensils,  value: "Consumption" },
              { label: "AI-Powered", icon: BarChart3,  value: "Analytics" },
            ].map(({ label, icon: Icon, value }) => (
              <div key={label} className="px-6 py-3.5 flex items-center gap-3">
                <Icon className="h-4 w-4 text-emerald-200" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-emerald-200/70 font-semibold">{label}</p>
                  <p className="text-sm font-bold text-white">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Main Content ── */}
        {isAdminOrManager ? (
          <div className="space-y-4">
            {/* Custom tab bar */}
            <div className="flex gap-1 rounded-2xl bg-muted/50 p-1.5">
              {[
                { key: "my-kitchens",  icon: Building2, label: t('my_kitchens') },
                { key: "assignments",  icon: Users,     label: t('kitchen_assignments') },
              ].map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setActiveTab(key as any)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                    activeTab === key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  }`}>
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </div>

            {activeTab === "my-kitchens" && <UserKitchenPageSimplified />}
            {activeTab === "assignments" && <KitchenAssignmentManager />}
          </div>
        ) : (
          <UserKitchenPageSimplified />
        )}
      </div>
    </DashboardLayout>
  );
}
