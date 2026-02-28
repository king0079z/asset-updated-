// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/contexts/TranslationContext';
import { Progress } from "@/components/ui/progress";
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Package, 
  Printer, 
  RefreshCw, 
  BarChart3, 
  Search, 
  Download, 
  CalendarDays,
  Utensils,
  ChefHat,
  Trash2,
  ArrowUpDown,
  Clock,
  TrendingDown,
  TrendingUp,
  DollarSign,
  PieChart,
  AlertCircle,
  Info,
  Calendar,
  Filter,
  BarChart2,
  LineChart,
  Percent,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { format, parseISO, subDays, differenceInDays } from 'date-fns';
import { printContentWithIframe } from '@/util/print';
import BarcodeScannerFood from './BarcodeScannerFood';
import { EnhancedKitchenFoodSupplyForm } from './EnhancedKitchenFoodSupplyForm';
import { EnhancedWasteTrackingDialog } from './EnhancedWasteTrackingDialog';

// Types
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
    category?: string;
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
  items: {
    id: string;
    name: string;
    unit: string;
    category: string;
    totalQuantity: number;
    consumptions: {
      id: string;
      quantity: number;
      date: string;
      user: string;
      notes?: string;
    }[];
    monthlyConsumption: Record<string, number>;
  }[];
  monthlyConsumption: {
    labels: string[];
    totalData: number[];
    byFoodType: {
      name: string;
      unit: string;
      data: number[];
    }[];
  };
  waste: {
    items: {
      id: string;
      name: string;
      unit: string;
      totalWasted: number;
      wastePercentage: number;
      wasteReasons: {
        reason: string;
        quantity: number;
        percentage: number;
      }[];
    }[];
    totalWaste: number;
    avgWastePercentage: number;
  };
  totalConsumption: number;
  totalWaste: number;
  kitchenEfficiency: number;
  topWastedItems: {
    name: string;
    amount: string;
    percentage: number;
  }[];
  consumptionTrends: {
    month: string;
    value: number;
  }[];
  recommendations: string[];
  anomalies: {
    item: string;
    issue: string;
    impact: string;
  }[];
};

interface KitchenConsumptionTabProps {
  kitchenId: string;
  kitchenName: string;
}

export function KitchenConsumptionTab({ kitchenId, kitchenName }: KitchenConsumptionTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [consumptionHistory, setConsumptionHistory] = useState<ConsumptionRecord[]>([]);
  const [kitchenData, setKitchenData] = useState<KitchenConsumptionData | null>(null);
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | '90days' | 'all'>('30days');
  const [sortBy, setSortBy] = useState<'date' | 'quantity' | 'value'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [selectedView, setSelectedView] = useState<'chart' | 'table'>('chart');
  const [selectedWasteView, setSelectedWasteView] = useState<'reasons' | 'items'>('items');

  // Fetch consumption history data
  const fetchConsumptionHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/food-supply/consumption-history?kitchenId=${kitchenId}`);
      if (!response.ok) throw new Error('Failed to load consumption history');
      const data = await response.json();
      console.log(`[KitchenConsumptionTab] Fetched ${data.length} consumption records for kitchen ${kitchenId}`);
      setConsumptionHistory(data);
    } catch (error) {
      console.error('Error loading consumption history:', error);
      toast({
        title: t('error'),
        description: t('failed_to_load_consumption_history'),
        variant: "destructive",
      });
      setConsumptionHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch kitchen consumption details
  const fetchKitchenDetails = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/kitchens/consumption-details?kitchenId=${kitchenId}`);
      if (!response.ok) throw new Error('Failed to load kitchen consumption details');
      const data = await response.json();
      console.log(`[KitchenConsumptionTab] Fetched kitchen details for ${kitchenId}`);
      setKitchenData(data);
    } catch (error) {
      console.error('Error loading kitchen details:', error);
      toast({
        title: t('error'),
        description: t('failed_to_load_kitchen_details'),
        variant: "destructive",
      });
      setKitchenData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    if (kitchenId) {
      fetchConsumptionHistory();
      fetchKitchenDetails();
    }
  }, [kitchenId]);

  // Filter consumption history based on time range and other filters
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
        if (selectedCategory === 'waste') {
          return record.isWaste === true;
        }
        if (selectedCategory === 'recipe') {
          return record.source === 'recipe';
        }
        if (selectedCategory === 'direct') {
          return !record.isWaste && record.source !== 'recipe';
        }
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

  // Get top wasted items
  const getTopWastedItems = () => {
    const itemMap = new Map<string, { name: string; unit: string; quantity: number; value: number; reason: string }>();
    
    filteredHistory.forEach(record => {
      if (record.isWaste) {
        const key = record.foodSupply.name;
        if (!itemMap.has(key)) {
          itemMap.set(key, {
            name: record.foodSupply.name,
            unit: record.foodSupply.unit,
            quantity: 0,
            value: 0,
            reason: record.reason || 'Unknown'
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

  // Get waste reasons
  const getWasteReasons = () => {
    const reasonMap = new Map<string, { reason: string; quantity: number; value: number; count: number }>();
    
    filteredHistory.forEach(record => {
      if (record.isWaste) {
        const key = record.reason || 'Unknown';
        if (!reasonMap.has(key)) {
          reasonMap.set(key, {
            reason: key,
            quantity: 0,
            value: 0,
            count: 0
          });
        }
        const item = reasonMap.get(key)!;
        item.quantity += record.quantity;
        item.value += record.quantity * record.foodSupply.pricePerUnit;
        item.count += 1;
      }
    });
    
    return Array.from(reasonMap.values())
      .sort((a, b) => b.value - a.value);
  };

  // Get consumption by food category
  const getConsumptionByFoodCategory = () => {
    const categoryMap = new Map<string, { category: string; quantity: number; value: number; count: number }>();
    
    filteredHistory.forEach(record => {
      if (!record.isWaste) {
        const key = record.foodSupply.category || 'Uncategorized';
        if (!categoryMap.has(key)) {
          categoryMap.set(key, {
            category: key,
            quantity: 0,
            value: 0,
            count: 0
          });
        }
        const category = categoryMap.get(key)!;
        category.quantity += record.quantity;
        category.value += record.quantity * record.foodSupply.pricePerUnit;
        category.count += 1;
      }
    });
    
    return Array.from(categoryMap.values())
      .sort((a, b) => b.value - a.value);
  };

  // Calculate waste percentage
  const wastePercentage = (() => {
    const totalQuantity = filteredHistory.reduce((sum, record) => sum + record.quantity, 0);
    const wastedQuantity = filteredHistory.filter(r => r.isWaste).reduce((sum, record) => sum + record.quantity, 0);
    
    return totalQuantity > 0 ? (wastedQuantity / totalQuantity) * 100 : 0;
  })();

  // Format date with relative time
  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = differenceInDays(now, date);
    
    if (diffDays === 0) {
      return t('today_at', { time: format(date, 'h:mm a') });
    } else if (diffDays === 1) {
      return t('yesterday_at', { time: format(date, 'h:mm a') });
    } else if (diffDays < 7) {
      return t('days_ago', { days: diffDays, time: format(date, 'h:mm a') });
    } else {
      return format(date, 'MMM d, yyyy h:mm a');
    }
  };

  // Calculate trend percentage
  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // Get trend data from kitchen data
  const getTrendData = () => {
    if (!kitchenData?.consumptionTrends || kitchenData.consumptionTrends.length < 2) {
      return { percentage: 0, isUp: false };
    }
    
    const trends = kitchenData.consumptionTrends;
    const currentMonth = trends[trends.length - 1].value;
    const previousMonth = trends[trends.length - 2].value;
    
    const percentage = calculateTrend(currentMonth, previousMonth);
    return {
      percentage: Math.abs(Math.round(percentage)),
      isUp: percentage > 0
    };
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
                <h2 class="text-xl font-semibold text-gray-800">${t('waste_analysis')}</h2>
              </div>
              <div class="p-6">
                <div class="mb-6">
                  <p class="text-sm text-gray-700 mb-2">${t('waste_percentage')}: <span class="font-bold">${wastePercentage.toFixed(1)}%</span></p>
                  <div class="w-full bg-gray-200 rounded-full h-2.5">
                    <div class="bg-red-600 h-2.5 rounded-full" style="width: ${Math.min(wastePercentage, 100)}%"></div>
                  </div>
                </div>
                
                <h3 class="text-lg font-medium mb-3">${t('top_wasted_items')}</h3>
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('item')}</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('quantity')}</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('value')}</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('reason')}</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    ${getTopWastedItems().map((item, index) => `
                      <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                        <td class="px-4 py-3 text-sm text-gray-900">${item.name}</td>
                        <td class="px-4 py-3 text-sm text-gray-900">${item.quantity.toFixed(2)} ${item.unit}</td>
                        <td class="px-4 py-3 text-sm font-medium text-gray-900">QAR ${item.value.toFixed(2)}</td>
                        <td class="px-4 py-3 text-sm text-gray-900">${item.reason}</td>
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

  // Get today's consumption
  const getTodayConsumption = () => {
    return filteredHistory
      .filter(r => !r.isWaste && new Date(r.date).toDateString() === new Date().toDateString())
      .reduce((sum, record) => sum + record.quantity, 0);
  };

  // Get today's waste
  const getTodayWaste = () => {
    return filteredHistory
      .filter(r => r.isWaste && new Date(r.date).toDateString() === new Date().toDateString())
      .reduce((sum, record) => sum + record.quantity, 0);
  };

  // Get this week's consumption
  const getWeek = (days: number) => {
    return filteredHistory
      .filter(r => !r.isWaste && new Date(r.date) >= subDays(new Date(), days))
      .reduce((sum, record) => sum + record.quantity, 0);
  };

  // Get this week's waste
  const getWeekWaste = (days: number) => {
    return filteredHistory
      .filter(r => r.isWaste && new Date(r.date) >= subDays(new Date(), days))
      .reduce((sum, record) => sum + record.quantity, 0);
  };

  const trendData = getTrendData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-blue-200 dark:border-blue-800 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20 dark:to-transparent border-b border-blue-100 dark:border-blue-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2 text-blue-800 dark:text-blue-300">
                <Utensils className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                {t('kitchen_consumption')} - {kitchenName}
              </CardTitle>
              <CardDescription className="text-blue-600 dark:text-blue-400 mt-1">
                {t('track_analyze_optimize')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  fetchConsumptionHistory();
                  fetchKitchenDetails();
                }}
                disabled={isLoading}
                className="bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-800"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {t('refresh')}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={generateDetailedReport}
                disabled={isLoading || isGeneratingReport || filteredHistory.length === 0}
                className="bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-800"
              >
                <Printer className={`h-4 w-4 mr-2 ${isGeneratingReport ? 'animate-spin' : ''}`} />
                {t('print_report')}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={isLoading || filteredHistory.length === 0}
                className="bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-800"
              >
                <Download className="h-4 w-4 mr-2" />
                {t('export_csv')}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 h-10">
          <TabsTrigger value="dashboard" className="text-sm">
            <BarChart2 className="h-4 w-4 mr-2" />
            {t('dashboard')}
          </TabsTrigger>
          <TabsTrigger value="record" className="text-sm">
            <Package className="h-4 w-4 mr-2" />
            {t('record')}
          </TabsTrigger>
          <TabsTrigger value="history" className="text-sm">
            <Calendar className="h-4 w-4 mr-2" />
            {t('history')}
          </TabsTrigger>
          <TabsTrigger value="waste" className="text-sm">
            <Trash2 className="h-4 w-4 mr-2" />
            {t('waste')}
          </TabsTrigger>
        </TabsList>
        
        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">{t('loading_kitchen_data')}</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      {t('total_consumption')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                      {kitchenData?.totalConsumption.toFixed(1) || '0'}
                    </div>
                    <div className="flex items-center text-sm text-blue-600/80 dark:text-blue-400/80 mt-1">
                      {t('units_consumed')}
                      {trendData && (
                        <div className={`ml-2 flex items-center ${trendData.isUp ? 'text-green-600' : 'text-red-600'}`}>
                          {trendData.isUp ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {trendData.percentage}%
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 border-red-200 dark:border-red-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-red-600" />
                      {t('total_waste')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-700 dark:text-red-400">
                      {kitchenData?.waste.totalWaste.toFixed(1) || '0'}
                    </div>
                    <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">{t('units_wasted')}</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10 border-amber-200 dark:border-amber-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Percent className="h-4 w-4 text-amber-600" />
                      {t('waste_percentage')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-amber-700 dark:text-amber-400">
                      {kitchenData?.waste.avgWastePercentage.toFixed(1) || '0'}%
                    </div>
                    <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-1">{t('of_total_consumption')}</p>
                    <div className="mt-2 w-full bg-amber-200 rounded-full h-1.5">
                      <div 
                        className="bg-amber-600 h-1.5 rounded-full" 
                        style={{ width: `${Math.min(kitchenData?.waste.avgWastePercentage || 0, 100)}%` }}
                      ></div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 border-green-200 dark:border-green-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      {t('kitchen_efficiency')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                      {kitchenData?.kitchenEfficiency || '100'}%
                    </div>
                    <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">{t('resource_utilization')}</p>
                    <div className="mt-2 w-full bg-green-200 rounded-full h-1.5">
                      <div 
                        className="bg-green-600 h-1.5 rounded-full" 
                        style={{ width: `${kitchenData?.kitchenEfficiency || 100}%` }}
                      ></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Main Dashboard Content */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left Column */}
                <div className="md:col-span-8 space-y-6">
                  {/* Top Consumed Items */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-blue-600" />
                        {t('top_consumed_items')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {getTopConsumedItems().length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                          <p>{t('no_consumption_data_available')}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {getTopConsumedItems().map((item, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium">{item.name}</span>
                                  <span className="text-sm text-muted-foreground">
                                    {item.quantity.toFixed(1)} {item.unit}
                                  </span>
                                </div>
                                <Progress 
                                  value={item.value} 
                                  max={getTopConsumedItems()[0]?.value || 0}
                                  className="h-2" 
                                />
                                <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                                  <span>QAR {item.value.toFixed(2)}</span>
                                  <span>{Math.round((item.value / totalValueConsumed) * 100)}% {t('of_total')}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  {/* Consumption by Category */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <PieChart className="h-5 w-5 text-blue-600" />
                        {t('consumption_by_category')}
                      </CardTitle>
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
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Food Categories */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <LineChart className="h-5 w-5 text-blue-600" />
                        {t('consumption_by_food_category')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {getConsumptionByFoodCategory().length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <PieChart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                          <p>{t('no_category_data_available')}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {getConsumptionByFoodCategory().map((category, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium capitalize">{category.category}</span>
                                  <span className="text-sm text-muted-foreground">
                                    {category.count} {t('items')}
                                  </span>
                                </div>
                                <Progress 
                                  value={category.value} 
                                  max={getConsumptionByFoodCategory()[0]?.value || 0}
                                  className="h-2" 
                                />
                                <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                                  <span>QAR {category.value.toFixed(2)}</span>
                                  <span>{Math.round((category.value / totalValueConsumed) * 100)}% {t('of_total')}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
                
                {/* Right Column */}
                <div className="md:col-span-4 space-y-6">
                  {/* Top Wasted Items */}
                  <Card className="border-red-200 dark:border-red-800">
                    <CardHeader className="bg-gradient-to-r from-red-50 to-transparent dark:from-red-900/20 dark:to-transparent">
                      <CardTitle className="text-lg flex items-center gap-2 text-red-800 dark:text-red-300">
                        <Trash2 className="h-5 w-5 text-red-600" />
                        {t('top_wasted_items')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {getTopWastedItems().length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <Trash2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                          <p>{t('no_waste_data_available')}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {getTopWastedItems().map((item, index) => (
                            <div key={index} className="border-b border-red-100 dark:border-red-800 pb-3 last:border-0 last:pb-0">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-medium">{item.name}</span>
                                <Badge variant="destructive">
                                  {item.quantity.toFixed(1)} {item.unit}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground flex justify-between">
                                <span>{item.reason}</span>
                                <span>QAR {item.value.toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  {/* Recent Activity */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{t('recent_activity')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {isLoading ? (
                          <div className="flex flex-col items-center justify-center py-6 space-y-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                            <p className="text-muted-foreground">{t('loading')}</p>
                          </div>
                        ) : filteredHistory.length === 0 ? (
                          <div className="text-center py-6">
                            <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                            <p className="text-muted-foreground">{t('no_recent_consumption_records')}</p>
                            <p className="text-sm text-muted-foreground mt-1">{t('add_consumption_to_see_records')}</p>
                          </div>
                        ) : (
                          filteredHistory.slice(0, 5).map((record) => (
                            <div
                              key={record.id}
                              className={`border rounded-lg p-3 space-y-2 ${
                                record.isWaste 
                                  ? 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800' 
                                  : record.source === 'recipe'
                                    ? 'border-purple-200 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800'
                                    : 'border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800'
                              }`}
                            >
                              <div className="flex justify-between">
                                <span className="font-medium">{record.foodSupply.name}</span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">{formatRelativeDate(record.date)}</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={record.isWaste ? "destructive" : "default"} className="text-md">
                                  {record.quantity} {record.foodSupply.unit}
                                </Badge>
                                <Badge variant="secondary" className="text-md">
                                  QAR {(record.quantity * record.foodSupply.pricePerUnit).toFixed(2)}
                                </Badge>
                                {record.isWaste && (
                                  <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                                    {t('waste')} {record.reason ? `- ${record.reason}` : ''}
                                  </Badge>
                                )}
                                {record.source === 'recipe' && (
                                  <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800">
                                    {t('recipe')} {record.recipeName ? `- ${record.recipeName}` : ''}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="border-t pt-4">
                      <Button 
                        variant="ghost" 
                        className="w-full" 
                        onClick={() => setActiveTab('history')}
                      >
                        {t('view_all_records')}
                      </Button>
                    </CardFooter>
                  </Card>
                  
                  {/* Recommendations */}
                  {kitchenData?.recommendations && kitchenData.recommendations.length > 0 && (
                    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800">
                      <CardHeader>
                        <CardTitle className="text-blue-800 dark:text-blue-300 flex items-center gap-2">
                          <Info className="h-5 w-5 text-blue-600" />
                          {t('recommendations')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {kitchenData.recommendations.map((recommendation, index) => (
                            <li key={index} className="flex items-start">
                              <div className="mt-1 mr-2 flex-shrink-0">
                                <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
                                  {index + 1}
                                </div>
                              </div>
                              <p className="text-blue-700 dark:text-blue-300">{recommendation}</p>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Anomalies */}
                  {kitchenData?.anomalies && kitchenData.anomalies.length > 0 && (
                    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800">
                      <CardHeader>
                        <CardTitle className="text-amber-800 dark:text-amber-300 flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-amber-600" />
                          {t('anomalies')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {kitchenData.anomalies.map((anomaly, index) => (
                            <div key={index} className="flex items-start p-3 border border-amber-200 dark:border-amber-800 rounded-md bg-amber-100/50 dark:bg-amber-900/20">
                              <div className="mr-3 mt-0.5">
                                <Badge variant={anomaly.impact === 'High' ? 'destructive' : 'outline'} className="uppercase text-xs">
                                  {anomaly.impact}
                                </Badge>
                              </div>
                              <div>
                                <p className="font-medium text-amber-900 dark:text-amber-300">{anomaly.item}</p>
                                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">{anomaly.issue}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </>
          )}
        </TabsContent>
        
        {/* Record Tab */}
        <TabsContent value="record" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Column - Forms */}
            <div className="md:col-span-7 space-y-6">
              {/* Consumption Tracking */}
              <Card className="border-blue-200 dark:border-blue-800 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20 dark:to-transparent border-b border-blue-100 dark:border-blue-800">
                  <CardTitle className="text-lg flex items-center gap-2 text-blue-800 dark:text-blue-300">
                    <Package className="h-5 w-5 text-blue-600" />
                    {t('consumption_tracking')}
                  </CardTitle>
                  <CardDescription className="text-blue-600 dark:text-blue-400">
                    {t('record_consumption_details')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
                      <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">{t('today')}</p>
                      <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                        {getTodayConsumption().toFixed(1)} {filteredHistory[0]?.foodSupply.unit || 'kg'}
                      </p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
                      <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">{t('this_week')}</p>
                      <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                        {getWeek(7).toFixed(1)} {filteredHistory[0]?.foodSupply.unit || 'kg'}
                      </p>
                    </div>
                  </div>
                  
                  <EnhancedKitchenFoodSupplyForm 
                    kitchenId={kitchenId} 
                    kitchenName={kitchenName}
                    onSuccess={() => {
                      fetchConsumptionHistory();
                      fetchKitchenDetails();
                    }}
                  />
                </CardContent>
              </Card>
              
              {/* Waste Tracking */}
              <Card className="border-red-200 dark:border-red-800 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-red-50 to-transparent dark:from-red-900/20 dark:to-transparent border-b border-red-100 dark:border-red-800">
                  <CardTitle className="text-lg flex items-center gap-2 text-red-800 dark:text-red-300">
                    <Trash2 className="h-5 w-5 text-red-600" />
                    {t('waste_tracking')}
                  </CardTitle>
                  <CardDescription className="text-red-600 dark:text-red-400">
                    {t('record_waste_details')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-100 dark:border-red-800">
                      <p className="text-xs text-red-600 dark:text-red-400 mb-1">{t('today')}</p>
                      <p className="text-2xl font-bold text-red-800 dark:text-red-300">
                        {getTodayWaste().toFixed(1)} {filteredHistory[0]?.foodSupply.unit || 'kg'}
                      </p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-100 dark:border-red-800">
                      <p className="text-xs text-red-600 dark:text-red-400 mb-1">{t('this_week')}</p>
                      <p className="text-2xl font-bold text-red-800 dark:text-red-300">
                        {getWeekWaste(7).toFixed(1)} {filteredHistory[0]?.foodSupply.unit || 'kg'}
                      </p>
                    </div>
                  </div>
                  
                  <EnhancedWasteTrackingDialog 
                    kitchenId={kitchenId}
                    onSuccess={() => {
                      fetchConsumptionHistory();
                      fetchKitchenDetails();
                    }}
                  />
                </CardContent>
              </Card>
            </div>
            
            {/* Right Column - Barcode Scanner & Recent Records */}
            <div className="md:col-span-5 space-y-6">
              {/* Barcode Scanner */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    {t('barcode_scanner')}
                  </CardTitle>
                  <CardDescription>
                    {t('scan_barcodes_to_record_consumption')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {kitchenId ? (
                    <BarcodeScannerFood 
                      kitchenId={kitchenId} 
                      onScanComplete={() => {
                        fetchConsumptionHistory();
                        fetchKitchenDetails();
                      }}
                    />
                  ) : (
                    <p className="text-muted-foreground">{t('loading_kitchen_information')}</p>
                  )}
                </CardContent>
              </Card>
              
              {/* Recent Records */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    {t('recent_records')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-6 space-y-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        <p className="text-muted-foreground">{t('loading')}</p>
                      </div>
                    ) : filteredHistory.length === 0 ? (
                      <div className="text-center py-6">
                        <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-muted-foreground">{t('no_recent_consumption_records')}</p>
                        <p className="text-sm text-muted-foreground mt-1">{t('add_consumption_to_see_records')}</p>
                      </div>
                    ) : (
                      filteredHistory.slice(0, 5).map((record) => (
                        <div
                          key={record.id}
                          className={`border rounded-lg p-3 space-y-2 ${
                            record.isWaste 
                              ? 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800' 
                              : record.source === 'recipe'
                                ? 'border-purple-200 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800'
                                : 'border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800'
                          }`}
                        >
                          <div className="flex justify-between">
                            <span className="font-medium">{record.foodSupply.name}</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">{formatRelativeDate(record.date)}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={record.isWaste ? "destructive" : "default"} className="text-md">
                              {record.quantity} {record.foodSupply.unit}
                            </Badge>
                            <Badge variant="secondary" className="text-md">
                              QAR {(record.quantity * record.foodSupply.pricePerUnit).toFixed(2)}
                            </Badge>
                            {record.isWaste && (
                              <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                                {t('waste')} {record.reason ? `- ${record.reason}` : ''}
                              </Badge>
                            )}
                            {record.source === 'recipe' && (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800">
                                {t('recipe')} {record.recipeName ? `- ${record.recipeName}` : ''}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
                <CardFooter className="border-t pt-4">
                  <Button 
                    variant="ghost" 
                    className="w-full" 
                    onClick={() => setActiveTab('history')}
                  >
                    {t('view_all_records')}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">{t('loading_consumption_history')}</p>
            </div>
          ) : (
            <>
              {/* Filters */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={t('search_by_item_or_user')}
                          className="pl-8"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                    <Select value={timeRange} onValueChange={(value) => setTimeRange(value as any)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t('select_time_range')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7days">{t('last_7_days')}</SelectItem>
                        <SelectItem value="30days">{t('last_30_days')}</SelectItem>
                        <SelectItem value="90days">{t('last_90_days')}</SelectItem>
                        <SelectItem value="all">{t('all_time')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t('select_category')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('all_categories')}</SelectItem>
                        <SelectItem value="direct">{t('direct_consumption')}</SelectItem>
                        <SelectItem value="recipe">{t('recipe_consumption')}</SelectItem>
                        <SelectItem value="waste">{t('waste')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex border rounded-md overflow-hidden">
                      <Button
                        variant={selectedView === 'chart' ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => setSelectedView('chart')}
                        className="rounded-none"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={selectedView === 'table' ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => setSelectedView('table')}
                        className="rounded-none"
                      >
                        <Package className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
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
                    <div className="flex items-center text-sm text-green-600/80 dark:text-green-400/80 mt-1">
                      {t('units_consumed')}
                      {trendData && (
                        <div className={`ml-2 flex items-center ${trendData.isUp ? 'text-green-600' : 'text-red-600'}`}>
                          {trendData.isUp ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {trendData.percentage}%
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10 border-amber-200 dark:border-amber-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{t('waste_percentage')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-amber-700 dark:text-amber-400">
                      {wastePercentage.toFixed(1)}%
                    </div>
                    <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-1">{t('of_total_consumption')}</p>
                    <div className="mt-2 w-full bg-amber-200 rounded-full h-1.5">
                      <div 
                        className="bg-amber-600 h-1.5 rounded-full" 
                        style={{ width: `${Math.min(wastePercentage, 100)}%` }}
                      ></div>
                    </div>
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
                    <p className="text-sm text-purple-600/80 dark:text-purple-400/80 mt-1 flex items-center">
                      <DollarSign className="h-3 w-3 mr-1" />
                      {t('total_consumption_value')}
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              {selectedView === 'chart' && (
                <>
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
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Charts Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Package className="h-5 w-5 text-blue-600" />
                          {t('top_consumed_items')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {getTopConsumedItems().length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                            <p>{t('no_consumption_data_available')}</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {getTopConsumedItems().map((item, index) => (
                              <div key={index} className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium">{item.name}</span>
                                    <span className="text-sm text-muted-foreground">
                                      {item.quantity.toFixed(1)} {item.unit}
                                    </span>
                                  </div>
                                  <Progress 
                                    value={item.value} 
                                    max={getTopConsumedItems()[0]?.value || 0}
                                    className="h-2" 
                                  />
                                  <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                                    <span>QAR {item.value.toFixed(2)}</span>
                                    <span>{Math.round((item.value / totalValueConsumed) * 100)}% {t('of_total')}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <PieChart className="h-5 w-5 text-blue-600" />
                          {t('consumption_by_food_category')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {getConsumptionByFoodCategory().length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <PieChart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                            <p>{t('no_category_data_available')}</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {getConsumptionByFoodCategory().map((category, index) => (
                              <div key={index} className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium capitalize">{category.category}</span>
                                    <span className="text-sm text-muted-foreground">
                                      {category.count} {t('items')}
                                    </span>
                                  </div>
                                  <Progress 
                                    value={category.value} 
                                    max={getConsumptionByFoodCategory()[0]?.value || 0}
                                    className="h-2" 
                                  />
                                  <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                                    <span>QAR {category.value.toFixed(2)}</span>
                                    <span>{Math.round((category.value / totalValueConsumed) * 100)}% {t('of_total')}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
              
              {/* Records Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('consumption_records')}</CardTitle>
                </CardHeader>
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
                        <Package className="h-12 w-12 mb-3 opacity-20" />
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
            </>
          )}
        </TabsContent>
        
        {/* Waste Tab */}
        <TabsContent value="waste" className="space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">{t('loading_waste_data')}</p>
            </div>
          ) : (
            <>
              {/* Waste Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 border-red-200 dark:border-red-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-800 dark:text-red-300 flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-red-600" />
                      {t('total_waste')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-700 dark:text-red-400">
                      {kitchenData?.waste.totalWaste.toFixed(1) || '0'}
                    </div>
                    <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">{t('units_wasted')}</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10 border-amber-200 dark:border-amber-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
                      <Percent className="h-4 w-4 text-amber-600" />
                      {t('waste_percentage')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-amber-700 dark:text-amber-400">
                      {kitchenData?.waste.avgWastePercentage.toFixed(1) || '0'}%
                    </div>
                    <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-1">{t('of_total_consumption')}</p>
                    <div className="mt-2 w-full bg-amber-200 rounded-full h-1.5">
                      <div 
                        className="bg-amber-600 h-1.5 rounded-full" 
                        style={{ width: `${Math.min(kitchenData?.waste.avgWastePercentage || 0, 100)}%` }}
                      ></div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 border-green-200 dark:border-green-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      {t('kitchen_efficiency')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                      {kitchenData?.kitchenEfficiency || '100'}%
                    </div>
                    <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">{t('resource_utilization')}</p>
                    <div className="mt-2 w-full bg-green-200 rounded-full h-1.5">
                      <div 
                        className="bg-green-600 h-1.5 rounded-full" 
                        style={{ width: `${kitchenData?.kitchenEfficiency || 100}%` }}
                      ></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Waste Tracking Actions */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                      <Trash2 className="h-5 w-5 text-red-600" />
                      {t('waste_tracking')}
                    </CardTitle>
                    <EnhancedWasteTrackingDialog 
                      kitchenId={kitchenId}
                      onSuccess={() => {
                        fetchConsumptionHistory();
                        fetchKitchenDetails();
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-muted-foreground">
                      {t('view_waste_data_by')}:
                    </div>
                    <div className="flex border rounded-md overflow-hidden">
                      <Button
                        variant={selectedWasteView === 'items' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedWasteView('items')}
                        className="rounded-none"
                      >
                        {t('items')}
                      </Button>
                      <Button
                        variant={selectedWasteView === 'reasons' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedWasteView('reasons')}
                        className="rounded-none"
                      >
                        {t('reasons')}
                      </Button>
                    </div>
                  </div>
                  
                  {selectedWasteView === 'items' ? (
                    <div className="space-y-4">
                      {kitchenData?.waste.items && kitchenData.waste.items.length > 0 ? (
                        kitchenData.waste.items.map((item, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="font-medium">{item.name}</h3>
                                <p className="text-sm text-muted-foreground">{t('total_wasted')}: {item.totalWasted.toFixed(1)} {item.unit}</p>
                              </div>
                              <Badge variant="destructive">
                                {item.wastePercentage.toFixed(1)}% {t('waste')}
                              </Badge>
                            </div>
                            
                            <Separator className="my-3" />
                            
                            <div className="space-y-2">
                              <div className="text-sm font-medium">{t('waste_reasons')}:</div>
                              {item.wasteReasons.map((reason, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                  <div className="flex items-center">
                                    <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                                    <span>{reason.reason}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span>{reason.quantity.toFixed(1)} {item.unit}</span>
                                    <span className="text-xs text-muted-foreground">({reason.percentage.toFixed(0)}%)</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <Trash2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-muted-foreground">{t('no_waste_data_available')}</p>
                          <p className="text-sm text-muted-foreground mt-1">{t('record_waste_to_see_data')}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {getWasteReasons().length > 0 ? (
                        getWasteReasons().map((reason, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="font-medium">{reason.reason}</h3>
                                <p className="text-sm text-muted-foreground">{t('occurrences')}: {reason.count}</p>
                              </div>
                              <Badge variant={
                                reason.reason.toLowerCase().includes('expir') ? 'destructive' : 
                                reason.reason.toLowerCase().includes('quality') ? 'outline' : 
                                'secondary'
                              }>
                                {reason.quantity.toFixed(1)} {t('units')}
                              </Badge>
                            </div>
                            
                            <div className="mt-2">
                              <div className="flex justify-between text-sm mb-1">
                                <span>{t('value_lost')}</span>
                                <span className="font-medium">QAR {reason.value.toFixed(2)}</span>
                              </div>
                              <Progress 
                                value={reason.value} 
                                max={getWasteReasons()[0]?.value || 0}
                                className="h-2 bg-red-100" 
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-muted-foreground">{t('no_waste_reasons_available')}</p>
                          <p className="text-sm text-muted-foreground mt-1">{t('record_waste_with_reasons')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Recommendations */}
              {kitchenData?.recommendations && kitchenData.recommendations.length > 0 && (
                <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800">
                  <CardHeader>
                    <CardTitle className="text-blue-800 dark:text-blue-300 flex items-center gap-2">
                      <Info className="h-5 w-5 text-blue-600" />
                      {t('waste_reduction_recommendations')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {kitchenData.recommendations.map((recommendation, index) => (
                        <li key={index} className="flex items-start">
                          <div className="mt-1 mr-2 flex-shrink-0">
                            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
                              {index + 1}
                            </div>
                          </div>
                          <p className="text-blue-700 dark:text-blue-300">{recommendation}</p>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              
              {/* Anomalies */}
              {kitchenData?.anomalies && kitchenData.anomalies.length > 0 && (
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800">
                  <CardHeader>
                    <CardTitle className="text-amber-800 dark:text-amber-300 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      {t('consumption_anomalies')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {kitchenData.anomalies.map((anomaly, index) => (
                        <div key={index} className="flex items-start p-3 border border-amber-200 dark:border-amber-800 rounded-md bg-amber-100/50 dark:bg-amber-900/20">
                          <div className="mr-3 mt-0.5">
                            <Badge variant={anomaly.impact === 'High' ? 'destructive' : 'outline'} className="uppercase text-xs">
                              {anomaly.impact}
                            </Badge>
                          </div>
                          <div>
                            <p className="font-medium text-amber-900 dark:text-amber-300">{anomaly.item}</p>
                            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">{anomaly.issue}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Footer */}
      <Card className="border-t border-blue-100 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
        <CardFooter className="py-3 px-6 text-xs text-muted-foreground">
          <div className="w-full flex justify-between items-center">
            <div>
              {t('kitchen_consumption')} - {kitchenName}
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
    </div>
  );
}