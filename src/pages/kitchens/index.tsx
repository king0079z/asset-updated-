import { DashboardLayout } from "@/components/DashboardLayout";
import { UserKitchenPageSimplified } from "@/components/UserKitchenPageSimplified";
import { KitchenAssignmentManager } from "@/components/KitchenAssignmentManager";
import { useAuth } from '@/contexts/AuthContext';
import { usePageAccess } from '@/hooks/usePageAccess';
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/contexts/TranslationContext";
import { Building2, Users, ChefHat, Layers, ArrowRight, Package, Utensils } from "lucide-react";
import { useRouter } from "next/router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function KitchensPage() {
  const { user } = useAuth();
  const { isAdmin, isManager, loading } = usePageAccess();
  const [isAdminOrManager, setIsAdminOrManager] = useState(false);
  const { t } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      setIsAdminOrManager(isAdmin || isManager);
    }
  }, [isAdmin, isManager, loading]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse">
          {/* Skeleton hero */}
          <div className="rounded-2xl h-44 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-700" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
          <div className="h-96 rounded-xl bg-slate-100 dark:bg-slate-800" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* ── World-Class Hero Header ── */}
      <div className="relative rounded-2xl overflow-hidden mb-8">
        {/* Layered gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.15),transparent_60%)]" />

        {/* Decorative circles */}
        <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute top-6 right-32 w-24 h-24 rounded-full bg-teal-400/20" />

        <div className="relative z-10 p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="flex-shrink-0 h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg ring-1 ring-white/30">
              <ChefHat className="h-9 w-9 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Kitchen Management
                </h1>
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm text-xs px-2.5 py-0.5">
                  {isAdminOrManager ? "Admin View" : "My Kitchens"}
                </Badge>
              </div>
              <p className="text-emerald-100/90 text-base">
                Manage inventory, consumption, waste and recipes across all kitchen locations
              </p>
            </div>
          </div>

          {/* Header quick-links */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/food-supply')}
              className="bg-white/15 border-white/30 text-white hover:bg-white/25 backdrop-blur-sm gap-2 shadow-sm"
            >
              <Package className="h-4 w-4" />
              Food Supply
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Bottom stat strip */}
        <div className="relative z-10 border-t border-white/20 grid grid-cols-3 divide-x divide-white/20">
          {[
            { label: "Locations", icon: Building2, value: "Kitchens" },
            { label: "Track Daily", icon: Utensils, value: "Consumption" },
            { label: "AI-Powered", icon: Layers, value: "Analytics" },
          ].map(({ label, icon: Icon, value }) => (
            <div key={label} className="px-6 py-3.5 flex items-center gap-3">
              <Icon className="h-4 w-4 text-emerald-200" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-emerald-200/70 font-semibold">{label}</p>
                <p className="text-sm font-semibold text-white">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Content ── */}
      {isAdminOrManager ? (
        <Tabs defaultValue="my-kitchens" className="w-full">
          <TabsList className="mb-6 h-11 bg-muted/60 backdrop-blur-sm rounded-xl p-1 gap-1">
            <TabsTrigger
              value="my-kitchens"
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm h-9 px-5 font-medium transition-all"
            >
              <Building2 className="h-4 w-4" />
              {t('my_kitchens')}
            </TabsTrigger>
            <TabsTrigger
              value="assignments"
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm h-9 px-5 font-medium transition-all"
            >
              <Users className="h-4 w-4" />
              {t('kitchen_assignments')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-kitchens" className="mt-0">
            <UserKitchenPageSimplified />
          </TabsContent>

          <TabsContent value="assignments" className="mt-0">
            <KitchenAssignmentManager />
          </TabsContent>
        </Tabs>
      ) : (
        <UserKitchenPageSimplified />
      )}
    </DashboardLayout>
  );
}
