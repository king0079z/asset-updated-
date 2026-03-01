import { DashboardLayout } from "@/components/DashboardLayout";
import { KitchenManagement } from "@/components/KitchenManagement";
import { KitchenConsumptionTab } from "@/components/KitchenConsumptionTab";
import { KitchenAnalyticsTab } from "@/components/KitchenAnalyticsTab";
import { KitchenConsumptionAnalysisTab } from "@/components/KitchenConsumptionAnalysisTab";
import { MultiLocationInventoryTab } from "@/components/MultiLocationInventoryTab";
import { BarcodeManagementDialog } from "@/components/BarcodeManagementDialog";
import { KitchenFoodSupplyNavigation } from "@/components/KitchenFoodSupplyNavigation";
import BarcodeScannerFood from "@/components/BarcodeScannerFood";
import { ConsumptionHistoryDialog } from "@/components/ConsumptionHistoryDialog";
import { EditFoodSupplyDialog } from "@/components/EditFoodSupplyDialog";
import { FoodSupplyMobileCard } from "@/components/FoodSupplyMobileCard";
import { ForecastingTab } from "@/components/ForecastingTab";
import { KitchenCompositionAnalytics } from "@/components/KitchenCompositionAnalytics";
import { KitchenConsumptionBreakdown } from "@/components/KitchenConsumptionBreakdown";
import { AiFoodConsumptionAnalysis } from "@/components/AiFoodConsumptionAnalysis";
import { EnhancedAiFoodAnalysis } from "@/components/EnhancedAiFoodAnalysis";
import { EnhancedWasteTrackingDialog } from "@/components/EnhancedWasteTrackingDialog";
import { WasteHistoryDialog } from "@/components/WasteHistoryDialog";
import { EnhancedRecipeManagementDialog } from "@/components/EnhancedRecipeManagementDialog";
import { RecipesTabRebuilt } from "@/components/RecipesTabRebuilt";
import { ExpiringItemsCard } from "@/components/ExpiringItemsCard";
import { LeadTimeNotificationsCard } from "@/components/LeadTimeNotificationsCard";
import { DisposedItemsTrackingCard } from "@/components/DisposedItemsTrackingCard";
import { NutritionalInfoDialog } from "@/components/NutritionalInfoDialog";
import { LocationOverpurchasingAnalysis } from "@/components/LocationOverpurchasingAnalysis";
import { FoodSupplyNotifications } from "@/components/FoodSupplyNotifications";
import { CategoryDetailsDialog } from "@/components/CategoryDetailsDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PrintFoodSupplyReportButton from "@/components/PrintFoodSupplyReportButton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { CardTabs } from "@/components/ui/card-tabs";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, UtensilsCrossed, Package, AlertTriangle, History, Search, Barcode, Utensils, Printer, FileText, ChefHat, BarChart3, LineChart, Trash2, Brain, MapPin, TrendingUp, Clock, CheckCircle2, ArrowRight, Building2, TrendingDown, Layers, X } from "lucide-react";
import { AssetReport } from "@/components/AssetReport";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { RefillFoodSupplyDialog } from "@/components/RefillFoodSupplyDialog";
import { printContentWithIframe } from '@/util/print';
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTranslation } from "@/contexts/TranslationContext";

const foodSupplySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  quantity: z.string().min(1, "Quantity is required"),
  unit: z.string().min(1, "Unit is required"),
  category: z.string().min(1, "Category is required"),
  expirationDate: z.string().min(1, "Expiration date is required"),
  vendorId: z.string().min(1, "Vendor is required"),
  pricePerUnit: z.string().min(1, "Price per unit is required"),
  notes: z.string().optional(),
});

type Vendor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type DashboardStats = {
  totalSupplies: number;
  expiringSupplies: number;
  categoryStats: Array<{ category: string; _count: number }>;
  recentSupplies: any[];
  totalConsumed?: number;
};

export default function FoodSupplyPage() {
  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [foodSupplies, setFoodSupplies] = useState<any[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refillDialogState, setRefillDialogState] = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const router = typeof window !== "undefined" ? require("next/router").useRouter() : { query: {} };
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [kitchens, setKitchens] = useState<{ id: string; name: string }[]>([]);
  const [consumptionHistory, setConsumptionHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const { toast } = useToast();

  const loadConsumptionHistory = async (foodSupplyId?: string) => {
    setIsLoadingHistory(true);
    try {
      const endpoint = foodSupplyId 
        ? `/api/food-supply/consumption-history?foodSupplyId=${foodSupplyId}`
        : '/api/food-supply/full-consumption-report';
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to load consumption history');
      const data = await response.json();
      
      // Ensure we have valid data with all required properties
      const validatedData = Array.isArray(data) ? data.map(record => ({
        ...record,
        quantity: record.quantity || 0,
        date: record.date || new Date().toISOString(),
        foodSupply: record.foodSupply || { 
          name: 'Unknown Item', 
          unit: 'units', 
          pricePerUnit: 0 
        },
        kitchen: record.kitchen || { 
          name: 'Unknown Kitchen', 
          floorNumber: null 
        },
        user: record.user || { 
          email: 'Unknown User' 
        }
      })) : [];
      
      setConsumptionHistory(validatedData);
    } catch (error) {
      console.error('Error loading consumption history:', error);
      toast({
        title: "Error",
        description: "Failed to load consumption history",
        variant: "destructive",
      });
      // Set empty array to prevent errors when rendering
      setConsumptionHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const categories = [
    { value: "dairy", label: "Dairy", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700", icon: "🥛" },
    { value: "meat", label: "Meat", color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700", icon: "🥩" },
    { value: "vegetables", label: "Vegetables", color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700", icon: "🥬" },
    { value: "fruits", label: "Fruits", color: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700", icon: "🍎" },
    { value: "grains", label: "Grains", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700", icon: "🌾" },
    { value: "beverages", label: "Beverages", color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700", icon: "🥤" },
    { value: "spices", label: "Spices", color: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700", icon: "🌶️" },
    { value: "seafood", label: "Seafood", color: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-700", icon: "🐟" },
    { value: "other", label: "Other", color: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700", icon: "📦" },
  ];

  const loadFoodSupplies = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/food-supply");
      const data = await response.json();
      setFoodSupplies(data);

      // If highlight param is present, open refill dialog for that item
      if (router && router.query && router.query.highlight) {
        const highlightId = Array.isArray(router.query.highlight)
          ? router.query.highlight[0]
          : router.query.highlight;
        const item = data.find((fs: any) => fs.id === highlightId);
        if (item) {
          setTimeout(() => {
            setRefillDialogState({
              open: true,
              item: {
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                expirationDate: new Date(item.expirationDate),
                isExpired: item.expirationDate && new Date(item.expirationDate) < new Date(),
              },
            });
          }, 300);
        }
      }
    } catch (error) {
      console.error("Error loading food supplies:", error);
      toast({
        title: "Error",
        description: "Failed to load food supplies",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const [statsResponse, consumedResponse] = await Promise.all([
        fetch("/api/food-supply/stats"),
        fetch("/api/food-supply/total-consumed")
      ]);
      
      const statsData = await statsResponse.json();
      const consumedData = await consumedResponse.json();
      
      setStats({
        ...statsData,
        totalConsumed: consumedData.totalConsumed
      });
    } catch (error) {
      console.error("Error loading stats:", error);
      toast({
        title: "Error",
        description: "Failed to load statistics",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const loadVendors = async () => {
      try {
        const response = await fetch("/api/vendors?type=FOOD_SUPPLY");
        const data = await response.json();
        setVendors(data);
      } catch (error) {
        console.error("Error loading vendors:", error);
        toast({
          title: "Error",
          description: "Failed to load vendors",
          variant: "destructive",
        });
      }
    };

    const loadKitchens = async () => {
      try {
        const response = await fetch("/api/kitchens");
        const data = await response.json();
        setKitchens(data);
      } catch (error) {
        console.error("Error loading kitchens:", error);
        toast({
          title: "Error",
          description: "Failed to load kitchens",
          variant: "destructive",
        });
      }
    };

    loadVendors();
    loadFoodSupplies();
    loadStats();
    loadKitchens();
    // eslint-disable-next-line
  }, []);

  const filteredSupplies = foodSupplies.filter((supply) => {
    const matchesSearch = supply.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || supply.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const form = useForm<z.infer<typeof foodSupplySchema>>({
    resolver: zodResolver(foodSupplySchema),
    defaultValues: {
      name: "",
      quantity: "",
      unit: "",
      category: "",
      expirationDate: "",
      notes: "",
    },
  });

  async function onSubmit(values: z.infer<typeof foodSupplySchema>) {
    try {
      const response = await fetch("/api/food-supply/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error("Failed to create food supply");
      }

      const data = await response.json();
      toast({
        title: "Success",
        description: "Food supply registered successfully",
      });
      setOpen(false);
      form.reset();
      loadFoodSupplies();
    } catch (error) {
      console.error("Error creating food supply:", error);
      toast({
        title: "Error",
        description: "Failed to register food supply",
        variant: "destructive",
      });
    }
  }

  const { t } = useTranslation();

  return (
    <>
      <RefillFoodSupplyDialog
        open={!!refillDialogState.open}
        onOpenChange={open => setRefillDialogState(s => ({ ...s, open }))}
        item={refillDialogState.item || {
          id: '',
          name: '',
          quantity: 0,
          unit: '',
          expirationDate: new Date(),
          isExpired: false,
        }}
        onRefill={async ({ id, newQuantity, newExpirationDate, disposedQuantity }) => {
          // Call API to update food supply
          try {
            const res = await fetch('/api/food-supply/refill', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                foodSupplyId: id,
                quantity: newQuantity,
                expirationDate: newExpirationDate,
                disposedQuantity,
              }),
            });
            if (!res.ok) throw new Error('Failed to refill food supply');
            // Refresh food supplies
            await loadFoodSupplies();
            setRefillDialogState({ open: false, item: null });
            toast({
              title: "Success",
              description: "Food supply refilled",
            });
          } catch (error) {
            toast({
              title: "Error",
              description: "Failed to refill food supply",
              variant: "destructive",
            });
          }
        }}
      />
      <DashboardLayout>
      <div className="flex flex-col space-y-6">

        {/* ══════════════════════════════════════
            World-Class Hero Header
        ══════════════════════════════════════ */}
        <div className="relative rounded-2xl overflow-hidden">
          {/* Layered gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.12),transparent_60%)]" />
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-44 h-44 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute top-6 right-36 w-20 h-20 rounded-full bg-amber-300/20" />

          <div className="relative z-10 p-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Title + inline stats */}
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg ring-1 ring-white/30 flex-shrink-0">
                  <UtensilsCrossed className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white tracking-tight">{t('food_supply_management')}</h1>
                  <p className="text-amber-100/80 text-sm mt-0.5">{t('manage_and_track_food_inventory')}</p>
                </div>
              </div>

              {/* Inline quick-stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Items', value: stats?.totalSupplies ?? 0, icon: Package },
                  { label: 'Categories', value: stats?.categoryStats?.length ?? 0, icon: Layers },
                  { label: 'Expiring Soon', value: stats?.expiringSupplies ?? 0, icon: AlertTriangle, warn: (stats?.expiringSupplies ?? 0) > 0 },
                  { label: 'Consumed Value', value: `QAR ${(stats?.totalConsumed ?? 0).toFixed(0)}`, icon: TrendingUp },
                ].map(({ label, value, icon: Icon, warn }) => (
                  <div key={label} className={`rounded-xl px-4 py-3 border ${warn ? 'bg-red-500/20 border-red-300/30' : 'bg-white/15 border-white/20'} backdrop-blur-sm`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="h-3 w-3 text-white/70" />
                      <p className="text-[10px] uppercase tracking-widest text-white/70 font-semibold">{label}</p>
                    </div>
                    <p className={`text-xl font-bold ${warn ? 'text-red-100' : 'text-white'}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2.5 lg:flex-col">
              <PrintFoodSupplyReportButton
                foodSupplies={foodSupplies}
                stats={stats}
                categories={categories}
              />
              <BarcodeManagementDialog />
              {kitchens.length > 0 && (
                <BarcodeScannerFood kitchenId={kitchens[0].id} onScanComplete={loadFoodSupplies} />
              )}
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-white text-orange-600 hover:bg-amber-50 border-0 shadow-lg font-semibold gap-2">
                    <PlusCircle className="h-4 w-4" />
                    {t('register_new_supply')}
                  </Button>
                </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>{t('register_new_food_supply')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('name')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('enter_food_supply_name')} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="quantity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('quantity')}</FormLabel>
                                <FormControl>
                                  <Input type="number" placeholder={t('enter_quantity')} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="unit"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('unit')}</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder={t('select_unit')} />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="kg">{t('kilograms')} (kg)</SelectItem>
                                    <SelectItem value="g">{t('grams')} (g)</SelectItem>
                                    <SelectItem value="l">{t('liters')} (L)</SelectItem>
                                    <SelectItem value="ml">{t('milliliters')} (mL)</SelectItem>
                                    <SelectItem value="units">{t('units')}</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('category')}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('select_category')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {categories.map((category) => (
                                    <SelectItem key={category.value} value={category.value}>
                                      {t(category.label)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="expirationDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('expiration_date')}</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="vendorId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('vendor')}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('select_vendor')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {vendors.map((vendor) => (
                                    <SelectItem key={vendor.id} value={vendor.id}>
                                      {vendor.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="pricePerUnit"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('price_per_unit')}</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder={t('enter_price_per_unit')} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('notes')}</FormLabel>
                              <FormControl>
                                <Textarea placeholder={t('add_any_additional_notes')} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-4 pt-4">
                          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                            {t('cancel')}
                          </Button>
                          <Button type="submit">{t('register_supply')}</Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
            </div>
          </div>

          {/* Bottom nav strip */}
          <div className="relative z-10 border-t border-white/20 grid grid-cols-3 divide-x divide-white/20">
            {[
              { label: 'Kitchen Link', icon: Building2, value: 'Kitchens' },
              { label: 'Track', icon: BarChart3, value: 'Analytics' },
              { label: 'AI-Powered', icon: Brain, value: 'Insights' },
            ].map(({ label, icon: Icon, value }) => (
              <div key={label} className="px-5 py-3 flex items-center gap-3">
                <Icon className="h-4 w-4 text-amber-200" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-amber-200/70 font-semibold">{label}</p>
                  <p className="text-sm font-semibold text-white">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════
            Category Filter Pills (replaces old Quick Actions card)
        ══════════════════════════════════════ */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Browse by Category</p>
            {(selectedCategory !== 'all' || searchTerm) && (
              <button
                onClick={() => { setSelectedCategory('all'); setSearchTerm(''); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {/* "All" pill */}
            <button
              onClick={() => setSelectedCategory('all')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 ${
                selectedCategory === 'all'
                  ? 'bg-foreground text-background shadow-sm'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              All
              {stats?.totalSupplies ? (
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold ${selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-muted-foreground/20'}`}>
                  {stats.totalSupplies}
                </span>
              ) : null}
            </button>

            {/* Category pills with dialog */}
            {categories.map((cat) => {
              const count = stats?.categoryStats?.find(s => s.category === cat.value)?._count;
              const isActive = selectedCategory === cat.value;
              return (
                <CategoryDetailsDialog
                  key={cat.value}
                  category={cat.value}
                  categoryLabel={cat.label}
                  trigger={
                    <button
                      onClick={() => setSelectedCategory(cat.value)}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 border ${
                        isActive
                          ? 'bg-foreground text-background border-transparent shadow-sm'
                          : `${cat.color} border-current/20 hover:shadow-sm`
                      }`}
                    >
                      <span className="text-base leading-none">{cat.icon}</span>
                      {cat.label}
                      {count !== undefined && (
                        <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-current/10'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  }
                />
              );
            })}
          </div>
        </div>
        
        {/* ══════════════════════════════════════
            Premium Stat Cards
        ══════════════════════════════════════ */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: t('total_supplies'), value: stats?.totalSupplies ?? 0, sub: t('active_inventory_items'),
              icon: Package, gradient: 'from-blue-500 to-indigo-600', bar: 75,
            },
            {
              label: t('expiring_soon'), value: stats?.expiringSupplies ?? 0, sub: t('items_expiring_within_30_days'),
              icon: AlertTriangle, gradient: 'from-amber-500 to-orange-600',
              bar: Math.min(((stats?.expiringSupplies ?? 0) / Math.max(stats?.totalSupplies ?? 1, 1)) * 100, 100),
            },
            {
              label: t('recent_activity'), value: stats?.recentSupplies?.length ?? 0, sub: t('new_items_this_week'),
              icon: History, gradient: 'from-emerald-500 to-teal-600', bar: 60,
            },
            {
              label: t('total_consumed_value'), value: `QAR ${(stats?.totalConsumed ?? 0).toFixed(0)}`, sub: t('total_value_of_consumed_items'),
              icon: UtensilsCrossed, gradient: 'from-purple-500 to-pink-600', bar: 85,
            },
          ].map(({ label, value, sub, icon: Icon, gradient, bar }) => (
            <div key={label} className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${gradient} text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5`}>
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
              <div className="relative z-10 p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-sm font-semibold text-white/90">{label}</p>
                  <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-4xl font-bold text-white mb-1 tabular-nums">{value}</p>
                <p className="text-xs text-white/70">{sub}</p>
                <div className="mt-4 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white/60 rounded-full" style={{ width: `${bar}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Food Supply Notifications Panel */}
        <div className="mb-6">
          <FoodSupplyNotifications />
        </div>

        <CardTabs defaultValue="inventory" className="space-y-5">
          <CardTabs.List className="bg-muted/50 p-1 rounded-xl gap-1">
            <CardTabs.Trigger value="inventory" icon={<Package className="h-4 w-4" />}>
              {t('inventory')}
            </CardTabs.Trigger>
            <CardTabs.Trigger value="multi-location" icon={<MapPin className="h-4 w-4" />}>
              Multi-Location
            </CardTabs.Trigger>
            <CardTabs.Trigger value="kitchens" icon={<Utensils className="h-4 w-4" />}>
              {t('kitchens')}
            </CardTabs.Trigger>
            <CardTabs.Trigger value="recipes" icon={<ChefHat className="h-4 w-4" />}>
              {t('recipes')}
            </CardTabs.Trigger>
            <CardTabs.Trigger value="kitchen-consumption-analysis" icon={<BarChart3 className="h-4 w-4" />}>
              Analytics
            </CardTabs.Trigger>
          </CardTabs.List>

          <CardTabs.Content value="inventory" className="space-y-6">
            {/* Category Distribution */}
            <Card className="border-0 ring-1 ring-border/60 shadow-sm">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                    <BarChart3 className="h-3.5 w-3.5 text-white" />
                  </div>
                  {t('category_distribution')}
                </CardTitle>
                <CardDescription className="text-xs">{t('overview_of_supplies_by_category')} — click any tile for details</CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {stats?.categoryStats.map((stat, index) => {
                    const category = categories.find(c => c.value === stat.category);
                    const gradients = [
                      'from-blue-500 to-cyan-500', 'from-red-500 to-pink-500',
                      'from-green-500 to-emerald-500', 'from-orange-500 to-yellow-500',
                      'from-amber-500 to-orange-500', 'from-purple-500 to-violet-500',
                      'from-cyan-500 to-blue-500', 'from-pink-500 to-rose-500',
                      'from-indigo-500 to-purple-500',
                    ];
                    const pct = Math.min((stat._count / (stats?.totalSupplies || 1)) * 100, 100);

                    return (
                      <CategoryDetailsDialog
                        key={stat.category}
                        category={stat.category}
                        categoryLabel={category?.label || stat.category}
                        trigger={
                          <div className={`relative overflow-hidden bg-gradient-to-br ${gradients[index % gradients.length]} text-white rounded-2xl p-4 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group`}>
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />
                            <div className="relative z-10">
                              <span className="text-2xl leading-none block mb-2">{category?.icon || '📦'}</span>
                              <p className="text-xs font-semibold capitalize text-white/90 mb-1">{category?.label || stat.category}</p>
                              <p className="text-2xl font-bold">{stat._count}</p>
                              <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                <div className="h-full bg-white/70 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <p className="mt-1 text-[10px] text-white/60">{pct.toFixed(1)}%</p>
                            </div>
                          </div>
                        }
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Food Supply List */}
            <Card className="border-0 ring-1 ring-border/60 shadow-sm">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-base">{t('food_supply_list')}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {filteredSupplies.length} {filteredSupplies.length === 1 ? 'item' : 'items'}
                      {(searchTerm || selectedCategory !== 'all') && ' (filtered)'}
                    </p>
                  </div>
                  <Dialog onOpenChange={(open) => {
                    if (open) loadConsumptionHistory();
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 rounded-lg">
                        <FileText className="h-4 w-4" />
                        {t('full_consumption_report')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-5xl w-[90vw]">
                      <DialogHeader className="sticky top-0 bg-background z-10 pb-4">
                        <DialogTitle>{t('full_consumption_report')}</DialogTitle>
                      </DialogHeader>
                      {isLoadingHistory ? (
                        <div className="flex items-center justify-center p-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      ) : (
                        <div className="overflow-y-auto">
                          <AssetReport
                            consumptionHistory={consumptionHistory}
                            isFullReport={true}
                          />
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('search_supplies')}
                      className="pl-9 rounded-xl h-9 border-border/60 focus-visible:ring-orange-400/40"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full sm:w-[160px] h-9 rounded-xl border-border/60">
                      <SelectValue placeholder={t('select_category')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all_categories')}</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.icon} {t(category.label) || category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {isLoading ? (
                  /* Premium skeleton */
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-muted" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-4 bg-muted rounded w-32" />
                            <div className="h-3 bg-muted rounded w-20" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[...Array(4)].map((__, j) => <div key={j} className="h-14 bg-muted rounded-xl" />)}
                        </div>
                        <div className="flex gap-2">
                          <div className="h-8 bg-muted rounded-lg flex-1" />
                          <div className="h-8 bg-muted rounded-lg flex-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredSupplies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-border">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold mb-1">{t('no_food_supplies_found')}</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-xs mb-4">
                      {searchTerm || selectedCategory !== 'all'
                        ? 'Try adjusting your search or category filter.'
                        : 'Register your first food supply item to get started.'}
                    </p>
                    {!searchTerm && selectedCategory === 'all' && (
                      <Button onClick={() => setOpen(true)} className="gap-2">
                        <PlusCircle className="h-4 w-4" /> {t('register_new_supply')}
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Mobile view */}
                    <div className="md:hidden grid gap-4">
                      {filteredSupplies.map((supply) => (
                        <FoodSupplyMobileCard
                          key={supply.id}
                          supply={supply}
                          categories={categories}
                          onUpdate={loadFoodSupplies}
                        />
                      ))}
                    </div>

                    {/* ── Premium Desktop Grid ── */}
                    <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredSupplies.map((supply) => {
                        const category = categories.find(c => c.value === supply.category);
                        const expirationDate = new Date(supply.expirationDate);
                        const daysUntilExpiration = Math.ceil((expirationDate.getTime() - Date.now()) / 86400000);
                        const isCritical = daysUntilExpiration <= 7;
                        const isWarning = daysUntilExpiration <= 30 && !isCritical;
                        const isGood = !isCritical && !isWarning;

                        return (
                          <div
                            key={supply.id}
                            className={`group relative rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
                              isCritical
                                ? 'border-red-200 dark:border-red-800/40'
                                : isWarning
                                  ? 'border-amber-200 dark:border-amber-800/40'
                                  : 'border-border hover:border-orange-200 dark:hover:border-orange-800/40'
                            } bg-card`}
                          >
                            {/* Top accent bar */}
                            <div className={`h-1 w-full ${
                              isCritical ? 'bg-gradient-to-r from-red-500 to-rose-500'
                              : isWarning ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                              : 'bg-gradient-to-r from-orange-400 to-amber-400 opacity-0 group-hover:opacity-100 transition-opacity'
                            }`} />

                            <div className="p-4">
                              {/* Header row */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                                    <span className="text-lg leading-none">{category?.icon || '📦'}</span>
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="font-bold text-sm leading-tight truncate">{supply.name}</h3>
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${category?.color || 'bg-muted text-muted-foreground'}`}>
                                        {category?.label || supply.category}
                                      </span>
                                      {isCritical && (
                                        <span className="text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                                          Critical
                                        </span>
                                      )}
                                      {isWarning && (
                                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                                          Expiring
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex-shrink-0 ml-2">
                                  {isCritical ? (
                                    <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                    </div>
                                  ) : isWarning ? (
                                    <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                      <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                    </div>
                                  ) : (
                                    <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Metric grid */}
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-2.5">
                                  <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Unit Price</p>
                                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">QAR {supply.pricePerUnit}</p>
                                </div>
                                <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-2.5">
                                  <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Quantity</p>
                                  <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{supply.quantity} {supply.unit}</p>
                                </div>
                                <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 p-2.5">
                                  <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Total Value</p>
                                  <p className="text-sm font-bold text-purple-700 dark:text-purple-300">QAR {(supply.quantity * supply.pricePerUnit).toFixed(0)}</p>
                                </div>
                                <div className={`rounded-xl p-2.5 ${
                                  isCritical ? 'bg-red-50 dark:bg-red-900/20'
                                  : isWarning ? 'bg-amber-50 dark:bg-amber-900/20'
                                  : 'bg-green-50 dark:bg-green-900/20'
                                }`}>
                                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${
                                    isCritical ? 'text-red-600 dark:text-red-400'
                                    : isWarning ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-green-600 dark:text-green-400'
                                  }`}>Expires in</p>
                                  <p className={`text-sm font-bold ${
                                    isCritical ? 'text-red-700 dark:text-red-300'
                                    : isWarning ? 'text-amber-700 dark:text-amber-300'
                                    : 'text-green-700 dark:text-green-300'
                                  }`}>{daysUntilExpiration < 0 ? 'Expired' : `${daysUntilExpiration}d`}</p>
                                </div>
                              </div>

                              {/* Vendor + kitchen tags */}
                              {(supply.vendor || (supply.kitchenSupplies?.length > 0)) && (
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                  {supply.vendor && (
                                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                                      {supply.vendor.name}
                                    </span>
                                  )}
                                  {supply.kitchenSupplies?.map((ks: any) => (
                                    <span key={ks.id} className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                                      {ks.kitchen?.name}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex gap-2 pt-1 border-t border-border/50">
                                <ConsumptionHistoryDialog foodSupplyId={supply.id} foodSupplyName={supply.name} />
                                <EditFoodSupplyDialog
                                  foodSupplyId={supply.id}
                                  currentPrice={supply.pricePerUnit}
                                  onUpdate={loadFoodSupplies}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </CardTabs.Content>

          <CardTabs.Content value="multi-location">
            <MultiLocationInventoryTab />
          </CardTabs.Content>

          <CardTabs.Content value="kitchens">
            <Card>
              <CardHeader>
                <CardTitle>{t('kitchen_management')}</CardTitle>
                <CardDescription>{t('manage_kitchen_locations_and_consumption')}</CardDescription>
              </CardHeader>
              <CardContent>
                <KitchenManagement />
              </CardContent>
            </Card>
          </CardTabs.Content>


          <CardTabs.Content value="recipes">
            <RecipesTabRebuilt />
          </CardTabs.Content>
          <CardTabs.Content value="kitchen-consumption-analysis">
            <KitchenConsumptionAnalysisTab />
          </CardTabs.Content>
        </CardTabs>
      </div>
    </DashboardLayout>
    </>
  );
}