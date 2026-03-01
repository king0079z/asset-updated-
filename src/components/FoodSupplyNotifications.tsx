import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, 
  Calendar, 
  Clock, 
  ArrowRight, 
  ShoppingCart, 
  ChefHat, 
  TrendingUp,
  Bell,
  RefreshCw,
  Utensils,
  Sparkles,
  RefreshCcw,
  Truck,
  Timer,
  Info
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";
import { RefillFoodSupplyDialog } from "./RefillFoodSupplyDialog";
import { RecipeDetailsDialog } from "./RecipeDetailsDialog";
import { 
  getFoodSupplies, 
  getExpiringItems, 
  getLowStockItems, 
  fetchWithCache 
} from '@/lib/foodSupplyService';

interface FoodSupply {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  expirationDate: string;
  pricePerUnit: number;
  notes?: string;
}

interface Recipe {
  id: string;
  name: string;
  description?: string;
  servings: number;
  prepTime?: number;
  usageCount: number;
  lastUsed: string;
  instructions?: string;
  ingredients: {
    name: string;
    quantity: number;
    unit: string;
  }[];
}

interface LeadTimeInfo {
  leadTime: number; // in days
  reorderPoint: number;
}

interface FoodSupplyNotificationsProps {
  className?: string;
  kitchenId?: string;
}

export function FoodSupplyNotifications({ className, kitchenId }: FoodSupplyNotificationsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [expiringItems, setExpiringItems] = useState<FoodSupply[]>([]);
  const [lowStockItems, setLowStockItems] = useState<FoodSupply[]>([]);
  const [popularRecipes, setPopularRecipes] = useState<Recipe[]>([]);
  const [activeTab, setActiveTab] = useState("expiring");
  const [refillDialogOpen, setRefillDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
    expirationDate: Date;
    isExpired: boolean;
  } | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);

  // Cache timeout - 2 minutes
  const CACHE_TIMEOUT = 2 * 60 * 1000;
  
  // Track last fetch time to avoid excessive refreshes
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  useEffect(() => {
    fetchNotificationData();
  }, [kitchenId]);

  const fetchNotificationData = async (forceRefresh = false) => {
    setIsLoading(true);
    
    // Check if we should use cached data (unless force refresh is requested)
    const now = Date.now();
    if (!forceRefresh && (now - lastFetchTime < CACHE_TIMEOUT)) {
      // If we've fetched recently, just use the existing state data
      setIsLoading(false);
      return;
    }
    
    try {
      // Use Promise.all to run these requests in parallel
      const [allSupplies, expiringData, lowStockData, recipesData] = await Promise.all([
        // Get all food supplies using the service function with caching
        getFoodSupplies(kitchenId || '', forceRefresh),
        
        // Get expiring items directly from API with caching
        fetchWithCache<{items: FoodSupply[]}>(`/api/food-supply?expiringSoon=true${kitchenId ? `&kitchenId=${kitchenId}` : ''}`, {}, forceRefresh),
        
        // Get low stock items directly from API with caching
        fetchWithCache<{items: FoodSupply[]}>(`/api/food-supply?lowStock=true${kitchenId ? `&kitchenId=${kitchenId}` : ''}`, {}, forceRefresh),
        
        // Get popular recipes directly from API with caching
        fetchWithCache<{items: Recipe[]}>(`/api/recipes?popular=true${kitchenId ? `&kitchenId=${kitchenId}` : ''}`, {}, forceRefresh)
      ]);
      
      // Process the data
      if (allSupplies && allSupplies.length > 0) {
        const today = new Date();
        
        // Filter for expired items
        const expiredItems = allSupplies.filter((item: FoodSupply) => {
          const expirationDate = new Date(item.expirationDate);
          return expirationDate < today;
        });
        
        // Get expiring soon items
        const expiringSoonItems = expiringData?.items || [];
        
        // Combine expired and expiring soon items
        setExpiringItems([...expiredItems, ...expiringSoonItems]);
      } else if (expiringData) {
        // If we can't get all supplies, at least use the expiring soon items
        setExpiringItems(expiringData.items || []);
      }
      
      if (lowStockData) {
        setLowStockItems(lowStockData.items || []);
      }
      
      if (recipesData) {
        setPopularRecipes(recipesData.items || []);
      }
      
      // If all API calls fail, use mock data
      if (!allSupplies && !expiringData && !lowStockData && !recipesData) {
        setMockData();
      }
      
      // Update last fetch time
      setLastFetchTime(now);
    } catch (error) {
      console.error('Error fetching notification data:', error);
      setMockData();
    } finally {
      setIsLoading(false);
    }
  };

  const setMockData = () => {
    // Mock data for expiring items
    setExpiringItems([
      {
        id: '1',
        name: 'Fresh Milk',
        quantity: 5,
        unit: 'liters',
        category: 'Dairy',
        expirationDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
        pricePerUnit: 5.99
      },
      {
        id: '2',
        name: 'Chicken Breast',
        quantity: 3,
        unit: 'kg',
        category: 'Meat',
        expirationDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
        pricePerUnit: 12.50
      },
      {
        id: '3',
        name: 'Yogurt',
        quantity: 8,
        unit: 'cups',
        category: 'Dairy',
        expirationDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days from now
        pricePerUnit: 1.25,
        notes: JSON.stringify({
          leadTime: 3,
          reorderPoint: 10
        })
      }
    ]);
    
    // Mock data for low stock items with lead time information
    setLowStockItems([
      {
        id: '4',
        name: 'Olive Oil',
        quantity: 0.5,
        unit: 'liters',
        category: 'Oils',
        expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days from now
        pricePerUnit: 15.99,
        notes: JSON.stringify({
          leadTime: 7,
          reorderPoint: 2
        })
      },
      {
        id: '5',
        name: 'Rice',
        quantity: 2,
        unit: 'kg',
        category: 'Grains',
        expirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 180 days from now
        pricePerUnit: 4.50,
        notes: JSON.stringify({
          leadTime: 5,
          reorderPoint: 5
        })
      },
      {
        id: '6',
        name: 'Tomato Paste',
        quantity: 1,
        unit: 'jars',
        category: 'Canned Goods',
        expirationDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days from now
        pricePerUnit: 3.25,
        notes: JSON.stringify({
          leadTime: 4,
          reorderPoint: 3
        })
      }
    ]);
    
    // Mock data for popular recipes with instructions
    setPopularRecipes([
      {
        id: '1',
        name: 'Chicken Biryani',
        description: 'Traditional spiced rice dish with chicken',
        servings: 6,
        prepTime: 45,
        usageCount: 28,
        lastUsed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        instructions: '1. Marinate chicken with yogurt and spices for 1 hour.\n2. Cook rice separately until 70% done.\n3. In a large pot, layer marinated chicken and partially cooked rice.\n4. Cover and cook on low heat for 25 minutes.\n5. Garnish with fried onions and serve hot.',
        ingredients: [
          { name: 'Basmati Rice', quantity: 2, unit: 'kg' },
          { name: 'Chicken', quantity: 1.5, unit: 'kg' },
          { name: 'Yogurt', quantity: 1, unit: 'cup' },
          { name: 'Garam Masala', quantity: 2, unit: 'tbsp' },
          { name: 'Onions', quantity: 3, unit: 'large' }
        ]
      },
      {
        id: '2',
        name: 'Pasta Carbonara',
        description: 'Creamy Italian pasta with bacon',
        servings: 4,
        prepTime: 25,
        usageCount: 22,
        lastUsed: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        instructions: '1. Cook pasta according to package instructions.\n2. In a separate pan, cook bacon until crispy.\n3. Beat eggs with grated cheese in a bowl.\n4. Drain pasta and immediately add to the bacon pan.\n5. Remove from heat and quickly stir in egg mixture to create a creamy sauce.\n6. Season with black pepper and serve immediately.',
        ingredients: [
          { name: 'Pasta', quantity: 0.5, unit: 'kg' },
          { name: 'Bacon', quantity: 0.2, unit: 'kg' },
          { name: 'Eggs', quantity: 4, unit: 'units' },
          { name: 'Parmesan Cheese', quantity: 100, unit: 'g' },
          { name: 'Black Pepper', quantity: 1, unit: 'tsp' }
        ]
      },
      {
        id: '3',
        name: 'Vegetable Curry',
        description: 'Spicy vegetable curry with coconut milk',
        servings: 4,
        prepTime: 35,
        usageCount: 18,
        lastUsed: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        instructions: '1. Heat oil in a large pot and add curry paste.\n2. Add chopped vegetables and stir to coat with paste.\n3. Pour in coconut milk and simmer for 20 minutes.\n4. Season with salt and lime juice.\n5. Serve with rice or naan bread.',
        ingredients: [
          { name: 'Mixed Vegetables', quantity: 1, unit: 'kg' },
          { name: 'Coconut Milk', quantity: 0.4, unit: 'liters' },
          { name: 'Curry Paste', quantity: 0.1, unit: 'kg' },
          { name: 'Vegetable Oil', quantity: 2, unit: 'tbsp' },
          { name: 'Lime', quantity: 1, unit: 'unit' }
        ]
      }
    ]);
  };

  const getExpirationStatus = (expirationDate: string) => {
    const today = new Date();
    const expDate = new Date(expirationDate);
    const daysUntilExpiration = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiration < 0) {
      // Item is already expired
      return {
        color: 'bg-red-200 text-red-900 dark:bg-red-900/30 dark:text-red-500',
        icon: <AlertTriangle className="h-4 w-4" />,
        label: t('expired'),
        days: daysUntilExpiration
      };
    } else if (daysUntilExpiration <= 3) {
      return {
        color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
        icon: <AlertTriangle className="h-4 w-4" />,
        label: t('critical'),
        days: daysUntilExpiration
      };
    } else if (daysUntilExpiration <= 7) {
      return {
        color: 'bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-300',
        icon: <AlertTriangle className="h-4 w-4" />,
        label: t('urgent'),
        days: daysUntilExpiration
      };
    } else if (daysUntilExpiration <= 14) {
      return {
        color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
        icon: <Clock className="h-4 w-4" />,
        label: t('soon'),
        days: daysUntilExpiration
      };
    } else {
      return {
        color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/10 dark:text-yellow-300',
        icon: <Calendar className="h-4 w-4" />,
        label: t('upcoming'),
        days: daysUntilExpiration
      };
    }
  };

  const getLeadTimeInfo = (item: FoodSupply): LeadTimeInfo | null => {
    if (!item.notes) return null;
    
    try {
      // First check if the notes are already in JSON format
      if (item.notes.startsWith('{') && item.notes.endsWith('}')) {
        const notesObj = JSON.parse(item.notes);
        if (notesObj.leadTime !== undefined && notesObj.reorderPoint !== undefined) {
          return {
            leadTime: notesObj.leadTime,
            reorderPoint: notesObj.reorderPoint
          };
        }
      }
      // If not JSON or doesn't have the required fields, return null
    } catch (e) {
      console.error("Error parsing lead time info from notes:", e);
    }
    
    return null;
  };

  const getStockStatus = (item: FoodSupply) => {
    // Check if we have lead time information
    const leadTimeInfo = getLeadTimeInfo(item);
    const stockLevel = item.quantity;
    
    if (leadTimeInfo) {
      // Use lead time information for more accurate status
      if (stockLevel <= leadTimeInfo.reorderPoint * 0.5) {
        return {
          color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
          icon: <AlertTriangle className="h-4 w-4" />,
          label: t('critical'),
          level: 'critical',
          leadTime: leadTimeInfo
        };
      } else if (stockLevel <= leadTimeInfo.reorderPoint) {
        return {
          color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
          icon: <ShoppingCart className="h-4 w-4" />,
          label: t('reorder_soon'),
          level: 'low',
          leadTime: leadTimeInfo
        };
      } else {
        return {
          color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/10 dark:text-yellow-300',
          icon: <ShoppingCart className="h-4 w-4" />,
          label: t('adequate'),
          level: 'adequate',
          leadTime: leadTimeInfo
        };
      }
    } else {
      // Fallback to simplified logic if no lead time info
      if (stockLevel <= 1) {
        return {
          color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
          icon: <AlertTriangle className="h-4 w-4" />,
          label: t('critical'),
          level: 'critical'
        };
      } else if (stockLevel <= 3) {
        return {
          color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
          icon: <ShoppingCart className="h-4 w-4" />,
          label: t('low'),
          level: 'low'
        };
      } else {
        return {
          color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/10 dark:text-yellow-300',
          icon: <ShoppingCart className="h-4 w-4" />,
          label: t('adequate'),
          level: 'adequate'
        };
      }
    }
  };

  const getPopularityBadge = (usageCount: number) => {
    if (usageCount > 25) {
      return {
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
        icon: <TrendingUp className="h-4 w-4" />,
        label: t('very_popular')
      };
    } else if (usageCount > 15) {
      return {
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
        icon: <TrendingUp className="h-4 w-4" />,
        label: t('popular')
      };
    } else {
      return {
        color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
        icon: <ChefHat className="h-4 w-4" />,
        label: t('regular')
      };
    }
  };

  const handleMarkForUse = (item: FoodSupply) => {
    toast({
      title: t('item_marked_for_priority_use'),
      description: `${item.name} ${t('has_been_marked_for_priority_use')}`,
    });
  };
  
  const handleRefill = (item: FoodSupply) => {
    const today = new Date();
    const expDate = new Date(item.expirationDate);
    const isExpired = expDate < today;
    
    setSelectedItem({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      expirationDate: expDate,
      isExpired
    });
    
    setRefillDialogOpen(true);
  };
  
  const handleRefillSubmit = async (data: {
    id: string;
    newQuantity: number;
    newExpirationDate: Date;
    disposedQuantity: number;
  }) => {
    try {
      const response = await fetch('/api/food-supply/refill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important: Include credentials for authentication
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to refill food supply');
      }
      
      // Refresh the data after successful refill
      fetchNotificationData();
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error refilling food supply:', error);
      return Promise.reject(error);
    }
  };

  const handleReorder = (item: FoodSupply) => {
    toast({
      title: t('item_added_to_order_list'),
      description: `${item.name} ${t('has_been_added_to_order_list')}`,
    });
  };

  const handleViewRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setRecipeDialogOpen(true);
  };

  const getNotificationCount = () => {
    return {
      expiring: expiringItems.length,
      lowStock: lowStockItems.length,
      recipes: popularRecipes.length,
      total: expiringItems.length + lowStockItems.length + popularRecipes.length
    };
  };

  const counts = getNotificationCount();

  return (
    <>
    <Card className={`shadow-md hover:shadow-lg transition-shadow ${className}`}>
      <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-600 pb-3 pt-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-white text-lg flex items-center">
            <Bell className="mr-2 h-5 w-5" />
            {kitchenId ? t('kitchen_notifications') : t('food_supply_notifications')}
            {counts.total > 0 && (
              <Badge className="ml-2 bg-white text-amber-700">{counts.total}</Badge>
            )}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => fetchNotificationData(true)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription className="text-white/80 text-sm">
          {kitchenId 
            ? t('important_alerts_for_this_kitchen') 
            : t('important_alerts_for_kitchen_management')}
        </CardDescription>
      </CardHeader>
      
      <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="px-4 pt-3 pb-1 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border-b border-amber-100 dark:border-amber-800/50">
          <TabsList className="bg-white/50 dark:bg-gray-800/50 w-full h-9 mb-1">
            <TabsTrigger value="expiring" className="text-xs flex items-center">
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
              {t('expiring')}
              {counts.expiring > 0 && (
                <Badge className="ml-1.5 h-5 min-w-5 text-[10px] bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                  {counts.expiring}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="lowStock" className="text-xs flex items-center">
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
              {t('low_stock')}
              {counts.lowStock > 0 && (
                <Badge className="ml-1.5 h-5 min-w-5 text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  {counts.lowStock}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="recipes" className="text-xs flex items-center">
              <ChefHat className="h-3.5 w-3.5 mr-1.5" />
              {t('popular_recipes')}
              {counts.recipes > 0 && (
                <Badge className="ml-1.5 h-5 min-w-5 text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  {counts.recipes}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="expiring">
          <CardContent className="p-0">
            <ScrollArea className="h-[280px]">
              <div className="p-4 space-y-3">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-[200px] text-center py-8">
                    <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-full mb-3">
                      <Sparkles className="h-8 w-8 text-amber-500 dark:text-amber-400 animate-pulse" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
                      {t('loading_notifications')}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                      {t('fetching_latest_kitchen_data')}
                    </p>
                  </div>
                ) : (
                  expiringItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[200px] text-center py-8">
                      <div className="bg-green-50 dark:bg-green-950/40 p-3 rounded-full mb-3">
                        <Calendar className="h-8 w-8 text-green-500 dark:text-green-400" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
                        {t('no_expiring_items')}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                        {t('all_food_supplies_are_fresh')}
                      </p>
                    </div>
                  ) : (
                    expiringItems.map((item) => {
                      const status = getExpirationStatus(item.expirationDate);
                      return (
                        <div 
                          key={item.id}
                          className={`border rounded-lg p-3 transition-colors ${
                            status.days < 0 ? 'border-red-300 bg-red-100/70 dark:border-red-900 dark:bg-red-900/20' :
                            status.days <= 3 ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10' :
                            status.days <= 7 ? 'border-red-100 bg-red-50/30 dark:border-red-800/70 dark:bg-red-900/5' :
                            status.days <= 14 ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10' :
                            'border-yellow-100 bg-yellow-50/30 dark:border-yellow-800/70 dark:bg-yellow-900/5'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium">{item.name}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className={status.color}>
                                  <span className="flex items-center gap-1">
                                    {status.icon}
                                    {status.label}
                                    {status.days >= 0 
                                      ? `: ${status.days} ${t('days')}` 
                                      : `: ${Math.abs(status.days)} ${t('days')} ${t('ago')}`}
                                  </span>
                                </Badge>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                                  {item.quantity} {item.unit}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleRefill(item)}
                              >
                                <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                                {t('refill')}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => handleMarkForUse(item)}
                              >
                                {t('mark_for_priority_use')}
                                <ArrowRight className="ml-1 h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-2 text-sm">
                            <span className="text-muted-foreground">
                              {status.days < 0 ? t('expired_on') : t('expires_on')}: 
                            </span>
                            <span className={
                              status.days < 0 
                                ? 'font-medium text-red-800' 
                                : status.days <= 7 
                                  ? 'font-medium text-red-700' 
                                  : 'font-medium'
                            }>
                              {new Date(item.expirationDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </TabsContent>
        
        <TabsContent value="lowStock">
          <CardContent className="p-0">
            <ScrollArea className="h-[280px]">
              <div className="p-4 space-y-3">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-[200px] text-center py-8">
                    <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-full mb-3">
                      <Sparkles className="h-8 w-8 text-amber-500 dark:text-amber-400 animate-pulse" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
                      {t('loading_notifications')}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                      {t('fetching_latest_kitchen_data')}
                    </p>
                  </div>
                ) : (
                  lowStockItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[200px] text-center py-8">
                      <div className="bg-green-50 dark:bg-green-950/40 p-3 rounded-full mb-3">
                        <ShoppingCart className="h-8 w-8 text-green-500 dark:text-green-400" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
                        {t('stock_levels_good')}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                        {t('no_items_need_reordering')}
                      </p>
                    </div>
                  ) : (
                    lowStockItems.map((item) => {
                      const status = getStockStatus(item);
                      return (
                        <div 
                          key={item.id}
                          className={`border rounded-lg p-3 transition-colors ${
                            status.level === 'critical' ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10' :
                            status.level === 'low' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10' :
                            'border-yellow-100 bg-yellow-50/30 dark:border-yellow-800/70 dark:bg-yellow-900/5'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium">{item.name}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className={status.color}>
                                  <span className="flex items-center gap-1">
                                    {status.icon}
                                    {status.label}
                                  </span>
                                </Badge>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                                  {item.quantity} {item.unit} {t('remaining')}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleRefill(item)}
                              >
                                <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                                {t('refill')}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => handleReorder(item)}
                              >
                                {t('add_to_order')}
                                <ArrowRight className="ml-1 h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-2 space-y-1">
                            <div className="text-sm">
                              <span className="text-muted-foreground">{t('category')}: </span>
                              <span className="font-medium">{item.category}</span>
                              <span className="text-muted-foreground ml-4">{t('price')}: </span>
                              <span className="font-medium">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'QAR' }).format(item.pricePerUnit)} / {item.unit}
                              </span>
                            </div>
                            
                            {status.leadTime && (
                              <div className="text-sm flex items-center gap-2 mt-1 p-1.5 bg-blue-50/50 dark:bg-blue-900/10 rounded-md">
                                <div className="flex items-center gap-1 text-blue-700 dark:text-blue-400">
                                  <Truck className="h-3.5 w-3.5" />
                                  <span className="font-medium">{t('lead_time')}: {status.leadTime.leadTime} {t('days')}</span>
                                </div>
                                <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                                  <Timer className="h-3.5 w-3.5" />
                                  <span className="font-medium">{t('reorder_at')}: {status.leadTime.reorderPoint} {item.unit}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </TabsContent>
        
        <TabsContent value="recipes">
          <CardContent className="p-0">
            <ScrollArea className="h-[280px]">
              <div className="p-4 space-y-3">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-[200px] text-center py-8">
                    <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-full mb-3">
                      <Sparkles className="h-8 w-8 text-amber-500 dark:text-amber-400 animate-pulse" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
                      {t('loading_notifications')}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                      {t('fetching_latest_kitchen_data')}
                    </p>
                  </div>
                ) : (
                  popularRecipes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[200px] text-center py-8">
                      <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-full mb-3">
                        <ChefHat className="h-8 w-8 text-blue-500 dark:text-blue-400" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
                        {t('no_recipe_data')}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                        {t('recipe_usage_data_not_available')}
                      </p>
                    </div>
                  ) : (
                    popularRecipes.map((recipe) => {
                      const popularity = getPopularityBadge(recipe.usageCount);
                      return (
                        <div 
                          key={recipe.id}
                          className="border border-blue-200 rounded-lg p-3 transition-colors bg-blue-50/30 dark:border-blue-800/70 dark:bg-blue-900/5"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium">{recipe.name}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className={popularity.color}>
                                  <span className="flex items-center gap-1">
                                    {popularity.icon}
                                    {popularity.label}
                                  </span>
                                </Badge>
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                                  {recipe.usageCount} {t('uses')}
                                </Badge>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => handleViewRecipe(recipe)}
                            >
                              {t('view_recipe')}
                              <ArrowRight className="ml-1 h-3 w-3" />
                            </Button>
                          </div>
                          <div className="mt-2 space-y-1">
                            <p className="text-muted-foreground line-clamp-1">{recipe.description}</p>
                            <div className="flex flex-wrap gap-1">
                              {(recipe.ingredients ?? []).slice(0, 3).map((ingredient, idx) => (
                                <Badge key={idx} variant="outline" className="bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400 text-xs">
                                  {ingredient.name}
                                </Badge>
                              ))}
                              {(recipe.ingredients ?? []).length > 3 && (
                                <Badge variant="outline" className="bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400 text-xs">
                                  +{(recipe.ingredients ?? []).length - 3} {t('more')}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <div className="flex items-center">
                                <Utensils className="h-3 w-3 mr-1" />
                                {recipe.servings} {t('servings')}
                              </div>
                              {recipe.prepTime && (
                                <div className="flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {recipe.prepTime} {t('min')}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>

    {selectedItem && (
      <RefillFoodSupplyDialog
        open={refillDialogOpen}
        onOpenChange={setRefillDialogOpen}
        item={selectedItem}
        onRefill={handleRefillSubmit}
      />
    )}
    
    {selectedRecipe && (
      <RecipeDetailsDialog
        open={recipeDialogOpen}
        onOpenChange={setRecipeDialogOpen}
        recipe={selectedRecipe}
      />
    )}
    </>
  );
}