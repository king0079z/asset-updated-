import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import BarcodeScannerFood from './BarcodeScannerFood';
import { useTranslation } from '@/contexts/TranslationContext';
import { History, Trash2, ChefHat } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Calendar, Building2, User, Package } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ConsumptionRecord {
  id: string;
  quantity: number;
  date: string;
  notes?: string;
  kitchen: {
    name: string;
    floorNumber: string;
  };
  foodSupply: {
    name: string;
    unit: string;
  };
}

// ConsumptionHistoryContent component
function ConsumptionHistoryContent() {
  const { t } = useTranslation();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMoneyConsumed, setTotalMoneyConsumed] = useState(0);

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/food-supply/consumption-history`);
        if (!response.ok) throw new Error('Failed to load consumption history');
        const data = await response.json();
        setHistory(data);
        
        // Calculate total money consumed
        const total = data.reduce((sum: number, record: any) => {
          return sum + (record.quantity * (record.foodSupply?.pricePerUnit || 0));
        }, 0);
        setTotalMoneyConsumed(total);
      } catch (error) {
        console.error('Error loading consumption history:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadHistory();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">{t('loading_history')}</p>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <History className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground font-medium">{t('no_consumption_history_found')}</p>
        <p className="text-sm text-muted-foreground">{t('once_items_consumed_appear_here')}</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {history.length > 0 && (
        <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg mb-4">
          <p className="text-green-700 dark:text-green-400 font-semibold">
            {t('total_value_consumed')}: QAR {totalMoneyConsumed.toFixed(2)}
          </p>
        </div>
      )}
      
      <ScrollArea className="h-[500px] pr-4">
        <div className="space-y-4">
          {history.map((record) => (
            <div
              key={record.id}
              className={`rounded-lg border bg-card p-4 hover:shadow-md transition-all ${record.isWaste ? 'border-red-200' : ''}`}
            >
              <div className="flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant={record.isWaste ? "destructive" : "default"} className="text-md">
                        {record.quantity} {record.foodSupply?.unit}
                      </Badge>
                      <Badge variant="secondary" className="text-md">
                        QAR {(record.quantity * (record.foodSupply?.pricePerUnit || 0)).toFixed(2)}
                      </Badge>
                      {record.isWaste && (
                        <Badge variant="outline" className="bg-red-50 text-red-700">
                          {t('waste')}
                        </Badge>
                      )}
                      {record.source === 'recipe' && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700">
                          {t('recipe')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span className="text-sm">
                      {format(new Date(record.date), 'PPp')}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {record.kitchen?.name}
                      {record.kitchen?.floorNumber !== '-' && ` (Floor ${record.kitchen?.floorNumber})`}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate" title={record.user?.email}>
                      {record.user?.email}
                    </span>
                  </div>
                </div>
                
                {record.notes && (
                  <div className="text-sm bg-amber-50 p-2 rounded-md">
                    <span className="font-medium">{t('notes')}: </span>
                    <span>{record.notes}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// WasteHistoryContent component
function WasteHistoryContent() {
  const { t } = useTranslation();
  const [wasteRecords, setWasteRecords] = useState<any[]>([]);
  const [wasteByReason, setWasteByReason] = useState<any[]>([]);
  const [totalWasteCost, setTotalWasteCost] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  
  useEffect(() => {
    const loadWasteHistory = async () => {
      setIsLoading(true);
      
      try {
        // Build query parameters
        let queryParams = new URLSearchParams();
        
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
        
        const response = await fetch(`/api/food-supply/disposals?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch waste history');
        }
        
        const data = await response.json();
        setWasteRecords(data.disposals || []);
        setWasteByReason(data.wasteByReason || []);
        setTotalWasteCost(data.totalWasteCost || 0);
      } catch (error) {
        console.error('Error loading waste history:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadWasteHistory();
  }, [timeRange]);

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

  const timeRangeOptions = [
    { value: 'all', label: t('all_time') },
    { value: 'week', label: t('last_7_days') },
    { value: 'month', label: t('last_30_days') },
    { value: 'quarter', label: t('last_90_days') },
  ];

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center border rounded-md overflow-hidden">
          {timeRangeOptions.map((option) => (
            <button
              key={option.value}
              className={`px-3 py-1.5 text-sm ${
                timeRange === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-accent'
              }`}
              onClick={() => setTimeRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
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
          />
        </TabsContent>
        
        <TabsContent value="direct" className="flex-1 overflow-hidden">
          <WasteRecordsList 
            records={filteredWasteRecords} 
            isLoading={isLoading} 
            getReasonBadgeColor={getReasonBadgeColor}
            getSourceBadgeColor={getSourceBadgeColor}
          />
        </TabsContent>
        
        <TabsContent value="recipe" className="flex-1 overflow-hidden">
          <WasteRecordsList 
            records={filteredWasteRecords} 
            isLoading={isLoading} 
            getReasonBadgeColor={getReasonBadgeColor}
            getSourceBadgeColor={getSourceBadgeColor}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

// WasteRecordsList component
function WasteRecordsList({ 
  records, 
  isLoading, 
  getReasonBadgeColor, 
  getSourceBadgeColor 
}: { 
  records: any[]; 
  isLoading: boolean; 
  getReasonBadgeColor: (reason: string) => string;
  getSourceBadgeColor: (source?: string) => string;
}) {
  const { t } = useTranslation();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (records.length === 0) {
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
        {records.map((record) => (
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
                      <h3 className="font-medium">{record.foodSupply?.name}</h3>
                    </>
                  )}
                  <Badge variant="outline" className={getSourceBadgeColor(record.source)}>
                    {record.source === 'recipe' ? t('recipe') : t('direct')}
                  </Badge>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="outline" className={getReasonBadgeColor(record.reason)}>
                    {t(record.reason)}
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    {record.quantity} {record.foodSupply?.unit}
                  </Badge>
                  <span className="text-sm text-muted-foreground flex items-center">
                    <Calendar className="h-3.5 w-3.5 mr-1" />
                    {new Date(record.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t('cost')}</p>
                <p className="font-bold text-red-600">QAR {record.cost.toFixed(2)}</p>
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
                  {t('recipe_waste_details', { servings: record.recipe.servings })}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ConsumptionHistoryDialog component
function ConsumptionHistoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>{t('all_food_supplies')} - {t('consumption_history')}</span>
          </DialogTitle>
          <DialogDescription>
            {t('track_all_consumption_records')}
          </DialogDescription>
        </DialogHeader>
        
        <ConsumptionHistoryContent />
      </DialogContent>
    </Dialog>
  );
}

// WasteHistoryDialog component
function WasteHistoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            {t('waste_history')}
          </DialogTitle>
          <DialogDescription>
            {t('view_all_waste_records')}
          </DialogDescription>
        </DialogHeader>
        
        <WasteHistoryContent />
      </DialogContent>
    </Dialog>
  );
}

export function ConsumptionTab() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [recentConsumptions, setRecentConsumptions] = useState<ConsumptionRecord[]>([]);
  const [selectedKitchenId, setSelectedKitchenId] = useState<string>('');
  const [consumptionHistoryOpen, setConsumptionHistoryOpen] = useState(false);
  const [wasteHistoryOpen, setWasteHistoryOpen] = useState(false);

  const fetchRecentConsumptions = async () => {
    try {
      if (!selectedKitchenId) return;
      
      const response = await fetch(`/api/food-supply/consumption-history?kitchenId=${selectedKitchenId}`);
      if (response.ok) {
        const data = await response.json();
        setRecentConsumptions(data);
      }
    } catch (error) {
      console.error('Error fetching recent consumptions:', error);
      toast({
        title: t('error'),
        description: t('failed_to_fetch_consumption_history'),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    // If kitchenId is provided as a prop, use it directly
    if (selectedKitchenId) {
      fetchRecentConsumptions();
    } else {
      // Otherwise fetch user's kitchen ID
      const fetchKitchenId = async () => {
        try {
          const response = await fetch('/api/kitchens');
          if (response.ok) {
            const data = await response.json();
            if (data.length > 0) {
              setSelectedKitchenId(data[0].id);
            }
          }
        } catch (error) {
          console.error('Error fetching kitchen:', error);
          toast({
            title: t('error'),
            description: t('failed_to_fetch_kitchen_information'),
            variant: 'destructive',
          });
        }
      };
      fetchKitchenId();
    }
  }, [selectedKitchenId]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('record_food_consumption')}</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedKitchenId ? (
            <BarcodeScannerFood 
              kitchenId={selectedKitchenId} 
              onScanComplete={fetchRecentConsumptions}
            />
          ) : (
            <p className="text-muted-foreground">{t('loading_kitchen_information')}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex space-x-4 mb-4">
        <Button 
          variant="outline" 
          onClick={() => setConsumptionHistoryOpen(true)}
        >
          <History className="h-4 w-4 mr-2" />
          {t('view_consumption_history')}
        </Button>
        
        <Button 
          variant="outline" 
          className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
          onClick={() => setWasteHistoryOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {t('view_waste_history')}
        </Button>
      </div>

      {/* Separate dialog components */}
      <ConsumptionHistoryDialog 
        open={consumptionHistoryOpen} 
        onOpenChange={setConsumptionHistoryOpen} 
      />
      
      <WasteHistoryDialog 
        open={wasteHistoryOpen} 
        onOpenChange={setWasteHistoryOpen} 
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('recent_consumption_records')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentConsumptions.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">{t('no_recent_consumption_records')}</p>
            ) : (
              recentConsumptions.map((record) => (
                <div
                  key={record.id}
                  className="border rounded p-4 space-y-2"
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{record.foodSupply.name}</span>
                    <span>{new Date(record.date).toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>{t('quantity')}: {record.quantity} {record.foodSupply.unit}</p>
                    <p>{t('kitchen')}: {record.kitchen.name} ({t('floor')} {record.kitchen.floorNumber})</p>
                    {record.notes && <p>{t('notes')}: {record.notes}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}