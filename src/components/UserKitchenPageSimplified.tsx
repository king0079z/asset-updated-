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
  Plus
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
  
  // Use the button visibility hook
  const buttonPermissions = useButtonVisibility();

  // Cache for storing fetched data by kitchen ID
  const [dataCache, setDataCache] = useState<{
    [kitchenId: string]: {
      foodSupplies?: FoodSupply[];
      recipes?: any[];
      timestamp: number;
    }
  }>({});
  
  // Cache expiration time in milliseconds (5 minutes)
  const CACHE_EXPIRATION = 5 * 60 * 1000;

  const fetchAssignments = async () => {
    try {
      const data = await getKitchenAssignments();
      if (data && data.length > 0) {
        setAssignments(data);
        
        // Set the first kitchen as selected by default
        if (!selectedKitchen) {
          setSelectedKitchen(data[0].kitchen);
        }
      }
    } catch (error) {
      console.error('Error fetching kitchen assignments:', error);
      toast({
        title: t('error'),
        description: t('failed_to_fetch_kitchen_assignments'),
        variant: 'destructive',
      });
    }
  };
  
  const fetchFoodSupplies = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      if (!selectedKitchen) {
        setFoodSupplies([]);
        setExpiringItems([]);
        setLowStockItems([]);
        setIsLoading(false);
        return;
      }
      
      // Check if we have cached data that's not expired
      const cachedData = dataCache[selectedKitchen.id];
      const now = new Date().getTime();
      
      if (!forceRefresh && cachedData && cachedData.foodSupplies && 
          (now - cachedData.timestamp < CACHE_EXPIRATION)) {
        setFoodSupplies(cachedData.foodSupplies);
        setExpiringItems(getExpiringItems(cachedData.foodSupplies, 7));
        setLowStockItems(getLowStockItems(cachedData.foodSupplies, 0.2));
        setIsLoading(false);
        return;
      }
      
      // If no valid cache, fetch from API using our service
      const data = await getFoodSupplies(selectedKitchen.id, forceRefresh);
      
      if (data && data.length > 0) {
        // Process the data to use kitchen-specific quantities and expiration dates
        const processedData = data.map((item: FoodSupply) => {
          // If there are kitchen-specific supplies for this item
          if (item.kitchenSupplies && item.kitchenSupplies.length > 0) {
            // Use the kitchen-specific quantity and expiration date
            const kitchenSupply = item.kitchenSupplies[0]; // There should only be one for the selected kitchen
            return {
              ...item,
              quantity: kitchenSupply.quantity,
              expirationDate: kitchenSupply.expirationDate,
            };
          }
          return item;
        });
        
        // Make sure we only include items that are actually linked to this kitchen
        const filteredData = processedData.filter((item: FoodSupply) => 
          item.kitchenId === selectedKitchen.id || 
          (item.kitchenSupplies && item.kitchenSupplies.some(ks => ks.kitchenId === selectedKitchen.id))
        );
        
        setFoodSupplies(filteredData);
        
        // Update cache
        setDataCache(prev => ({
          ...prev,
          [selectedKitchen.id]: {
            ...prev[selectedKitchen.id],
            foodSupplies: filteredData,
            timestamp: now
          }
        }));
        
        // Use utility functions from our service
        setExpiringItems(getExpiringItems(filteredData, 7));
        setLowStockItems(getLowStockItems(filteredData, 0.2));
      } else {
        // If no data or empty array, reset states
        setFoodSupplies([]);
        setExpiringItems([]);
        setLowStockItems([]);
        
        // Update cache with empty array
        setDataCache(prev => ({
          ...prev,
          [selectedKitchen.id]: {
            ...prev[selectedKitchen.id],
            foodSupplies: [],
            timestamp: now
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching food supplies:', error);
      toast({
        title: t('error'),
        description: t('failed_to_fetch_food_supplies'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add a function to fetch recipes using our service
  const fetchRecipes = async (forceRefresh = false) => {
    if (!selectedKitchen) return;
    
    try {
      // Check if we have cached data that's not expired
      const cachedData = dataCache[selectedKitchen.id];
      const now = new Date().getTime();
      
      if (!forceRefresh && cachedData && cachedData.recipes && 
          (now - cachedData.timestamp < CACHE_EXPIRATION)) {
        setRecipes(cachedData.recipes);
        return;
      }
      
      // Use fetchWithCache from our service
      const data = await fetchWithCache(
        `/api/recipes?kitchenId=${selectedKitchen.id}`,
        {},
        forceRefresh
      );
      
      if (data) {
        setRecipes(data);
        
        // Update cache
        setDataCache(prev => ({
          ...prev,
          [selectedKitchen.id]: {
            ...prev[selectedKitchen.id],
            recipes: data,
            timestamp: now
          }
        }));
      } else {
        setRecipes([]);
        
        // Update cache with empty array
        setDataCache(prev => ({
          ...prev,
          [selectedKitchen.id]: {
            ...prev[selectedKitchen.id],
            recipes: [],
            timestamp: now
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching recipes:', error);
      toast({
        title: t('error'),
        description: t('failed_to_fetch_recipes'),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  useEffect(() => {
    if (selectedKitchen) {
      fetchFoodSupplies();
      fetchRecipes();
    }
  }, [selectedKitchen]);

  const handleKitchenSelect = (kitchen: Kitchen) => {
    setIsLoading(true);
    
    // Check if we have cached data for this kitchen
    const cachedData = dataCache[kitchen.id];
    const now = new Date().getTime();
    
    if (cachedData && (now - cachedData.timestamp < CACHE_EXPIRATION)) {
      // Use cached data if available
      if (cachedData.foodSupplies) {
        setFoodSupplies(cachedData.foodSupplies);
        
        // Use utility functions from our service
        setExpiringItems(getExpiringItems(cachedData.foodSupplies, 7));
        setLowStockItems(getLowStockItems(cachedData.foodSupplies, 0.2));
        
        setIsLoading(false);
      }
      
      if (cachedData.recipes) {
        setRecipes(cachedData.recipes);
      }
    } else {
      // Reset data if no cache is available
      setFoodSupplies([]);
      setExpiringItems([]);
      setLowStockItems([]);
      setRecipes([]);
    }
    
    // Set the selected kitchen
    setSelectedKitchen(kitchen);
  };

  // Filter food supplies based on search query
  const filteredFoodSupplies = searchQuery 
    ? foodSupplies.filter(supply => 
        supply.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supply.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : foodSupplies;

  return (
    <div className="space-y-4">
      {assignments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-muted p-3 mb-4">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t('no_kitchens_assigned')}</h3>
            <p className="text-muted-foreground text-center max-w-md">
              {t('contact_admin_for_kitchen_assignment')}
            </p>
            <Button className="mt-4">
              {t('contact_administrator')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Kitchen Selection - Simplified */}
          <div className="md:col-span-3 lg:col-span-2">
            <Card className="shadow-sm h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center">
                  <Building2 className="h-4 w-4 mr-2 text-primary" />
                  {t('kitchens')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-2">
                <div className="space-y-1">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className={`p-2 rounded-md cursor-pointer transition-all text-sm ${
                        selectedKitchen?.id === assignment.kitchen.id
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'hover:bg-accent hover:text-accent-foreground'
                      }`}
                      onClick={() => handleKitchenSelect(assignment.kitchen)}
                    >
                      <div className="flex items-center">
                        <Building2 className="h-4 w-4 mr-2" />
                        <div>
                          <p className="font-medium">{assignment.kitchen.name}</p>
                          <p className="text-xs opacity-80">Floor {assignment.kitchen.floorNumber}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Compact Stats */}
                {selectedKitchen && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <h3 className="text-xs font-medium mb-2 text-muted-foreground">{t('quick_stats')}</h3>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-1">
                        <p className="text-xs text-blue-700 dark:text-blue-400">{t('inventory')}</p>
                        <p className="font-bold text-sm">{foodSupplies.length}</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded p-1">
                        <p className="text-xs text-red-700 dark:text-red-400">{t('expiring')}</p>
                        <p className="font-bold text-sm">{expiringItems.length}</p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded p-1">
                        <p className="text-xs text-amber-700 dark:text-amber-400">{t('low')}</p>
                        <p className="font-bold text-sm">{lowStockItems.length}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area - Simplified */}
          <div className="md:col-span-9 lg:col-span-10">
            {selectedKitchen ? (
              <div className="space-y-4">
                {/* Kitchen Header - Simplified */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-border">
                  <div>
                    <div className="flex items-center">
                      <h2 className="text-xl font-bold mr-2">{selectedKitchen.name}</h2>
                      <Badge variant="outline" className="bg-primary/10 text-primary">
                        Floor {selectedKitchen.floorNumber}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedKitchen.description || t('no_description_available')}
                    </p>
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

                {/* Kitchen Financial Metrics */}
                <KitchenFinancialMetrics 
                  kitchenId={selectedKitchen.id}
                  kitchenName={selectedKitchen.name}
                />

                {/* Kitchen-specific notifications */}
                <FoodSupplyNotifications kitchenId={selectedKitchen.id} />
                
                {/* Kitchen Dashboard Navigation - Simplified */}
                <CardTabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <CardTabs.List className="w-full flex gap-4 mb-2">
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
                  </CardTabs.List>
                
                  {/* Overview Tab Content */}
                  <CardTabs.Content value="overview" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Key Stats Cards - Simplified */}
                      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-100 dark:border-green-900/30">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium text-green-700 dark:text-green-400">{t('total_inventory')}</p>
                              <h3 className="text-2xl font-bold">{foodSupplies.length}</h3>
                              <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">{t('items_in_stock')}</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                              <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="mt-3 text-green-700 dark:text-green-400 p-0 h-auto"
                            onClick={() => setActiveTab("inventory")}
                          >
                            {t('view_inventory')} →
                          </Button>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 border-red-100 dark:border-red-900/30">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium text-red-700 dark:text-red-400">{t('expiring_soon')}</p>
                              <h3 className="text-2xl font-bold">{expiringItems.length}</h3>
                              <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">{t('items_expiring_within_7_days')}</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="mt-3 text-red-700 dark:text-red-400 p-0 h-auto"
                            onClick={() => setActiveTab("inventory")}
                          >
                            {t('view_expiring')} →
                          </Button>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-100 dark:border-amber-900/30">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{t('low_stock')}</p>
                              <h3 className="text-2xl font-bold">{lowStockItems.length}</h3>
                              <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">{t('items_running_low')}</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                              <Package className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="mt-3 text-amber-700 dark:text-amber-400 p-0 h-auto"
                            onClick={() => setActiveTab("inventory")}
                          >
                            {t('view_low_stock')} →
                          </Button>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100 dark:border-blue-900/30">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{t('recipes')}</p>
                              <h3 className="text-2xl font-bold">{recipes.length}</h3>
                              <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">{t('available_recipes')}</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <ChefHat className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="mt-3 text-blue-700 dark:text-blue-400 p-0 h-auto"
                            onClick={() => setActiveTab("recipes")}
                          >
                            {t('view_recipes')} →
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                    
                    {/* Food Supply Overview */}
                    <div className="mt-4">
                      <KitchenFoodSupplyOverview 
                        kitchenId={selectedKitchen.id}
                        kitchenName={selectedKitchen.name}
                      />
                    </div>
                    
                    {/* Quick Actions - Simplified */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      {/* Order Food Supplies */}
                      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100 dark:border-blue-900/30">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-medium flex items-center">
                              <ShoppingCart className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                              {t('order_supplies')}
                            </h3>
                            <Badge variant="outline" className="bg-blue-100/50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              {lowStockItems.length > 0 ? t('recommended') : t('available')}
                            </Badge>
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
                            buttonClassName="w-full"
                            buttonLabel={t('order_now')}
                          />
                        </CardContent>
                      </Card>
                      
                      {/* Record Consumption */}
                      {buttonPermissions.isButtonVisible('kitchen_consumption') && (
                        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-100 dark:border-green-900/30">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-medium flex items-center">
                                <Utensils className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                                {t('record_consumption')}
                              </h3>
                              <Badge variant="outline" className="bg-green-100/50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                {t('daily')}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3">
                              {t('track_what_you_use_daily')}
                            </p>
                            <KitchenConsumptionDialog 
                              kitchenId={selectedKitchen.id} 
                              kitchenName={selectedKitchen.name}
                              buttonVariant="default"
                              buttonSize="sm"
                              buttonClassName="w-full bg-green-600 hover:bg-green-700"
                              buttonLabel={t('record_now')}
                            />
                          </CardContent>
                        </Card>
                      )}
                      
                      {/* Track Waste */}
                      {buttonPermissions.isButtonVisible('kitchen_waste_tracking') && (
                        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-100 dark:border-amber-900/30">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-medium flex items-center">
                                <Trash2 className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-400" />
                                {t('track_waste')}
                              </h3>
                              <Badge variant="outline" className="bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                {t('important')}
                              </Badge>
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
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </CardTabs.Content>
                  
                  {/* Inventory Tab Content */}
                  <CardTabs.Content value="inventory" className="mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                          <CardTitle className="text-lg flex items-center">
                            <Package className="h-5 w-5 mr-2 text-primary" />
                            {t('kitchen_inventory')}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                              <input 
                                type="text" 
                                placeholder={t('search_inventory')} 
                                className="pl-9 h-10 w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                              />
                            </div>
                            <Button variant="outline" size="sm" className="gap-1">
                              <Filter className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">{t('filter')}</span>
                            </Button>
                            <KitchenFoodSupplyForm
                              kitchenId={selectedKitchen.id}
                              kitchenName={selectedKitchen.name}
                              onSuccess={fetchFoodSupplies}
                              buttonVariant="default"
                              buttonSize="sm"
                              buttonClassName="gap-1"
                              buttonIcon={<Plus className="h-3.5 w-3.5" />}
                              buttonLabel={<span className="hidden sm:inline">{t('add')}</span>}
                            />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {isLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          </div>
                        ) : filteredFoodSupplies.length === 0 ? (
                          <div className="text-center py-8 border border-dashed rounded-lg">
                            <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <h3 className="text-lg font-medium mb-2">
                              {searchQuery ? t('no_matching_items') : t('no_food_supplies_found')}
                            </h3>
                            <p className="text-muted-foreground max-w-md mx-auto mb-4">
                              {searchQuery 
                                ? t('try_different_search_terms')
                                : t('add_food_supplies_to_get_started')}
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
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-4">
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                                {t('all')}: {filteredFoodSupplies.length}
                              </Badge>
                              <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                                {t('expiring')}: {expiringItems.length}
                              </Badge>
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                {t('low_stock')}: {lowStockItems.length}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {filteredFoodSupplies.map((supply) => {
                                const expirationDate = new Date(supply.expirationDate);
                                const daysUntilExpiration = Math.ceil((expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                const isExpiringSoon = daysUntilExpiration <= 7;
                                const isLowStock = lowStockItems.some(item => item.id === supply.id);
                                
                                return (
                                  <div
                                    key={supply.id}
                                    className={`border rounded-lg p-3 hover:shadow-sm transition-all ${
                                      isExpiringSoon 
                                        ? 'border-red-200 dark:border-red-800/30' 
                                        : isLowStock 
                                          ? 'border-amber-200 dark:border-amber-800/30' 
                                          : 'border-border'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <h3 className="font-medium">{supply.name}</h3>
                                      <Badge variant="outline" className="text-xs">
                                        {supply.category}
                                      </Badge>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                      <div>
                                        <span className="text-muted-foreground">{t('quantity')}:</span>
                                        <span className="font-medium ml-1">{supply.quantity} {supply.unit}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">{t('value')}:</span>
                                        <span className="font-medium ml-1">QAR {(supply.pricePerUnit * supply.quantity).toFixed(0)}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">{t('expires')}:</span>
                                        <span className={`font-medium ml-1 ${isExpiringSoon ? 'text-red-600 dark:text-red-400' : ''}`}>
                                          {daysUntilExpiration} {t('days')}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">{t('price')}:</span>
                                        <span className="font-medium ml-1">QAR {supply.pricePerUnit.toFixed(2)}/{supply.unit}</span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex justify-end gap-2">
                                      <KitchenConsumptionDialog 
                                        kitchenId={selectedKitchen.id}
                                        kitchenName={selectedKitchen.name}
                                        preselectedFoodSupplyId={supply.id}
                                        buttonVariant="outline"
                                        buttonSize="sm"
                                        buttonLabel={t('consume')}
                                        onSuccess={fetchFoodSupplies}
                                      />
                                      <Button variant="outline" size="sm">
                                        {t('update')}
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </CardTabs.Content>
                  
                  {/* Recipes Tab Content */}
                  <CardTabs.Content value="recipes" className="mt-4">
                    <RecipesTab kitchenId={selectedKitchen.id} />
                  </CardTabs.Content>
                  
                  {/* Consumption Tab Content */}
                  <CardTabs.Content value="consumption" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                          <BarChart3 className="h-5 w-5 mr-2 text-primary" />
                          {t('kitchen_consumption')}
                        </CardTitle>
                        <CardDescription>{t('track_and_analyze_consumption_in_this_kitchen')}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ConsumptionTabContent kitchenId={selectedKitchen.id} kitchenName={selectedKitchen.name} />
                      </CardContent>
                    </Card>
                  </CardTabs.Content>
                  
                </CardTabs>
              </div>
            ) : (
              <Card className="shadow-sm border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <div className="rounded-full bg-muted p-3 mb-4">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{t('no_kitchen_selected')}</h3>
                  <p className="text-muted-foreground text-center max-w-md mb-4">
                    {t('select_kitchen_from_sidebar')}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}