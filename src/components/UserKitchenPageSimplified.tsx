// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useButtonVisibility } from '@/hooks/useButtonVisibility';
import { 
  getFoodSupplies, 
  getKitchenAssignments, 
  getExpiringItems, 
  getLowStockItems,
  fetchWithCache,
  type FoodSupply,
  type KitchenAssignment,
  type Kitchen
} from '@/lib/foodSupplyService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { useTranslation } from "@/contexts/TranslationContext";
import { CardTabs } from "@/components/ui/card-tabs";
import { KitchenConsumptionDialog } from './KitchenConsumptionDialog';
import { ConsumptionHistoryDialog } from './ConsumptionHistoryDialog';
import { WasteHistoryDialog } from './WasteHistoryDialog';
import { EnhancedWasteTrackingDialog } from './EnhancedWasteTrackingDialog';
import { FoodSupplyNotifications } from './FoodSupplyNotifications';
import { RecipesTab } from './RecipesTab';
import { KitchenOperationsTab } from './KitchenOperationsTab';
import { KitchenAIAnalysis } from './KitchenAIAnalysis';
import { KitchenWasteAnalysis } from './KitchenWasteAnalysis';
import { KitchenFoodSupplyForm } from './KitchenFoodSupplyForm';
import { EnhancedRecipeManagementDialog } from './EnhancedRecipeManagementDialog';
import { OrderFoodSuppliesDialog } from './OrderFoodSuppliesDialog';
import { EnhancedKitchenReportButton } from './EnhancedKitchenReportButton';
import { ScanFoodSupplyButton } from './ScanFoodSupplyButton';
import { KitchenFinancialMetrics } from './KitchenFinancialMetrics';
import { KitchenFoodSupplyOverview } from './KitchenFoodSupplyOverview';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConsumptionTabContent } from './ConsumptionTabContent';
import { 
  Utensils, 
  Building2, 
  ChefHat, 
  AlertTriangle,
  AlertCircle,
  Package, 
  Trash2, 
  History,
  BarChart3,
  PieChart,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  Info,
  ShoppingCart,
  Plus,
  TrendingDown,
  TrendingUp,
  Clock,
  ArrowRight,
  CheckCircle2,
  ClipboardList
} from 'lucide-react';

interface Kitchen {
  id: string;
  name: string;
  floorNumber: string;
  description?: string;
}

interface KitchenAssignment {
  id: string;
  kitchenId: string;
  kitchen: Kitchen;
}

interface FoodSupply {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  pricePerUnit: number;
  expirationDate: string;
  totalWasted: number;
  kitchenId: string;
  kitchenSupplies?: {
    id: string;
    kitchenId: string;
    quantity: number;
    expirationDate: string;
    kitchen: {
      id: string;
      name: string;
    };
  }[];
}

// ── Skeleton loader for inventory grid ──
function InventorySkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-muted rounded w-28" />
            <div className="h-5 w-16 bg-muted rounded-full" />
          </div>
          <div className="h-2 bg-muted rounded-full w-full" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-full" />
          </div>
          <div className="flex gap-2 pt-1">
            <div className="h-8 bg-muted rounded-lg flex-1" />
            <div className="h-8 bg-muted rounded-lg flex-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function UserKitchenPageSimplified() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<KitchenAssignment[]>([]);
  const [selectedKitchen, setSelectedKitchen] = useState<Kitchen | null>(null);
  const [foodSupplies, setFoodSupplies] = useState<FoodSupply[]>([]);
  const [expiringItems, setExpiringItems] = useState<FoodSupply[]>([]);
  const [lowStockItems, setLowStockItems] = useState<FoodSupply[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useTranslation();
  const buttonPermissions = useButtonVisibility();

  const [dataCache, setDataCache] = useState<{
    [kitchenId: string]: {
      foodSupplies?: FoodSupply[];
      recipes?: any[];
      timestamp: number;
    }
  }>({});
  const CACHE_EXPIRATION = 5 * 60 * 1000;

  const fetchAssignments = async () => {
    try {
      const data = await getKitchenAssignments();
      if (data && data.length > 0) {
        setAssignments(data);
        if (!selectedKitchen) {
          setSelectedKitchen(data[0].kitchen);
        }
      }
    } catch (error) {
      console.error('Error fetching kitchen assignments:', error);
      toast({ title: t('error'), description: t('failed_to_fetch_kitchen_assignments'), variant: 'destructive' });
    }
  };

  const fetchFoodSupplies = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      if (!selectedKitchen) {
        setFoodSupplies([]); setExpiringItems([]); setLowStockItems([]);
        setIsLoading(false); return;
      }
      const cachedData = dataCache[selectedKitchen.id];
      const now = new Date().getTime();
      if (!forceRefresh && cachedData && cachedData.foodSupplies && (now - cachedData.timestamp < CACHE_EXPIRATION)) {
        setFoodSupplies(cachedData.foodSupplies);
        setExpiringItems(getExpiringItems(cachedData.foodSupplies, 7));
        setLowStockItems(getLowStockItems(cachedData.foodSupplies, 0.2));
        setIsLoading(false); return;
      }
      const data = await getFoodSupplies(selectedKitchen.id, forceRefresh);
      if (data && data.length > 0) {
        const processedData = data.map((item: FoodSupply) => {
          if (item.kitchenSupplies && item.kitchenSupplies.length > 0) {
            const kitchenSupply = item.kitchenSupplies[0];
            return { ...item, quantity: kitchenSupply.quantity, expirationDate: kitchenSupply.expirationDate };
          }
          return item;
        });
        const filteredData = processedData.filter((item: FoodSupply) =>
          item.kitchenId === selectedKitchen.id ||
          (item.kitchenSupplies && item.kitchenSupplies.some(ks => ks.kitchenId === selectedKitchen.id))
        );
        setFoodSupplies(filteredData);
        setDataCache(prev => ({ ...prev, [selectedKitchen.id]: { ...prev[selectedKitchen.id], foodSupplies: filteredData, timestamp: now } }));
        setExpiringItems(getExpiringItems(filteredData, 7));
        setLowStockItems(getLowStockItems(filteredData, 0.2));
      } else {
        setFoodSupplies([]); setExpiringItems([]); setLowStockItems([]);
        setDataCache(prev => ({ ...prev, [selectedKitchen.id]: { ...prev[selectedKitchen.id], foodSupplies: [], timestamp: now } }));
      }
    } catch (error) {
      console.error('Error fetching food supplies:', error);
      toast({ title: t('error'), description: t('failed_to_fetch_food_supplies'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecipes = async (forceRefresh = false) => {
    if (!selectedKitchen) return;
    try {
      const cachedData = dataCache[selectedKitchen.id];
      const now = new Date().getTime();
      if (!forceRefresh && cachedData && cachedData.recipes && (now - cachedData.timestamp < CACHE_EXPIRATION)) {
        setRecipes(cachedData.recipes); return;
      }
      const data = await fetchWithCache(`/api/recipes?kitchenId=${selectedKitchen.id}`, {}, forceRefresh);
      if (data) {
        setRecipes(data);
        setDataCache(prev => ({ ...prev, [selectedKitchen.id]: { ...prev[selectedKitchen.id], recipes: data, timestamp: now } }));
      } else {
        setRecipes([]);
        setDataCache(prev => ({ ...prev, [selectedKitchen.id]: { ...prev[selectedKitchen.id], recipes: [], timestamp: now } }));
      }
    } catch (error) {
      console.error('Error fetching recipes:', error);
      toast({ title: t('error'), description: t('failed_to_fetch_recipes'), variant: 'destructive' });
    }
  };

  useEffect(() => { fetchAssignments(); }, []);
  useEffect(() => {
    if (selectedKitchen) { fetchFoodSupplies(); fetchRecipes(); }
  }, [selectedKitchen]);

  const handleKitchenSelect = (kitchen: Kitchen) => {
    setIsLoading(true);
    const cachedData = dataCache[kitchen.id];
    const now = new Date().getTime();
    if (cachedData && (now - cachedData.timestamp < CACHE_EXPIRATION)) {
      if (cachedData.foodSupplies) {
        setFoodSupplies(cachedData.foodSupplies);
        setExpiringItems(getExpiringItems(cachedData.foodSupplies, 7));
        setLowStockItems(getLowStockItems(cachedData.foodSupplies, 0.2));
        setIsLoading(false);
      }
      if (cachedData.recipes) setRecipes(cachedData.recipes);
    } else {
      setFoodSupplies([]); setExpiringItems([]); setLowStockItems([]); setRecipes([]);
    }
    setSelectedKitchen(kitchen);
  };

  const filteredFoodSupplies = searchQuery
    ? foodSupplies.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : foodSupplies;

  // ── Stat card definitions ──
  const statCards = [
    {
      label: t('total_inventory'),
      value: foodSupplies.length,
      sub: t('items_in_stock'),
      icon: Package,
      color: 'emerald',
      tab: 'inventory',
      gradient: 'from-emerald-500 to-teal-600',
      bgLight: 'from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      textColor: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      label: t('expiring_soon'),
      value: expiringItems.length,
      sub: t('items_expiring_within_7_days'),
      icon: AlertTriangle,
      color: 'red',
      tab: 'inventory',
      gradient: 'from-red-500 to-rose-600',
      bgLight: 'from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20',
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      textColor: 'text-red-700 dark:text-red-400',
    },
    {
      label: t('low_stock'),
      value: lowStockItems.length,
      sub: t('items_running_low'),
      icon: TrendingDown,
      color: 'amber',
      tab: 'inventory',
      gradient: 'from-amber-500 to-yellow-600',
      bgLight: 'from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      textColor: 'text-amber-700 dark:text-amber-400',
    },
    {
      label: t('recipes'),
      value: recipes.length,
      sub: t('available_recipes'),
      icon: ChefHat,
      color: 'blue',
      tab: 'recipes',
      gradient: 'from-blue-500 to-indigo-600',
      bgLight: 'from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      textColor: 'text-blue-700 dark:text-blue-400',
    },
  ];

  return (
    <div className="space-y-5">
      {assignments.length === 0 ? (
        /* ── Empty State ── */
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl border-2 border-dashed border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/10">
          <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-5 shadow-inner">
            <Building2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">{t('no_kitchens_assigned')}</h3>
          <p className="text-muted-foreground text-center max-w-sm mb-6">
            {t('contact_admin_for_kitchen_assignment')}
          </p>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md gap-2">
            {t('contact_administrator')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

          {/* ══════════════════════════════
              Kitchen Selector Sidebar
          ══════════════════════════════ */}
          <div className="md:col-span-3 lg:col-span-2">
            <Card className="shadow-sm h-full overflow-hidden border-0 ring-1 ring-border/60">
              <CardHeader className="pb-3 bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900/60 border-b border-border/50">
                <CardTitle className="text-xs font-semibold flex items-center gap-2 text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">
                  <Building2 className="h-3.5 w-3.5" />
                  {t('kitchens')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="space-y-1">
                  {assignments.map((assignment) => {
                    const isActive = selectedKitchen?.id === assignment.kitchen.id;
                    return (
                      <button
                        key={assignment.id}
                        onClick={() => handleKitchenSelect(assignment.kitchen)}
                        className={`w-full text-left rounded-xl p-3 transition-all duration-200 group ${
                          isActive
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-200/50 dark:shadow-emerald-900/30'
                            : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-foreground'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                            isActive ? 'bg-white/20' : 'bg-emerald-100 dark:bg-emerald-900/30 group-hover:bg-emerald-200/70'
                          }`}>
                            <ChefHat className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold leading-tight truncate ${isActive ? 'text-white' : ''}`}>
                              {assignment.kitchen.name}
                            </p>
                            <p className={`text-[11px] mt-0.5 ${isActive ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                              Floor {assignment.kitchen.floorNumber}
                            </p>
                          </div>
                          {isActive && (
                            <div className="flex-shrink-0 mt-1">
                              <div className="h-2 w-2 rounded-full bg-white/80 animate-pulse" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Quick stat pills */}
                {selectedKitchen && (
                  <div className="mt-4 pt-4 border-t border-border/50 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-2">
                      {t('quick_stats')}
                    </p>
                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
                      <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{t('inventory')}</span>
                      <span className="text-sm font-bold text-emerald-900 dark:text-emerald-300">{foodSupplies.length}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">
                      <span className="text-xs text-red-700 dark:text-red-400 font-medium">{t('expiring')}</span>
                      <span className={`text-sm font-bold ${expiringItems.length > 0 ? 'text-red-700 dark:text-red-400' : 'text-red-900 dark:text-red-300'}`}>{expiringItems.length}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                      <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">{t('low_stock')}</span>
                      <span className={`text-sm font-bold ${lowStockItems.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-amber-900 dark:text-amber-300'}`}>{lowStockItems.length}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ══════════════════════════════
              Main Content Area
          ══════════════════════════════ */}
          <div className="md:col-span-9 lg:col-span-10">
            {selectedKitchen ? (
              <div className="space-y-5">

                {/* ── Kitchen Hero Header ── */}
                <div className="relative rounded-2xl overflow-hidden ring-1 ring-border/60 shadow-sm">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-700" />
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
                  <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
                  <div className="relative z-10 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                        </div>
                        <p className="text-sm text-emerald-100/80 mt-0.5">
                          {selectedKitchen.description || t('no_description_available')}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ScanFoodSupplyButton
                        kitchenId={selectedKitchen.id}
                        onScanComplete={fetchFoodSupplies}
                        buttonSize="sm"
                      />
                      {buttonPermissions.isButtonVisible('kitchen_food_supply') && (
                        <KitchenFoodSupplyForm
                          kitchenId={selectedKitchen.id}
                          kitchenName={selectedKitchen.name}
                          onSuccess={fetchFoodSupplies}
                          buttonSize="sm"
                        />
                      )}
                      <EnhancedKitchenReportButton
                        kitchen={selectedKitchen}
                        recipes={recipes}
                        foodSupplies={foodSupplies}
                        expiringItems={expiringItems}
                        lowStockItems={lowStockItems}
                        buttonSize="sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Kitchen Financial Metrics */}
                <KitchenFinancialMetrics
                  kitchenId={selectedKitchen.id}
                  kitchenName={selectedKitchen.name}
                />

                {/* Kitchen-specific notifications */}
                <FoodSupplyNotifications kitchenId={selectedKitchen.id} />

                {/* ── Tabs ── */}
                <CardTabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <CardTabs.List className="w-full flex gap-1 mb-2 bg-muted/50 p-1 rounded-xl">
                    <CardTabs.Trigger value="overview" icon={<Package className="h-4 w-4" />}>
                      {t('overview')}
                    </CardTabs.Trigger>
                    <CardTabs.Trigger value="inventory" icon={<Utensils className="h-4 w-4" />}>
                      {t('inventory')}
                    </CardTabs.Trigger>
                    <CardTabs.Trigger value="recipes" icon={<ChefHat className="h-4 w-4" />}>
                      {t('recipes')}
                    </CardTabs.Trigger>
                    <CardTabs.Trigger value="consumption" icon={<BarChart3 className="h-4 w-4" />}>
                      {t('consumption')}
                    </CardTabs.Trigger>
                    <CardTabs.Trigger value="operations" icon={<ClipboardList className="h-4 w-4" />}>
                      Operations
                    </CardTabs.Trigger>
                  </CardTabs.List>

                  {/* ── Overview Tab ── */}
                  <CardTabs.Content value="overview" className="mt-5">
                    {/* Real-time inventory alerts */}
                    {(lowStockItems.length > 0 || expiringItems.length > 0) && (
                      <div className="mb-4 space-y-2">
                        {lowStockItems.length > 0 && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-300">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span><strong>{lowStockItems.length}</strong> item{lowStockItems.length !== 1 ? 's' : ''} running low on stock: {lowStockItems.slice(0, 3).map(i => i.name).join(', ')}{lowStockItems.length > 3 ? ` +${lowStockItems.length - 3} more` : ''}</span>
                            <button className="ml-auto text-xs underline" onClick={() => setActiveTab('inventory')}>View</button>
                          </div>
                        )}
                        {expiringItems.length > 0 && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span><strong>{expiringItems.length}</strong> item{expiringItems.length !== 1 ? 's' : ''} expiring within 7 days: {expiringItems.slice(0, 3).map(i => i.name).join(', ')}{expiringItems.length > 3 ? ` +${expiringItems.length - 3} more` : ''}</span>
                            <button className="ml-auto text-xs underline" onClick={() => setActiveTab('inventory')}>View</button>
                          </div>
                        )}
                      </div>
                    )}
                    {/* World-class metric cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      {statCards.map((card) => {
                        const Icon = card.icon;
                        return (
                          <button
                            key={card.label}
                            onClick={() => setActiveTab(card.tab)}
                            className={`group relative text-left rounded-2xl overflow-hidden bg-gradient-to-br ${card.bgLight} border border-transparent hover:border-current/20 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
                          >
                            <div className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className={`h-10 w-10 rounded-xl ${card.iconBg} flex items-center justify-center shadow-sm`}>
                                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                                </div>
                                {card.value > 0 && card.color !== 'emerald' && card.color !== 'blue' && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                    card.color === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                                  }`}>!</span>
                                )}
                              </div>
                              <p className={`text-xs font-semibold ${card.textColor} uppercase tracking-wide mb-0.5`}>
                                {card.label}
                              </p>
                              <p className="text-3xl font-bold tabular-nums leading-none mb-1">{card.value}</p>
                              <p className="text-[11px] text-muted-foreground">{card.sub}</p>
                            </div>
                            {/* Bottom accent bar */}
                            <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${card.gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />
                          </button>
                        );
                      })}
                    </div>

                    {/* Food Supply Overview */}
                    <div className="mb-5">
                      <KitchenFoodSupplyOverview
                        kitchenId={selectedKitchen.id}
                        kitchenName={selectedKitchen.name}
                      />
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Order Supplies */}
                      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-100 dark:border-blue-900/30 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <ShoppingCart className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{t('order_supplies')}</p>
                            {lowStockItems.length > 0 && (
                              <Badge className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-0 h-4 px-1.5">
                                {t('recommended')}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          {lowStockItems.length > 0
                            ? t('low_stock_items_order_now', { count: lowStockItems.length })
                            : t('keep_your_inventory_stocked')}
                        </p>
                        <OrderFoodSuppliesDialog
                          kitchenId={selectedKitchen.id}
                          kitchenName={selectedKitchen.name}
                          onOrderComplete={fetchFoodSupplies}
                          button
                          buttonVariant="default"
                          buttonSize="sm"
                          buttonClassName="w-full bg-blue-600 hover:bg-blue-700"
                          buttonLabel={t('order_now')}
                        />
                      </div>

                      {/* Record Consumption */}
                      {buttonPermissions.isButtonVisible('kitchen_consumption') && (
                        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-100 dark:border-emerald-900/30 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                              <Utensils className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{t('record_consumption')}</p>
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 h-4 px-1.5">
                                {t('daily')}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            {t('track_what_you_use_daily')}
                          </p>
                          <KitchenConsumptionDialog
                            kitchenId={selectedKitchen.id}
                            kitchenName={selectedKitchen.name}
                            buttonVariant="default"
                            buttonSize="sm"
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
                              <Trash2 className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{t('track_waste')}</p>
                              <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-0 h-4 px-1.5">
                                {t('important')}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            {t('reduce_costs_by_tracking_waste')}
                          </p>
                          <EnhancedWasteTrackingDialog
                            buttonVariant="default"
                            buttonSize="sm"
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
                              <Package className="h-4.5 w-4.5 text-emerald-600" />
                              {t('kitchen_inventory')}
                            </CardTitle>
                            <CardDescription className="text-xs mt-0.5">
                              {filteredFoodSupplies.length} {t('items_in_stock')}
                              {expiringItems.length > 0 && ` · ${expiringItems.length} expiring`}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                              <input
                                type="text"
                                placeholder={t('search_inventory')}
                                className="pl-8 h-9 w-[180px] rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                              />
                            </div>
                            <KitchenFoodSupplyForm
                              kitchenId={selectedKitchen.id}
                              kitchenName={selectedKitchen.name}
                              onSuccess={fetchFoodSupplies}
                              buttonVariant="default"
                              buttonSize="sm"
                              buttonClassName="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                              buttonIcon={<Plus className="h-3.5 w-3.5" />}
                              buttonLabel={<span className="hidden sm:inline">{t('add')}</span>}
                            />
                          </div>
                        </div>
                        {/* Filter badges */}
                        {filteredFoodSupplies.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30 text-xs">
                              All: {filteredFoodSupplies.length}
                            </Badge>
                            {expiringItems.length > 0 && (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 text-xs">
                                Expiring: {expiringItems.length}
                              </Badge>
                            )}
                            {lowStockItems.length > 0 && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 text-xs">
                                Low Stock: {lowStockItems.length}
                              </Badge>
                            )}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="pt-4">
                        {isLoading ? (
                          <InventorySkeleton />
                        ) : filteredFoodSupplies.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-border text-center">
                            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                              <Package className="h-7 w-7 text-muted-foreground" />
                            </div>
                            <h3 className="font-semibold mb-1">
                              {searchQuery ? t('no_matching_items') : t('no_food_supplies_found')}
                            </h3>
                            <p className="text-sm text-muted-foreground max-w-xs mb-4">
                              {searchQuery ? t('try_different_search_terms') : t('add_food_supplies_to_get_started')}
                            </p>
                            {!searchQuery && (
                              <KitchenFoodSupplyForm
                                kitchenId={selectedKitchen.id}
                                kitchenName={selectedKitchen.name}
                                onSuccess={fetchFoodSupplies}
                              />
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredFoodSupplies.map((supply) => {
                              const expirationDate = new Date(supply.expirationDate);
                              const daysUntilExpiration = Math.ceil((expirationDate.getTime() - Date.now()) / 86400000);
                              const isExpiringSoon = daysUntilExpiration <= 7;
                              const isLowStock = lowStockItems.some(item => item.id === supply.id);
                              const totalValue = (supply.pricePerUnit * supply.quantity).toFixed(0);
                              // Stock level as % (max 100)
                              const stockPct = Math.min(100, Math.round((supply.quantity / Math.max(supply.quantity, 1)) * 100));

                              return (
                                <div
                                  key={supply.id}
                                  className={`group relative rounded-2xl border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden ${
                                    isExpiringSoon
                                      ? 'border-red-200 dark:border-red-800/40 bg-red-50/30 dark:bg-red-950/10'
                                      : isLowStock
                                        ? 'border-amber-200 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/10'
                                        : 'border-border bg-card hover:border-emerald-200 dark:hover:border-emerald-800/40'
                                  }`}
                                >
                                  {/* Status accent top bar */}
                                  {(isExpiringSoon || isLowStock) && (
                                    <div className={`h-1 w-full ${isExpiringSoon ? 'bg-gradient-to-r from-red-500 to-rose-500' : 'bg-gradient-to-r from-amber-500 to-yellow-500'}`} />
                                  )}

                                  <div className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="min-w-0 flex-1 pr-2">
                                        <h3 className="font-semibold text-sm leading-tight truncate">{supply.name}</h3>
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] mt-1 h-4 px-1.5 font-medium border-0 bg-muted text-muted-foreground"
                                        >
                                          {supply.category}
                                        </Badge>
                                      </div>
                                      <div className="flex-shrink-0">
                                        {isExpiringSoon ? (
                                          <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                          </div>
                                        ) : isLowStock ? (
                                          <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                            <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                          </div>
                                        ) : (
                                          <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Stats grid */}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-3">
                                      <div>
                                        <p className="text-muted-foreground">Quantity</p>
                                        <p className="font-semibold">{supply.quantity} <span className="text-muted-foreground font-normal">{supply.unit}</span></p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">Value</p>
                                        <p className="font-semibold">QAR {totalValue}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">Expires in</p>
                                        <p className={`font-semibold ${isExpiringSoon ? 'text-red-600 dark:text-red-400' : ''}`}>
                                          {daysUntilExpiration < 0 ? 'Expired' : `${daysUntilExpiration}d`}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">Unit price</p>
                                        <p className="font-semibold">QAR {supply.pricePerUnit.toFixed(2)}</p>
                                      </div>
                                    </div>

                                    {/* Expiry countdown pill */}
                                    {daysUntilExpiration <= 14 && (
                                      <div className={`flex items-center gap-1.5 text-[10px] font-semibold rounded-full px-2.5 py-1 mb-3 w-fit ${
                                        daysUntilExpiration <= 3
                                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                          : daysUntilExpiration <= 7
                                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                      }`}>
                                        <Clock className="h-3 w-3" />
                                        {daysUntilExpiration < 0 ? 'Expired' : daysUntilExpiration === 0 ? 'Expires today' : `Expires in ${daysUntilExpiration} days`}
                                      </div>
                                    )}

                                    {/* Action buttons */}
                                    <div className="flex gap-2 pt-1">
                                      <KitchenConsumptionDialog
                                        kitchenId={selectedKitchen.id}
                                        kitchenName={selectedKitchen.name}
                                        preselectedFoodSupplyId={supply.id}
                                        buttonVariant="outline"
                                        buttonSize="sm"
                                        buttonLabel={t('consume')}
                                        onSuccess={fetchFoodSupplies}
                                      />
                                      <Button variant="outline" size="sm" className="flex-1 text-xs h-8">
                                        {t('update')}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </CardTabs.Content>

                  {/* ── Recipes Tab ── */}
                  <CardTabs.Content value="recipes" className="mt-5">
                    <RecipesTab kitchenId={selectedKitchen.id} />
                  </CardTabs.Content>

                  {/* ── Operations Tab ── */}
                  <CardTabs.Content value="operations" className="mt-5">
                    <KitchenOperationsTab
                      kitchenId={selectedKitchen.id}
                      kitchenName={selectedKitchen.name}
                      allKitchens={kitchens}
                    />
                  </CardTabs.Content>

                  {/* ── Consumption Tab ── */}
                  <CardTabs.Content value="consumption" className="mt-5">
                    <Card className="border-0 ring-1 ring-border/60 shadow-sm">
                      <CardHeader className="border-b border-border/50">
                        <CardTitle className="text-base flex items-center gap-2">
                          <BarChart3 className="h-4.5 w-4.5 text-emerald-600" />
                          {t('kitchen_consumption')}
                        </CardTitle>
                        <CardDescription>{t('track_and_analyze_consumption_in_this_kitchen')}</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <ConsumptionTabContent kitchenId={selectedKitchen.id} kitchenName={selectedKitchen.name} />
                      </CardContent>
                    </Card>
                  </CardTabs.Content>

                </CardTabs>
              </div>
            ) : (
              /* No kitchen selected state */
              <div className="flex flex-col items-center justify-center py-24 rounded-2xl border-2 border-dashed border-border">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">{t('no_kitchen_selected')}</h3>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  {t('select_kitchen_from_sidebar')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
