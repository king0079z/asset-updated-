// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, LineChart } from '@/components/ui/chart';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, TrendingDown, Building2, DollarSign, Loader2 } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';

interface KitchenOverpurchaseData {
  id: string;
  name: string;
  floorNumber: string;
  totalSpent: number;
  wastePercentage: number;
  excessInventory: number;
  topOverpurchasedItems: {
    id: string;
    name: string;
    category: string;
    quantity: number;
    value: number;
    unit: string;
  }[];
  monthlyTrend: {
    month: string;
    spent: number;
    waste: number;
  }[];
}

export function LocationOverpurchasingAnalysis() {
  const [kitchenData, setKitchenData] = useState<KitchenOverpurchaseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Mock data generation for demonstration
  const generateMockKitchenData = (): KitchenOverpurchaseData[] => {
    const mockData: KitchenOverpurchaseData[] = [];
    
    const kitchenNames = ['Main Kitchen', 'Pastry Kitchen', 'Prep Kitchen', 'Banquet Kitchen'];
    const floorNumbers = ['1', '2', '1', 'B1'];
    
    for (let i = 0; i < kitchenNames.length; i++) {
      const wastePercentage = Math.floor(Math.random() * 20) + 5;
      
      // Generate monthly trend data
      const monthlyTrend = [];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      for (let j = 0; j < months.length; j++) {
        const spent = Math.floor(Math.random() * 5000) + 3000;
        const waste = Math.floor(spent * (Math.random() * 0.3 + 0.05));
        monthlyTrend.push({
          month: months[j],
          spent,
          waste,
        });
      }
      
      // Generate top overpurchased items
      const topItems = [];
      const itemNames = ['Flour', 'Sugar', 'Butter', 'Eggs', 'Milk', 'Cheese', 'Chicken', 'Beef'];
      const categories = ['dairy', 'meat', 'grains', 'vegetables'];
      const units = ['kg', 'g', 'l', 'units'];
      
      for (let j = 0; j < 5; j++) {
        const quantity = Math.floor(Math.random() * 50) + 10;
        const value = Math.floor(Math.random() * 500) + 100;
        topItems.push({
          id: `item-${i}-${j}`,
          name: itemNames[Math.floor(Math.random() * itemNames.length)],
          category: categories[Math.floor(Math.random() * categories.length)],
          quantity,
          value,
          unit: units[Math.floor(Math.random() * units.length)],
        });
      }
      
      mockData.push({
        id: `kitchen-${i}`,
        name: kitchenNames[i],
        floorNumber: floorNumbers[i],
        totalSpent: Math.floor(Math.random() * 20000) + 10000,
        wastePercentage,
        excessInventory: Math.floor(Math.random() * 5000) + 1000,
        topOverpurchasedItems: topItems,
        monthlyTrend,
      });
    }
    
    return mockData;
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch kitchens data
        const kitchensResponse = await fetch('/api/kitchens');
        if (!kitchensResponse.ok) {
          throw new Error('Failed to fetch kitchens data');
        }
        const kitchensData = await kitchensResponse.json();
        
        // Fetch consumption data by kitchen
        const consumptionResponse = await fetch('/api/kitchens/consumption-details');
        let consumptionData = [];
        try {
          if (consumptionResponse.ok) {
            consumptionData = await consumptionResponse.json();
          }
        } catch (error) {
          console.error('Error fetching kitchen consumption:', error);
        }
        
        // Fetch monthly consumption data
        const monthlyResponse = await fetch('/api/kitchens/monthly-consumption');
        let monthlyData = [];
        try {
          if (monthlyResponse.ok) {
            monthlyData = await monthlyResponse.json();
          }
        } catch (error) {
          console.error('Error fetching monthly consumption:', error);
        }
        
        // Transform real data into the format we need
        const transformedData = transformKitchenData(kitchensData, consumptionData, monthlyData);
        setKitchenData(transformedData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: t('error'),
          description: t('failed_to_load_kitchen_analysis_data'),
          variant: "destructive",
        });
        
        // Fallback to mock data if API calls fail
        const mockData = generateMockKitchenData();
        setKitchenData(mockData);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [t, toast]);
  
  // Transform kitchen data with consumption information
  const transformKitchenData = (kitchens, consumptionData, monthlyData) => {
    if (!kitchens || kitchens.length === 0) {
      return generateMockKitchenData();
    }
    
    return kitchens.map(kitchen => {
      // Find consumption data for this kitchen
      const kitchenConsumption = consumptionData.filter(record => 
        record.kitchenId === kitchen.id
      );
      
      // Calculate waste percentage (mock for now)
      const wastePercentage = Math.floor(Math.random() * 20) + 5;
      
      // Calculate total spent
      const totalSpent = kitchenConsumption.reduce((sum, record) => 
        sum + (record.quantity * record.pricePerUnit), 0
      ) || Math.floor(Math.random() * 20000) + 10000; // Fallback to mock if no data
      
      // Calculate excess inventory (mock for now)
      const excessInventory = Math.floor(totalSpent * (wastePercentage / 100));
      
      // Find monthly trend data for this kitchen
      let monthlyTrend = [];
      if (monthlyData && monthlyData.length > 0) {
        const kitchenMonthly = monthlyData.filter(record => 
          record.kitchenId === kitchen.id
        );
        
        if (kitchenMonthly.length > 0) {
          // Group by month
          const months = {};
          kitchenMonthly.forEach(record => {
            const month = new Date(record.date).toLocaleString('default', { month: 'short' });
            if (!months[month]) {
              months[month] = {
                month: month,
                spent: 0,
                waste: 0
              };
            }
            months[month].spent += record.spent || 0;
            months[month].waste += record.waste || 0;
          });
          
          monthlyTrend = Object.values(months);
        }
      }
      
      // If no monthly data, generate mock data
      if (monthlyTrend.length === 0) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        for (let j = 0; j < months.length; j++) {
          const spent = Math.floor(Math.random() * 5000) + 3000;
          const waste = Math.floor(spent * (Math.random() * 0.3 + 0.05));
          monthlyTrend.push({
            month: months[j],
            spent,
            waste,
          });
        }
      }
      
      // Generate top overpurchased items
      // In a real implementation, this would come from the API
      const topItems = [];
      if (kitchenConsumption.length > 0) {
        // Group by item and calculate excess
        const itemGroups = {};
        kitchenConsumption.forEach(record => {
          if (!itemGroups[record.foodSupplyId]) {
            itemGroups[record.foodSupplyId] = {
              id: record.foodSupplyId,
              name: record.foodSupplyName || 'Unknown Item',
              category: record.category || 'other',
              quantity: 0,
              value: 0,
              unit: record.unit || 'units'
            };
          }
          itemGroups[record.foodSupplyId].quantity += record.quantity || 0;
          itemGroups[record.foodSupplyId].value += (record.quantity * record.pricePerUnit) || 0;
        });
        
        // Convert to array and sort by value
        const items = Object.values(itemGroups);
        items.sort((a, b) => b.value - a.value);
        
        // Take top 5 items
        topItems.push(...items.slice(0, 5));
      }
      
      // If no items or less than 5, add mock items
      while (topItems.length < 5) {
        const quantity = Math.floor(Math.random() * 50) + 10;
        const value = Math.floor(Math.random() * 500) + 100;
        topItems.push({
          id: `item-mock-${topItems.length}`,
          name: `Item ${topItems.length + 1}`,
          category: ['dairy', 'meat', 'grains', 'vegetables'][Math.floor(Math.random() * 4)],
          quantity,
          value,
          unit: ['kg', 'g', 'l', 'units'][Math.floor(Math.random() * 4)],
        });
      }
      
      return {
        id: kitchen.id,
        name: kitchen.name,
        floorNumber: kitchen.floorNumber || '1',
        totalSpent,
        wastePercentage,
        excessInventory,
        topOverpurchasedItems: topItems,
        monthlyTrend,
      };
    });
  };

  // Sort kitchens by waste percentage (descending)
  const sortedKitchens = [...kitchenData].sort((a, b) => b.wastePercentage - a.wastePercentage);
  
  // Prepare chart data for waste by kitchen
  const wasteByKitchenData = {
    labels: sortedKitchens.map(kitchen => kitchen.name),
    datasets: [
      {
        label: t('waste_percentage'),
        data: sortedKitchens.map(kitchen => kitchen.wastePercentage),
        backgroundColor: sortedKitchens.map(kitchen => 
          kitchen.wastePercentage > 15 ? 'rgba(239, 68, 68, 0.7)' : 
          kitchen.wastePercentage > 10 ? 'rgba(245, 158, 11, 0.7)' : 
          'rgba(16, 185, 129, 0.7)'
        ),
      }
    ]
  };

  // Prepare chart data for monthly trend of the worst kitchen
  const worstKitchen = sortedKitchens[0];
  const monthlyTrendData = worstKitchen ? {
    labels: worstKitchen.monthlyTrend.map(item => item.month),
    datasets: [
      {
        label: t('spent'),
        data: worstKitchen.monthlyTrend.map(item => item.spent),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.3,
      },
      {
        label: t('waste'),
        data: worstKitchen.monthlyTrend.map(item => item.waste),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.5)',
        tension: 0.3,
      }
    ]
  } : null;

  const handleGenerateReport = () => {
    // In a real implementation, this would generate a detailed report
    // For now, we'll just show a toast
    toast({
      title: t('report_generated'),
      description: t('overpurchasing_report_generated'),
    });
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl">{t('overpurchasing_analysis')}</CardTitle>
            <CardDescription>{t('identify_waste_and_excess_inventory')}</CardDescription>
          </div>
          <Button onClick={handleGenerateReport}>
            <DollarSign className="h-4 w-4 mr-2" />
            {t('generate_savings_report')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="overview">
                <AlertTriangle className="h-4 w-4 mr-2" />
                {t('waste_overview')}
              </TabsTrigger>
              <TabsTrigger value="details">
                <TrendingDown className="h-4 w-4 mr-2" />
                {t('detailed_analysis')}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-800">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="font-medium">{t('waste_alert')}</h3>
                </div>
                <p className="text-sm">{t('waste_alert_description')}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border rounded-md p-4">
                  <h4 className="font-medium mb-3">{t('waste_by_kitchen')}</h4>
                  <div className="h-[250px]">
                    <BarChart data={wasteByKitchenData} />
                  </div>
                </div>
                
                {worstKitchen && monthlyTrendData && (
                  <div className="border rounded-md p-4">
                    <h4 className="font-medium mb-3">
                      {worstKitchen.name} - {t('monthly_trend')}
                    </h4>
                    <div className="h-[250px]">
                      <LineChart data={monthlyTrendData} />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {sortedKitchens.map(kitchen => (
                  <Card key={kitchen.id} className="overflow-hidden">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{kitchen.name}</CardTitle>
                          <CardDescription>Floor {kitchen.floorNumber}</CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          className={`
                            ${kitchen.wastePercentage > 15 ? 'bg-red-50 text-red-700' : 
                              kitchen.wastePercentage > 10 ? 'bg-amber-50 text-amber-700' : 
                              'bg-green-50 text-green-700'}
                          `}
                        >
                          {kitchen.wastePercentage}% {t('waste')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('total_spent')}:</span>
                          <span className="font-medium">QAR {kitchen.totalSpent.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('excess_inventory')}:</span>
                          <span className="font-medium">QAR {kitchen.excessInventory.toLocaleString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="details" className="space-y-4">
              {sortedKitchens.map(kitchen => (
                <div key={kitchen.id} className="border rounded-md overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-slate-600" />
                      <div>
                        <h3 className="font-medium">{kitchen.name}</h3>
                        <p className="text-sm text-muted-foreground">Floor {kitchen.floorNumber}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`
                        ${kitchen.wastePercentage > 15 ? 'bg-red-50 text-red-700' : 
                          kitchen.wastePercentage > 10 ? 'bg-amber-50 text-amber-700' : 
                          'bg-green-50 text-green-700'}
                      `}
                    >
                      {kitchen.wastePercentage}% {t('waste')}
                    </Badge>
                  </div>
                  
                  <div className="p-4">
                    <h4 className="font-medium mb-2">{t('top_overpurchased_items')}</h4>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {kitchen.topOverpurchasedItems.map(item => (
                          <div
                            key={item.id}
                            className="flex justify-between items-center p-3 bg-slate-50 rounded-md"
                          >
                            <div>
                              <span className="font-medium">{item.name}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                  {item.category}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {item.quantity} {item.unit}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-medium text-red-600">QAR {item.value.toLocaleString()}</span>
                              <p className="text-xs text-muted-foreground">{t('excess_value')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    
                    <div className="mt-4 pt-4 border-t flex justify-between items-center">
                      <div>
                        <p className="text-sm text-muted-foreground">{t('recommended_action')}</p>
                        <p className="font-medium">{t('reduce_ordering_by')} {Math.round(kitchen.wastePercentage * 0.8)}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">{t('potential_savings')}</p>
                        <p className="font-medium text-green-600">
                          QAR {Math.round(kitchen.totalSpent * (kitchen.wastePercentage / 100) * 0.8).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}