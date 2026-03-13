import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Trash2, History, ChefHat, Package, Calendar, BarChart3, Download } from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WasteRecord {
  id: string;
  foodSupplyId: string;
  quantity: number;
  reason: string;
  notes?: string;
  cost: number;
  createdAt: string;
  updatedAt: string;
  source?: 'direct' | 'recipe';
  recipeId?: string;
  recipe?: {
    id: string;
    name: string;
    servings: number;
  };
  foodSupply: {
    id: string;
    name: string;
    unit: string;
  };
  user: {
    id: string;
    email: string;
  };
}

interface WasteByReason {
  reason: string;
  _sum: {
    cost: number;
    quantity: number;
  };
}

interface WasteHistoryDialogProps {
  foodSupplyId?: string;
  foodSupplyName?: string;
  onRefresh?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function WasteHistoryDialog({
  foodSupplyId,
  foodSupplyName,
  onRefresh,
  open: controlledOpen,
  onOpenChange
}: WasteHistoryDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  
  // Use controlled open state if provided, otherwise use uncontrolled
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = onOpenChange || setUncontrolledOpen;
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [wasteByReason, setWasteByReason] = useState<WasteByReason[]>([]);
  const [totalWasteCost, setTotalWasteCost] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  
  const { toast } = useToast();
  const { t } = useTranslation();

  const loadWasteHistory = async () => {
    setIsLoading(true);
    
    try {
      // Build query parameters
      let queryParams = new URLSearchParams();
      
      if (foodSupplyId) {
        queryParams.append('foodSupplyId', foodSupplyId);
      }
      
      if (timeRange !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        if (timeRange === 'week') {
          startDate.setDate(now.getDate() - 7);
        } else if (timeRange === 'month') {
          startDate.setMonth(now.getMonth() - 1);
        } else if (timeRange === 'quarter') {
          startDate.setMonth(now.getMonth() - 3);
        }
        
        queryParams.append('startDate', startDate.toISOString());
        queryParams.append('endDate', now.toISOString());
      }
      
      console.log(`Fetching waste history with params: ${queryParams.toString()}`);
      const response = await fetch(`/api/food-supply/disposals?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch waste history: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Waste history data:', data);
      
      if (!data.disposals || !Array.isArray(data.disposals)) {
        console.error('Invalid waste history data format:', data);
        throw new Error('Invalid data format received from server');
      }
      
      setWasteRecords(data.disposals);
      setWasteByReason(data.wasteByReason || []);
      setTotalWasteCost(data.totalWasteCost || 0);
    } catch (error) {
      console.error('Error loading waste history:', error);
      toast({
        title: t('error'),
        description: t('failed_to_load_waste_history'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadWasteHistory();
    }
  }, [open, timeRange]);

  const getReasonBadgeColor = (reason: string) => {
    switch (reason) {
      case 'expired':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'damaged':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
      case 'quality_issues':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'overproduction':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getSourceBadgeColor = (source?: string) => {
    return source === 'recipe' 
      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
      : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
  };

  const filteredWasteRecords = wasteRecords.filter(record => {
    if (activeTab === 'all') return true;
    if (activeTab === 'direct') return record.source !== 'recipe';
    if (activeTab === 'recipe') return record.source === 'recipe';
    return true;
  });

  const exportToCSV = () => {
    // Create CSV content
    const headers = ['Date', 'Item', 'Quantity', 'Unit', 'Reason', 'Source', 'Cost', 'Notes'];
    const rows = filteredWasteRecords.map(record => [
      new Date(record.createdAt).toLocaleString(),
      record.source === 'recipe' && record.recipe ? record.recipe.name : record.foodSupply.name,
      record.quantity.toString(),
      record.foodSupply.unit,
      t(record.reason),
      record.source === 'recipe' ? t('recipe') : t('direct'),
      `QAR ${record.cost.toFixed(2)}`,
      record.notes || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `waste-history-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200">
          <History className="h-4 w-4 mr-2" />
          {t('waste_history')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            {t('waste_history')}
          </DialogTitle>
          <DialogDescription>
            {foodSupplyName 
              ? t('waste_history_for_specific_item', { item: foodSupplyName })
              : t('view_all_waste_records')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            <SelectTimeRange
              value={timeRange}
              onValueChange={setTimeRange}
              options={[
                { value: 'all', label: t('all_time') },
                { value: 'week', label: t('last_7_days') },
                { value: 'month', label: t('last_30_days') },
                { value: 'quarter', label: t('last_90_days') },
              ]}
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={exportToCSV}
          >
            <Download className="h-4 w-4 mr-2" />
            {t('export_csv')}
          </Button>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Card className="bg-red-50 border-red-200">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium text-red-800">{t('total_waste_cost')}</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="text-2xl font-bold text-red-700">QAR {totalWasteCost.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border-amber-200">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium text-amber-800">{t('waste_records')}</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="text-2xl font-bold text-amber-700">{wasteRecords.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium text-blue-800">{t('top_reason')}</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="text-2xl font-bold text-blue-700">
                {wasteByReason.length > 0 
                  ? t(wasteByReason.sort((a, b) => b._sum.cost - a._sum.cost)[0].reason)
                  : '-'}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              {t('all_waste')}
            </TabsTrigger>
            <TabsTrigger value="direct" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t('direct_waste')}
            </TabsTrigger>
            <TabsTrigger value="recipe" className="flex items-center gap-2">
              <ChefHat className="h-4 w-4" />
              {t('recipe_waste')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="flex-1 overflow-hidden">
            <WasteRecordsList 
              records={filteredWasteRecords} 
              isLoading={isLoading} 
              getReasonBadgeColor={getReasonBadgeColor}
              getSourceBadgeColor={getSourceBadgeColor}
              t={t}
            />
          </TabsContent>
          
          <TabsContent value="direct" className="flex-1 overflow-hidden">
            <WasteRecordsList 
              records={filteredWasteRecords} 
              isLoading={isLoading} 
              getReasonBadgeColor={getReasonBadgeColor}
              getSourceBadgeColor={getSourceBadgeColor}
              t={t}
            />
          </TabsContent>
          
          <TabsContent value="recipe" className="flex-1 overflow-hidden">
            <WasteRecordsList 
              records={filteredWasteRecords} 
              isLoading={isLoading} 
              getReasonBadgeColor={getReasonBadgeColor}
              getSourceBadgeColor={getSourceBadgeColor}
              t={t}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SelectTimeRangeProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function SelectTimeRange({ value, onValueChange, options }: SelectTimeRangeProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select time range" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface WasteRecordsListProps {
  records: WasteRecord[];
  isLoading: boolean;
  getReasonBadgeColor: (reason: string) => string;
  getSourceBadgeColor: (source?: string) => string;
  t: (key: string, options?: any) => string;
}

function WasteRecordsList({ records, isLoading, getReasonBadgeColor, getSourceBadgeColor, t }: WasteRecordsListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!records || records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Trash2 className="h-12 w-12 mb-4" />
        <p>{t('no_waste_records_found')}</p>
      </div>
    );
  }
  
  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-4 p-1">
        {records.map((record) => {
          // Skip rendering if record is missing critical data
          if (!record || !record.id || !record.foodSupply) {
            console.error('Invalid waste record:', record);
            return null;
          }
          
          return (
            <div 
              key={record.id}
              className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    {record.source === 'recipe' && record.recipe ? (
                      <>
                        <ChefHat className="h-4 w-4 text-purple-600" />
                        <h3 className="font-medium">{record.recipe.name}</h3>
                      </>
                    ) : (
                      <>
                        <Package className="h-4 w-4 text-green-600" />
                        <h3 className="font-medium">{record.foodSupply.name || 'Unknown Item'}</h3>
                      </>
                    )}
                    <Badge variant="outline" className={getSourceBadgeColor(record.source)}>
                      {record.source === 'recipe' ? t('recipe') : t('direct')}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge variant="outline" className={getReasonBadgeColor(record.reason || 'other')}>
                      {t(record.reason || 'other')}
                    </Badge>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {record.quantity || 0} {record.foodSupply.unit || 'units'}
                    </Badge>
                    <span className="text-sm text-muted-foreground flex items-center">
                      <Calendar className="h-3.5 w-3.5 mr-1" />
                      {record.createdAt ? new Date(record.createdAt).toLocaleString() : 'Unknown date'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{t('cost')}</p>
                  <p className="font-bold text-red-600">QAR {(record.cost || 0).toFixed(2)}</p>
                </div>
              </div>
              
              {record.notes && (
                <div className="mt-3 text-sm bg-gray-50 p-2 rounded-md">
                  <span className="font-medium">{t('notes')}: </span>
                  <span className="text-muted-foreground">{record.notes}</span>
                </div>
              )}
              
              {record.source === 'recipe' && record.recipe && (
                <div className="mt-3 text-sm bg-purple-50 p-2 rounded-md">
                  <span className="font-medium">{t('recipe_details')}: </span>
                  <span className="text-muted-foreground">
                    {t('recipe_waste_details', { servings: record.recipe.servings || 0 })}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}