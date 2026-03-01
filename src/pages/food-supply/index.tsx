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
import { PlusCircle, UtensilsCrossed, Package, AlertTriangle, History, Search, Barcode, Utensils, Printer, FileText, ChefHat, BarChart3, LineChart, Trash2, Brain, MapPin } from "lucide-react";
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
        {/* Enhanced Header Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-purple-900/20 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
          <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent dark:from-white/5"></div>
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <UtensilsCrossed className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                      {t('food_supply_management')}
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1 text-lg">{t('manage_and_track_food_inventory')}</p>
                  </div>
                </div>
                
                {/* Quick Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Total Items</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{stats?.totalSupplies || 0}</p>
                  </div>
                  <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Categories</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{stats?.categoryStats?.length || 0}</p>
                  </div>
                  <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Expiring Soon</p>
                    <p className="text-xl font-bold text-amber-600">{stats?.expiringSupplies || 0}</p>
                  </div>
                  <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Total Value</p>
                    <p className="text-xl font-bold text-emerald-600">QAR {(stats?.totalConsumed || 0).toFixed(0)}</p>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
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
                    <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 shadow-lg">
                      <PlusCircle className="mr-2 h-4 w-4" />
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
          </div>
        </div>

        {/* Enhanced Quick Actions Section */}
        <Card className="bg-gradient-to-r from-emerald-50 via-blue-50 to-purple-50 dark:from-emerald-900/20 dark:via-blue-900/20 dark:to-purple-900/20 border-emerald-200 dark:border-emerald-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
                <Package className="h-3 w-3 text-white" />
              </div>
              Quick Actions
            </CardTitle>
            <CardDescription>Frequently used operations for efficient inventory management</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {/* Category Quick Actions with Dialogs */}
              <CategoryDetailsDialog 
                category="dairy" 
                categoryLabel="Dairy"
                trigger={
                  <Button 
                    variant="outline" 
                    className="h-auto flex-col gap-2 p-4 bg-white/60 hover:bg-white/80 border-blue-200 hover:border-blue-300 hover:bg-blue-50"
                    onClick={() => setSelectedCategory("dairy")}
                  >
                    <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-lg">
                      🥛
                    </div>
                    <span className="text-xs font-medium">View Dairy</span>
                  </Button>
                }
              />
              
              <CategoryDetailsDialog 
                category="meat" 
                categoryLabel="Meat"
                trigger={
                  <Button 
                    variant="outline" 
                    className="h-auto flex-col gap-2 p-4 bg-white/60 hover:bg-white/80 border-red-200 hover:border-red-300 hover:bg-red-50"
                    onClick={() => setSelectedCategory("meat")}
                  >
                    <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center text-lg">
                      🥩
                    </div>
                    <span className="text-xs font-medium">View Meat</span>
                  </Button>
                }
              />
              
              <CategoryDetailsDialog 
                category="vegetables" 
                categoryLabel="Vegetables"
                trigger={
                  <Button 
                    variant="outline" 
                    className="h-auto flex-col gap-2 p-4 bg-white/60 hover:bg-white/80 border-green-200 hover:border-green-300 hover:bg-green-50"
                    onClick={() => setSelectedCategory("vegetables")}
                  >
                    <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center text-lg">
                      🥬
                    </div>
                    <span className="text-xs font-medium">View Vegetables</span>
                  </Button>
                }
              />

              <CategoryDetailsDialog 
                category="fruits" 
                categoryLabel="Fruits"
                trigger={
                  <Button 
                    variant="outline" 
                    className="h-auto flex-col gap-2 p-4 bg-white/60 hover:bg-white/80 border-orange-200 hover:border-orange-300 hover:bg-orange-50"
                    onClick={() => setSelectedCategory("fruits")}
                  >
                    <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center text-lg">
                      🍎
                    </div>
                    <span className="text-xs font-medium">View Fruits</span>
                  </Button>
                }
              />

              <CategoryDetailsDialog 
                category="grains" 
                categoryLabel="Grains"
                trigger={
                  <Button 
                    variant="outline" 
                    className="h-auto flex-col gap-2 p-4 bg-white/60 hover:bg-white/80 border-amber-200 hover:border-amber-300 hover:bg-amber-50"
                    onClick={() => setSelectedCategory("grains")}
                  >
                    <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center text-lg">
                      🌾
                    </div>
                    <span className="text-xs font-medium">View Grains</span>
                  </Button>
                }
              />

              <CategoryDetailsDialog 
                category="seafood" 
                categoryLabel="Seafood"
                trigger={
                  <Button 
                    variant="outline" 
                    className="h-auto flex-col gap-2 p-4 bg-white/60 hover:bg-white/80 border-cyan-200 hover:border-cyan-300 hover:bg-cyan-50"
                    onClick={() => setSelectedCategory("seafood")}
                  >
                    <div className="h-8 w-8 rounded-lg bg-cyan-100 flex items-center justify-center text-lg">
                      🐟
                    </div>
                    <span className="text-xs font-medium">View Seafood</span>
                  </Button>
                }
              />
              
              <Button 
                variant="outline" 
                className="h-auto flex-col gap-2 p-4 bg-white/60 hover:bg-white/80 border-purple-200 hover:border-purple-300 hover:bg-purple-50"
                onClick={() => {
                  setSelectedCategory("all");
                  setSearchTerm("");
                }}
              >
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Search className="h-4 w-4 text-purple-600" />
                </div>
                <span className="text-xs font-medium">Clear Filters</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto flex-col gap-2 p-4 bg-white/60 hover:bg-white/80 border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50"
                onClick={() => setOpen(true)}
              >
                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <PlusCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="text-xs font-medium">Add Supply</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Navigation between Kitchen and Food Supply */}
        <div className="mb-6">
          <KitchenFoodSupplyNavigation currentPage="foodSupply" />
        </div>
        
        {/* Enhanced Dashboard Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 border-0 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-white/90">{t('total_supplies')}</CardTitle>
              <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Package className="h-6 w-6 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-4xl font-bold text-white mb-2">{stats?.totalSupplies || 0}</div>
              <p className="text-sm text-white/80">{t('active_inventory_items')}</p>
              <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/60 rounded-full animate-pulse" style={{ width: '75%' }}></div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 border-0 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-white/90">{t('expiring_soon')}</CardTitle>
              <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-white animate-pulse" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-4xl font-bold text-white mb-2">{stats?.expiringSupplies || 0}</div>
              <p className="text-sm text-white/80">{t('items_expiring_within_30_days')}</p>
              <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/60 rounded-full animate-pulse" style={{ width: `${Math.min(((stats?.expiringSupplies || 0) / (stats?.totalSupplies || 1)) * 100, 100)}%` }}></div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 border-0 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-white/90">{t('recent_activity')}</CardTitle>
              <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <History className="h-6 w-6 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-4xl font-bold text-white mb-2">{stats?.recentSupplies?.length || 0}</div>
              <p className="text-sm text-white/80">{t('new_items_this_week')}</p>
              <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/60 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 border-0 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-white/90">{t('total_consumed_value')}</CardTitle>
              <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <UtensilsCrossed className="h-6 w-6 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-4xl font-bold text-white mb-2">
                QAR {(stats?.totalConsumed || 0).toFixed(2)}
              </div>
              <p className="text-sm text-white/80">{t('total_value_of_consumed_items')}</p>
              <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/60 rounded-full animate-pulse" style={{ width: '85%' }}></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Food Supply Notifications Panel */}
        <div className="mb-6">
          <FoodSupplyNotifications />
        </div>

        <CardTabs defaultValue="inventory" className="space-y-4">
          <CardTabs.List>
            <CardTabs.Trigger value="inventory" icon={<Package className="h-4 w-4" />}>
              {t('inventory')}
            </CardTabs.Trigger>
            <CardTabs.Trigger value="multi-location" icon={<MapPin className="h-4 w-4" />}>
              Multi-Location Inventory
            </CardTabs.Trigger>
            <CardTabs.Trigger value="kitchens" icon={<Utensils className="h-4 w-4" />}>
              {t('kitchens')}
            </CardTabs.Trigger>
            <CardTabs.Trigger value="recipes" icon={<ChefHat className="h-4 w-4" />}>
              {t('recipes')}
            </CardTabs.Trigger>
            <CardTabs.Trigger value="kitchen-consumption-analysis" icon={<BarChart3 className="h-4 w-4" />}>
              {t('kitchen_consumption_analysis') || "Kitchen Consumption Analysis"}
            </CardTabs.Trigger>
          </CardTabs.List>

          <CardTabs.Content value="inventory" className="space-y-6">
            {/* Enhanced Category Distribution */}
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-white" />
                  </div>
                  {t('category_distribution')}
                </CardTitle>
                <CardDescription>{t('overview_of_supplies_by_category')} - Click on any category to view detailed breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {stats?.categoryStats.map((stat, index) => {
                    const category = categories.find(c => c.value === stat.category);
                    const gradients = [
                      'from-blue-500 to-cyan-500',
                      'from-red-500 to-pink-500', 
                      'from-green-500 to-emerald-500',
                      'from-orange-500 to-yellow-500',
                      'from-amber-500 to-orange-500',
                      'from-purple-500 to-violet-500',
                      'from-cyan-500 to-blue-500',
                      'from-pink-500 to-rose-500',
                      'from-indigo-500 to-purple-500'
                    ];
                    
                    return (
                      <CategoryDetailsDialog 
                        key={stat.category}
                        category={stat.category} 
                        categoryLabel={category?.label || stat.category}
                        trigger={
                          <div className={`relative overflow-hidden bg-gradient-to-br ${gradients[index % gradients.length]} text-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer group`}>
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent group-hover:from-white/20"></div>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <div className="h-6 w-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <Search className="h-3 w-3 text-white" />
                              </div>
                            </div>
                            <div className="relative z-10">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">{category?.icon || '📦'}</span>
                                <span className="text-sm font-semibold capitalize opacity-90">{t(stat.category) || stat.category}</span>
                              </div>
                              <div className="flex items-end justify-between mt-2">
                                <span className="text-3xl font-bold">{stat._count}</span>
                                <div className="text-xs opacity-75">
                                  {((stat._count / (stats?.totalSupplies || 1)) * 100).toFixed(1)}%
                                </div>
                              </div>
                              <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-white/60 rounded-full transition-all duration-1000 ease-out" 
                                  style={{ width: `${Math.min((stat._count / (stats?.totalSupplies || 1)) * 100, 100)}%` }}
                                ></div>
                              </div>
                              <div className="mt-2 text-xs opacity-75 group-hover:opacity-100 transition-opacity">
                                Click to view details
                              </div>
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
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>{t('food_supply_list')}</CardTitle>
                  <Dialog onOpenChange={(open) => {
                    if (open) loadConsumptionHistory();
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <FileText className="h-4 w-4 mr-2" />
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
                <div className="flex flex-col md:flex-row gap-4 mt-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t('search_supplies')}
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={t('select_category')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all_categories')}</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {t(category.label) || category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : filteredSupplies.length === 0 ? (
                  <div className="text-center py-6">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{t('no_food_supplies_found')}</p>
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
                    
                    {/* Enhanced Desktop view */}
                    <div className="hidden md:grid gap-6">
                      {filteredSupplies.map((supply) => {
                        const category = categories.find(c => c.value === supply.category);
                        const expirationDate = new Date(supply.expirationDate);
                        const daysUntilExpiration = Math.ceil((expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        const expirationStatus = 
                          daysUntilExpiration <= 7 ? 'from-red-500 to-red-600' :
                          daysUntilExpiration <= 30 ? 'from-amber-500 to-orange-500' :
                          'from-green-500 to-emerald-500';

                        return (
                          <Card
                            key={supply.id}
                            className="relative overflow-hidden bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full -translate-y-16 translate-x-16"></div>
                            
                            <CardHeader className="relative z-10">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                      <Package className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                      <CardTitle className="text-xl font-bold">{supply.name}</CardTitle>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge className={`text-xs px-2 py-1 ${category?.color || 'bg-gray-100'}`}>
                                          {category?.label || supply.category}
                                        </Badge>
                                        <Badge className={`text-xs px-2 py-1 bg-gradient-to-r ${expirationStatus} text-white`}>
                                          {daysUntilExpiration <= 7 ? '⚠️ Critical' : 
                                           daysUntilExpiration <= 30 ? '⏰ Soon' : '✅ Good'}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex gap-2">
                                  <ConsumptionHistoryDialog foodSupplyId={supply.id} foodSupplyName={supply.name} />
                                  <EditFoodSupplyDialog
                                    foodSupplyId={supply.id}
                                    currentPrice={supply.pricePerUnit}
                                    onUpdate={loadFoodSupplies}
                                  />
                                </div>
                              </div>
                            </CardHeader>
                            
                            <CardContent className="relative z-10">
                              {/* Key Metrics Row */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Price per Unit</p>
                                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">QAR {supply.pricePerUnit}</p>
                                </div>
                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Quantity</p>
                                  <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{supply.quantity} {supply.unit}</p>
                                </div>
                                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Total Value</p>
                                  <p className="text-lg font-bold text-purple-700 dark:text-purple-300">QAR {(supply.quantity * supply.pricePerUnit).toFixed(2)}</p>
                                </div>
                                <div className={`bg-gradient-to-br p-3 rounded-lg border ${
                                  daysUntilExpiration <= 7 ? 'from-red-50 to-red-100 border-red-200 dark:from-red-900/20 dark:to-red-800/20 dark:border-red-800' :
                                  daysUntilExpiration <= 30 ? 'from-amber-50 to-amber-100 border-amber-200 dark:from-amber-900/20 dark:to-amber-800/20 dark:border-amber-800' :
                                  'from-green-50 to-green-100 border-green-200 dark:from-green-900/20 dark:to-green-800/20 dark:border-green-800'
                                }`}>
                                  <p className={`text-xs font-medium ${
                                    daysUntilExpiration <= 7 ? 'text-red-600 dark:text-red-400' :
                                    daysUntilExpiration <= 30 ? 'text-amber-600 dark:text-amber-400' :
                                    'text-green-600 dark:text-green-400'
                                  }`}>Expires in</p>
                                  <p className={`text-lg font-bold ${
                                    daysUntilExpiration <= 7 ? 'text-red-700 dark:text-red-300' :
                                    daysUntilExpiration <= 30 ? 'text-amber-700 dark:text-amber-300' :
                                    'text-green-700 dark:text-green-300'
                                  }`}>{daysUntilExpiration} days</p>
                                </div>
                              </div>

                              {/* Additional Info */}
                              <div className="space-y-3">
                                {supply.vendor && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-300">
                                      Vendor: {supply.vendor.name}
                                    </Badge>
                                  </div>
                                )}

                                {supply.kitchenSupplies && supply.kitchenSupplies.length > 0 && (
                                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                    <p className="text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Available in Kitchens:</p>
                                    <div className="flex flex-wrap gap-2">
                                      {supply.kitchenSupplies.map((ks: any) => (
                                        <div key={ks.id} className="bg-white dark:bg-slate-700 rounded-md p-2 border border-slate-200 dark:border-slate-600 text-xs">
                                          <span className="font-medium text-slate-700 dark:text-slate-300">{ks.kitchen?.name || t('unknown_kitchen')}</span>
                                          <div className="flex items-center gap-2 mt-1">
                                            <span className="text-blue-600 dark:text-blue-400">{ks.quantity} {supply.unit}</span>
                                            <span className="text-amber-600 dark:text-amber-400">Exp: {new Date(ks.expirationDate).toLocaleDateString()}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {supply.notes && (
                                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                      <span className="font-medium">Notes:</span> {supply.notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
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