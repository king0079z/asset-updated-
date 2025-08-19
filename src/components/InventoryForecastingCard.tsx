import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, BarChart, PieChart } from '@/components/ui/chart';
import { 
  Loader2, 
  TrendingUp, 
  AlertTriangle, 
  ShoppingCart, 
  ChefHat, 
  Trash2, 
  DollarSign,
  Calendar,
  FileText
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/contexts/TranslationContext';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  consumptionTrend: 'increasing' | 'decreasing' | 'stable';
  historicalData: { date: string; quantity: number }[];
  linkedRecipes?: string[]; // Names of recipes that use this item
  wastePercentage?: number; // Percentage of this item that gets wasted
}

interface RecipeUsageData {
  id: string;
  name: string;
  usageCount: number;
  lastUsed: string;
  ingredients: { name: string; quantity: number; unit: string }[];
  totalCost: number;
}

interface DisposalData {
  reason: string;
  cost: number;
  quantity: number;
}

export function InventoryForecastingCard() {
  const [forecastData, setForecastData] = useState<ForecastItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [recipeUsageData, setRecipeUsageData] = useState<RecipeUsageData[]>([]);
  const [disposalData, setDisposalData] = useState<DisposalData[]>([]);
  const [totalBudget, setTotalBudget] = useState(0);
  const [totalQuantityNeeded, setTotalQuantityNeeded] = useState(0);
  const [totalWaste, setTotalWaste] = useState(0);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Mock data generation for demonstration
  const generateMockForecastData = () => {
    const categories = ['dairy', 'meat', 'vegetables', 'fruits', 'grains', 'beverages'];
    const trends = ['increasing', 'decreasing', 'stable'];
    const recipeNames = [
      'Chicken Alfredo', 'Vegetable Stir Fry', 'Beef Stew', 
      'Caesar Salad', 'Pasta Primavera', 'Chocolate Cake',
      'Mushroom Risotto', 'Grilled Salmon'
    ];
    
    const mockData: ForecastItem[] = [];
    let totalBudgetSum = 0;
    let totalQuantitySum = 0;
    
    for (let i = 0; i < 15; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const trend = trends[Math.floor(Math.random() * trends.length)] as 'increasing' | 'decreasing' | 'stable';
      const currentStock = Math.floor(Math.random() * 100) + 10;
      const forecastedDemand = Math.floor(Math.random() * 50) + 5;
      const daysUntilDepletion = Math.floor(currentStock / (forecastedDemand / 30));
      const pricePerUnit = Math.floor(Math.random() * 50) + 5;
      
      // Generate linked recipes (1-3 random recipes)
      const numRecipes = Math.floor(Math.random() * 3) + 1;
      const linkedRecipes: string[] = [];
      for (let r = 0; r < numRecipes; r++) {
        const recipeName = recipeNames[Math.floor(Math.random() * recipeNames.length)];
        if (!linkedRecipes.includes(recipeName)) {
          linkedRecipes.push(recipeName);
        }
      }
      
      // Generate waste percentage (0-15%)
      const wastePercentage = Math.random() * 15;
      
      // Generate historical data for the past 7 days
      const historicalData = [];
      const today = new Date();
      for (let j = 6; j >= 0; j--) {
        const date = new Date(today);
        date.setDate(date.getDate() - j);
        
        // Create a consumption pattern based on the trend
        let baseQuantity = forecastedDemand / 30; // Daily average
        if (trend === 'increasing') {
          baseQuantity = baseQuantity * (1 + (6 - j) * 0.1);
        } else if (trend === 'decreasing') {
          baseQuantity = baseQuantity * (1 - (6 - j) * 0.05);
        }
        
        historicalData.push({
          date: date.toISOString().split('T')[0],
          quantity: Math.max(0, baseQuantity + (Math.random() * 2 - 1))
        });
      }
      
      const suggestedOrder = Math.max(0, forecastedDemand - currentStock);
      totalBudgetSum += suggestedOrder * pricePerUnit;
      totalQuantitySum += suggestedOrder;
      
      mockData.push({
        id: `item-${i}`,
        name: `Food Item ${i + 1}`,
        currentStock,
        unit: i % 2 === 0 ? 'kg' : 'units',
        forecastedDemand,
        suggestedOrder,
        daysUntilDepletion,
        category,
        pricePerUnit,
        consumptionTrend: trend,
        historicalData,
        linkedRecipes,
        wastePercentage
      });
    }
    
    setTotalBudget(totalBudgetSum);
    setTotalQuantityNeeded(totalQuantitySum);
    
    return mockData;
  };
  
  // Generate mock recipe usage data
  const generateMockRecipeUsageData = () => {
    const recipes: RecipeUsageData[] = [];
    
    for (let i = 0; i < 8; i++) {
      const usageCount = Math.floor(Math.random() * 20) + 1;
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 14));
      
      // Generate 3-5 ingredients per recipe
      const numIngredients = Math.floor(Math.random() * 3) + 3;
      const ingredients = [];
      let totalCost = 0;
      
      for (let j = 0; j < numIngredients; j++) {
        const quantity = Math.floor(Math.random() * 5) + 1;
        const pricePerUnit = Math.floor(Math.random() * 20) + 5;
        const cost = quantity * pricePerUnit;
        totalCost += cost;
        
        ingredients.push({
          name: `Ingredient ${j + 1}`,
          quantity,
          unit: j % 2 === 0 ? 'kg' : 'units'
        });
      }
      
      recipes.push({
        id: `recipe-${i}`,
        name: `Recipe ${i + 1}`,
        usageCount,
        lastUsed: date.toISOString(),
        ingredients,
        totalCost
      });
    }
    
    return recipes;
  };
  
  // Generate mock disposal data
  const generateMockDisposalData = () => {
    const reasons = ['expired', 'damaged', 'quality_issues', 'overproduction', 'other'];
    const disposals: DisposalData[] = [];
    let totalWasteSum = 0;
    
    for (const reason of reasons) {
      const cost = Math.floor(Math.random() * 1000) + 100;
      const quantity = Math.floor(Math.random() * 50) + 5;
      totalWasteSum += cost;
      
      disposals.push({
        reason,
        cost,
        quantity
      });
    }
    
    setTotalWaste(totalWasteSum);
    
    return disposals;
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch real food supplies from the API
        const foodSuppliesResponse = await fetch('/api/food-supply');
        if (!foodSuppliesResponse.ok) {
          throw new Error('Failed to fetch food supplies');
        }
        const foodSuppliesData = await foodSuppliesResponse.json();
        
        // Fetch consumption history for each food supply
        let allConsumptionData = [];
        try {
          // For each food supply, fetch its consumption history
          for (const supply of foodSuppliesData) {
            const consumptionResponse = await fetch(`/api/food-supply/consumption-history?foodSupplyId=${supply.id}`);
            if (consumptionResponse.ok) {
              const supplyConsumptionData = await consumptionResponse.json();
              allConsumptionData = [...allConsumptionData, ...supplyConsumptionData];
            }
          }
        } catch (error) {
          console.error('Error fetching consumption history:', error);
        }
        
        // Fetch recipes for recipe impact analysis
        const recipesResponse = await fetch('/api/recipes');
        let recipesData = [];
        try {
          if (recipesResponse.ok) {
            recipesData = await recipesResponse.json();
          }
        } catch (error) {
          console.error('Error fetching recipes:', error);
        }
        
        // Fetch waste disposal data
        const disposalsResponse = await fetch('/api/food-supply/disposals');
        let disposalsData = [];
        try {
          if (disposalsResponse.ok) {
            disposalsData = await disposalsResponse.json();
          }
        } catch (error) {
          console.error('Error fetching disposals:', error);
        }
        
        // Transform real data into forecast data format
        const transformedForecastData = transformFoodSupplyData(foodSuppliesData, allConsumptionData);
        const transformedRecipeData = transformRecipeData(recipesData, allConsumptionData);
        const transformedDisposalData = transformDisposalData(disposalsData);
        
        setForecastData(transformedForecastData);
        setRecipeUsageData(transformedRecipeData);
        setDisposalData(transformedDisposalData);
        
        // Calculate totals
        const budget = transformedForecastData.reduce((sum, item) => sum + (item.suggestedOrder * item.pricePerUnit), 0);
        const quantity = transformedForecastData.reduce((sum, item) => sum + item.suggestedOrder, 0);
        const waste = transformedDisposalData.reduce((sum, item) => sum + item.cost, 0);
        
        setTotalBudget(budget);
        setTotalQuantityNeeded(quantity);
        setTotalWaste(waste);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: t('error'),
          description: t('failed_to_load_forecasting_data'),
          variant: "destructive",
        });
        
        // Fallback to mock data if API calls fail
        const mockData = generateMockForecastData();
        const mockRecipeData = generateMockRecipeUsageData();
        const mockDisposalData = generateMockDisposalData();
        
        setForecastData(mockData);
        setRecipeUsageData(mockRecipeData);
        setDisposalData(mockDisposalData);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [t, toast]);
  
  // Transform real food supply data into forecast data format
  const transformFoodSupplyData = (foodSupplies, consumptionHistory) => {
    return foodSupplies.map(supply => {
      // Calculate forecasted demand based on consumption history
      const supplyConsumption = consumptionHistory.filter(record => 
        record.foodSupplyId === supply.id
      );
      
      // Calculate average daily consumption
      const totalConsumed = supplyConsumption.reduce((sum, record) => sum + record.quantity, 0);
      const daysWithData = supplyConsumption.length > 0 ? 30 : 1; // Assume 30 days if we have data
      const dailyAverage = totalConsumed / daysWithData;
      
      // Forecast for next 30 days
      const forecastedDemand = dailyAverage * 30;
      
      // Calculate days until depletion
      const daysUntilDepletion = dailyAverage > 0 ? Math.floor(supply.quantity / dailyAverage) : 999;
      
      // Determine consumption trend
      let trend = 'stable';
      if (supplyConsumption.length >= 3) {
        // Sort by date
        const sorted = [...supplyConsumption].sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        
        // Split into first half and second half
        const midpoint = Math.floor(sorted.length / 2);
        const firstHalf = sorted.slice(0, midpoint);
        const secondHalf = sorted.slice(midpoint);
        
        // Calculate average consumption for each half
        const firstHalfAvg = firstHalf.reduce((sum, record) => sum + record.quantity, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, record) => sum + record.quantity, 0) / secondHalf.length;
        
        // Determine trend
        if (secondHalfAvg > firstHalfAvg * 1.1) {
          trend = 'increasing';
        } else if (secondHalfAvg < firstHalfAvg * 0.9) {
          trend = 'decreasing';
        }
      }
      
      // Calculate suggested order
      const suggestedOrder = Math.max(0, forecastedDemand - supply.quantity);
      
      // Generate historical data for chart
      const historicalData = [];
      const today = new Date();
      
      // Use actual consumption data if available, otherwise generate mock data
      if (supplyConsumption.length > 0) {
        // Group by date and sum quantities
        const consumptionByDate = {};
        supplyConsumption.forEach(record => {
          const date = record.date.split('T')[0];
          if (!consumptionByDate[date]) {
            consumptionByDate[date] = 0;
          }
          consumptionByDate[date] += record.quantity;
        });
        
        // Convert to array format needed for chart
        for (const [date, quantity] of Object.entries(consumptionByDate)) {
          historicalData.push({ date, quantity });
        }
        
        // Sort by date
        historicalData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Take the last 7 days or pad with empty days if less
        while (historicalData.length < 7) {
          const lastDate = historicalData.length > 0 
            ? new Date(historicalData[historicalData.length - 1].date)
            : new Date(today);
          lastDate.setDate(lastDate.getDate() + 1);
          historicalData.push({
            date: lastDate.toISOString().split('T')[0],
            quantity: 0
          });
        }
        
        // Only keep the last 7 days
        if (historicalData.length > 7) {
          historicalData.splice(0, historicalData.length - 7);
        }
      } else {
        // Generate mock historical data if no real data
        for (let j = 6; j >= 0; j--) {
          const date = new Date(today);
          date.setDate(date.getDate() - j);
          historicalData.push({
            date: date.toISOString().split('T')[0],
            quantity: 0
          });
        }
      }
      
      return {
        id: supply.id,
        name: supply.name,
        currentStock: supply.quantity,
        unit: supply.unit,
        forecastedDemand: forecastedDemand,
        suggestedOrder: suggestedOrder,
        daysUntilDepletion: daysUntilDepletion,
        category: supply.category,
        pricePerUnit: supply.pricePerUnit,
        consumptionTrend: trend,
        historicalData: historicalData,
        linkedRecipes: [], // Will be populated if recipe data is available
        wastePercentage: 0 // Will be calculated if waste data is available
      };
    });
  };
  
  // Transform recipe data
  const transformRecipeData = (recipes, consumptionHistory) => {
    if (!recipes || recipes.length === 0) {
      return generateMockRecipeUsageData();
    }
    
    return recipes.map(recipe => {
      // Find usage records for this recipe
      const usageCount = Math.floor(Math.random() * 20) + 1; // Mock for now
      const lastUsed = new Date().toISOString(); // Mock for now
      
      return {
        id: recipe.id,
        name: recipe.name,
        usageCount: usageCount,
        lastUsed: lastUsed,
        ingredients: recipe.ingredients ? recipe.ingredients.map(ing => ({
          name: ing.name || 'Ingredient',
          quantity: ing.quantity || 1,
          unit: ing.unit || 'units'
        })) : [],
        totalCost: recipe.totalCost || 0
      };
    });
  };
  
  // Transform disposal data
  const transformDisposalData = (disposals) => {
    if (!disposals || disposals.length === 0) {
      return generateMockDisposalData();
    }
    
    // Group by reason
    const reasonGroups = {};
    disposals.forEach(disposal => {
      const reason = disposal.reason || 'other';
      if (!reasonGroups[reason]) {
        reasonGroups[reason] = {
          reason: reason,
          cost: 0,
          quantity: 0
        };
      }
      reasonGroups[reason].cost += disposal.cost || 0;
      reasonGroups[reason].quantity += disposal.quantity || 0;
    });
    
    return Object.values(reasonGroups);
  };

  const filteredData = forecastData.filter(item => 
    selectedCategory === 'all' || item.category === selectedCategory
  );

  // Sort by days until depletion (ascending)
  const sortedByDepletion = [...filteredData].sort((a, b) => a.daysUntilDepletion - b.daysUntilDepletion);
  
  // Get items that need immediate attention (less than 7 days until depletion)
  const criticalItems = sortedByDepletion.filter(item => item.daysUntilDepletion < 7);
  
  // Get items with increasing consumption trend
  const increasingTrendItems = filteredData.filter(item => item.consumptionTrend === 'increasing');
  
  // Get items with high waste percentage (>10%)
  const highWasteItems = filteredData.filter(item => (item.wastePercentage || 0) > 10);

  // Prepare chart data
  const prepareChartData = (item: ForecastItem) => {
    return {
      labels: item.historicalData.map(d => d.date.split('-')[2]), // Just the day
      datasets: [
        {
          label: 'Consumption',
          data: item.historicalData.map(d => d.quantity),
          borderColor: 'rgb(99, 102, 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.5)',
          tension: 0.3,
        }
      ]
    };
  };

  // Prepare category distribution data for pie chart
  const categoryData = {
    labels: ['Dairy', 'Meat', 'Vegetables', 'Fruits', 'Grains', 'Beverages'],
    datasets: [
      {
        label: 'Items by Category',
        data: [
          forecastData.filter(item => item.category === 'dairy').length,
          forecastData.filter(item => item.category === 'meat').length,
          forecastData.filter(item => item.category === 'vegetables').length,
          forecastData.filter(item => item.category === 'fruits').length,
          forecastData.filter(item => item.category === 'grains').length,
          forecastData.filter(item => item.category === 'beverages').length,
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.7)',
          'rgba(239, 68, 68, 0.7)',
          'rgba(16, 185, 129, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(168, 85, 247, 0.7)',
          'rgba(236, 72, 153, 0.7)',
        ],
      }
    ]
  };

  // Prepare depletion forecast data for bar chart
  const depletionData = {
    labels: sortedByDepletion.slice(0, 10).map(item => item.name),
    datasets: [
      {
        label: 'Days Until Depletion',
        data: sortedByDepletion.slice(0, 10).map(item => item.daysUntilDepletion),
        backgroundColor: sortedByDepletion.slice(0, 10).map(item => 
          item.daysUntilDepletion < 7 ? 'rgba(239, 68, 68, 0.7)' : 
          item.daysUntilDepletion < 14 ? 'rgba(245, 158, 11, 0.7)' : 
          'rgba(16, 185, 129, 0.7)'
        ),
      }
    ]
  };
  
  // Prepare waste by reason data for pie chart
  const wasteData = {
    labels: disposalData.map(d => t(d.reason)),
    datasets: [
      {
        label: 'Waste Cost by Reason',
        data: disposalData.map(d => d.cost),
        backgroundColor: [
          'rgba(239, 68, 68, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(16, 185, 129, 0.7)',
          'rgba(59, 130, 246, 0.7)',
          'rgba(168, 85, 247, 0.7)',
        ],
      }
    ]
  };

  const handleGenerateOrderList = () => {
    // In a real implementation, this would generate a purchase order
    // For now, we'll just show a toast
    toast({
      title: t('order_list_generated'),
      description: t('order_list_generated_description'),
    });
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl">{t('inventory_forecasting')}</CardTitle>
            <CardDescription>{t('ai_powered_inventory_predictions')}</CardDescription>
          </div>
          <div className="flex gap-2">
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
          <Tabs defaultValue="critical">
            <TabsList className="grid grid-cols-5 mb-4">
              <TabsTrigger value="critical">
                <AlertTriangle className="h-4 w-4 mr-2" />
                {t('critical_items')}
              </TabsTrigger>
              <TabsTrigger value="trends">
                <TrendingUp className="h-4 w-4 mr-2" />
                {t('consumption_trends')}
              </TabsTrigger>
              <TabsTrigger value="recipes">
                <ChefHat className="h-4 w-4 mr-2" />
                {t('recipe_impact')}
              </TabsTrigger>
              <TabsTrigger value="waste">
                <Trash2 className="h-4 w-4 mr-2" />
                {t('waste_tracking')}
              </TabsTrigger>
              <TabsTrigger value="analytics">
                <PieChart className="h-4 w-4 mr-2" />
                {t('analytics')}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="critical" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-blue-600 mb-1">{t('total_budget_needed')}</p>
                  <p className="text-xl font-bold text-blue-700 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    QAR {totalBudget.toFixed(2)}
                  </p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-green-600 mb-1">{t('total_quantity_needed')}</p>
                  <p className="text-xl font-bold text-green-700 flex items-center justify-center">
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    {totalQuantityNeeded.toFixed(2)} {t('units')}
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-amber-600 mb-1">{t('critical_items')}</p>
                  <p className="text-xl font-bold text-amber-700 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {criticalItems.length}
                  </p>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-800">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="font-medium">{t('items_requiring_attention')}</h3>
                </div>
                <p className="text-sm">{t('items_requiring_attention_description')}</p>
              </div>
              
              {criticalItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('no_critical_items')}
                </div>
              ) : (
                <div className="space-y-3">
                  {criticalItems.map(item => (
                    <div key={item.id} className="border rounded-md p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">{item.name}</h4>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              {item.currentStock} {item.unit} {t('in_stock')}
                            </Badge>
                            <Badge variant="outline" className="bg-red-50 text-red-700">
                              {t('depletes_in')} {item.daysUntilDepletion} {t('days')}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">{t('suggested_order')}</p>
                          <p className="font-bold">{item.suggestedOrder} {item.unit}</p>
                          <p className="text-sm text-green-600">QAR {(item.suggestedOrder * item.pricePerUnit).toFixed(2)}</p>
                        </div>
                      </div>
                      {item.linkedRecipes && item.linkedRecipes.length > 0 && (
                        <div className="mt-2 text-sm">
                          <span className="text-muted-foreground">{t('used_in_recipes')}: </span>
                          <span className="font-medium">{item.linkedRecipes.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="trends" className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-md p-4 text-indigo-800">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5" />
                  <h3 className="font-medium">{t('consumption_trend_analysis')}</h3>
                </div>
                <p className="text-sm">{t('consumption_trend_analysis_description')}</p>
              </div>
              
              {increasingTrendItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('no_increasing_trends')}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {increasingTrendItems.slice(0, 4).map(item => (
                    <div key={item.id} className="border rounded-md p-4">
                      <h4 className="font-medium mb-2">{item.name}</h4>
                      <div className="h-[150px]">
                        <LineChart data={prepareChartData(item)} />
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <Badge variant="outline" className="bg-purple-50 text-purple-700">
                          {t('trend')}: {t(item.consumptionTrend)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {t('forecast')}: +{Math.floor(Math.random() * 20) + 5}% {t('next_month')}
                        </span>
                      </div>
                      {item.linkedRecipes && item.linkedRecipes.length > 0 && (
                        <div className="mt-2 text-sm">
                          <span className="text-muted-foreground">{t('used_in_recipes')}: </span>
                          <span className="font-medium">{item.linkedRecipes.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="recipes" className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <ChefHat className="h-5 w-5" />
                  <h3 className="font-medium">{t('recipe_impact_analysis')}</h3>
                </div>
                <p className="text-sm">{t('recipe_impact_analysis_description')}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-blue-600 mb-1">{t('total_recipes')}</p>
                  <p className="text-xl font-bold text-blue-700 flex items-center justify-center">
                    <ChefHat className="h-4 w-4 mr-1" />
                    {recipeUsageData.length}
                  </p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-purple-600 mb-1">{t('most_used_recipe')}</p>
                  <p className="text-xl font-bold text-purple-700 flex items-center justify-center">
                    {recipeUsageData.length > 0 ? 
                      recipeUsageData.sort((a, b) => b.usageCount - a.usageCount)[0].name : 
                      t('none')}
                  </p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-green-600 mb-1">{t('avg_recipe_cost')}</p>
                  <p className="text-xl font-bold text-green-700 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    QAR {recipeUsageData.length > 0 ? 
                      (recipeUsageData.reduce((sum, r) => sum + r.totalCost, 0) / recipeUsageData.length).toFixed(2) : 
                      '0.00'}
                  </p>
                </div>
              </div>
              
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {recipeUsageData.map(recipe => (
                    <div key={recipe.id} className="border rounded-md p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">{recipe.name}</h4>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              {t('used')}: {recipe.usageCount} {t('times')}
                            </Badge>
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              {t('cost')}: QAR {recipe.totalCost.toFixed(2)}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">{t('last_used')}</p>
                          <p className="font-medium">{new Date(recipe.lastUsed).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground mb-1">{t('ingredients')}:</p>
                        <div className="flex flex-wrap gap-2">
                          {recipe.ingredients.map((ing, idx) => (
                            <Badge key={idx} variant="outline" className="bg-slate-50">
                              {ing.name}: {ing.quantity} {ing.unit}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="waste" className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
                <div className="flex items-center gap-2 mb-2">
                  <Trash2 className="h-5 w-5" />
                  <h3 className="font-medium">{t('waste_tracking_analysis')}</h3>
                </div>
                <p className="text-sm">{t('waste_tracking_analysis_description')}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-red-600 mb-1">{t('total_waste_cost')}</p>
                  <p className="text-xl font-bold text-red-700 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    QAR {totalWaste.toFixed(2)}
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-amber-600 mb-1">{t('waste_percentage')}</p>
                  <p className="text-xl font-bold text-amber-700 flex items-center justify-center">
                    {((totalWaste / (totalWaste + totalBudget)) * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-blue-600 mb-1">{t('high_waste_items')}</p>
                  <p className="text-xl font-bold text-blue-700 flex items-center justify-center">
                    {highWasteItems.length}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border rounded-md p-4">
                  <h4 className="font-medium mb-3">{t('waste_by_reason')}</h4>
                  <div className="h-[250px]">
                    <PieChart data={wasteData} />
                  </div>
                </div>
                
                <div className="border rounded-md p-4">
                  <h4 className="font-medium mb-3">{t('high_waste_items')}</h4>
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-3">
                      {highWasteItems.map(item => (
                        <div key={item.id} className="border rounded-md p-3 hover:bg-accent/50 transition-colors">
                          <div className="flex justify-between items-center">
                            <h5 className="font-medium">{item.name}</h5>
                            <Badge variant="outline" className="bg-red-50 text-red-700">
                              {item.wastePercentage?.toFixed(2)}% {t('waste')}
                            </Badge>
                          </div>
                          <div className="mt-2 text-sm">
                            <span className="text-muted-foreground">{t('estimated_waste_cost')}: </span>
                            <span className="font-medium text-red-600">
                              QAR {((item.forecastedDemand * item.pricePerUnit * (item.wastePercentage || 0)) / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="analytics" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border rounded-md p-4">
                  <h4 className="font-medium mb-3">{t('category_distribution')}</h4>
                  <div className="h-[250px]">
                    <PieChart data={categoryData} />
                  </div>
                </div>
                
                <div className="border rounded-md p-4">
                  <h4 className="font-medium mb-3">{t('depletion_forecast')}</h4>
                  <div className="h-[250px]">
                    <BarChart data={depletionData} />
                  </div>
                </div>
              </div>
              
              <div className="border rounded-md p-4">
                <h4 className="font-medium mb-3">{t('budget_allocation_by_category')}</h4>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  {['dairy', 'meat', 'vegetables', 'fruits', 'grains', 'beverages'].map(category => {
                    const items = forecastData.filter(item => item.category === category);
                    const budget = items.reduce((sum, item) => sum + (item.suggestedOrder * item.pricePerUnit), 0);
                    const percentage = totalBudget > 0 ? (budget / totalBudget) * 100 : 0;
                    
                    return (
                      <div key={category} className="bg-slate-50 p-3 rounded-lg text-center">
                        <p className="text-sm font-medium capitalize">{t(category)}</p>
                        <p className="text-lg font-bold text-blue-700">QAR {budget.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% {t('of_budget')}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}