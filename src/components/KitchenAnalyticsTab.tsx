import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/contexts/TranslationContext';
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Printer, 
  Download,
  AlertTriangle,
  ChefHat,
  Utensils,
  Trash2,
  Clock,
  Calendar,
  DollarSign,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lightbulb
} from 'lucide-react';
import { format } from 'date-fns';
import { printContentWithIframe } from '@/util/print';

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
  recommendations: string[];
  anomalies: Array<{
    item: string;
    issue: string;
    impact: string;
  }>;
};

interface KitchenAnalyticsTabProps {
  kitchenId: string;
  kitchenName: string;
}

export function KitchenAnalyticsTab({ kitchenId, kitchenName }: KitchenAnalyticsTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [kitchenData, setKitchenData] = useState<KitchenConsumptionData | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch kitchen consumption details
  const fetchKitchenData = async () => {
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    if (kitchenId) {
      fetchKitchenData();
    }
  }, [kitchenId]);

  // Generate and print analytics report
  const generateAnalyticsReport = async () => {
    if (!kitchenData) return;
    
    setIsGeneratingReport(true);
    
    try {
      // Create report content
      const reportContent = `
        <div class="p-8 max-w-5xl mx-auto">
          <div class="flex justify-between items-center mb-8 border-b pb-6">
            <div>
              <h1 class="text-3xl font-bold text-gray-800">${kitchenName} - ${t('analytics_report')}</h1>
              <p class="text-gray-600 mt-1">${t('generated_on')} ${new Date().toLocaleDateString()}</p>
            </div>
            <div class="text-right">
              <p class="text-sm text-gray-500">${t('report_type')}: ${t('kitchen_analytics')}</p>
              <p class="text-sm font-medium">${t('report_id')}: ${Math.random().toString(36).substring(2, 10).toUpperCase()}</p>
            </div>
          </div>
          
          <div class="mb-8">
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
              <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                <h2 class="text-xl font-semibold text-gray-800">${t('kitchen_performance_summary')}</h2>
              </div>
              <div class="p-6">
                <div class="grid grid-cols-3 gap-6">
                  <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <p class="text-sm text-blue-700 font-medium mb-1">${t('total_consumption')}</p>
                    <p class="text-xl font-bold text-blue-900">${kitchenData.totalConsumption.toFixed(2)}</p>
                  </div>
                  <div class="bg-red-50 p-4 rounded-lg border border-red-100">
                    <p class="text-sm text-red-700 font-medium mb-1">${t('total_waste')}</p>
                    <p class="text-xl font-bold text-red-900">${kitchenData.totalWaste.toFixed(2)}</p>
                  </div>
                  <div class="bg-green-50 p-4 rounded-lg border border-green-100">
                    <p class="text-sm text-green-700 font-medium mb-1">${t('kitchen_efficiency')}</p>
                    <p class="text-xl font-bold text-green-900">${kitchenData.kitchenEfficiency}%</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
              <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                <h2 class="text-xl font-semibold text-gray-800">${t('monthly_consumption_trends')}</h2>
              </div>
              <div class="p-6">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('month')}</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('consumption_value')}</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('trend')}</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    ${kitchenData.consumptionTrends.map((trend, index, arr) => {
                      const prevValue = index > 0 ? arr[index - 1].value : 0;
                      const change = prevValue > 0 ? ((trend.value - prevValue) / prevValue) * 100 : 0;
                      return `
                        <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                          <td class="px-4 py-3 text-sm text-gray-900">${trend.month}</td>
                          <td class="px-4 py-3 text-sm text-gray-900">${trend.value.toFixed(2)}</td>
                          <td class="px-4 py-3 text-sm">
                            ${index > 0 ? `
                              <span class="${change > 0 ? 'text-red-600' : 'text-green-600'}">
                                ${change > 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}%
                              </span>
                            ` : '-'}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
              <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                <h2 class="text-xl font-semibold text-gray-800">${t('top_wasted_items')}</h2>
              </div>
              <div class="p-6">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('item')}</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('amount')}</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('waste_percentage')}</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    ${kitchenData.topWastedItems.map((item, index) => `
                      <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                        <td class="px-4 py-3 text-sm text-gray-900">${item.name}</td>
                        <td class="px-4 py-3 text-sm text-gray-900">${item.amount}</td>
                        <td class="px-4 py-3 text-sm font-medium text-red-600">${item.percentage}%</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
              <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                <h2 class="text-xl font-semibold text-gray-800">${t('recommendations')}</h2>
              </div>
              <div class="p-6">
                <ul class="list-disc pl-5 space-y-2">
                  ${kitchenData.recommendations.map(rec => `
                    <li class="text-gray-800">${rec}</li>
                  `).join('')}
                </ul>
              </div>
            </div>
            
            ${kitchenData.anomalies.length > 0 ? `
              <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                  <h2 class="text-xl font-semibold text-gray-800">${t('anomalies_detected')}</h2>
                </div>
                <div class="p-6">
                  <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                      <tr>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('item')}</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('issue')}</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${t('impact')}</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      ${kitchenData.anomalies.map((anomaly, index) => `
                        <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                          <td class="px-4 py-3 text-sm text-gray-900">${anomaly.item}</td>
                          <td class="px-4 py-3 text-sm text-gray-900">${anomaly.issue}</td>
                          <td class="px-4 py-3 text-sm font-medium ${anomaly.impact === 'High' ? 'text-red-600' : 'text-amber-600'}">${anomaly.impact}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : ''}
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
      await printContentWithIframe(reportContent, `${kitchenName} - ${t('analytics_report')}`);
      
      toast({
        title: t('report_generated'),
        description: t('analytics_report_generated_successfully'),
      });
    } catch (error) {
      console.error('Error generating analytics report:', error);
      toast({
        title: t('error'),
        description: t('failed_to_generate_report'),
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            {t('kitchen_analytics')} - {kitchenName}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchKitchenData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={generateAnalyticsReport}
              disabled={isLoading || isGeneratingReport || !kitchenData}
            >
              <Printer className={`h-4 w-4 mr-2 ${isGeneratingReport ? 'animate-spin' : ''}`} />
              {t('print_report')}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={isLoading || !kitchenData}
            >
              <Download className="h-4 w-4 mr-2" />
              {t('export_data')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">{t('loading_kitchen_analytics')}</p>
          </div>
        ) : !kitchenData ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-3 opacity-20" />
            <p>{t('no_analytics_data_available')}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchKitchenData}
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('try_again')}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Performance Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{t('total_consumption')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                    {kitchenData.totalConsumption.toFixed(1)}
                  </div>
                  <p className="text-sm text-blue-600/80 dark:text-blue-400/80 mt-1">{t('units_consumed')}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 border-red-200 dark:border-red-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{t('total_waste')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-700 dark:text-red-400">
                    {kitchenData.totalWaste.toFixed(1)}
                  </div>
                  <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">{t('units_wasted')}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 border-green-200 dark:border-green-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{t('kitchen_efficiency')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                    {kitchenData.kitchenEfficiency}%
                  </div>
                  <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">
                    {kitchenData.kitchenEfficiency >= 90 ? t('excellent') :
                     kitchenData.kitchenEfficiency >= 75 ? t('good') :
                     kitchenData.kitchenEfficiency >= 60 ? t('average') :
                     t('needs_improvement')}
                  </p>
                </CardContent>
              </Card>
            </div>
            
            {/* Tabs for different analytics views */}
            <div className="border rounded-md">
              <div className="flex overflow-x-auto">
                <button 
                  className={`px-4 py-2 text-sm font-medium ${activeTab === 'overview' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                  onClick={() => setActiveTab('overview')}
                >
                  {t('overview')}
                </button>
                <button 
                  className={`px-4 py-2 text-sm font-medium ${activeTab === 'trends' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                  onClick={() => setActiveTab('trends')}
                >
                  {t('consumption_trends')}
                </button>
                <button 
                  className={`px-4 py-2 text-sm font-medium ${activeTab === 'waste' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                  onClick={() => setActiveTab('waste')}
                >
                  {t('waste_analysis')}
                </button>
                <button 
                  className={`px-4 py-2 text-sm font-medium ${activeTab === 'insights' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                  onClick={() => setActiveTab('insights')}
                >
                  {t('insights')}
                </button>
              </div>
              
              <div className="p-4">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Monthly Consumption Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{t('monthly_consumption')}</CardTitle>
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
                      </CardContent>
                    </Card>
                    
                    {/* Top Consumed Items */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{t('top_consumed_items')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {kitchenData.items
                            .sort((a, b) => b.totalQuantity - a.totalQuantity)
                            .slice(0, 5)
                            .map((item, index) => (
                              <div key={index} className="flex items-center">
                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-800 dark:text-blue-300 font-medium mr-3">
                                  {index + 1}
                                </div>
                                <div className="flex-1">
                                  <div className="flex justify-between items-center mb-1">
                                    <h4 className="font-medium">{item.name}</h4>
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                      {item.totalQuantity.toFixed(1)} {item.unit}
                                    </Badge>
                                  </div>
                                  <Progress 
                                    value={item.totalQuantity} 
                                    max={kitchenData.items[0].totalQuantity}
                                    className="h-2 bg-gray-100" 
                                    indicatorClassName="bg-gradient-to-r from-blue-500 to-green-500" 
                                  />
                                </div>
                              </div>
                            ))}
                          
                          {kitchenData.items.length === 0 && (
                            <div className="text-center py-6 text-muted-foreground">
                              <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                              <p>{t('no_consumption_data_available')}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Anomalies */}
                    {kitchenData.anomalies.length > 0 && (
                      <Card className="border-amber-200">
                        <CardHeader className="bg-amber-50">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                            {t('anomalies_detected')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {kitchenData.anomalies.map((anomaly, index) => (
                              <div key={index} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                                <div className="flex items-start gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    anomaly.impact === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    <AlertTriangle className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <h4 className="font-medium">{anomaly.item}</h4>
                                    <p className="text-muted-foreground mt-1">{anomaly.issue}</p>
                                    <Badge 
                                      variant="outline" 
                                      className={`mt-2 ${
                                        anomaly.impact === 'High' 
                                          ? 'bg-red-50 text-red-700 border-red-200' 
                                          : 'bg-amber-50 text-amber-700 border-amber-200'
                                      }`}
                                    >
                                      {anomaly.impact} {t('impact')}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
                
                {/* Consumption Trends Tab */}
                {activeTab === 'trends' && (
                  <div className="space-y-6">
                    {/* Monthly Consumption Trends */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{t('monthly_consumption_trends')}</CardTitle>
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
                          
                          {/* Consumption by Food Type */}
                          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-lg p-4">
                            <h3 className="font-medium text-purple-800 dark:text-purple-300 mb-2">{t('food_type_distribution')}</h3>
                            
                            <div className="space-y-2">
                              {kitchenData.monthlyConsumption.byFoodType.slice(0, 3).map((item, index) => {
                                const totalValue = kitchenData.monthlyConsumption.byFoodType.reduce(
                                  (sum, i) => sum + i.data.reduce((s, v) => s + v, 0), 0
                                );
                                const itemValue = item.data.reduce((sum, v) => sum + v, 0);
                                const percentage = totalValue > 0 ? (itemValue / totalValue) * 100 : 0;
                                
                                return (
                                  <div key={index}>
                                    <div className="flex justify-between text-sm mb-1">
                                      <span className="truncate" title={item.name}>{item.name}</span>
                                      <span>{percentage.toFixed(1)}%</span>
                                    </div>
                                    <Progress 
                                      value={percentage} 
                                      max={100}
                                      className="h-2 bg-purple-200" 
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Consumption by Food Type */}
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
                  </div>
                )}
                
                {/* Waste Analysis Tab */}
                {activeTab === 'waste' && (
                  <div className="space-y-6">
                    {/* Waste Summary */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{t('waste_summary')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg p-4">
                            <h3 className="font-medium text-red-800 dark:text-red-300 mb-2">{t('total_waste')}</h3>
                            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                              {kitchenData.totalWaste.toFixed(1)}
                            </div>
                            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                              {t('units_wasted')}
                            </div>
                          </div>
                          
                          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg p-4">
                            <h3 className="font-medium text-amber-800 dark:text-amber-300 mb-2">{t('waste_percentage')}</h3>
                            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                              {kitchenData.waste.avgWastePercentage.toFixed(1)}%
                            </div>
                            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                              {t('of_total_consumption')}
                            </div>
                          </div>
                          
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4">
                            <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">{t('waste_reduction_target')}</h3>
                            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                              {Math.max(0, kitchenData.waste.avgWastePercentage - 5).toFixed(1)}%
                            </div>
                            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                              {t('recommended_target')}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Top Wasted Items */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{t('top_wasted_items')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {kitchenData.topWastedItems.map((item, index) => (
                            <div key={index} className="border border-red-100 rounded-lg p-4 bg-red-50/50">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-800 font-medium">
                                  {index + 1}
                                </div>
                                <div className="flex-1">
                                  <div className="flex justify-between items-center">
                                    <h4 className="font-medium">{item.name}</h4>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="bg-red-50 text-red-700">
                                        {item.amount}
                                      </Badge>
                                      <Badge variant="outline" className="bg-amber-50 text-amber-700">
                                        {item.percentage}% {t('waste')}
                                      </Badge>
                                    </div>
                                  </div>
                                  <Progress 
                                    value={item.percentage} 
                                    max={100}
                                    className="h-2 mt-2 bg-red-100" 
                                    indicatorClassName="bg-red-500" 
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {kitchenData.topWastedItems.length === 0 && (
                            <div className="text-center py-6 text-muted-foreground">
                              <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                              <p>{t('no_waste_data_available')}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Waste Reasons */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{t('waste_reasons')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {kitchenData.waste.items.length > 0 ? (
                          <div className="space-y-6">
                            {/* Waste Reasons Chart */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 flex items-center justify-center">
                                <div className="w-full max-w-xs aspect-square relative">
                                  {/* Simulated pie chart for waste reasons */}
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-full h-full rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                                      {/* Get all unique reasons */}
                                      {(() => {
                                        const allReasons = kitchenData.waste.items.flatMap(item => item.wasteReasons);
                                        const reasonsMap = new Map();
                                        
                                        allReasons.forEach(reason => {
                                          const key = reason.reason;
                                          if (!reasonsMap.has(key)) {
                                            reasonsMap.set(key, { reason: key, quantity: 0 });
                                          }
                                          reasonsMap.get(key).quantity += reason.quantity;
                                        });
                                        
                                        const totalWaste = Array.from(reasonsMap.values()).reduce((sum, r) => sum + r.quantity, 0);
                                        let cumulativePercentage = 0;
                                        
                                        const colors = [
                                          'bg-red-500 dark:bg-red-600',
                                          'bg-amber-500 dark:bg-amber-600',
                                          'bg-orange-500 dark:bg-orange-600',
                                          'bg-blue-500 dark:bg-blue-600',
                                          'bg-purple-500 dark:bg-purple-600',
                                        ];
                                        
                                        return Array.from(reasonsMap.values()).map((reason, index) => {
                                          const percentage = totalWaste > 0 ? (reason.quantity / totalWaste) * 100 : 0;
                                          const previousPercentage = cumulativePercentage;
                                          cumulativePercentage += percentage;
                                          
                                          return (
                                            <div 
                                              key={index}
                                              className={`absolute inset-0 ${colors[index % colors.length]}`}
                                              style={{
                                                clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos(cumulativePercentage * 3.6 * Math.PI / 180)}% ${50 - 50 * Math.sin(cumulativePercentage * 3.6 * Math.PI / 180)}%, ${50 + 50 * Math.cos(previousPercentage * 3.6 * Math.PI / 180)}% ${50 - 50 * Math.sin(previousPercentage * 3.6 * Math.PI / 180)}%)`
                                              }}
                                            ></div>
                                          );
                                        });
                                      })()}
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-[60%] h-[60%] rounded-full bg-white dark:bg-gray-900 flex items-center justify-center">
                                          <Trash2 className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-4">
                                {(() => {
                                  const allReasons = kitchenData.waste.items.flatMap(item => item.wasteReasons);
                                  const reasonsMap = new Map();
                                  
                                  allReasons.forEach(reason => {
                                    const key = reason.reason;
                                    if (!reasonsMap.has(key)) {
                                      reasonsMap.set(key, { reason: key, quantity: 0 });
                                    }
                                    reasonsMap.get(key).quantity += reason.quantity;
                                  });
                                  
                                  const totalWaste = Array.from(reasonsMap.values()).reduce((sum, r) => sum + r.quantity, 0);
                                  
                                  const colors = [
                                    'bg-red-500 dark:bg-red-600',
                                    'bg-amber-500 dark:bg-amber-600',
                                    'bg-orange-500 dark:bg-orange-600',
                                    'bg-blue-500 dark:bg-blue-600',
                                    'bg-purple-500 dark:bg-purple-600',
                                  ];
                                  
                                  return Array.from(reasonsMap.values())
                                    .sort((a, b) => b.quantity - a.quantity)
                                    .map((reason, index) => {
                                      const percentage = totalWaste > 0 ? (reason.quantity / totalWaste) * 100 : 0;
                                      
                                      return (
                                        <div key={index} className="flex items-center gap-3">
                                          <div className={`w-4 h-4 rounded-full ${colors[index % colors.length]}`}></div>
                                          <div className="flex-1">
                                            <div className="flex justify-between items-center">
                                              <span className="font-medium">{t(reason.reason)}</span>
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
                                    });
                                })()}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-muted-foreground">
                            <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>{t('no_waste_reason_data_available')}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
                
                {/* Insights Tab */}
                {activeTab === 'insights' && (
                  <div className="space-y-6">
                    {/* Recommendations */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Lightbulb className="h-5 w-5 text-amber-500" />
                          {t('recommendations')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {kitchenData.recommendations.map((recommendation, index) => (
                            <div key={index} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                              <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
                                {index + 1}
                              </div>
                              <p>{recommendation}</p>
                            </div>
                          ))}
                          
                          {kitchenData.recommendations.length === 0 && (
                            <div className="text-center py-6 text-muted-foreground">
                              <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-20" />
                              <p>{t('no_recommendations_available')}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Efficiency Score */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{t('kitchen_efficiency_score')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col md:flex-row items-center gap-8">
                          <div className="relative w-40 h-40">
                            <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 100 100">
                              <circle 
                                cx="50" cy="50" r="45" 
                                fill="none" 
                                stroke="#e5e7eb" 
                                strokeWidth="10"
                              />
                              <circle 
                                cx="50" cy="50" r="45" 
                                fill="none" 
                                stroke={
                                  kitchenData.kitchenEfficiency >= 90 ? "#22c55e" :
                                  kitchenData.kitchenEfficiency >= 75 ? "#3b82f6" :
                                  kitchenData.kitchenEfficiency >= 60 ? "#f59e0b" :
                                  "#ef4444"
                                }
                                strokeWidth="10"
                                strokeDasharray={`${2 * Math.PI * 45 * kitchenData.kitchenEfficiency / 100} ${2 * Math.PI * 45 * (1 - kitchenData.kitchenEfficiency / 100)}`}
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-3xl font-bold">{kitchenData.kitchenEfficiency}%</span>
                              <span className="text-sm text-muted-foreground">{t('efficiency')}</span>
                            </div>
                          </div>
                          
                          <div className="flex-1 space-y-4">
                            <div>
                              <h3 className="text-lg font-medium">
                                {kitchenData.kitchenEfficiency >= 90 ? t('excellent_efficiency') :
                                 kitchenData.kitchenEfficiency >= 75 ? t('good_efficiency') :
                                 kitchenData.kitchenEfficiency >= 60 ? t('average_efficiency') :
                                 t('poor_efficiency')}
                              </h3>
                              <p className="text-muted-foreground mt-1">
                                {kitchenData.kitchenEfficiency >= 90 ? t('excellent_efficiency_description') :
                                 kitchenData.kitchenEfficiency >= 75 ? t('good_efficiency_description') :
                                 kitchenData.kitchenEfficiency >= 60 ? t('average_efficiency_description') :
                                 t('poor_efficiency_description')}
                              </p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 border rounded-lg">
                                <div className="text-sm text-muted-foreground">{t('consumption_to_waste_ratio')}</div>
                                <div className="text-lg font-medium mt-1">
                                  {kitchenData.totalConsumption > 0 ? 
                                    (kitchenData.totalConsumption / (kitchenData.totalWaste || 1)).toFixed(1) : 0}:1
                                </div>
                              </div>
                              <div className="p-3 border rounded-lg">
                                <div className="text-sm text-muted-foreground">{t('improvement_target')}</div>
                                <div className="text-lg font-medium mt-1">
                                  {Math.min(100, kitchenData.kitchenEfficiency + 5)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Anomalies */}
                    {kitchenData.anomalies.length > 0 && (
                      <Card className="border-amber-200">
                        <CardHeader className="bg-amber-50">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                            {t('anomalies_detected')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {kitchenData.anomalies.map((anomaly, index) => (
                              <div key={index} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                                <div className="flex items-start gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    anomaly.impact === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    <AlertTriangle className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <h4 className="font-medium">{anomaly.item}</h4>
                                    <p className="text-muted-foreground mt-1">{anomaly.issue}</p>
                                    <Badge 
                                      variant="outline" 
                                      className={`mt-2 ${
                                        anomaly.impact === 'High' 
                                          ? 'bg-red-50 text-red-700 border-red-200' 
                                          : 'bg-amber-50 text-amber-700 border-amber-200'
                                      }`}
                                    >
                                      {anomaly.impact} {t('impact')}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t py-3 px-6 text-xs text-muted-foreground">
        <div className="w-full flex justify-between items-center">
          <div>
            {t('kitchen_analytics')} - {kitchenName}
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