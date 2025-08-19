import React, { useState, useEffect } from 'react';
import { fetchWithErrorHandling } from '@/util/apiErrorHandler';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useButtonVisibility } from '@/hooks/useButtonVisibility';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { useTranslation } from "@/contexts/TranslationContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KitchenConsumptionDialog } from './KitchenConsumptionDialog';
import { ConsumptionHistoryDialog } from './ConsumptionHistoryDialog';
import { WasteHistoryDialog } from './WasteHistoryDialog';
import { EnhancedWasteTrackingDialog } from './EnhancedWasteTrackingDialog';
import { FoodSupplyNotifications } from './FoodSupplyNotifications';
import { FoodSupplyBarcodeDialog } from './FoodSupplyBarcodeDialog';
import { RecipesTab } from './RecipesTab';
import { KitchenAIAnalysis } from './KitchenAIAnalysis';
import { KitchenFoodSupplyForm } from './KitchenFoodSupplyForm';
import { EnhancedRecipeManagementDialog } from './EnhancedRecipeManagementDialog';
import { OrderFoodSuppliesDialog } from './OrderFoodSuppliesDialog';
import { VegetableQualityDialog } from './VegetableQualityDialog';
import { WastePatternsDialog } from './WastePatternsDialog';
import { EnhancedKitchenReportButton } from './EnhancedKitchenReportButton';
import { ScanFoodSupplyButton } from './ScanFoodSupplyButton';
import { ScanRecipeButton } from './ScanRecipeButton';
import { RecipeScannerDialog } from './RecipeScannerDialog';
import { KitchenFinancialMetrics } from './KitchenFinancialMetrics';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Utensils, 
  Building2, 
  ChefHat, 
  AlertTriangle, 
  Clock, 
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
  Bell,
  ShoppingCart
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

export function UserKitchenPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<KitchenAssignment[]>([]);
  const [selectedKitchen, setSelectedKitchen] = useState<Kitchen | null>(null);
  const [foodSupplies, setFoodSupplies] = useState<FoodSupply[]>([]);
  const [expiringItems, setExpiringItems] = useState<FoodSupply[]>([]);
  const [lowStockItems, setLowStockItems] = useState<FoodSupply[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [consumptionHistoryOpen, setConsumptionHistoryOpen] = useState(false);
  const [wasteHistoryOpen, setWasteHistoryOpen] = useState(false);
  const [recipeScannerOpen, setRecipeScannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [wasteReasons, setWasteReasons] = useState<{reason: string, percentage: number}[]>([]);
  const [isLoadingWasteReasons, setIsLoadingWasteReasons] = useState(true);
  const { t } = useTranslation();
  
  // Use the button visibility hook at the top level
  const buttonPermissions = useButtonVisibility();

  const fetchAssignments = async () => {
    try {
      const data = await fetchWithErrorHandling('/api/kitchens/assignments', {}, []);
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

  // Cache for storing fetched data by kitchen ID
  const [dataCache, setDataCache] = useState<{
    [kitchenId: string]: {
      foodSupplies?: FoodSupply[];
      recipes?: any[];
      recentActivities?: any[];
      wasteReasons?: {reason: string, percentage: number}[];
      timestamp: number;
    }
  }>({});
  
  // Cache expiration time in milliseconds (5 minutes)
  const CACHE_EXPIRATION = 5 * 60 * 1000;
  
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
        console.log(`Using cached food supplies for kitchen ${selectedKitchen.id}`);
        setFoodSupplies(cachedData.foodSupplies);
        
        // Process cached data for expiring and low stock items
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        
        const expiring = cachedData.foodSupplies.filter((item: FoodSupply) => {
          const expirationDate = new Date(item.expirationDate);
          return expirationDate <= sevenDaysFromNow;
        });
        setExpiringItems(expiring);
        
        const averageQuantity = cachedData.foodSupplies.length > 0
          ? cachedData.foodSupplies.reduce((sum: number, item: FoodSupply) => sum + item.quantity, 0) / cachedData.foodSupplies.length
          : 0;
        const lowStock = cachedData.foodSupplies.filter((item: FoodSupply) => item.quantity < (averageQuantity * 0.2));
        setLowStockItems(lowStock);
        
        setIsLoading(false);
        return;
      }
      
      // If no valid cache, fetch from API
      const url = `/api/food-supply?kitchenId=${selectedKitchen.id}`;
      
      const data = await fetchWithErrorHandling(url, {
        headers: forceRefresh ? { 'Cache-Control': 'no-cache' } : {}
      }, []);
      
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
        
        console.log(`Fetched ${filteredData.length} food supplies for kitchen ${selectedKitchen.id}`);
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
        
        // Filter expiring items (within 7 days)
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        
        const expiring = filteredData.filter((item: FoodSupply) => {
          const expirationDate = new Date(item.expirationDate);
          return expirationDate <= sevenDaysFromNow;
        });
        setExpiringItems(expiring);
        
        // Filter low stock items (less than 20% of average quantity)
        const averageQuantity = filteredData.length > 0
          ? filteredData.reduce((sum: number, item: FoodSupply) => sum + item.quantity, 0) / filteredData.length
          : 0;
        const lowStock = filteredData.filter((item: FoodSupply) => item.quantity < (averageQuantity * 0.2));
        setLowStockItems(lowStock);
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

  const fetchRecipes = async (forceRefresh = false) => {
    if (!selectedKitchen) return;
    
    try {
      // Check if we have cached data that's not expired
      const cachedData = dataCache[selectedKitchen.id];
      const now = new Date().getTime();
      
      if (!forceRefresh && cachedData && cachedData.recipes && 
          (now - cachedData.timestamp < CACHE_EXPIRATION)) {
        console.log(`Using cached recipes for kitchen ${selectedKitchen.id}`);
        setRecipes(cachedData.recipes);
        return;
      }
      
      const data = await fetchWithErrorHandling(
        `/api/recipes?kitchenId=${selectedKitchen.id}`, 
        forceRefresh ? { headers: { 'Cache-Control': 'no-cache' } } : {}, 
        []
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
  
  const fetchRecentActivities = async (forceRefresh = false) => {
    if (!selectedKitchen) return;
    
    setIsLoadingActivities(true);
    try {
      // Check if we have cached data that's not expired
      const cachedData = dataCache[selectedKitchen.id];
      const now = new Date().getTime();
      
      if (!forceRefresh && cachedData && cachedData.recentActivities && 
          (now - cachedData.timestamp < CACHE_EXPIRATION)) {
        console.log(`Using cached recent activities for kitchen ${selectedKitchen.id}`);
        setRecentActivities(cachedData.recentActivities);
        setIsLoadingActivities(false);
        return;
      }
      
      const data = await fetchWithErrorHandling(
        `/api/kitchens/recent-activity?kitchenId=${selectedKitchen.id}`, 
        forceRefresh ? { headers: { 'Cache-Control': 'no-cache' } } : {}, 
        { activities: [] }
      );
      
      if (data) {
        const activities = data.activities || [];
        setRecentActivities(activities);
        
        // Update cache
        setDataCache(prev => ({
          ...prev,
          [selectedKitchen.id]: {
            ...prev[selectedKitchen.id],
            recentActivities: activities,
            timestamp: now
          }
        }));
      } else {
        setRecentActivities([]);
        
        // Update cache with empty array
        setDataCache(prev => ({
          ...prev,
          [selectedKitchen.id]: {
            ...prev[selectedKitchen.id],
            recentActivities: [],
            timestamp: now
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      toast({
        title: t('error'),
        description: t('failed_to_fetch_recent_activities'),
        variant: 'destructive',
      });
      setRecentActivities([]);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const fetchWasteReasons = async (forceRefresh = false) => {
    if (!selectedKitchen) return;
    
    setIsLoadingWasteReasons(true);
    try {
      // Check if we have cached data that's not expired
      const cachedData = dataCache[selectedKitchen.id];
      const now = new Date().getTime();
      
      if (!forceRefresh && cachedData && cachedData.wasteReasons && 
          (now - cachedData.timestamp < CACHE_EXPIRATION)) {
        console.log(`Using cached waste reasons for kitchen ${selectedKitchen.id}`);
        setWasteReasons(cachedData.wasteReasons);
        setIsLoadingWasteReasons(false);
        return;
      }
      
      // Fetch waste reasons data from the API using our error handling utility
      const data = await fetchWithErrorHandling(
        `/api/food-supply/waste-reasons?kitchenId=${selectedKitchen.id}`,
        forceRefresh ? { headers: { 'Cache-Control': 'no-cache' } } : {},
        { reasons: [] }
      );
      
      if (data && Array.isArray(data.reasons)) {
        setWasteReasons(data.reasons);
        
        // Update cache
        setDataCache(prev => ({
          ...prev,
          [selectedKitchen.id]: {
            ...prev[selectedKitchen.id],
            wasteReasons: data.reasons,
            timestamp: now
          }
        }));
      } else {
        setWasteReasons([]);
        
        // Update cache with empty array
        setDataCache(prev => ({
          ...prev,
          [selectedKitchen.id]: {
            ...prev[selectedKitchen.id],
            wasteReasons: [],
            timestamp: now
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching waste reasons:', error);
      // Set empty array on error
      setWasteReasons([]);
    } finally {
      setIsLoadingWasteReasons(false);
    }
  };

  useEffect(() => {
    if (selectedKitchen) {
      fetchFoodSupplies();
      fetchRecipes();
      fetchRecentActivities();
      fetchWasteReasons();
    }
  }, [selectedKitchen]);

  // Listen for recipe updates to refresh recipe data for reports
  useEffect(() => {
    // Create event listener for recipe updates
    const handleRecipeUpdate = () => {
      if (selectedKitchen) {
        fetchRecipes();
      }
    };

    // Add event listener
    window.addEventListener('recipe-updated', handleRecipeUpdate);
    
    // Clean up event listener
    return () => {
      window.removeEventListener('recipe-updated', handleRecipeUpdate);
    };
  }, [selectedKitchen]);

  const handleKitchenSelect = (kitchen: Kitchen) => {
    // Set loading states
    setIsLoading(true);
    setIsLoadingActivities(true);
    setIsLoadingWasteReasons(true);
    
    // Check if we have cached data for this kitchen
    const cachedData = dataCache[kitchen.id];
    const now = new Date().getTime();
    
    if (cachedData && (now - cachedData.timestamp < CACHE_EXPIRATION)) {
      console.log(`Using cached data for kitchen ${kitchen.id}`);
      
      // Use cached data if available
      if (cachedData.foodSupplies) {
        setFoodSupplies(cachedData.foodSupplies);
        
        // Process cached data for expiring and low stock items
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        
        const expiring = cachedData.foodSupplies.filter((item: FoodSupply) => {
          const expirationDate = new Date(item.expirationDate);
          return expirationDate <= sevenDaysFromNow;
        });
        setExpiringItems(expiring);
        
        const averageQuantity = cachedData.foodSupplies.length > 0
          ? cachedData.foodSupplies.reduce((sum: number, item: FoodSupply) => sum + item.quantity, 0) / cachedData.foodSupplies.length
          : 0;
        const lowStock = cachedData.foodSupplies.filter((item: FoodSupply) => item.quantity < (averageQuantity * 0.2));
        setLowStockItems(lowStock);
        
        setIsLoading(false);
      }
      
      if (cachedData.recipes) {
        setRecipes(cachedData.recipes);
      }
      
      if (cachedData.recentActivities) {
        setRecentActivities(cachedData.recentActivities);
        setIsLoadingActivities(false);
      }
      
      if (cachedData.wasteReasons) {
        setWasteReasons(cachedData.wasteReasons);
        setIsLoadingWasteReasons(false);
      }
    } else {
      // Reset data if no cache is available
      setFoodSupplies([]);
      setExpiringItems([]);
      setLowStockItems([]);
      setRecipes([]);
      setRecentActivities([]);
      setWasteReasons([]);
    }
    
    // Set the selected kitchen
    setSelectedKitchen(kitchen);
    
    // Data will be fetched by the useEffect that depends on selectedKitchen
    // if cache is not available or expired
  };

  // Categories for food supplies
  const categories = [
    { value: "dairy", label: "Dairy", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400" },
    { value: "meat", label: "Meat", color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400" },
    { value: "vegetables", label: "Vegetables", color: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" },
    { value: "fruits", label: "Fruits", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400" },
    { value: "grains", label: "Grains", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400" },
    { value: "beverages", label: "Beverages", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400" },
    { value: "other", label: "Other", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('my_kitchens')}</h1>
          <p className="text-muted-foreground mt-1">{t('manage_your_assigned_kitchens')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder={t('search_kitchens')} 
              className="pl-9 h-10 w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10">
            <Filter className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10">
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {assignments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-3 mb-4">
              <Building2 className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('no_kitchens_assigned')}</h3>
            <p className="text-muted-foreground text-center max-w-md">
              {t('contact_admin_for_kitchen_assignment')}
            </p>
            <Button className="mt-6">
              {t('contact_administrator')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Kitchen Selection Sidebar */}
          <div className="lg:col-span-3 xl:col-span-2">
            <div className="sticky top-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    <Building2 className="h-5 w-5 mr-2 text-primary" />
                    {t('my_kitchens')}
                  </CardTitle>
                  <CardDescription>{t('select_a_kitchen_to_manage')}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1.5">
                    {assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className={`p-3 rounded-md cursor-pointer transition-all ${
                          selectedKitchen?.id === assignment.kitchen.id
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'hover:bg-accent hover:text-accent-foreground'
                        }`}
                        onClick={() => handleKitchenSelect(assignment.kitchen)}
                      >
                        <div className="flex items-center">
                          <Building2 className="h-5 w-5 mr-2" />
                          <div>
                            <p className="font-medium">{assignment.kitchen.name}</p>
                            <p className="text-xs opacity-80">Floor {assignment.kitchen.floorNumber}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              {/* Quick Stats Card */}
              {selectedKitchen && (
                <Card className="mt-4 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{t('kitchen_stats')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{t('total_inventory')}</span>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                          {foodSupplies.length} {t('items')}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{t('expiring_soon')}</span>
                        <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                          {expiringItems.length} {t('items')}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{t('low_stock')}</span>
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                          {lowStockItems.length} {t('items')}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-9 xl:col-span-10">
            {selectedKitchen ? (
              <div className="space-y-6">
                {/* Kitchen Header */}
                <Card className="shadow-sm border-b-4 border-b-primary">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                      <div>
                        <div className="flex items-center">
                          <CardTitle className="text-2xl mr-2">{selectedKitchen.name}</CardTitle>
                          <Badge variant="outline" className="bg-primary/10 text-primary">
                            Floor {selectedKitchen.floorNumber}
                          </Badge>
                        </div>
                        <CardDescription className="mt-1">
                          {selectedKitchen.description || t('no_description_available')}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        {/* Quick action buttons */}
                        <Button variant="outline" size="sm" className="gap-1 h-9" onClick={() => setActiveTab("overview")}>
                          <Package className="h-4 w-4" />
                          <span className="hidden sm:inline">{t('overview')}</span>
                        </Button>
                        
                        <ScanFoodSupplyButton 
                          kitchenId={selectedKitchen.id}
                          onScanComplete={() => {
                            fetchFoodSupplies();
                            fetchRecipes();
                          }}
                        />
                        
                        {buttonPermissions.isButtonVisible('kitchen_food_supply') && (
                          <KitchenFoodSupplyForm
                            kitchenId={selectedKitchen.id}
                            kitchenName={selectedKitchen.name}
                            onSuccess={fetchFoodSupplies}
                          />
                        )}
                        
                        <EnhancedKitchenReportButton 
                          kitchen={selectedKitchen}
                          recipes={recipes}
                          foodSupplies={foodSupplies}
                          expiringItems={expiringItems}
                          lowStockItems={lowStockItems}
                        />
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Kitchen Financial Metrics */}
                <KitchenFinancialMetrics 
                  kitchenId={selectedKitchen.id}
                  kitchenName={selectedKitchen.name}
                />

                {/* Kitchen-specific notifications */}
                <FoodSupplyNotifications kitchenId={selectedKitchen.id} />
                
                {/* Kitchen Dashboard Navigation */}
                <div className="bg-muted/30 p-1 rounded-lg mb-6">
                  <div className="grid grid-cols-5 h-11 gap-1">
                    {[
                      { id: "overview", icon: <Package className="h-4 w-4" />, label: t('overview') },
                      { id: "inventory", icon: <Utensils className="h-4 w-4" />, label: t('inventory') },
                      { id: "recipes", icon: <ChefHat className="h-4 w-4" />, label: t('recipes') },
                      { id: "consumption", icon: <BarChart3 className="h-4 w-4" />, label: t('consumption') },
                      { id: "analytics", icon: <Sparkles className="h-4 w-4" />, label: t('analytics') }
                    ].map(tab => (
                      <Button 
                        key={tab.id}
                        variant={activeTab === tab.id ? "default" : "ghost"}
                        className={`flex items-center justify-center gap-2 h-full ${activeTab === tab.id ? 'shadow-sm' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                {activeTab === "overview" && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                      {/* Key Stats Cards */}
                      <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-100 dark:border-green-900/30">
                          <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">{t('total_inventory')}</p>
                                <h3 className="text-3xl font-bold">{foodSupplies.length}</h3>
                                <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">{t('items_in_stock')}</p>
                              </div>
                              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <Package className="h-6 w-6 text-green-600 dark:text-green-400" />
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="mt-4 text-green-700 dark:text-green-400 p-0 h-auto"
                              onClick={() => setActiveTab("inventory")}
                            >
                              {t('view_inventory')} →
                            </Button>
                          </CardContent>
                        </Card>
                        
                        <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 border-red-100 dark:border-red-900/30">
                          <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">{t('expiring_soon')}</p>
                                <h3 className="text-3xl font-bold">{expiringItems.length}</h3>
                                <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">{t('items_expiring_within_7_days')}</p>
                              </div>
                              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="mt-4 text-red-700 dark:text-red-400 p-0 h-auto"
                              onClick={() => {
                                toast({
                                  title: t('expiring_items'),
                                  description: t('viewing_all_expiring_items'),
                                });
                              }}
                            >
                              {t('view_expiring')} →
                            </Button>
                          </CardContent>
                        </Card>
                        
                        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-100 dark:border-amber-900/30">
                          <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">{t('low_stock')}</p>
                                <h3 className="text-3xl font-bold">{lowStockItems.length}</h3>
                                <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">{t('items_running_low')}</p>
                              </div>
                              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <Package className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="mt-4 text-amber-700 dark:text-amber-400 p-0 h-auto"
                              onClick={() => {
                                toast({
                                  title: t('low_stock_items'),
                                  description: t('viewing_all_low_stock_items'),
                                });
                              }}
                            >
                              {t('view_low_stock')} →
                            </Button>
                          </CardContent>
                        </Card>
                        
                        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100 dark:border-blue-900/30">
                          <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">{t('recipes')}</p>
                                <h3 className="text-3xl font-bold">{recipes.length}</h3>
                                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">{t('available_recipes')}</p>
                              </div>
                              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <ChefHat className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="mt-4 text-blue-700 dark:text-blue-400 p-0 h-auto"
                              onClick={() => setActiveTab("recipes")}
                            >
                              {t('view_recipes')} →
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                      
                      {/* Quick Actions */}
                      <div className="lg:col-span-4">
                        <Card className="overflow-hidden border-none shadow-md">
                          <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
                            <CardTitle className="text-lg flex items-center">
                              <Sparkles className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                              {t('quick_actions')}
                            </CardTitle>
                            <CardDescription>{t('common_kitchen_management_tasks')}</CardDescription>
                          </CardHeader>
                          <CardContent className="p-6">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                              {/* Primary Actions - Most frequently used */}
                              <div className="col-span-2 sm:col-span-3 lg:col-span-4 mb-2">
                                <h3 className="text-sm font-medium text-muted-foreground mb-3">{t('primary_actions')}</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {/* Order Food Supplies */}
                                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-4 shadow-sm hover:shadow-md transition-all border border-blue-100 dark:border-blue-900/30 group">
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                      </div>
                                      <Badge variant="outline" className="bg-blue-100/50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                        {lowStockItems.length > 0 ? t('recommended') : t('available')}
                                      </Badge>
                                    </div>
                                    <h3 className="font-medium mb-1">{t('order_supplies')}</h3>
                                    <p className="text-xs text-muted-foreground mb-3">
                                      {lowStockItems.length > 0 
                                        ? t('low_stock_items_order_now', { count: lowStockItems.length }) 
                                        : t('keep_your_inventory_stocked')}
                                    </p>
                                    <OrderFoodSuppliesDialog
                                      kitchenId={selectedKitchen.id}
                                      kitchenName={selectedKitchen.name}
                                      onOrderComplete={fetchFoodSupplies}
                                      buttonVariant="default"
                                      buttonSize="sm"
                                      buttonClassName="w-full"
                                      buttonLabel={t('order_now')}
                                    />
                                  </div>
                                  
                                  {/* Record Consumption */}
                                  {buttonPermissions.isButtonVisible('kitchen_consumption') && (
                                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl p-4 shadow-sm hover:shadow-md transition-all border border-green-100 dark:border-green-900/30 group">
                                      <div className="flex items-start justify-between mb-3">
                                        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                          <Utensils className="h-5 w-5 text-green-600 dark:text-green-400" />
                                        </div>
                                        <Badge variant="outline" className="bg-green-100/50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                          {t('daily')}
                                        </Badge>
                                      </div>
                                      <h3 className="font-medium mb-1">{t('record_consumption')}</h3>
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
                                    </div>
                                  )}
                                  
                                  {/* Track Waste */}
                                  {buttonPermissions.isButtonVisible('kitchen_waste_tracking') && (
                                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 rounded-xl p-4 shadow-sm hover:shadow-md transition-all border border-amber-100 dark:border-amber-900/30 group">
                                      <div className="flex items-start justify-between mb-3">
                                        <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                          <Trash2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                        </div>
                                        <Badge variant="outline" className="bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                          {t('important')}
                                        </Badge>
                                      </div>
                                      <h3 className="font-medium mb-1">{t('track_waste')}</h3>
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
                              </div>
                              
                              {/* Secondary Actions */}
                              <div className="col-span-2 sm:col-span-3 lg:col-span-4 mt-2">
                                <h3 className="text-sm font-medium text-muted-foreground mb-3">{t('other_actions')}</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                  {/* Scan Barcode */}
                                  <div className="flex flex-col items-center justify-center bg-muted/30 hover:bg-muted/50 rounded-lg p-3 transition-colors border border-border">
                                    <ScanFoodSupplyButton 
                                      kitchenId={selectedKitchen.id}
                                      onScanComplete={() => {
                                        fetchFoodSupplies();
                                        fetchRecipes();
                                      }}
                                      buttonVariant="ghost"
                                      buttonSize="lg"
                                      buttonClassName="h-12 w-12 rounded-full mb-2 hover:bg-background"
                                      buttonIcon={<Search className="h-5 w-5 text-muted-foreground" />}
                                      buttonLabel=""
                                    />
                                    <span className="text-xs font-medium">{t('scan_barcode')}</span>
                                  </div>
                                  
                                  {/* Add Food Supply */}
                                  {buttonPermissions.isButtonVisible('kitchen_food_supply') && (
                                    <div className="flex flex-col items-center justify-center bg-muted/30 hover:bg-muted/50 rounded-lg p-3 transition-colors border border-border">
                                      <KitchenFoodSupplyForm
                                        kitchenId={selectedKitchen.id}
                                        kitchenName={selectedKitchen.name}
                                        onSuccess={fetchFoodSupplies}
                                        buttonVariant="ghost"
                                        buttonSize="lg"
                                        buttonClassName="h-12 w-12 rounded-full mb-2 hover:bg-background"
                                        buttonIcon={<Package className="h-5 w-5 text-muted-foreground" />}
                                        buttonLabel=""
                                      />
                                      <span className="text-xs font-medium">{t('add_food_supply')}</span>
                                    </div>
                                  )}
                                  
                                  {/* Manage Recipes */}
                                  {buttonPermissions.isButtonVisible('kitchen_recipe') && (
                                    <div className="flex flex-col items-center justify-center bg-muted/30 hover:bg-muted/50 rounded-lg p-3 transition-colors border border-border">
                                      <EnhancedRecipeManagementDialog 
                                        kitchenId={selectedKitchen.id}
                                        buttonVariant="ghost"
                                        buttonSize="lg"
                                        buttonClassName="h-12 w-12 rounded-full mb-2 hover:bg-background"
                                        buttonIcon={<ChefHat className="h-5 w-5 text-muted-foreground" />}
                                        buttonLabel=""
                                      />
                                      <span className="text-xs font-medium">{t('manage_recipes')}</span>
                                    </div>
                                  )}
                                  
                                  {/* Generate Report */}
                                  <div className="flex flex-col items-center justify-center bg-muted/30 hover:bg-muted/50 rounded-lg p-3 transition-colors border border-border">
                                    <EnhancedKitchenReportButton 
                                      kitchen={selectedKitchen}
                                      recipes={recipes}
                                      foodSupplies={foodSupplies}
                                      expiringItems={expiringItems}
                                      lowStockItems={lowStockItems}
                                      buttonVariant="ghost"
                                      buttonSize="lg"
                                      buttonClassName="h-12 w-12 rounded-full mb-2 hover:bg-background"
                                      buttonIcon={<BarChart3 className="h-5 w-5 text-muted-foreground" />}
                                      buttonLabel=""
                                    />
                                    <span className="text-xs font-medium">{t('generate_report')}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      
                      {/* Recent Activity and Alerts */}
                      <div className="lg:col-span-3">
                        <Card className="h-full">
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-center">
                              <CardTitle className="text-lg flex items-center">
                                <History className="h-5 w-5 mr-2 text-primary" />
                                {t('recent_activity')}
                              </CardTitle>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-2"
                                onClick={fetchRecentActivities}
                              >
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                {t('refresh')}
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {isLoadingActivities ? (
                              <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                              </div>
                            ) : recentActivities.length === 0 ? (
                              <div className="text-center py-8 border border-dashed rounded-lg">
                                <p className="text-muted-foreground">{t('no_recent_activity')}</p>
                              </div>
                            ) : (
                              <ScrollArea className="h-[400px] pr-4">
                                <div className="space-y-3">
                                  {recentActivities.map((activity) => {
                                    // Determine icon and colors based on activity type
                                    const iconConfig = 
                                      activity.type === 'consumption' 
                                        ? { icon: <Utensils className="h-4 w-4 text-green-600" />, bgColor: 'bg-green-100', badgeColor: 'bg-green-50 text-green-700' } :
                                      activity.type === 'recipe' 
                                        ? { icon: <ChefHat className="h-4 w-4 text-blue-600" />, bgColor: 'bg-blue-100', badgeColor: 'bg-blue-50 text-blue-700' } :
                                      activity.type === 'waste' 
                                        ? { icon: <Trash2 className="h-4 w-4 text-red-600" />, bgColor: 'bg-red-100', badgeColor: 'bg-red-50 text-red-700' } :
                                        { icon: <Clock className="h-4 w-4 text-gray-600" />, bgColor: 'bg-gray-100', badgeColor: 'bg-gray-50 text-gray-700' };
                                    
                                    return (
                                      <div key={activity.id} className="flex items-start gap-3 p-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                                        <div className={`h-8 w-8 rounded-full ${iconConfig.bgColor} flex items-center justify-center flex-shrink-0`}>
                                          {iconConfig.icon}
                                        </div>
                                        <div>
                                          <p className="font-medium">{t(activity.title)}</p>
                                          <p className="text-sm text-muted-foreground">{activity.timeFormatted} - {activity.description}</p>
                                        </div>
                                        <div className="ml-auto text-right">
                                          <Badge variant="outline" className={iconConfig.badgeColor}>
                                            {t(activity.dateFormatted)}
                                          </Badge>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </ScrollArea>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                      
                      <div className="lg:col-span-1">
                        <Card className="h-full">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center">
                              <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
                              {t('alerts')}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ScrollArea className="h-[400px] pr-4">
                              <div className="space-y-4">
                                {expiringItems.length > 0 && (
                                  <div className="border border-red-200 rounded-lg p-3 bg-red-50/50 dark:bg-red-900/10 dark:border-red-800/30">
                                    <h4 className="font-medium flex items-center text-red-700 dark:text-red-400">
                                      <AlertTriangle className="h-4 w-4 mr-2" />
                                      {t('expiring_items')}
                                    </h4>
                                    <div className="mt-2 space-y-2">
                                      {expiringItems.slice(0, 3).map(item => (
                                        <div key={item.id} className="flex justify-between items-center text-sm">
                                          <span>{item.name}</span>
                                          <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30">
                                            {new Date(item.expirationDate).toLocaleDateString()}
                                          </Badge>
                                        </div>
                                      ))}
                                      {expiringItems.length > 3 && (
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="w-full mt-1 text-red-700 dark:text-red-400"
                                          onClick={() => setActiveTab("inventory")}
                                        >
                                          {t('view_all')} ({expiringItems.length})
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {lowStockItems.length > 0 && (
                                  <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800/30">
                                    <h4 className="font-medium flex items-center text-amber-700 dark:text-amber-400">
                                      <AlertTriangle className="h-4 w-4 mr-2" />
                                      {t('low_stock_items')}
                                    </h4>
                                    <div className="mt-2 space-y-2">
                                      {lowStockItems.slice(0, 3).map(item => (
                                        <div key={item.id} className="flex justify-between items-center text-sm">
                                          <span>{item.name}</span>
                                          <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30">
                                            {item.quantity} {item.unit}
                                          </Badge>
                                        </div>
                                      ))}
                                      {lowStockItems.length > 3 && (
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="w-full mt-1 text-amber-700 dark:text-amber-400"
                                          onClick={() => setActiveTab("inventory")}
                                        >
                                          {t('view_all')} ({lowStockItems.length})
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800/30">
                                  <h4 className="font-medium flex items-center text-blue-700 dark:text-blue-400">
                                    <Info className="h-4 w-4 mr-2" />
                                    {t('suggested_actions')}
                                  </h4>
                                  <div className="mt-2 space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                      <span>{t('order_more_food_supplies')}</span>
                                      <OrderFoodSuppliesDialog 
                                        kitchenId={selectedKitchen.id}
                                        kitchenName={selectedKitchen.name}
                                        buttonSize="sm"
                                        buttonVariant="outline"
                                        buttonClassName="h-7 text-xs"
                                        onOrderComplete={fetchFoodSupplies}
                                      />
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                      <span>{t('check_vegetable_quality')}</span>
                                      <VegetableQualityDialog />
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                      <span>{t('review_waste_patterns')}</span>
                                      <WastePatternsDialog 
                                        kitchenId={selectedKitchen.id}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                )}

                {activeTab === "inventory" && (
                    <Card className="shadow-sm">
                      <CardHeader className="pb-3">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                          <div>
                            <CardTitle className="text-lg flex items-center">
                              <Package className="h-5 w-5 mr-2 text-primary" />
                              {t('kitchen_inventory')}
                            </CardTitle>
                            <CardDescription>{t('manage_food_supplies_in_this_kitchen')}</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                              <input 
                                type="text" 
                                placeholder={t('search_inventory')} 
                                className="pl-9 h-10 w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              />
                            </div>
                            <KitchenFoodSupplyForm
                              kitchenId={selectedKitchen.id}
                              kitchenName={selectedKitchen.name}
                              onSuccess={fetchFoodSupplies}
                            />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {isLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          </div>
                        ) : foodSupplies.length === 0 ? (
                          <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <div className="bg-muted/50 inline-flex rounded-full p-3 mb-4">
                              <Package className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium mb-2">{t('no_food_supplies_found')}</h3>
                            <p className="text-muted-foreground max-w-md mx-auto mb-6">
                              {t('add_food_supplies_to_get_started')}
                            </p>
                            <KitchenFoodSupplyForm
                              kitchenId={selectedKitchen.id}
                              kitchenName={selectedKitchen.name}
                              onSuccess={fetchFoodSupplies}
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="flex flex-wrap items-center justify-between mb-4 px-2 gap-3">
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                                  {t('all')}: {foodSupplies.length}
                                </Badge>
                                <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                                  {t('expiring')}: {expiringItems.length}
                                </Badge>
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                  {t('low_stock')}: {lowStockItems.length}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm">
                                  <Filter className="h-3.5 w-3.5 mr-1.5" />
                                  {t('filter')}
                                </Button>
                                <Button variant="outline" size="sm">
                                  <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                                  {t('sort')}
                                </Button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {foodSupplies.map((supply) => {
                                const category = categories.find(c => c.value === supply.category);
                                const expirationDate = new Date(supply.expirationDate);
                                const daysUntilExpiration = Math.ceil((expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                const expirationStatus = 
                                  daysUntilExpiration <= 7 ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 border-red-200' :
                                  daysUntilExpiration <= 30 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200' :
                                  'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 border-green-200';

                                return (
                                  <div
                                    key={supply.id}
                                    className="border rounded-lg p-4 hover:shadow-md transition-all bg-card"
                                  >
                                    <div className="flex flex-col h-full">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                          <h3 className="font-semibold">{supply.name}</h3>
                                          <span className={`text-xs px-2 py-0.5 rounded-full ${category?.color || 'bg-gray-100'}`}>
                                            {category?.label || supply.category}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <FoodSupplyBarcodeDialog supply={supply} kitchenId={selectedKitchen.id} />
                                          <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <Bell className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                      
                                      <div className="flex flex-col gap-2 mb-3">
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-muted-foreground">{t('quantity')}:</span>
                                          <span className="font-medium">{supply.quantity} {supply.unit}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-muted-foreground">{t('price')}:</span>
                                          <span className="font-medium">QAR {supply.pricePerUnit.toFixed(2)} / {supply.unit}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-muted-foreground">{t('total_value')}:</span>
                                          <span className="font-medium">QAR {(supply.pricePerUnit * supply.quantity).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-muted-foreground">{t('expires')}:</span>
                                          <Badge variant="outline" className={expirationStatus}>
                                            {daysUntilExpiration} {t('days')}
                                          </Badge>
                                        </div>
                                      </div>
                                      
                                      <div className="mt-auto pt-2 border-t flex justify-between items-center">
                                        <ConsumptionHistoryDialog 
                                          foodSupplyId={supply.id} 
                                          foodSupplyName={supply.name} 
                                        />
                                        <div className="flex gap-2">
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
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                )}

                {activeTab === "recipes" && (
                  <RecipesTab kitchenId={selectedKitchen.id} />
                )}
                  
                {activeTab === "consumption" && (
                    <Card className="shadow-sm">
                      <CardHeader className="pb-3">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                          <div>
                            <CardTitle className="text-lg flex items-center">
                              <BarChart3 className="h-5 w-5 mr-2 text-primary" />
                              {t('kitchen_consumption')}
                            </CardTitle>
                            <CardDescription>{t('track_and_analyze_consumption_in_this_kitchen')}</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm">
                              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                              {t('refresh')}
                            </Button>
                            <Button variant="outline" size="sm">
                              <Filter className="h-3.5 w-3.5 mr-1.5" />
                              {t('filter')}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          <div className="border rounded-lg p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-medium text-lg flex items-center">
                                <Utensils className="h-5 w-5 mr-2 text-blue-600" />
                                {t('consumption_tracking')}
                              </h3>
                              <KitchenConsumptionDialog 
                                kitchenId={selectedKitchen.id} 
                                kitchenName={selectedKitchen.name} 
                              />
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                              {t('record_and_track_food_consumption_in_this_kitchen')}
                            </p>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                              <div className="bg-white dark:bg-gray-800 rounded-md p-3 shadow-sm">
                                <div className="text-xs text-muted-foreground mb-1">{t('today')}</div>
                                <div className="text-xl font-bold">2.5 kg</div>
                                <div className="text-xs text-blue-600 mt-1">+15% vs. avg</div>
                              </div>
                              <div className="bg-white dark:bg-gray-800 rounded-md p-3 shadow-sm">
                                <div className="text-xs text-muted-foreground mb-1">{t('this_week')}</div>
                                <div className="text-xl font-bold">18.3 kg</div>
                                <div className="text-xs text-green-600 mt-1">-5% vs. avg</div>
                              </div>
                            </div>
                            <Button 
                              className="w-full" 
                              onClick={() => setConsumptionHistoryOpen(true)}
                            >
                              <History className="h-4 w-4 mr-2" />
                              {t('view_consumption_history')}
                            </Button>
                          </div>
                          
                          <div className="border rounded-lg p-5 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-medium text-lg flex items-center">
                                <Trash2 className="h-5 w-5 mr-2 text-red-600" />
                                {t('waste_tracking')}
                              </h3>
                              <EnhancedWasteTrackingDialog />
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                              {t('record_and_analyze_food_waste_to_reduce_costs')}
                            </p>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                              <div className="bg-white dark:bg-gray-800 rounded-md p-3 shadow-sm">
                                <div className="text-xs text-muted-foreground mb-1">{t('today')}</div>
                                <div className="text-xl font-bold">
                                  {isLoadingWasteReasons ? (
                                    <div className="animate-pulse h-6 w-16 bg-muted rounded"></div>
                                  ) : (
                                    "0.8 kg"
                                  )}
                                </div>
                                <div className="text-xs text-red-600 mt-1">+10% vs. avg</div>
                              </div>
                              <div className="bg-white dark:bg-gray-800 rounded-md p-3 shadow-sm">
                                <div className="text-xs text-muted-foreground mb-1">{t('this_week')}</div>
                                <div className="text-xl font-bold">
                                  {isLoadingWasteReasons ? (
                                    <div className="animate-pulse h-6 w-16 bg-muted rounded"></div>
                                  ) : (
                                    "4.2 kg"
                                  )}
                                </div>
                                <div className="text-xs text-green-600 mt-1">-12% vs. avg</div>
                              </div>
                            </div>
                            <Button 
                              className="w-full" 
                              onClick={() => setWasteHistoryOpen(true)}
                            >
                              <History className="h-4 w-4 mr-2" />
                              {t('view_waste_history')}
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="border rounded-lg p-5">
                            <h3 className="font-medium text-lg mb-4 flex items-center">
                              <PieChart className="h-5 w-5 mr-2 text-primary" />
                              {t('consumption_by_category')}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="col-span-2 h-[200px] flex items-center justify-center bg-muted/30 rounded-lg">
                                <div className="text-center text-muted-foreground">
                                  {t('chart_visualization_here')}
                                </div>
                              </div>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/10 rounded-md">
                                  <div className="flex items-center">
                                    <div className="h-3 w-3 rounded-full bg-blue-500 mr-2"></div>
                                    <span>{t('meat')}</span>
                                  </div>
                                  <span className="font-medium">35%</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/10 rounded-md">
                                  <div className="flex items-center">
                                    <div className="h-3 w-3 rounded-full bg-green-500 mr-2"></div>
                                    <span>{t('vegetables')}</span>
                                  </div>
                                  <span className="font-medium">25%</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-amber-50 dark:bg-amber-900/10 rounded-md">
                                  <div className="flex items-center">
                                    <div className="h-3 w-3 rounded-full bg-amber-500 mr-2"></div>
                                    <span>{t('grains')}</span>
                                  </div>
                                  <span className="font-medium">20%</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-purple-50 dark:bg-purple-900/10 rounded-md">
                                  <div className="flex items-center">
                                    <div className="h-3 w-3 rounded-full bg-purple-500 mr-2"></div>
                                    <span>{t('dairy')}</span>
                                  </div>
                                  <span className="font-medium">15%</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-900/10 rounded-md">
                                  <div className="flex items-center">
                                    <div className="h-3 w-3 rounded-full bg-gray-500 mr-2"></div>
                                    <span>{t('other')}</span>
                                  </div>
                                  <span className="font-medium">5%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="border rounded-lg p-5">
                            <h3 className="font-medium text-lg mb-4 flex items-center">
                              <Trash2 className="h-5 w-5 mr-2 text-red-600" />
                              {t('top_waste_reasons')}
                            </h3>
                            {isLoadingWasteReasons ? (
                              <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                  <div key={i} className="animate-pulse flex items-center justify-between p-3 bg-muted/30 rounded-md">
                                    <div className="h-4 w-32 bg-muted rounded"></div>
                                    <div className="h-4 w-12 bg-muted rounded"></div>
                                  </div>
                                ))}
                              </div>
                            ) : wasteReasons.length > 0 ? (
                              <div className="space-y-3">
                                {wasteReasons.map((reason, index) => {
                                  // Define colors for different waste reasons
                                  const colors = [
                                    { bg: "bg-red-50 dark:bg-red-900/10", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
                                    { bg: "bg-amber-50 dark:bg-amber-900/10", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
                                    { bg: "bg-blue-50 dark:bg-blue-900/10", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
                                    { bg: "bg-green-50 dark:bg-green-900/10", text: "text-green-700 dark:text-green-400", dot: "bg-green-500" },
                                    { bg: "bg-purple-50 dark:bg-purple-900/10", text: "text-purple-700 dark:text-purple-400", dot: "bg-purple-500" },
                                  ];
                                  const color = colors[index % colors.length];
                                  
                                  return (
                                    <div 
                                      key={index} 
                                      className={`flex justify-between items-center p-3 ${color.bg} rounded-md`}
                                    >
                                      <div className={`flex items-center ${color.text}`}>
                                        <div className={`h-3 w-3 rounded-full ${color.dot} mr-2`}></div>
                                        <span>{reason.reason}</span>
                                      </div>
                                      <span className="font-medium">{reason.percentage}%</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-8 border border-dashed rounded-lg">
                                <p className="text-muted-foreground">{t('no_waste_data_available')}</p>
                                <p className="text-sm text-muted-foreground mt-1">{t('start_tracking_waste_to_see_reasons')}</p>
                                <EnhancedWasteTrackingDialog 
                                  buttonClassName="mt-4"
                                  buttonLabel={t('track_waste_now')}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                )}

                {activeTab === "analytics" && (
                  <KitchenAIAnalysis 
                    kitchenId={selectedKitchen.id} 
                    kitchenName={selectedKitchen.name} 
                  />
                )}
              </div>
            ) : (
              <Card className="shadow-sm border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="rounded-full bg-muted p-3 mb-4">
                    <Building2 className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{t('no_kitchen_selected')}</h3>
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    {t('select_kitchen_from_sidebar')}
                  </p>
                  <Button variant="outline">
                    {t('select_a_kitchen')}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Dialog components with proper state management */}
      <ConsumptionHistoryDialog 
        foodSupplyId="" 
        foodSupplyName={t('all_food_supplies')}
        open={consumptionHistoryOpen}
        onOpenChange={setConsumptionHistoryOpen}
      />
      
      <WasteHistoryDialog 
        foodSupplyId=""
        foodSupplyName={t('all_food_supplies')}
        open={wasteHistoryOpen}
        onOpenChange={setWasteHistoryOpen}
      />
      
      {selectedKitchen && (
        <RecipeScannerDialog
          kitchenId={selectedKitchen.id}
          open={recipeScannerOpen}
          onOpenChange={setRecipeScannerOpen}
          onScanComplete={fetchRecipes}
        />
      )}
    </div>
  );
}