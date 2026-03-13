// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useButtonVisibility } from '@/hooks/useButtonVisibility';
import {
  getFoodSupplies, getKitchenAssignments, getExpiringItems, getLowStockItems,
  fetchWithCache, type FoodSupply, type KitchenAssignment, type Kitchen
} from '@/lib/foodSupplyService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { useTranslation } from "@/contexts/TranslationContext";
import { CardTabs } from "@/components/ui/card-tabs";
import { KitchenConsumptionDialog } from './KitchenConsumptionDialog';
import { WasteHistoryDialog } from './WasteHistoryDialog';
import { EnhancedWasteTrackingDialog } from './EnhancedWasteTrackingDialog';
import { FoodSupplyNotifications } from './FoodSupplyNotifications';
import { RecipesTab } from './RecipesTab';
import { KitchenOperationsTab } from './KitchenOperationsTab';
import { KitchenFoodSupplyForm } from './KitchenFoodSupplyForm';
import { OrderFoodSuppliesDialog } from './OrderFoodSuppliesDialog';
import { EnhancedKitchenReportButton } from './EnhancedKitchenReportButton';
import { ScanFoodSupplyButton } from './ScanFoodSupplyButton';
import { KitchenFinancialMetrics } from './KitchenFinancialMetrics';
import { KitchenFoodSupplyOverview } from './KitchenFoodSupplyOverview';
import { Badge } from '@/components/ui/badge';
import { ConsumptionTabContent } from './ConsumptionTabContent';
import { RefillFoodSupplyDialog } from './RefillFoodSupplyDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Utensils, Building2, ChefHat, AlertTriangle, AlertCircle, Package, Trash2,
  BarChart3, RefreshCw, Search, Plus, TrendingDown, TrendingUp, Clock,
  CheckCircle2, ClipboardList, ArrowUp, ArrowDown, ArrowUpDown, X,
  ShoppingCart, DollarSign, Grid3X3, List, MoreHorizontal, Zap, Star,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

/* ─── Category icons ─────────────────────────────────────────────────────────── */
const CAT_ICON: Record<string, string> = {
  dairy: '🥛', meat: '🥩', vegetables: '🥬', fruits: '🍎',
  grains: '🌾', beverages: '🥤', spices: '🌶️', seafood: '🐟', other: '📦',
};

/* ─── Skeleton ───────────────────────────────────────────────────────────────── */
function InventorySkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3 animate-pulse">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[...Array(4)].map((_, j) => <Skeleton key={j} className="h-14 rounded-xl" />)}
          </div>
          <Skeleton className="h-1.5 rounded-full w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-8 rounded-lg flex-1" />
            <Skeleton className="h-8 rounded-lg flex-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Inventory Card ──────────────────────────────────────────────────────────── */
function InventoryCard({
  supply, kitchenId, kitchenName, isExpiringSoon, isLowStock, onUpdate, onRefill,
}: {
  supply: FoodSupply; kitchenId: string; kitchenName: string;
  isExpiringSoon: boolean; isLowStock: boolean;
  onUpdate: () => void; onRefill: (supply: FoodSupply) => void;
}) {
  const { t } = useTranslation();
  const expirationDate = new Date(supply.expirationDate);
  const days = Math.ceil((expirationDate.getTime() - Date.now()) / 86400000);
  const totalValue = (supply.pricePerUnit * supply.quantity).toFixed(0);
  const catIcon = CAT_ICON[supply.category] || '📦';
  const expiryPct = Math.max(0, Math.min(100, days < 0 ? 0 : days > 365 ? 100 : (days / 365) * 100));

  const statusColor = days < 0 ? 'red' : isExpiringSoon ? 'red' : isLowStock ? 'amber' : 'emerald';
  const statusCls = {
    red: { border: 'border-red-200 dark:border-red-800/40', bg: 'bg-red-50/30 dark:bg-red-950/10', bar: 'bg-gradient-to-r from-red-500 to-rose-500', icon: 'bg-red-100 dark:bg-red-900/30', iconText: 'text-red-600 dark:text-red-400' },
    amber: { border: 'border-amber-200 dark:border-amber-800/40', bg: 'bg-amber-50/30 dark:bg-amber-950/10', bar: 'bg-gradient-to-r from-amber-500 to-yellow-500', icon: 'bg-amber-100 dark:bg-amber-900/30', iconText: 'text-amber-600 dark:text-amber-400' },
    emerald: { border: 'border-border hover:border-emerald-200 dark:hover:border-emerald-800/30', bg: 'bg-card', bar: 'bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity', icon: 'bg-emerald-100 dark:bg-emerald-900/30', iconText: 'text-emerald-600 dark:text-emerald-400' },
  }[statusColor];

  return (
    <div className={`group relative rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${statusCls.border} ${statusCls.bg}`}>
      {/* Top accent bar */}
      <div className={`h-1.5 w-full ${statusCls.bar}`} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm text-lg">
            {catIcon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm leading-tight truncate">{supply.name}</h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize">
                {supply.category}
              </span>
              {days < 0 && <span className="text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">Expired</span>}
              {days >= 0 && days <= 3 && <span className="text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">Critical</span>}
              {days > 3 && days <= 7 && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full">Expiring Soon</span>}
              {isLowStock && days > 7 && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">Low Stock</span>}
            </div>
          </div>
          <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${statusCls.icon}`}>
            {days < 0 || isExpiringSoon ? <AlertTriangle className={`h-4 w-4 ${statusCls.iconText}`} />
              : isLowStock ? <TrendingDown className={`h-4 w-4 ${statusCls.iconText}`} />
              : <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          </div>
        </div>

        {/* Metric grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-2.5">
            <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Quantity</p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              {supply.quantity} <span className="text-xs font-medium">{supply.unit}</span>
            </p>
          </div>
          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-2.5">
            <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Unit Price</p>
            <p className="text-sm font-bold text-blue-700 dark:text-blue-300">QAR {Number(supply.pricePerUnit).toFixed(2)}</p>
          </div>
          <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 p-2.5">
            <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Total Value</p>
            <p className="text-sm font-bold text-purple-700 dark:text-purple-300">QAR {totalValue}</p>
          </div>
          <div className={`rounded-xl p-2.5 ${days < 0 || days <= 7 ? 'bg-red-50 dark:bg-red-900/20' : days <= 30 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wide ${days < 0 || days <= 7 ? 'text-red-600 dark:text-red-400' : days <= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
              {days < 0 ? 'Expired' : 'Expires in'}
            </p>
            <p className={`text-sm font-bold ${days < 0 || days <= 7 ? 'text-red-700 dark:text-red-300' : days <= 30 ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}`}>
              {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'Today!' : `${days}d`}
            </p>
          </div>
        </div>

        {/* Expiry progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-muted-foreground">{expirationDate.toLocaleDateString()}</p>
            {supply.totalWasted > 0 && (
              <p className="text-[10px] text-rose-500">Wasted: {supply.totalWasted} {supply.unit}</p>
            )}
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${
              days < 0 ? 'bg-red-500' : days <= 7 ? 'bg-red-400' : days <= 30 ? 'bg-amber-400' : 'bg-emerald-400'
            }`} style={{ width: `${expiryPct}%` }} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 pt-1 border-t border-border/40">
          <KitchenConsumptionDialog
            kitchenId={kitchenId} kitchenName={kitchenName}
            preselectedFoodSupplyId={supply.id}
            buttonVariant="outline" buttonSize="sm" buttonLabel={t('consume')}
            onSuccess={onUpdate}
          />
          <Button variant="outline" size="sm" className="flex-1 text-xs h-8 gap-1" onClick={() => onRefill(supply)}>
            <RefreshCw className="h-3 w-3" />{t('update')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────────── */
export function UserKitchenPageSimplified() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<KitchenAssignment[]>([]);
  const [selectedKitchen, setSelectedKitchen] = useState<Kitchen | null>(null);
  const [foodSupplies, setFoodSupplies] = useState<FoodSupply[]>([]);
  const [expiringItems, setExpiringItems] = useState<FoodSupply[]>([]);
  const [lowStockItems, setLowStockItems] = useState<FoodSupply[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState<"all" | "expiring" | "lowstock" | "good">("all");
  const [sortBy, setSortBy] = useState<"name" | "expiry" | "quantity" | "value">("expiry");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [refillItem, setRefillItem] = useState<FoodSupply | null>(null);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['overview']));
  const [dataCache, setDataCache] = useState<Record<string, { foodSupplies?: FoodSupply[]; recipes?: any[]; timestamp: number }>>({});
  const CACHE_EXPIRATION = 5 * 60 * 1000;
  const { t } = useTranslation();
  const buttonPermissions = useButtonVisibility();

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setVisitedTabs(prev => new Set([...prev, tab]));
  };

  /* ─── Data loading ── */
  const fetchAssignments = async () => {
    try {
      const data = await getKitchenAssignments();
      if (data?.length > 0) {
        setAssignments(data);
        if (!selectedKitchen) setSelectedKitchen(data[0].kitchen);
      }
    } catch {
      toast({ title: t('error'), description: t('failed_to_fetch_kitchen_assignments'), variant: 'destructive' });
    }
  };

  const fetchFoodSupplies = useCallback(async (forceRefresh = false) => {
    if (!selectedKitchen) { setFoodSupplies([]); setExpiringItems([]); setLowStockItems([]); setIsLoading(false); return; }
    if (forceRefresh) setIsRefreshing(true); else setIsLoading(true);
    try {
      const cached = dataCache[selectedKitchen.id];
      const now = Date.now();
      if (!forceRefresh && cached?.foodSupplies && now - cached.timestamp < CACHE_EXPIRATION) {
        setFoodSupplies(cached.foodSupplies);
        setExpiringItems(getExpiringItems(cached.foodSupplies, 7));
        setLowStockItems(getLowStockItems(cached.foodSupplies, 0.2));
        setIsLoading(false); return;
      }
      const data = await getFoodSupplies(selectedKitchen.id, forceRefresh);
      if (data?.length > 0) {
        const processed = data.map((item: FoodSupply) => {
          const ks = item.kitchenSupplies?.[0];
          return ks ? { ...item, quantity: ks.quantity, expirationDate: ks.expirationDate } : item;
        }).filter((item: FoodSupply) =>
          item.kitchenId === selectedKitchen.id ||
          item.kitchenSupplies?.some(ks => ks.kitchenId === selectedKitchen.id)
        );
        setFoodSupplies(processed);
        setExpiringItems(getExpiringItems(processed, 7));
        setLowStockItems(getLowStockItems(processed, 0.2));
        setDataCache(prev => ({ ...prev, [selectedKitchen.id]: { ...prev[selectedKitchen.id], foodSupplies: processed, timestamp: now } }));
      } else {
        setFoodSupplies([]); setExpiringItems([]); setLowStockItems([]);
        setDataCache(prev => ({ ...prev, [selectedKitchen.id]: { ...prev[selectedKitchen.id], foodSupplies: [], timestamp: now } }));
      }
    } catch {
      toast({ title: t('error'), description: t('failed_to_fetch_food_supplies'), variant: 'destructive' });
    } finally { setIsLoading(false); setIsRefreshing(false); }
  }, [selectedKitchen, dataCache, t]);

  const fetchRecipes = async (forceRefresh = false) => {
    if (!selectedKitchen) return;
    try {
      const cached = dataCache[selectedKitchen.id];
      const now = Date.now();
      if (!forceRefresh && cached?.recipes && now - cached.timestamp < CACHE_EXPIRATION) { setRecipes(cached.recipes); return; }
      const data = await fetchWithCache(`/api/recipes?kitchenId=${selectedKitchen.id}`, {}, forceRefresh);
      const recipes = data || [];
      setRecipes(recipes);
      setDataCache(prev => ({ ...prev, [selectedKitchen.id]: { ...prev[selectedKitchen.id], recipes, timestamp: now } }));
    } catch {
      toast({ title: t('error'), description: t('failed_to_fetch_recipes'), variant: 'destructive' });
    }
  };

  useEffect(() => { fetchAssignments(); }, []);
  useEffect(() => { if (selectedKitchen) { fetchFoodSupplies(); fetchRecipes(); } }, [selectedKitchen?.id]);

  const handleKitchenSelect = (kitchen: Kitchen) => {
    setIsLoading(true);
    setVisitedTabs(new Set(['overview']));
    setActiveTab('overview');
    setSearchQuery('');
    setInventoryFilter('all');
    const cached = dataCache[kitchen.id];
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_EXPIRATION) {
      if (cached.foodSupplies) {
        setFoodSupplies(cached.foodSupplies);
        setExpiringItems(getExpiringItems(cached.foodSupplies, 7));
        setLowStockItems(getLowStockItems(cached.foodSupplies, 0.2));
        setIsLoading(false);
      }
      if (cached.recipes) setRecipes(cached.recipes);
    } else {
      setFoodSupplies([]); setExpiringItems([]); setLowStockItems([]); setRecipes([]);
    }
    setSelectedKitchen(kitchen);
  };

  const handleRefresh = () => {
    fetchFoodSupplies(true);
    fetchRecipes(true);
  };

  /* ─── Computed values ── */
  const totalInventoryValue = useMemo(() => foodSupplies.reduce((s, i) => s + i.quantity * i.pricePerUnit, 0), [foodSupplies]);
  const expiredCount = useMemo(() => foodSupplies.filter(s => new Date(s.expirationDate) < new Date()).length, [foodSupplies]);

  const filteredAndSorted = useMemo(() => {
    let list = foodSupplies.filter(s => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
      const days = Math.ceil((new Date(s.expirationDate).getTime() - Date.now()) / 86400000);
      const matchFilter = inventoryFilter === 'all' ? true
        : inventoryFilter === 'expiring' ? (days <= 7)
        : inventoryFilter === 'lowstock' ? lowStockItems.some(i => i.id === s.id)
        : days > 7 && !lowStockItems.some(i => i.id === s.id);
      return matchSearch && matchFilter;
    });

    list.sort((a, b) => {
      let v = 0;
      if (sortBy === 'name') v = a.name.localeCompare(b.name);
      else if (sortBy === 'expiry') v = new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
      else if (sortBy === 'quantity') v = a.quantity - b.quantity;
      else if (sortBy === 'value') v = (a.quantity * a.pricePerUnit) - (b.quantity * b.pricePerUnit);
      return sortDir === 'asc' ? v : -v;
    });
    return list;
  }, [foodSupplies, searchQuery, inventoryFilter, sortBy, sortDir, lowStockItems]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  /* ─── Stat cards ── */
  const statCards = [
    { label: t('total_inventory'), value: foodSupplies.length, sub: t('items_in_stock'), icon: Package, tab: 'inventory', gradient: 'from-emerald-500 to-teal-600', bg: 'from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400', textColor: 'text-emerald-700 dark:text-emerald-400' },
    { label: 'Inventory Value', value: `QAR ${totalInventoryValue.toFixed(0)}`, sub: 'total stock value', icon: DollarSign, tab: 'inventory', gradient: 'from-violet-500 to-purple-600', bg: 'from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20', iconBg: 'bg-violet-100 dark:bg-violet-900/30', iconColor: 'text-violet-600 dark:text-violet-400', textColor: 'text-violet-700 dark:text-violet-400' },
    { label: t('expiring_soon'), value: expiringItems.length, sub: t('items_expiring_within_7_days'), icon: AlertTriangle, tab: 'inventory', gradient: 'from-red-500 to-rose-600', bg: 'from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20', iconBg: 'bg-red-100 dark:bg-red-900/30', iconColor: 'text-red-600 dark:text-red-400', textColor: 'text-red-700 dark:text-red-400' },
    { label: t('low_stock'), value: lowStockItems.length, sub: t('items_running_low'), icon: TrendingDown, tab: 'inventory', gradient: 'from-amber-500 to-yellow-600', bg: 'from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20', iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-600 dark:text-amber-400', textColor: 'text-amber-700 dark:text-amber-400' },
    { label: t('recipes'), value: recipes.length, sub: t('available_recipes'), icon: ChefHat, tab: 'recipes', gradient: 'from-blue-500 to-indigo-600', bg: 'from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20', iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400', textColor: 'text-blue-700 dark:text-blue-400' },
  ];

  /* ─── Alert counts for tab badges ── */
  const alertCount = expiringItems.length + lowStockItems.length;

  /* ─── Empty state ── */
  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 rounded-3xl border-2 border-dashed border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10">
        <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-5 shadow-inner">
          <Building2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold mb-2">{t('no_kitchens_assigned')}</h3>
        <p className="text-muted-foreground text-center max-w-sm mb-6">{t('contact_admin_for_kitchen_assignment')}</p>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md gap-2">
          {t('contact_administrator')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

        {/* ══ Kitchen Selector Sidebar ══════════════════════════════════════════════ */}
        <div className="md:col-span-3 lg:col-span-2">
          <Card className="shadow-sm h-full overflow-hidden border-0 ring-1 ring-border/60 sticky top-20">
            <CardHeader className="pb-3 bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900/60 border-b border-border/50">
              <CardTitle className="text-xs font-semibold flex items-center gap-2 text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">
                <Building2 className="h-3.5 w-3.5" />{t('kitchens')}
                <span className="ml-auto text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">
                  {assignments.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="space-y-1">
                {assignments.map((a) => {
                  const isActive = selectedKitchen?.id === a.kitchen.id;
                  return (
                    <button key={a.id} onClick={() => handleKitchenSelect(a.kitchen)}
                      className={`w-full text-left rounded-xl p-3 transition-all duration-200 group ${
                        isActive ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-200/40 dark:shadow-emerald-900/20'
                          : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-foreground'
                      }`}>
                      <div className="flex items-start gap-2.5">
                        <div className={`mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${isActive ? 'bg-white/20' : 'bg-emerald-100 dark:bg-emerald-900/30 group-hover:bg-emerald-200/70'}`}>
                          <ChefHat className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-semibold leading-tight truncate ${isActive ? 'text-white' : ''}`}>{a.kitchen.name}</p>
                          <p className={`text-[11px] mt-0.5 ${isActive ? 'text-emerald-100' : 'text-muted-foreground'}`}>Floor {a.kitchen.floorNumber}</p>
                        </div>
                        {isActive && <div className="flex-shrink-0 mt-1 h-2 w-2 rounded-full bg-white/80 animate-pulse" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Quick stats for selected kitchen */}
              {selectedKitchen && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-2">{t('quick_stats')}</p>
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{t('inventory')}</span>
                    <span className="text-sm font-bold text-emerald-900 dark:text-emerald-300">{foodSupplies.length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-violet-50 dark:bg-violet-900/20 px-3 py-2">
                    <span className="text-xs text-violet-700 dark:text-violet-400 font-medium">Value</span>
                    <span className="text-sm font-bold text-violet-900 dark:text-violet-300">QAR {totalInventoryValue.toFixed(0)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">
                    <span className="text-xs text-red-700 dark:text-red-400 font-medium">{t('expiring')}</span>
                    <span className={`text-sm font-bold ${expiringItems.length > 0 ? 'text-red-700 dark:text-red-400' : 'text-red-900 dark:text-red-300'}`}>{expiringItems.length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                    <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">{t('low_stock')}</span>
                    <span className={`text-sm font-bold ${lowStockItems.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-amber-900 dark:text-amber-300'}`}>{lowStockItems.length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2">
                    <span className="text-xs text-blue-700 dark:text-blue-400 font-medium">{t('recipes')}</span>
                    <span className="text-sm font-bold text-blue-900 dark:text-blue-300">{recipes.length}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ══ Main Content ══════════════════════════════════════════════════════════ */}
        <div className="md:col-span-9 lg:col-span-10">
          {selectedKitchen ? (
            <div className="space-y-5">

              {/* Kitchen Hero Header */}
              <div className="relative rounded-2xl overflow-hidden ring-1 ring-border/60 shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_60%)]" />
                <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full bg-white/5" />

                <div className="relative z-10 p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30 shadow-inner flex-shrink-0">
                        <ChefHat className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl font-bold text-white">{selectedKitchen.name}</h2>
                          <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white ring-1 ring-white/30">
                            Floor {selectedKitchen.floorNumber}
                          </span>
                          {alertCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/80 px-2.5 py-0.5 text-xs font-bold text-white animate-pulse">
                              <AlertTriangle className="h-3 w-3" />{alertCount} alert{alertCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-emerald-100/80 mt-0.5">
                          {selectedKitchen.description || t('no_description_available')}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ScanFoodSupplyButton kitchenId={selectedKitchen.id} onScanComplete={() => fetchFoodSupplies(true)} buttonSize="sm" />
                      {buttonPermissions.isButtonVisible('kitchen_food_supply') && (
                        <KitchenFoodSupplyForm
                          kitchenId={selectedKitchen.id} kitchenName={selectedKitchen.name}
                          onSuccess={() => fetchFoodSupplies(true)} buttonSize="sm"
                        />
                      )}
                      <EnhancedKitchenReportButton
                        kitchen={selectedKitchen} recipes={recipes} foodSupplies={foodSupplies}
                        expiringItems={expiringItems} lowStockItems={lowStockItems} buttonSize="sm"
                      />
                      <Button variant="outline" size="sm"
                        className="border-white/30 bg-white/10 text-white hover:bg-white/20 gap-1.5"
                        onClick={handleRefresh} disabled={isRefreshing}>
                        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                  </div>

                  {/* Inline stat strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { label: 'Items', value: foodSupplies.length, color: 'bg-white/15' },
                      { label: 'Value', value: `QAR ${totalInventoryValue.toFixed(0)}`, color: 'bg-violet-500/30' },
                      { label: 'Expiring', value: expiringItems.length, color: expiringItems.length > 0 ? 'bg-red-500/30' : 'bg-white/15' },
                      { label: 'Low Stock', value: lowStockItems.length, color: lowStockItems.length > 0 ? 'bg-amber-500/30' : 'bg-white/15' },
                      { label: 'Recipes', value: recipes.length, color: 'bg-blue-500/30' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className={`rounded-xl px-3 py-2 ${color} border border-white/20`}>
                        <p className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">{label}</p>
                        <p className="text-lg font-black text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Financial metrics */}
              <KitchenFinancialMetrics kitchenId={selectedKitchen.id} kitchenName={selectedKitchen.name} />

              {/* Notifications */}
              <FoodSupplyNotifications kitchenId={selectedKitchen.id} />

              {/* ── Tabs ── */}
              <CardTabs defaultValue="overview" value={activeTab} onValueChange={handleTabChange} className="w-full">
                <CardTabs.List className="w-full flex gap-1 mb-2 bg-muted/50 p-1 rounded-xl overflow-x-auto">
                  <CardTabs.Trigger value="overview" icon={<Package className="h-4 w-4" />}>
                    {t('overview')}
                  </CardTabs.Trigger>
                  <CardTabs.Trigger value="inventory" icon={<Utensils className="h-4 w-4" />}>
                    <span className="flex items-center gap-1.5">
                      {t('inventory')}
                      {alertCount > 0 && (
                        <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                          {alertCount}
                        </span>
                      )}
                    </span>
                  </CardTabs.Trigger>
                  <CardTabs.Trigger value="recipes" icon={<ChefHat className="h-4 w-4" />}>
                    {t('recipes')}
                  </CardTabs.Trigger>
                  <CardTabs.Trigger value="consumption" icon={<BarChart3 className="h-4 w-4" />}>
                    {t('consumption')}
                  </CardTabs.Trigger>
                  <CardTabs.Trigger value="operations" icon={<ClipboardList className="h-4 w-4" />}>
                    {t('operations') || 'Operations'}
                  </CardTabs.Trigger>
                </CardTabs.List>

                {/* ── Overview Tab ── */}
                <CardTabs.Content value="overview" className="mt-5">
                  {/* Alert ribbons */}
                  {(lowStockItems.length > 0 || expiringItems.length > 0 || expiredCount > 0) && (
                    <div className="mb-5 space-y-2">
                      {expiredCount > 0 && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300">
                          <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 animate-pulse" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">{expiredCount} expired item{expiredCount !== 1 ? 's' : ''}</p>
                            <p className="text-xs text-red-700/70 dark:text-red-400/70">{foodSupplies.filter(s => new Date(s.expirationDate) < new Date()).slice(0, 3).map(i => i.name).join(', ')}</p>
                          </div>
                          <button className="text-xs font-semibold underline" onClick={() => { setInventoryFilter('expiring'); handleTabChange('inventory'); }}>View →</button>
                        </div>
                      )}
                      {expiringItems.length > 0 && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-300">
                          <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center flex-shrink-0">
                            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold"><strong>{expiringItems.length}</strong> item{expiringItems.length !== 1 ? 's' : ''} expiring within 7 days</p>
                            <p className="text-xs text-orange-700/70 dark:text-orange-400/70">{expiringItems.slice(0, 3).map(i => i.name).join(', ')}{expiringItems.length > 3 ? ` +${expiringItems.length - 3} more` : ''}</p>
                          </div>
                          <button className="text-xs font-semibold underline" onClick={() => { setInventoryFilter('expiring'); handleTabChange('inventory'); }}>View →</button>
                        </div>
                      )}
                      {lowStockItems.length > 0 && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                          <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                            <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold"><strong>{lowStockItems.length}</strong> item{lowStockItems.length !== 1 ? 's' : ''} running low</p>
                            <p className="text-xs text-amber-700/70 dark:text-amber-400/70">{lowStockItems.slice(0, 3).map(i => i.name).join(', ')}{lowStockItems.length > 3 ? ` +${lowStockItems.length - 3} more` : ''}</p>
                          </div>
                          <button className="text-xs font-semibold underline" onClick={() => { setInventoryFilter('lowstock'); handleTabChange('inventory'); }}>View →</button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stat cards — 5 columns */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                    {statCards.map((card) => {
                      const Icon = card.icon;
                      const isAlert = (card.label === t('expiring_soon') || card.label === t('low_stock')) && Number(card.value) > 0;
                      return (
                        <button key={card.label} onClick={() => handleTabChange(card.tab)}
                          className={`group relative text-left rounded-2xl overflow-hidden bg-gradient-to-br ${card.bg} border border-transparent hover:border-current/20 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}>
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className={`h-9 w-9 rounded-xl ${card.iconBg} flex items-center justify-center shadow-sm`}>
                                <Icon className={`h-4 w-4 ${card.iconColor}`} />
                              </div>
                              {isAlert && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 animate-pulse">!</span>
                              )}
                            </div>
                            <p className={`text-[10px] font-semibold ${card.textColor} uppercase tracking-wide mb-0.5`}>{card.label}</p>
                            <p className="text-2xl font-bold tabular-nums leading-none mb-1">{card.value}</p>
                            <p className="text-[11px] text-muted-foreground">{card.sub}</p>
                          </div>
                          <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${card.gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />
                        </button>
                      );
                    })}
                  </div>

                  {/* Food Supply Overview */}
                  <div className="mb-5">
                    <KitchenFoodSupplyOverview kitchenId={selectedKitchen.id} kitchenName={selectedKitchen.name} />
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Order Supplies */}
                    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-100 dark:border-blue-900/30 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{t('order_supplies')}</p>
                          {lowStockItems.length > 0 && <Badge className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-0 h-4 px-1.5">{t('recommended')}</Badge>}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        {lowStockItems.length > 0 ? `${lowStockItems.length} low stock items need restocking` : t('keep_your_inventory_stocked')}
                      </p>
                      <OrderFoodSuppliesDialog
                        kitchenId={selectedKitchen.id} kitchenName={selectedKitchen.name}
                        onOrderComplete={() => fetchFoodSupplies(true)} button
                        buttonVariant="default" buttonSize="sm"
                        buttonClassName="w-full bg-blue-600 hover:bg-blue-700"
                        buttonLabel={t('order_now')}
                      />
                    </div>

                    {/* Record Consumption */}
                    {buttonPermissions.isButtonVisible('kitchen_consumption') && (
                      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-100 dark:border-emerald-900/30 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <Utensils className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{t('record_consumption')}</p>
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 h-4 px-1.5">{t('daily')}</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{t('track_what_you_use_daily')}</p>
                        <KitchenConsumptionDialog
                          kitchenId={selectedKitchen.id} kitchenName={selectedKitchen.name}
                          buttonVariant="default" buttonSize="sm"
                          buttonClassName="w-full bg-emerald-600 hover:bg-emerald-700"
                          buttonLabel={t('record_now')}
                        />
                      </div>
                    )}

                    {/* Track Waste */}
                    {buttonPermissions.isButtonVisible('kitchen_waste_tracking') && (
                      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border border-amber-100 dark:border-amber-900/30 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <Trash2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{t('track_waste')}</p>
                            <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-0 h-4 px-1.5">{t('important')}</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{t('reduce_costs_by_tracking_waste')}</p>
                        <EnhancedWasteTrackingDialog
                          kitchenId={selectedKitchen.id}
                          kitchenName={selectedKitchen.name}
                          buttonVariant="default" buttonSize="sm"
                          buttonClassName="w-full bg-amber-600 hover:bg-amber-700"
                          buttonLabel={t('track_now')}
                        />
                      </div>
                    )}
                  </div>
                </CardTabs.Content>

                {/* ── Inventory Tab ── */}
                <CardTabs.Content value="inventory" className="mt-5">
                  <Card className="border-0 ring-1 ring-border/60 shadow-sm">
                    <CardHeader className="pb-4 border-b border-border/50">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Package className="h-4 w-4 text-emerald-600" />
                            {t('kitchen_inventory')}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {filteredAndSorted.length} of {foodSupplies.length} {t('items_in_stock')}
                            {(searchQuery || inventoryFilter !== 'all') && ' (filtered)'}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Sort */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl h-8">
                                <ArrowUpDown className="h-3.5 w-3.5" />
                                {sortBy === 'expiry' ? 'Expiry' : sortBy === 'name' ? 'Name' : sortBy === 'quantity' ? 'Qty' : 'Value'}
                                {sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuLabel className="text-xs">Sort by</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {[{ key: 'expiry', label: 'Expiry Date' }, { key: 'name', label: 'Name A–Z' }, { key: 'quantity', label: 'Quantity' }, { key: 'value', label: 'Total Value' }].map(o => (
                                <DropdownMenuItem key={o.key} onClick={() => toggleSort(o.key as any)}
                                  className={sortBy === o.key ? 'font-semibold text-emerald-600' : ''}>
                                  {o.label}
                                  {sortBy === o.key && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-auto" /> : <ArrowDown className="h-3 w-3 ml-auto" />)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <KitchenFoodSupplyForm
                            kitchenId={selectedKitchen.id} kitchenName={selectedKitchen.name}
                            onSuccess={() => fetchFoodSupplies(true)}
                            buttonVariant="default" buttonSize="sm"
                            buttonClassName="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-8"
                            buttonIcon={<Plus className="h-3.5 w-3.5" />}
                            buttonLabel={<span className="hidden sm:inline">{t('add')}</span>}
                          />
                        </div>
                      </div>

                      {/* Search + filter pills */}
                      <div className="mt-3 space-y-2.5">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <input type="text" placeholder={t('search_inventory')}
                            className="w-full pl-9 pr-8 h-9 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                          />
                          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
                        </div>

                        {/* Status filter pills */}
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: 'all',      label: 'All',          count: foodSupplies.length,  cls: 'bg-muted text-muted-foreground hover:text-foreground' },
                            { key: 'expiring', label: 'Expiring (≤7d)', count: expiringItems.length, cls: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400' },
                            { key: 'lowstock', label: 'Low Stock',    count: lowStockItems.length, cls: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400' },
                            { key: 'good',     label: 'Good',         count: foodSupplies.filter(s => Math.ceil((new Date(s.expirationDate).getTime() - Date.now()) / 86400000) > 7 && !lowStockItems.some(l => l.id === s.id)).length, cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400' },
                          ].map(({ key, label, count, cls }) => (
                            <button key={key} onClick={() => setInventoryFilter(key as any)}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${inventoryFilter === key ? 'ring-2 ring-offset-1 ring-emerald-400 shadow-sm' : ''} ${cls}`}>
                              {label}
                              <span className="bg-current/15 rounded-full px-1.5 py-0.5 font-bold">{count}</span>
                            </button>
                          ))}
                          {(searchQuery || inventoryFilter !== 'all') && (
                            <button onClick={() => { setSearchQuery(''); setInventoryFilter('all'); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5">
                              <X className="h-3 w-3" />Clear
                            </button>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-4">
                      {isLoading ? <InventorySkeleton /> : filteredAndSorted.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-border text-center">
                          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                            <Package className="h-7 w-7 text-muted-foreground" />
                          </div>
                          <h3 className="font-semibold mb-1">{searchQuery || inventoryFilter !== 'all' ? t('no_matching_items') : t('no_food_supplies_found')}</h3>
                          <p className="text-sm text-muted-foreground max-w-xs mb-4">
                            {searchQuery || inventoryFilter !== 'all' ? 'Try adjusting your search or filters.' : t('add_food_supplies_to_get_started')}
                          </p>
                          {!searchQuery && inventoryFilter === 'all' && (
                            <KitchenFoodSupplyForm kitchenId={selectedKitchen.id} kitchenName={selectedKitchen.name} onSuccess={() => fetchFoodSupplies(true)} />
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredAndSorted.map(supply => (
                            <InventoryCard
                              key={supply.id} supply={supply}
                              kitchenId={selectedKitchen.id} kitchenName={selectedKitchen.name}
                              isExpiringSoon={expiringItems.some(i => i.id === supply.id)}
                              isLowStock={lowStockItems.some(i => i.id === supply.id)}
                              onUpdate={() => fetchFoodSupplies(true)}
                              onRefill={setRefillItem}
                            />
                          ))}
                        </div>
                      )}

                      {/* Footer summary */}
                      {!isLoading && filteredAndSorted.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{filteredAndSorted.length} item{filteredAndSorted.length !== 1 ? 's' : ''}</span>
                          <span className="font-semibold text-foreground">
                            Total: QAR {filteredAndSorted.reduce((s, i) => s + i.quantity * i.pricePerUnit, 0).toFixed(0)}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </CardTabs.Content>

                {/* ── Recipes Tab (lazy) ── */}
                <CardTabs.Content value="recipes" className="mt-5">
                  {visitedTabs.has('recipes') && <RecipesTab kitchenId={selectedKitchen.id} />}
                </CardTabs.Content>

                {/* ── Operations Tab (lazy) ── */}
                <CardTabs.Content value="operations" className="mt-5">
                  {visitedTabs.has('operations') && (
                    <KitchenOperationsTab
                      kitchenId={selectedKitchen.id} kitchenName={selectedKitchen.name}
                      allKitchens={assignments.map(a => ({ id: a.kitchen.id, name: a.kitchen.name }))}
                    />
                  )}
                </CardTabs.Content>

                {/* ── Consumption Tab (lazy) ── */}
                <CardTabs.Content value="consumption" className="mt-5">
                  {visitedTabs.has('consumption') && (
                    <Card className="border-0 ring-1 ring-border/60 shadow-sm">
                      <CardHeader className="border-b border-border/50">
                        <CardTitle className="text-base flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-emerald-600" />
                          {t('kitchen_consumption')}
                        </CardTitle>
                        <CardDescription>{t('track_and_analyze_consumption_in_this_kitchen')}</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <ConsumptionTabContent kitchenId={selectedKitchen.id} kitchenName={selectedKitchen.name} />
                      </CardContent>
                    </Card>
                  )}
                </CardTabs.Content>
              </CardTabs>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 rounded-2xl border-2 border-dashed border-border">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">{t('no_kitchen_selected')}</h3>
              <p className="text-sm text-muted-foreground text-center max-w-xs">{t('select_kitchen_from_sidebar')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Refill Dialog */}
      {refillItem && (
        <RefillFoodSupplyDialog
          open={!!refillItem}
          onOpenChange={open => { if (!open) setRefillItem(null); }}
          item={{ id: refillItem.id, name: refillItem.name, quantity: refillItem.quantity, unit: refillItem.unit, expirationDate: new Date(refillItem.expirationDate), isExpired: new Date(refillItem.expirationDate) < new Date() }}
          onRefill={async ({ id, newQuantity, newExpirationDate, disposedQuantity }) => {
            try {
              const res = await fetch('/api/food-supply/refill', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ foodSupplyId: id, quantity: newQuantity, expirationDate: newExpirationDate, disposedQuantity }),
              });
              if (!res.ok) throw new Error('Failed');
              setRefillItem(null);
              await fetchFoodSupplies(true);
              toast({ title: t('success'), description: 'Food supply updated successfully.' });
            } catch {
              toast({ title: t('error'), description: 'Failed to update food supply.', variant: 'destructive' });
            }
          }}
        />
      )}
    </div>
  );
}
