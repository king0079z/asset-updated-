import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/contexts/TranslationContext';
import { Progress } from "@/components/ui/progress";
import { 
  History, 
  Calendar, 
  Building2, 
  User, 
  Package, 
  Printer, 
  RefreshCw, 
  BarChart3, 
  LineChart, 
  PieChart, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Filter, 
  Search, 
  ChevronDown, 
  Download, 
  CalendarDays,
  Utensils,
  DollarSign,
  ArrowUpDown,
  ChefHat,
  Trash2
} from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import { printContentWithIframe } from '@/util/print';

type ConsumptionRecord = {
  id: string;
  quantity: number;
  date: string;
  expirationDate?: string;
  kitchen: {
    name: string;
    floorNumber: string | null;
  };
  foodSupply: {
    name: string;
    unit: string;
    pricePerUnit: number;
  };
  user: {
    email: string;
  };
  isWaste?: boolean;
  reason?: string;
  source?: 'direct' | 'recipe';
  recipeId?: string;
  recipeName?: string;
  notes?: string;
};

type KitchenConsumptionData = {
  kitchen: {
    id: string;
    name: string;
  };
  items: Array<{
    id: string;
    name: string;
    unit: string;
    category: string;
    totalQuantity: number;
    consumptions: Array<{
      id: string;
      quantity: number;
      date: string;
      user: string;
      notes: string | null;
    }>;
  }>;
  monthlyConsumption: {
    labels: string[];
    totalData: number[];
    byFoodType: Array<{
      name: string;
      unit: string;
      data: number[];
    }>;
  };
  waste: {
    items: Array<{
      id: string;
      name: string;
      unit: string;
      totalWasted: number;
      wastePercentage: number;
      wasteReasons: Array<{
        reason: string;
        quantity: number;
        percentage: number;
      }>;
    }>;
    totalWaste: number;
    avgWastePercentage: number;
  };
  totalConsumption: number;
  totalWaste: number;
  kitchenEfficiency: number;
  topWastedItems: Array<{
    name: string;
    amount: string;
    percentage: number;
  }>;
  consumptionTrends: Array<{
    month: string;
    value: number;
  }>;
};

interface KitchenConsumptionHistoryDetailsProps {
  kitchenId: string;
  kitchenName: string;
}

export function KitchenConsumptionHistoryDetails({ kitchenId, kitchenName }: KitchenConsumptionHistoryDetailsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [consumptionHistory, setConsumptionHistory] = useState<ConsumptionRecord[]>([]);
  const [kitchenData, setKitchenData] = useState<KitchenConsumptionData | null>(null);
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | '90days' | 'all'>('30days');
  const [sortBy, setSortBy] = useState<'date' | 'quantity' | 'value'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Fetch consumption history data
  const fetchConsumptionHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/food-supply/consumption-history?kitchenId=${kitchenId}`);
      if (!response.ok) throw new Error('Failed to load consumption history');
      const data = await response.json();
      setConsumptionHistory(data);
    } catch (error) {
      console.error('Error loading consumption history:', error);
      toast({
        title: t('error'),
        description: t('failed_to_load_consumption_history'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch kitchen consumption details
  const fetchKitchenData = async () => {
    try {
      const response = await fetch(`/api/kitchens/consumption-details?kitchenId=${kitchenId}`);
      if (!response.ok) throw new Error('Failed to load kitchen data');
      const data = await response.json();
      setKitchenData(data);
    } catch (error) {
      console.error('Error loading kitchen data:', error);
      toast({
        title: t('error'),
        description: t('failed_to_load_kitchen_data'),
        variant: "destructive",
      });
    }
  };

  // Initial data load
  useEffect(() => {
    if (kitchenId) {
      fetchConsumptionHistory();
      fetchKitchenData();
    }
  }, [kitchenId]);

  // Filter consumption history based on time range
  const getFilteredHistory = () => {
    if (!consumptionHistory) return [];
    
    let filtered = [...consumptionHistory];
    
    // Apply time range filter
    if (timeRange !== 'all') {
      const daysToSubtract = timeRange === '7days' ? 7 : timeRange === '30days' ? 30 : 90;
      const cutoffDate = subDays(new Date(), daysToSubtract);
      filtered = filtered.filter(record => new Date(record.date) >= cutoffDate);
    }
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(record => 
        record.foodSupply.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply category filter if not 'all'
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(record => {
        // For waste records, we need to check if they're waste records
        if (selectedCategory === 'waste') {
          return record.isWaste === true;
        }
        // For recipe records, check if they have a recipe source
        if (selectedCategory === 'recipe') {
          return record.source === 'recipe';
        }
        // Otherwise, we don't have category info in the consumption records
        return true;
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return sortOrder === 'desc' 
          ? new Date(b.date).getTime() - new Date(a.date).getTime()
          : new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === 'quantity') {
        return sortOrder === 'desc' 
          ? b.quantity - a.quantity
          : a.quantity - b.quantity;
      } else { // value
        const valueA = a.quantity * a.foodSupply.pricePerUnit;
        const valueB = b.quantity * b.foodSupply.pricePerUnit;
        return sortOrder === 'desc' ? valueB - valueA : valueA - valueB;
      }
    });
    
    return filtered;
  };

  const filteredHistory = getFilteredHistory();
  
  // Calculate total value consumed
  const totalValueConsumed = filteredHistory.reduce((sum, record) => {
    return sum + (record.quantity * record.foodSupply.pricePerUnit);
  }, 0);

  // Calculate consumption by category
  const consumptionByCategory = filteredHistory.reduce((acc, record) => {
    const category = record.isWaste ? 'waste' : (record.source === 'recipe' ? 'recipe' : 'direct');
    if (!acc[category]) {
      acc[category] = {
        quantity: 0,
        value: 0,
        count: 0
      };
    }
    acc[category].quantity += record.quantity;
    acc[category].value += record.quantity * record.foodSupply.pricePerUnit;
    acc[category].count += 1;
    return acc;
  }, {} as Record<string, { quantity: number; value: number; count: number }>);

  // Get top consumed items
  const getTopConsumedItems = () => {
    const itemMap = new Map<string, { name: string; unit: string; quantity: number; value: number }>();
    
    filteredHistory.forEach(record => {
      if (!record.isWaste) {
        const key = record.foodSupply.name;
        if (!itemMap.has(key)) {
          itemMap.set(key, {
            name: record.foodSupply.name,
            unit: record.foodSupply.unit,
            quantity: 0,
            value: 0
          });
        }
        const item = itemMap.get(key)!;
        item.quantity += record.quantity;
        item.value += record.quantity * record.foodSupply.pricePerUnit;
      }
    });
    
    return Array.from(itemMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  // Get consumption by user
  const getConsumptionByUser = () => {
    const userMap = new Map<string, { email: string; quantity: number; value: number; count: number }>();
    
    filteredHistory.forEach(record => {
      const key = record.user.email;
      if (!userMap.has(key)) {
        userMap.set(key, {
          email: record.user.email,
          quantity: 0,
          value: 0,
          count: 0
        });
      }
      const user = userMap.get(key)!;
      user.quantity += record.quantity;
      user.value += record.quantity * record.foodSupply.pricePerUnit;
      user.count += 1;
    });
    
    return Array.from(userMap.values())
      .sort((a, b) => b.value - a.value);
  };

  // Generate and print detailed report
  const generateDetailedReport = async () => {
    setIsGeneratingReport(true);
    
    try {
      // Create report content
      const reportContent = `
        <div class="p-8 max-w-5xl mx-auto">
          <div class="flex justify-between items-center mb-8 border-b pb-6">
            <div>
              <h1 class="text-3xl font-bold text-gray-800">${kitchenName} - ${t('consumption_history_report')}</h1>
              <p class="text-gray-600 mt-1">${t('generated_on')} ${new Date().toLocaleDateString()}</p>
            </div>
            <div class="text-right">
              <p class="text-sm text-gray-500">${t('time_range')}: ${
                timeRange === '7days' ? t('last_7_days') :
                timeRange === '30days' ? t('last_30_days') :
                timeRange === '90days' ? t('last_90_days') :
                t('all_time')
              }</p>
              <p class="text-sm font-medium">${t('report_id')}: ${Math.random().toString(36).substring(2, 10).toUpperCase()}</p>
            </div>
          </div>
          
          <div class="mb-8">
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
              <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                <h2 class="text-xl font-semibold text-gray-800">${t('consumption_summary')}</h2>
              </div>
              <div class="p-6">
                <div class="grid grid-cols-3 gap-6">
                  <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <p class="text-sm text-blue-700 font-medium mb-1">${t('total_records')}</p>
                    <p class="text-xl font-bold text-blue-900">${filteredHistory.length}</p>
                  </div>
                  <div class="bg-green-50 p-4 rounded-lg border border-green-100">
                    <p class="text-sm text-green-700 font-medium mb-1">${t('total_quantity')}</p>
                    <p class="text-xl font-bold text-green-900">
                      ${filteredHistory.reduce((sum, record) => sum + record.quantity, 0).toFixed(2)}
                    </p>
                  </div>
                  <div class="bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <p class="text-sm text-purple-700 font-medium mb-1">${t('total_value')}</p>
                    <p class="text-xl font-bold text-purple-900">QAR ${totalValueConsumed.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
              <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                <h2 class="text-xl font-semibold text-gray-800">${t('top_consumed_items')}</h2>
              </div>
              <div class="p-6">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('item')}</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('quantity')}</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('value')}</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    ${getTopConsumedItems().map((item, index) => `
                      <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                        <td class="px-4 py-3 text-sm text-gray-900">${item.name}</td>
                        <td class="px-4 py-3 text-sm text-gray-900">${item.quantity.toFixed(2)} ${item.unit}</td>
                        <td class="px-4 py-3 text-sm font-medium text-gray-900">QAR ${item.value.toFixed(2)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
              <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                <h2 class="text-xl font-semibold text-gray-800">${t('consumption_by_user')}</h2>
              </div>
              <div class="p-6">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('user')}</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('records')}</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('quantity')}</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('value')}</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    ${getConsumptionByUser().map((user, index) => `
                      <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                        <td class="px-4 py-3 text-sm text-gray-900">${user.email}</td>
                        <td class="px-4 py-3 text-sm text-gray-900">${user.count}</td>
                        <td class="px-4 py-3 text-sm text-gray-900">${user.quantity.toFixed(2)}</td>
                        <td class="px-4 py-3 text-sm font-medium text-gray-900">QAR ${user.value.toFixed(2)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-sm border border-gray-200">
              <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                <h2 class="text-xl font-semibold text-gray-800">${t('detailed_consumption_records')}</h2>
              </div>
              <div class="p-6">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('date')}</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('item')}</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('quantity')}</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('value')}</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('user')}</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    ${filteredHistory.slice(0, 50).map((record, index) => `
                      <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                        <td class="px-4 py-3 text-sm text-gray-900">${new Date(record.date).toLocaleString()}</td>
                        <td class="px-4 py-3 text-sm text-gray-900">
                          ${record.foodSupply.name}
                          ${record.isWaste ? `<span class="text-red-600"> (${t('waste')})</span>` : ''}
                          ${record.source === 'recipe' ? `<span class="text-purple-600"> (${t('recipe')})</span>` : ''}
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-900">${record.quantity} ${record.foodSupply.unit}</td>
                        <td class="px-4 py-3 text-sm font-medium text-gray-900">
                          QAR ${(record.quantity * record.foodSupply.pricePerUnit).toFixed(2)}
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-900">${record.user.email}</td>
                      </tr>
                    `).join('')}
                    ${filteredHistory.length > 50 ? `
                      <tr>
                        <td colspan="5" class="px-4 py-3 text-sm text-center text-gray-500">
                          ${t('showing_first')} 50 ${t('of')} ${filteredHistory.length} ${t('records')}
                        </td>
                      </tr>
                    ` : ''}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <div class="mt-12 pt-6 border-t border-gray-200">
            <div class="flex justify-between items-center text-gray-500 text-sm">
              <p>${t('enterprise_resource_management')}</p>
              <p>${t('page')} 1 ${t('of')} 1</p>
            </div>
            <p class="text-center text-gray-400 text-xs mt-2">
              ${t('report_confidentiality_notice')}
            </p>
          </div>
        </div>
      `;
      
      // Print the report
      await printContentWithIframe(reportContent, `${kitchenName} - ${t('consumption_history_report')}`);
      
      toast({
        title: t('report_generated'),
        description: t('report_generated_successfully'),
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: t('error'),
        description: t('failed_to_generate_report'),
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Toggle sort order
  const toggleSort = (field: 'date' | 'quantity' | 'value') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              {t('kitchen_consumption_history')}
            </CardTitle>
            <CardDescription>{kitchenName}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                fetchConsumptionHistory();
                fetchKitchenData();
              }}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={generateDetailedReport}
              disabled={isLoading || isGeneratingReport || filteredHistory.length === 0}
            >
              <Printer className={`h-4 w-4 mr-2 ${isGeneratingReport ? 'animate-spin' : ''}`} />
              {t('print_report')}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={isLoading || filteredHistory.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              {t('export_csv')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">{t('loading_consumption_history')}</p>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid grid-cols-3 md:grid-cols-5 h-10">
              <TabsTrigger value="overview" className="text-xs md:text-sm">
                <BarChart3 className="h-4 w-4 mr-2 hidden md:inline" />
                {t('overview')}
              </TabsTrigger>
              <TabsTrigger value="detailed" className="text-xs md:text-sm">
                <History className="h-4 w-4 mr-2 hidden md:inline" />
                {t('detailed_history')}
              </TabsTrigger>
              <TabsTrigger value="trends" className="text-xs md:text-sm">
                <LineChart className="h-4 w-4 mr-2 hidden md:inline" />
                {t('trends')}
              </TabsTrigger>
              <TabsTrigger value="users" className="text-xs md:text-sm">
                <User className="h-4 w-4 mr-2 hidden md:inline" />
                {t('by_user')}
              </TabsTrigger>
              <TabsTrigger value="items" className="text-xs md:text-sm">
                <Package className="h-4 w-4 mr-2 hidden md:inline" />
                {t('by_item')}
              </TabsTrigger>
            </TabsList>
            
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{t('total_records')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">{filteredHistory.length}</div>
                    <p className="text-sm text-blue-600/80 dark:text-blue-400/80 mt-1">
                      {timeRange === '7days' ? t('in_the_last_7_days') :
                       timeRange === '30days' ? t('in_the_last_30_days') :
                       timeRange === '90days' ? t('in_the_last_90_days') :
                       t('all_time')}
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 border-green-200 dark:border-green-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{t('total_consumed')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                      {filteredHistory.filter(r => !r.isWaste).reduce((sum, record) => sum + record.quantity, 0).toFixed(1)}
                    </div>
                    <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">{t('units_consumed')}</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10 border-amber-200 dark:border-amber-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{t('waste_percentage')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-amber-700 dark:text-amber-400">
                      {filteredHistory.length > 0 ? 
                        ((filteredHistory.filter(r => r.isWaste).length / filteredHistory.length) * 100).toFixed(1) + '%' : 
                        '0%'}
                    </div>
                    <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-1">{t('of_total_records')}</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 border-purple-200 dark:border-purple-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{t('total_value')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-700 dark:text-purple-400">
                      QAR {totalValueConsumed.toFixed(2)}
                    </div>
                    <p className="text-sm text-purple-600/80 dark:text-purple-400/80 mt-1">{t('total_consumption_value')}</p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Consumption by Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('consumption_by_category')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Direct Consumption */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-blue-800 dark:text-blue-300 flex items-center">
                          <Utensils className="h-4 w-4 mr-2" />
                          {t('direct_consumption')}
                        </h3>
                        <Badge variant="outline" className="bg-blue-100 text-blue-800">
                          {consumptionByCategory['direct']?.count || 0} {t('records')}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{t('quantity')}</span>
                            <span className="font-medium">{consumptionByCategory['direct']?.quantity.toFixed(1) || 0}</span>
                          </div>
                          <Progress 
                            value={consumptionByCategory['direct']?.quantity || 0} 
                            max={Object.values(consumptionByCategory).reduce((sum, cat) => sum + cat.quantity, 0)}
                            className="h-2 bg-blue-200" 
                            indicatorClassName="bg-blue-500" 
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{t('value')}</span>
                            <span className="font-medium">QAR {consumptionByCategory['direct']?.value.toFixed(2) || 0}</span>
                          </div>
                          <Progress 
                            value={consumptionByCategory['direct']?.value || 0} 
                            max={Object.values(consumptionByCategory).reduce((sum, cat) => sum + cat.value, 0)}
                            className="h-2 bg-blue-200" 
                            indicatorClassName="bg-blue-500" 
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Recipe Consumption */}
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-purple-800 dark:text-purple-300 flex items-center">
                          <ChefHat className="h-4 w-4 mr-2" />
                          {t('recipe_consumption')}
                        </h3>
                        <Badge variant="outline" className="bg-purple-100 text-purple-800">
                          {consumptionByCategory['recipe']?.count || 0} {t('records')}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{t('quantity')}</span>
                            <span className="font-medium">{consumptionByCategory['recipe']?.quantity.toFixed(1) || 0}</span>
                          </div>
                          <Progress 
                            value={consumptionByCategory['recipe']?.quantity || 0} 
                            max={Object.values(consumptionByCategory).reduce((sum, cat) => sum + cat.quantity, 0)}
                            className="h-2 bg-purple-200" 
                            indicatorClassName="bg-purple-500" 
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{t('value')}</span>
                            <span className="font-medium">QAR {consumptionByCategory['recipe']?.value.toFixed(2) || 0}</span>
                          </div>
                          <Progress 
                            value={consumptionByCategory['recipe']?.value || 0} 
                            max={Object.values(consumptionByCategory).reduce((sum, cat) => sum + cat.value, 0)}
                            className="h-2 bg-purple-200" 
                            indicatorClassName="bg-purple-500" 
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Waste */}
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-red-800 dark:text-red-300 flex items-center">
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('waste')}
                        </h3>
                        <Badge variant="outline" className="bg-red-100 text-red-800">
                          {consumptionByCategory['waste']?.count || 0} {t('records')}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{t('quantity')}</span>
                            <span className="font-medium">{consumptionByCategory['waste']?.quantity.toFixed(1) || 0}</span>
                          </div>
                          <Progress 
                            value={consumptionByCategory['waste']?.quantity || 0} 
                            max={Object.values(consumptionByCategory).reduce((sum, cat) => sum + cat.quantity, 0)}
                            className="h-2 bg-red-200" 
                            indicatorClassName="bg-red-500" 
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{t('value')}</span>
                            <span className="font-medium">QAR {consumptionByCategory['waste']?.value.toFixed(2) || 0}</span>
                          </div>
                          <Progress 
                            value={consumptionByCategory['waste']?.value || 0} 
                            max={Object.values(consumptionByCategory).reduce((sum, cat) => sum + cat.value, 0)}
                            className="h-2 bg-red-200" 
                            indicatorClassName="bg-red-500" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Top Consumed Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('top_consumed_items')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {getTopConsumedItems().map((item, index) => (
                      <div key={index} className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-800 dark:text-blue-300 font-medium mr-3">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <h4 className="font-medium">{item.name}</h4>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                {item.quantity.toFixed(1)} {item.unit}
                              </Badge>
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                QAR {item.value.toFixed(2)}
                              </Badge>
                            </div>
                          </div>
                          <Progress 
                            value={item.value} 
                            max={getTopConsumedItems()[0].value}
                            className="h-2 bg-gray-100" 
                            indicatorClassName="bg-gradient-to-r from-blue-500 to-green-500" 
                          />
                        </div>
                      </div>
                    ))}
                    
                    {getTopConsumedItems().length === 0 && (
                      <div className="text-center py-6 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>{t('no_consumption_data_available')}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Monthly Consumption Trends */}
              {kitchenData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t('monthly_consumption_trends')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-md">
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-full max-w-4xl p-4">
                          {/* Simulated chart with bars */}
                          <div className="space-y-6">
                            <div className="flex justify-between mb-2">
                              {kitchenData.monthlyConsumption.labels.map((month, i) => (
                                <div key={i} className="text-xs text-gray-500">{month}</div>
                              ))}
                            </div>
                            <div className="relative h-[200px]">
                              <div className="absolute inset-0 flex items-end justify-between">
                                {kitchenData.monthlyConsumption.totalData.map((value, i) => {
                                  const maxValue = Math.max(...kitchenData.monthlyConsumption.totalData);
                                  const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                                  return (
                                    <div key={i} className="flex-1 mx-1">
                                      <div 
                                        className="bg-blue-500 dark:bg-blue-600 rounded-t-sm w-full transition-all duration-500"
                                        style={{ height: `${height}%` }}
                                      ></div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex justify-between">
                              {kitchenData.monthlyConsumption.totalData.map((value, i) => (
                                <div key={i} className="text-xs font-medium">{value.toFixed(0)}</div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {kitchenData.monthlyConsumption.byFoodType.slice(0, 4).map((item, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border">
                          <h4 className="text-sm font-medium mb-2 truncate" title={item.name}>{item.name}</h4>
                          <div className="flex items-end h-10 gap-1">
                            {item.data.slice(-3).map((value, i) => {
                              const maxValue = Math.max(...item.data.slice(-3));
                              const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                              return (
                                <div key={i} className="flex-1 flex flex-col items-center">
                                  <div 
                                    className={`w-full rounded-t-sm ${
                                      i === 0 ? 'bg-blue-300 dark:bg-blue-700' :
                                      i === 1 ? 'bg-blue-500 dark:bg-blue-500' :
                                      'bg-blue-700 dark:bg-blue-300'
                                    }`}
                                    style={{ height: `${height}%` }}
                                  ></div>
                                  <span className="text-xs mt-1">{value.toFixed(1)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            {/* Detailed History Tab */}
            <TabsContent value="detailed" className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      placeholder={t('search_by_item_or_user')}
                      className="pl-8 pr-4 py-2 w-full border rounded-md"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <select
                  className="px-3 py-2 border rounded-md"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as any)}
                >
                  <option value="7days">{t('last_7_days')}</option>
                  <option value="30days">{t('last_30_days')}</option>
                  <option value="90days">{t('last_90_days')}</option>
                  <option value="all">{t('all_time')}</option>
                </select>
                <select
                  className="px-3 py-2 border rounded-md"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="all">{t('all_categories')}</option>
                  <option value="direct">{t('direct_consumption')}</option>
                  <option value="recipe">{t('recipe_consumption')}</option>
                  <option value="waste">{t('waste')}</option>
                </select>
              </div>
              
              {/* Records Table */}
              <Card>
                <CardContent className="p-0">
                  <div className="border-b">
                    <div className="grid grid-cols-12 gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 font-medium text-xs text-gray-500 dark:text-gray-400">
                      <button 
                        className="col-span-3 md:col-span-2 flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
                        onClick={() => toggleSort('date')}
                      >
                        {t('date')}
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                      <div className="col-span-3 md:col-span-2">{t('item')}</div>
                      <button 
                        className="col-span-2 md:col-span-1 flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
                        onClick={() => toggleSort('quantity')}
                      >
                        {t('quantity')}
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                      <button 
                        className="col-span-2 flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
                        onClick={() => toggleSort('value')}
                      >
                        {t('value')}
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                      <div className="col-span-2 md:col-span-3">{t('user')}</div>
                      <div className="hidden md:block md:col-span-2">{t('notes')}</div>
                    </div>
                  </div>
                  
                  <ScrollArea className="h-[500px]">
                    {filteredHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <History className="h-12 w-12 mb-3 opacity-20" />
                        <p>{t('no_consumption_records_found')}</p>
                        <p className="text-sm mt-1">{t('try_adjusting_filters')}</p>
                      </div>
                    ) : (
                      <div>
                        {filteredHistory.map((record, index) => (
                          <div 
                            key={record.id} 
                            className={`grid grid-cols-12 gap-2 p-3 text-sm ${
                              index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'
                            } ${record.isWaste ? 'border-l-4 border-red-500 dark:border-red-700' : 
                                record.source === 'recipe' ? 'border-l-4 border-purple-500 dark:border-purple-700' : ''
                            } hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors`}
                          >
                            <div className="col-span-3 md:col-span-2">
                              <div className="font-medium">
                                {format(new Date(record.date), 'MMM d, yyyy')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(record.date), 'h:mm a')}
                              </div>
                            </div>
                            
                            <div className="col-span-3 md:col-span-2">
                              <div className="font-medium truncate" title={record.foodSupply.name}>
                                {record.foodSupply.name}
                              </div>
                              <div className="flex gap-1 mt-1">
                                {record.isWaste && (
                                  <Badge variant="outline" className="text-xs bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                    {t('waste')}
                                  </Badge>
                                )}
                                {record.source === 'recipe' && (
                                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                    {t('recipe')}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="col-span-2 md:col-span-1 font-medium">
                              {record.quantity} {record.foodSupply.unit}
                            </div>
                            
                            <div className="col-span-2 font-medium">
                              QAR {(record.quantity * record.foodSupply.pricePerUnit).toFixed(2)}
                            </div>
                            
                            <div className="col-span-2 md:col-span-3 truncate" title={record.user.email}>
                              {record.user.email}
                            </div>
                            
                            <div className="hidden md:block md:col-span-2 truncate text-muted-foreground" title={record.notes || ''}>
                              {record.notes || '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
                <CardFooter className="border-t py-3 px-6 text-xs text-muted-foreground">
                  {filteredHistory.length > 0 && (
                    <div className="w-full flex justify-between items-center">
                      <div>
                        {t('showing')} {filteredHistory.length} {t('records')}
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-3 w-3" />
                        <span>
                          {timeRange === '7days' ? t('last_7_days') :
                           timeRange === '30days' ? t('last_30_days') :
                           timeRange === '90days' ? t('last_90_days') :
                           t('all_time')}
                        </span>
                      </div>
                    </div>
                  )}
                </CardFooter>
              </Card>
            </TabsContent>
            
            {/* Trends Tab */}
            <TabsContent value="trends" className="space-y-6">
              {kitchenData ? (
                <>
                  {/* Monthly Consumption Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{t('monthly_consumption_trends')}</CardTitle>
                      <CardDescription>
                        {t('consumption_trends_description')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[350px] flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-md">
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-full max-w-4xl p-4">
                            {/* Simulated chart with bars and lines */}
                            <div className="space-y-6">
                              <div className="flex justify-between mb-2">
                                {kitchenData.monthlyConsumption.labels.map((month, i) => (
                                  <div key={i} className="text-xs text-gray-500">{month}</div>
                                ))}
                              </div>
                              <div className="relative h-[250px]">
                                <div className="absolute inset-0 flex items-end justify-between">
                                  {kitchenData.monthlyConsumption.totalData.map((value, i) => {
                                    const maxValue = Math.max(...kitchenData.monthlyConsumption.totalData);
                                    const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                                    return (
                                      <div key={i} className="flex-1 mx-1">
                                        <div 
                                          className="bg-gradient-to-t from-blue-600 to-blue-400 dark:from-blue-700 dark:to-blue-500 rounded-t-sm w-full transition-all duration-500"
                                          style={{ height: `${height}%` }}
                                        ></div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="flex justify-between">
                                {kitchenData.monthlyConsumption.totalData.map((value, i) => (
                                  <div key={i} className="text-xs font-medium">{value.toFixed(0)}</div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Trend Summary */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4">
                          <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">{t('consumption_trend')}</h3>
                          
                          {kitchenData.monthlyConsumption.totalData.length >= 2 && (
                            <div className="flex items-center gap-3">
                              {kitchenData.monthlyConsumption.totalData[kitchenData.monthlyConsumption.totalData.length - 1] >
                               kitchenData.monthlyConsumption.totalData[kitchenData.monthlyConsumption.totalData.length - 2] ? (
                                <>
                                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                    <TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-red-600 dark:text-red-400">
                                      +{(((kitchenData.monthlyConsumption.totalData[kitchenData.monthlyConsumption.totalData.length - 1] -
                                          kitchenData.monthlyConsumption.totalData[kitchenData.monthlyConsumption.totalData.length - 2]) /
                                          kitchenData.monthlyConsumption.totalData[kitchenData.monthlyConsumption.totalData.length - 2]) * 100).toFixed(1)}%
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">{t('increasing')}</div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <TrendingDown className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-green-600 dark:text-green-400">
                                      {(((kitchenData.monthlyConsumption.totalData[kitchenData.monthlyConsumption.totalData.length - 1] -
                                          kitchenData.monthlyConsumption.totalData[kitchenData.monthlyConsumption.totalData.length - 2]) /
                                          kitchenData.monthlyConsumption.totalData[kitchenData.monthlyConsumption.totalData.length - 2]) * 100).toFixed(1)}%
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">{t('decreasing')}</div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                          
                          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                            {t('compared_to_previous_month')}
                          </div>
                        </div>
                        
                        {/* Average Consumption */}
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg p-4">
                          <h3 className="font-medium text-green-800 dark:text-green-300 mb-2">{t('average_consumption')}</h3>
                          
                          <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                            {(kitchenData.monthlyConsumption.totalData.reduce((sum, val) => sum + val, 0) / 
                              Math.max(1, kitchenData.monthlyConsumption.totalData.length)).toFixed(1)}
                          </div>
                          
                          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            {t('units_per_month')}
                          </div>
                          
                          <div className="mt-4 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span className="text-sm text-green-600 dark:text-green-400">
                              {(kitchenData.monthlyConsumption.totalData.reduce((sum, val) => sum + val, 0) / 
                                Math.max(1, kitchenData.monthlyConsumption.totalData.length) / 30).toFixed(1)} {t('units_per_day')}
                            </span>
                          </div>
                        </div>
                        
                        {/* Efficiency Score */}
                        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-lg p-4">
                          <h3 className="font-medium text-purple-800 dark:text-purple-300 mb-2">{t('kitchen_efficiency')}</h3>
                          
                          <div className="flex items-center gap-3">
                            <div className="relative w-16 h-16">
                              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
                                <circle 
                                  cx="50" cy="50" r="45" 
                                  fill="none" 
                                  stroke="#e9d5ff" 
                                  strokeWidth="10"
                                />
                                <circle 
                                  cx="50" cy="50" r="45" 
                                  fill="none" 
                                  stroke="#9333ea" 
                                  strokeWidth="10"
                                  strokeDasharray={`${2 * Math.PI * 45 * kitchenData.kitchenEfficiency / 100} ${2 * Math.PI * 45 * (1 - kitchenData.kitchenEfficiency / 100)}`}
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-lg font-bold text-purple-800 dark:text-purple-300">{kitchenData.kitchenEfficiency}%</span>
                              </div>
                            </div>
                            
                            <div>
                              <div className="font-medium">
                                {kitchenData.kitchenEfficiency >= 90 ? t('excellent') :
                                 kitchenData.kitchenEfficiency >= 75 ? t('good') :
                                 kitchenData.kitchenEfficiency >= 60 ? t('average') :
                                 t('needs_improvement')}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {t('based_on_waste_percentage')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Top Food Types */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{t('consumption_by_food_type')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Food Type Chart */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 flex items-center justify-center">
                          <div className="w-full max-w-xs aspect-square relative">
                            {/* Simulated pie chart */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-full h-full rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                                {kitchenData.monthlyConsumption.byFoodType.slice(0, 5).map((item, index, arr) => {
                                  const total = arr.reduce((sum, i) => sum + i.data.reduce((s, v) => s + v, 0), 0);
                                  const value = item.data.reduce((sum, v) => sum + v, 0);
                                  const percentage = total > 0 ? (value / total) * 100 : 0;
                                  
                                  // Calculate rotation for pie chart segments
                                  const previousPercentages = arr.slice(0, index).reduce((sum, i) => {
                                    return sum + (total > 0 ? (i.data.reduce((s, v) => s + v, 0) / total) * 100 : 0);
                                  }, 0);
                                  
                                  const colors = [
                                    'bg-blue-500 dark:bg-blue-600',
                                    'bg-green-500 dark:bg-green-600',
                                    'bg-purple-500 dark:bg-purple-600',
                                    'bg-amber-500 dark:bg-amber-600',
                                    'bg-red-500 dark:bg-red-600',
                                  ];
                                  
                                  return (
                                    <div 
                                      key={index}
                                      className={`absolute inset-0 ${colors[index % colors.length]}`}
                                      style={{
                                        clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos((previousPercentages + percentage) * 3.6 * Math.PI / 180)}% ${50 - 50 * Math.sin((previousPercentages + percentage) * 3.6 * Math.PI / 180)}%, ${50 + 50 * Math.cos(previousPercentages * 3.6 * Math.PI / 180)}% ${50 - 50 * Math.sin(previousPercentages * 3.6 * Math.PI / 180)}%)`
                                      }}
                                    ></div>
                                  );
                                })}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-[60%] h-[60%] rounded-full bg-white dark:bg-gray-900 flex items-center justify-center">
                                    <PieChart className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Food Type Legend */}
                        <div className="space-y-4">
                          {kitchenData.monthlyConsumption.byFoodType.slice(0, 5).map((item, index) => {
                            const total = kitchenData.monthlyConsumption.byFoodType.reduce(
                              (sum, i) => sum + i.data.reduce((s, v) => s + v, 0), 0
                            );
                            const value = item.data.reduce((sum, v) => sum + v, 0);
                            const percentage = total > 0 ? (value / total) * 100 : 0;
                            
                            const colors = [
                              'bg-blue-500 dark:bg-blue-600',
                              'bg-green-500 dark:bg-green-600',
                              'bg-purple-500 dark:bg-purple-600',
                              'bg-amber-500 dark:bg-amber-600',
                              'bg-red-500 dark:bg-red-600',
                            ];
                            
                            return (
                              <div key={index} className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full ${colors[index % colors.length]}`}></div>
                                <div className="flex-1">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium">{item.name}</span>
                                    <span className="text-sm">{percentage.toFixed(1)}%</span>
                                  </div>
                                  <Progress 
                                    value={percentage} 
                                    max={100}
                                    className="h-1.5 mt-1 bg-gray-100 dark:bg-gray-700" 
                                    indicatorClassName={colors[index % colors.length]} 
                                  />
                                </div>
                              </div>
                            );
                          })}
                          
                          {kitchenData.monthlyConsumption.byFoodType.length === 0 && (
                            <div className="text-center py-6 text-muted-foreground">
                              <p>{t('no_food_type_data_available')}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <LineChart className="h-12 w-12 mb-3 opacity-20" />
                  <p>{t('no_trend_data_available')}</p>
                </div>
              )}
            </TabsContent>
            
            {/* By User Tab */}
            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('consumption_by_user')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {getConsumptionByUser().length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <User className="h-12 w-12 mb-3 opacity-20" />
                      <p>{t('no_user_data_available')}</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {getConsumptionByUser().map((user, index) => (
                        <div key={index} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                            <div>
                              <h3 className="font-medium">{user.email}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                  {user.count} {t('records')}
                                </Badge>
                                <Badge variant="outline" className="bg-green-50 text-green-700">
                                  {user.quantity.toFixed(1)} {t('units')}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-700">QAR {user.value.toFixed(2)}</div>
                              <div className="text-sm text-muted-foreground">{t('total_value')}</div>
                            </div>
                          </div>
                          
                          <div className="mt-4">
                            <div className="flex justify-between text-sm mb-1">
                              <span>{t('contribution')}</span>
                              <span>
                                {(user.value / totalValueConsumed * 100).toFixed(1)}% {t('of_total')}
                              </span>
                            </div>
                            <Progress 
                              value={user.value} 
                              max={getConsumptionByUser()[0].value}
                              className="h-2 bg-gray-100" 
                              indicatorClassName="bg-gradient-to-r from-blue-500 to-green-500" 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* By Item Tab */}
            <TabsContent value="items" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('consumption_by_item')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mb-3 opacity-20" />
                      <p>{t('no_item_data_available')}</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Top Items */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {getTopConsumedItems().map((item, index) => (
                          <div key={index} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-800 dark:text-blue-300 font-medium">
                                  {index + 1}
                                </div>
                                <div>
                                  <h3 className="font-medium">{item.name}</h3>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                      {item.quantity.toFixed(1)} {item.unit}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-green-700">QAR {item.value.toFixed(2)}</div>
                                <div className="text-sm text-muted-foreground">{t('total_value')}</div>
                              </div>
                            </div>
                            
                            <div className="mt-4">
                              <div className="flex justify-between text-sm mb-1">
                                <span>{t('percentage')}</span>
                                <span>
                                  {(item.value / totalValueConsumed * 100).toFixed(1)}% {t('of_total')}
                                </span>
                              </div>
                              <Progress 
                                value={item.value} 
                                max={getTopConsumedItems()[0].value}
                                className="h-2 bg-gray-100" 
                                indicatorClassName="bg-gradient-to-r from-blue-500 to-green-500" 
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Value Distribution */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{t('value_distribution')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[200px] flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-md">
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-full max-w-4xl p-4">
                                {/* Simulated chart with bars */}
                                <div className="flex items-end h-[150px] gap-2">
                                  {getTopConsumedItems().map((item, index) => {
                                    const maxValue = getTopConsumedItems()[0].value;
                                    const height = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                                    
                                    const colors = [
                                      'bg-blue-500 dark:bg-blue-600',
                                      'bg-green-500 dark:bg-green-600',
                                      'bg-purple-500 dark:bg-purple-600',
                                      'bg-amber-500 dark:bg-amber-600',
                                      'bg-red-500 dark:bg-red-600',
                                    ];
                                    
                                    return (
                                      <div key={index} className="flex-1 flex flex-col items-center">
                                        <div 
                                          className={`w-full rounded-t-sm ${colors[index % colors.length]}`}
                                          style={{ height: `${height}%` }}
                                        ></div>
                                        <div className="mt-2 text-xs text-center">
                                          <div className="font-medium truncate w-20" title={item.name}>
                                            {item.name.length > 10 ? item.name.substring(0, 10) + '...' : item.name}
                                          </div>
                                          <div className="text-muted-foreground">
                                            QAR {item.value.toFixed(0)}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
      <CardFooter className="border-t py-3 px-6 text-xs text-muted-foreground">
        <div className="w-full flex justify-between items-center">
          <div>
            {t('kitchen_consumption_history')} - {kitchenName}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>
              {t('last_updated')}: {new Date().toLocaleString()}
            </span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}