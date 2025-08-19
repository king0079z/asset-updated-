import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  AlertTriangle, 
  ShoppingCart, 
  ChefHat, 
  Trash2, 
  DollarSign,
  TrendingUp,
  FileText,
  Calendar,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/contexts/TranslationContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EnhancedRecipeManagementDialog } from './EnhancedRecipeManagementDialog';

interface ForecastItem {
  id: string;
  name: string;
  currentStock: number;
  unit: string;
  forecastedDemand: number;
  suggestedOrder: number;
  daysUntilDepletion: number;
  category: string;
  pricePerUnit: number;
  totalCost: number;
  linkedRecipes?: string[];
  wastePercentage?: number;
}

interface RecipeData {
  id: string;
  name: string;
  usageCount: number;
  totalCost: number;
  forecastQty: number;
  forecastCost: number;
  lastUsed: string | null;
  ingredientCount: number;
  ingredients: { name: string; quantity: number; unit: string }[];
}

interface WasteData {
  reason: string;
  cost: number;
  quantity: number;
  percentage: number;
}

interface ForecastTotals {
  forecastCost: number;
  forecastQty: number;
  wasteCost: number;
  wasteQty: number;
}

export function EnhancedForecastingCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [forecastItems, setForecastItems] = useState<ForecastItem[]>([]);
  const [criticalItems, setCriticalItems] = useState<ForecastItem[]>([]);
  const [recipeData, setRecipeData] = useState<RecipeData[]>([]);
  const [wasteData, setWasteData] = useState<WasteData[]>([]);
  const [totals, setTotals] = useState<ForecastTotals>({
    forecastCost: 0,
    forecastQty: 0,
    wasteCost: 0,
    wasteQty: 0
  });
  const [showRecipeDialog, setShowRecipeDialog] = useState(false);

  const fetchForecastData = async () => {
    setIsLoading(true);
    setIsRefreshing(true);
    
    try {
      // Use our dedicated forecast API endpoint with proper headers
      const response = await fetch('/api/food-supply/forecast', {
        method: 'GET',
        credentials: 'include', // Include cookies in the request
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        let errorMessage = 'Failed to fetch forecast data';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If parsing JSON fails, use the default error message
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Log the data to debug
      console.log('Forecast API response:', data);
      console.log('Totals from API:', data.totals);
      
      // Update state with the fetched data with fallbacks for missing data
      setForecastItems(data.inventory || []);
      setCriticalItems(data.criticalItems || []);
      setRecipeData(data.recipes || []);
      setWasteData(data.wasteData || []);
      
      // Ensure totals are properly set with fallbacks
      const apiTotals = data.totals || {};
      
      // Convert values to numbers and ensure they're not NaN, null, or undefined
      // Use Number() instead of parseFloat to handle numeric values more reliably
      const forecastCost = Number(apiTotals.forecastCost);
      const forecastQty = Number(apiTotals.forecastQty);
      const wasteCost = Number(apiTotals.wasteCost);
      const wasteQty = Number(apiTotals.wasteQty);
      
      // Set the totals with the parsed values, ensuring they're valid numbers
      setTotals({
        forecastCost: isNaN(forecastCost) ? 0 : forecastCost,
        forecastQty: isNaN(forecastQty) ? 0 : forecastQty,
        wasteCost: isNaN(wasteCost) ? 0 : wasteCost,
        wasteQty: isNaN(wasteQty) ? 0 : wasteQty
      });
      
      // Log the totals that will be displayed
      console.log('Totals being set:', {
        forecastCost,
        forecastQty,
        wasteCost,
        wasteQty
      });
      
      toast({
        title: t('forecast_updated'),
        description: t('forecast_data_refreshed'),
      });
    } catch (error) {
      console.error('Error fetching forecast data:', error);
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_load_forecasting_data'),
        variant: "destructive",
      });
      
      // Fallback to mock data if API fails
      generateMockData();
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchForecastData();
    
    // Set up an event listener for consumption updates
    const handleConsumptionUpdate = (event: Event) => {
      console.log('Received food-consumption-recorded event in EnhancedForecastingCard', event);
      // Add a longer delay to ensure the database has been updated
      setTimeout(() => {
        console.log('Refreshing forecast data after consumption event');
        fetchForecastData();
      }, 1500); // Increased delay to 1.5 seconds
    };
    
    // Add the event listener
    window.addEventListener('food-consumption-recorded', handleConsumptionUpdate);
    
    // Clean up the event listener when the component unmounts
    return () => {
      console.log('Removing food-consumption-recorded event listener');
      window.removeEventListener('food-consumption-recorded', handleConsumptionUpdate);
    };
  }, []);

  // Generate mock data as fallback
  const generateMockData = () => {
    // Generate mock forecast items
    const mockForecastItems = [];
    const categories = ['dairy', 'meat', 'vegetables', 'fruits', 'grains', 'beverages'];
    
    for (let i = 0; i < 10; i++) {
      const currentStock = Math.floor(Math.random() * 100) + 10;
      const forecastedDemand = Math.floor(Math.random() * 150) + 20;
      const suggestedOrder = Math.max(0, forecastedDemand - currentStock);
      const pricePerUnit = Math.floor(Math.random() * 50) + 5;
      const totalCost = suggestedOrder * pricePerUnit;
      const daysUntilDepletion = Math.floor(currentStock / (forecastedDemand / 30));
      
      mockForecastItems.push({
        id: `item-${i}`,
        name: `Food Item ${i + 1}`,
        currentStock,
        unit: i % 2 === 0 ? 'kg' : 'units',
        forecastedDemand,
        suggestedOrder,
        daysUntilDepletion,
        category: categories[Math.floor(Math.random() * categories.length)],
        pricePerUnit,
        totalCost,
        linkedRecipes: [`Recipe ${i % 5 + 1}`, `Recipe ${(i + 2) % 5 + 1}`],
        wastePercentage: Math.random() * 15
      });
    }
    
    // Generate mock recipe data
    const mockRecipeData = [];
    for (let i = 0; i < 5; i++) {
      const usageCount = Math.floor(Math.random() * 20) + 1;
      const ingredients = [];
      let totalCost = 0;
      
      for (let j = 0; j < 3; j++) {
        const quantity = Math.floor(Math.random() * 5) + 1;
        const pricePerUnit = Math.floor(Math.random() * 20) + 5;
        totalCost += quantity * pricePerUnit;
        
        ingredients.push({
          name: `Ingredient ${j + 1}`,
          quantity,
          unit: j % 2 === 0 ? 'kg' : 'units'
        });
      }
      
      mockRecipeData.push({
        id: `recipe-${i}`,
        name: `Recipe ${i + 1}`,
        usageCount,
        totalCost,
        forecastQty: Math.floor(Math.random() * 10) + 1,
        forecastCost: totalCost * (Math.floor(Math.random() * 10) + 1),
        lastUsed: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        ingredientCount: ingredients.length,
        ingredients
      });
    }
    
    // Generate mock waste data
    const mockWasteData = [];
    const reasons = ['expired', 'damaged', 'quality_issues', 'overproduction', 'other'];
    let totalWasteCost = 0;
    
    for (const reason of reasons) {
      const cost = Math.floor(Math.random() * 1000) + 100;
      totalWasteCost += cost;
      
      mockWasteData.push({
        reason,
        cost,
        quantity: Math.floor(Math.random() * 50) + 5,
        percentage: 0 // Will be calculated below
      });
    }
    
    // Calculate percentages for waste data
    mockWasteData.forEach(item => {
      item.percentage = (item.cost / totalWasteCost) * 100;
    });
    
    // Calculate mock totals
    const mockTotals = {
      forecastCost: mockForecastItems.reduce((sum, item) => sum + item.totalCost, 0),
      forecastQty: mockForecastItems.reduce((sum, item) => sum + item.suggestedOrder, 0),
      wasteCost: totalWasteCost,
      wasteQty: mockWasteData.reduce((sum, item) => sum + item.quantity, 0)
    };
    
    // Sort critical items by days until depletion
    const mockCriticalItems = [...mockForecastItems]
      .sort((a, b) => a.daysUntilDepletion - b.daysUntilDepletion)
      .filter(item => item.daysUntilDepletion < 14);
    
    // Update state with mock data
    setForecastItems(mockForecastItems);
    setCriticalItems(mockCriticalItems);
    setRecipeData(mockRecipeData);
    setWasteData(mockWasteData);
    setTotals(mockTotals);
  };

  // Generate order list
  const handleGenerateOrderList = () => {
    toast({
      title: t('order_list_generated'),
      description: t('order_list_generated_description'),
    });
  };

  // Sort recipes by usage count (descending)
  const topRecipes = [...recipeData].sort((a, b) => b.usageCount - a.usageCount);

  return (
    <>
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl">{t('inventory_forecasting')}</CardTitle>
              <CardDescription>{t('ai_powered_inventory_predictions')}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={fetchForecastData}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {t('refresh_forecast')}
              </Button>
              <Button variant="outline" onClick={() => {
                toast({
                  title: t('forecast_report_generated'),
                  description: t('forecast_report_generated_description'),
                });
              }}>
                <FileText className="h-4 w-4 mr-2" />
                {t('generate_report')}
              </Button>
              <Button onClick={handleGenerateOrderList}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                {t('generate_order_list')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Key Metrics Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">{t('forecast_cost')}</h3>
                      <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                      QAR {(totals?.forecastCost || 0).toFixed(2)}
                    </div>
                    <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
                      {t('estimated_budget_needed')}
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-green-800 dark:text-green-300">{t('forecast_quantity')}</h3>
                      <ShoppingCart className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="text-2xl font-bold text-green-800 dark:text-green-300">
                      {Math.round(totals?.forecastQty || 0)} {t('units')}
                    </div>
                    <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-1">
                      {t('total_items_to_order')}
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-purple-800 dark:text-purple-300">{t('recipe_impact')}</h3>
                      <ChefHat className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-purple-800 dark:text-purple-300">
                      {recipeData.length} {t('recipes')}
                    </div>
                    <p className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-1">
                      {t('active_recipes_in_system')}
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-300">{t('waste_cost')}</h3>
                      <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="text-2xl font-bold text-red-800 dark:text-red-300">
                      QAR {(totals?.wasteCost || 0).toFixed(2)}
                    </div>
                    <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                      {t('total_waste_value')}
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              <Tabs defaultValue="forecast" className="space-y-4">
                <TabsList className="grid grid-cols-3 mb-4">
                  <TabsTrigger value="forecast">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    {t('forecast')}
                  </TabsTrigger>
                  <TabsTrigger value="recipes">
                    <ChefHat className="h-4 w-4 mr-2" />
                    {t('recipes')}
                  </TabsTrigger>
                  <TabsTrigger value="waste">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('waste')}
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="forecast" className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5" />
                      <h3 className="font-medium">{t('inventory_forecast')}</h3>
                    </div>
                    <p className="text-sm">{t('items_requiring_attention_based_on_consumption_patterns')}</p>
                  </div>
                  
                  <div className="space-y-3">
                    {criticalItems.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {t('no_critical_items')}
                      </div>
                    ) : (
                      criticalItems.map(item => (
                        <div key={item.id} className="border rounded-md p-4 hover:bg-accent/50 transition-colors">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-medium">{item.name}</h4>
                              <div className="flex gap-2 mt-1">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                  {item.currentStock} {item.unit} {t('in_stock')}
                                </Badge>
                                <Badge variant="outline" className={
                                  item.daysUntilDepletion < 7 
                                    ? "bg-red-50 text-red-700" 
                                    : "bg-amber-50 text-amber-700"
                                }>
                                  {t('depletes_in')} {item.daysUntilDepletion} {t('days')}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">{t('suggested_order')}</p>
                              <p className="font-bold">{item.suggestedOrder} {item.unit}</p>
                              <p className="text-sm text-green-600">QAR {item.totalCost?.toFixed(2) || '0.00'}</p>
                            </div>
                          </div>
                          {item.linkedRecipes && item.linkedRecipes.length > 0 && (
                            <div className="mt-2 text-sm">
                              <span className="text-muted-foreground">{t('used_in_recipes')}: </span>
                              <span className="font-medium">{item.linkedRecipes.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  
                  <div className="flex justify-end mt-4">
                    <Button variant="outline" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      {t('view_all_items')}
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="recipes" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="bg-purple-50 border border-purple-200 rounded-md p-4 text-purple-800 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <ChefHat className="h-5 w-5" />
                        <h3 className="font-medium">{t('recipe_impact_analysis')}</h3>
                      </div>
                      <p className="text-sm">{t('how_recipes_affect_inventory_and_costs')}</p>
                    </div>
                    <div className="ml-4">
                      <Button 
                        variant="outline" 
                        className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
                        onClick={() => setShowRecipeDialog(true)}
                      >
                        <ChefHat className="h-4 w-4 mr-2" />
                        {t('manage_recipes')}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <Card className="border-purple-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t('most_used_recipes')}</CardTitle>
                      </CardHeader><CardContent>
                        <ScrollArea className="h-[200px] pr-4">
                          <div className="space-y-3">
                            {topRecipes.length === 0 ? (
                              <div className="text-center py-4 text-muted-foreground">
                                {t('no_recipes_found')}
                              </div>
                            ) : (
                              topRecipes.map(recipe => (
                                <div key={recipe.id} className="border rounded-md p-3 hover:bg-accent/50 transition-colors">
                                  <div className="flex justify-between items-center">
                                    <h5 className="font-medium">{recipe.name}</h5>
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700">
                                      {recipe.usageCount} {t('uses')}
                                    </Badge>
                                  </div>
                                  <div className="mt-2 text-sm">
                                    <span className="text-muted-foreground">{t('forecast')}: </span>
                                    <span className="font-medium">{recipe.forecastQty} {t('uses')} - QAR {recipe.forecastCost?.toFixed(2) || '0.00'}</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-green-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t('recipe_ingredients_impact')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {topRecipes.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground">
                              {t('no_recipes_found')}
                            </div>
                          ) : (
                            <>
                              {topRecipes.length > 0 && (
                                <div key={topRecipes[0].id} className="border rounded-md p-3">
                                  <h5 className="font-medium mb-2">{topRecipes[0].name} {t('ingredients')}</h5>
                                  <div className="space-y-2">
                                    {topRecipes[0].ingredients && topRecipes[0].ingredients.map((ing, idx) => (
                                      <div key={idx} className="flex justify-between items-center">
                                        <span className="text-sm">{ing.name}</span>
                                        <Badge variant="outline" className="bg-green-50 text-green-700">
                                          {ing.quantity} {ing.unit}
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-3 pt-2 border-t">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm font-medium">{t('total_cost')}</span>
                                      <span className="font-bold text-green-700">QAR {topRecipes[0].totalCost?.toFixed(2) || '0.00'}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-800">
                                <h5 className="font-medium mb-1">{t('recipe_optimization_tip')}</h5>
                                <p className="text-xs">
                                  {t('recipe_optimization_description')}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                <TabsContent value="waste" className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Trash2 className="h-5 w-5" />
                      <h3 className="font-medium">{t('waste_analysis')}</h3>
                    </div>
                    <p className="text-sm">{t('analyze_food_waste_patterns_and_costs')}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-red-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t('waste_by_reason')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {wasteData.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground">
                              {t('no_waste_data')}
                            </div>
                          ) : (
                            wasteData.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${
                                    item.reason === 'expired' ? 'bg-red-500' :
                                    item.reason === 'damaged' ? 'bg-amber-500' :
                                    item.reason === 'quality_issues' ? 'bg-orange-500' :
                                    item.reason === 'overproduction' ? 'bg-blue-500' :
                                    'bg-gray-500'
                                  }`}></div>
                                  <span className="text-sm">{t(item.reason)}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="bg-red-50 text-red-700">
                                    {item.percentage?.toFixed(1) || '0.0'}%
                                  </Badge>
                                  <span className="font-medium text-red-700">QAR {item.cost?.toFixed(2) || '0.00'}</span>
                                </div>
                              </div>
                            ))
                          )}
                          
                          {wasteData.length > 0 && (
                            <div className="mt-2 pt-2 border-t">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{t('total_waste')}</span>
                                <span className="font-bold text-red-700">QAR {totals?.wasteCost?.toFixed(2) || '0.00'}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-amber-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t('waste_reduction_opportunities')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="border rounded-md p-3 bg-amber-50">
                            <h5 className="font-medium mb-1">{t('expired_items')}</h5>
                            <p className="text-xs text-amber-800 mb-2">
                              {t('expired_items_waste_description')}
                            </p>
                            <Badge variant="outline" className="bg-red-50 text-red-700">
                              {t('potential_savings')}: QAR {((totals?.wasteCost || 0) * 0.45).toFixed(2)}
                            </Badge>
                          </div>
                          
                          <div className="border rounded-md p-3 bg-blue-50">
                            <h5 className="font-medium mb-1">{t('overproduction')}</h5>
                            <p className="text-xs text-blue-800 mb-2">
                              {t('overproduction_waste_description')}
                            </p>
                            <Badge variant="outline" className="bg-blue-100 text-blue-700">
                              {t('potential_savings')}: QAR {((totals?.wasteCost || 0) * 0.3).toFixed(2)}
                            </Badge>
                          </div>
                          
                          <div className="border rounded-md p-3 bg-green-50">
                            <h5 className="font-medium mb-1">{t('ai_recommendation')}</h5>
                            <p className="text-xs text-green-800">
                              {t('waste_ai_recommendation')}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Recipe Management Dialog */}
      {showRecipeDialog && (
        <EnhancedRecipeManagementDialog 
          open={showRecipeDialog} 
          onOpenChange={setShowRecipeDialog}
          onRecipeSaved={() => {
            // Refresh forecast data when a recipe is saved
            fetchForecastData();
          }}
        />
      )}
    </>
  );
}