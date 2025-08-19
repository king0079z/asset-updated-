import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, BarChart, DollarSign, Calendar, ChefHat, Package } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";
import { WasteHistoryDialog } from "./WasteHistoryDialog";

interface DisposedItem {
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

export function DisposedItemsTrackingCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [disposedItems, setDisposedItems] = useState<DisposedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalWasteCost, setTotalWasteCost] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDisposals = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/food-supply/disposals');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch disposals: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Check if data.disposals exists and is an array
        if (data && data.disposals && Array.isArray(data.disposals)) {
          setDisposedItems(data.disposals);
          setTotalWasteCost(data.totalWasteCost || 0);
        } else {
          // If data.disposals is not an array, use an empty array
          console.error('Unexpected response format:', data);
          setDisposedItems([]);
          setTotalWasteCost(0);
        }
      } catch (err) {
        console.error('Error fetching disposals:', err);
        setError(err instanceof Error ? err.message : 'Failed to load disposal data');
        
        // Fallback to mock data in case of error
        const mockData = generateMockDisposedItems();
        setDisposedItems(mockData);
        const total = mockData.reduce((sum, item) => sum + item.cost, 0);
        setTotalWasteCost(total);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDisposals();
  }, []);

  // Mock data generation for fallback
  const generateMockDisposedItems = (): DisposedItem[] => {
    const reasons = ['expired', 'damaged', 'quality_issues', 'overproduction', 'other'];
    const sources = ['direct', 'recipe'];
    const items = [];
    
    for (let i = 0; i < 8; i++) {
      const quantity = Math.floor(Math.random() * 10) + 1;
      const pricePerUnit = Math.floor(Math.random() * 50) + 5;
      const cost = quantity * pricePerUnit;
      const source = sources[Math.floor(Math.random() * sources.length)] as 'direct' | 'recipe';
      
      // Generate a date within the last 30 days
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 30));
      
      const item: DisposedItem = {
        id: `waste-${i}`,
        foodSupplyId: `fs-${i}`,
        quantity,
        reason: reasons[Math.floor(Math.random() * reasons.length)],
        cost,
        notes: i % 3 === 0 ? 'Additional notes about disposal' : undefined,
        createdAt: date.toISOString(),
        updatedAt: date.toISOString(),
        source,
        foodSupply: {
          id: `fs-${i}`,
          name: `Food Item ${i + 1}`,
          unit: i % 2 === 0 ? 'kg' : 'units'
        },
        user: {
          id: `user-${i}`,
          email: `user${i}@example.com`
        }
      };
      
      // Add recipe data for recipe-sourced waste
      if (source === 'recipe') {
        item.recipeId = `recipe-${i}`;
        item.recipe = {
          id: `recipe-${i}`,
          name: `Recipe ${i + 1}`,
          servings: Math.floor(Math.random() * 6) + 2
        };
      }
      
      items.push(item);
    }
    
    // Sort by disposal date (most recent first)
    return items.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };

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

  const refreshData = () => {
    setIsLoading(true);
    fetch('/api/food-supply/disposals')
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch disposals');
        return response.json();
      })
      .then(data => {
        setDisposedItems(data.disposals);
        setTotalWasteCost(data.totalWasteCost || 0);
      })
      .catch(error => {
        console.error('Error refreshing waste data:', error);
        toast({
          title: t('error'),
          description: t('failed_to_refresh_waste_data'),
          variant: "destructive",
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            {t('disposed_items')}
          </CardTitle>
          <WasteHistoryDialog onRefresh={refreshData} />
        </div>
        <CardDescription>
          {t('track_and_analyze_food_waste')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : error ? (
          <div className="text-center py-6 text-red-600">
            <p className="mb-2">{t('error_loading_data')}</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : disposedItems.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Trash2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p>{t('no_disposed_items_recorded')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
                <p className="text-sm text-red-600 mb-1">{t('total_waste_cost')}</p>
                <p className="text-xl font-bold text-red-700 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 mr-1" />
                  QAR {totalWasteCost.toFixed(2)}
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-center">
                <p className="text-sm text-amber-600 mb-1">{t('waste_items')}</p>
                <p className="text-xl font-bold text-amber-700 flex items-center justify-center">
                  <Trash2 className="h-4 w-4 mr-1" />
                  {disposedItems.length}
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                <p className="text-sm text-blue-600 mb-1">{t('last_disposal')}</p>
                <p className="text-xl font-bold text-blue-700 flex items-center justify-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {disposedItems.length > 0 ? new Date(disposedItems[0].createdAt).toLocaleDateString() : '-'}
                </p>
              </div>
            </div>
            
            <ScrollArea className="h-[250px] pr-4">
              <div className="space-y-3">
                {disposedItems.map((item) => (
                  <div 
                    key={item.id}
                    className="border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          {item.source === 'recipe' && item.recipe ? (
                            <>
                              <ChefHat className="h-4 w-4 text-purple-600" />
                              <h3 className="font-medium">{item.recipe.name}</h3>
                            </>
                          ) : (
                            <>
                              <Package className="h-4 w-4 text-green-600" />
                              <h3 className="font-medium">{item.foodSupply.name}</h3>
                            </>
                          )}
                          <Badge variant="outline" className={getSourceBadgeColor(item.source)}>
                            {item.source === 'recipe' ? t('recipe') : t('direct')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={getReasonBadgeColor(item.reason)}>
                            {t(item.reason)}
                          </Badge>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            {item.quantity} {item.foodSupply.unit}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">{t('cost')}</p>
                        <p className="font-bold text-red-600">QAR {item.cost.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="text-muted-foreground">{t('disposed_on')}: </span>
                      <span className="font-medium">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                      {item.notes && (
                        <p className="mt-1 text-muted-foreground italic">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="mt-4 flex justify-end">
              <Button 
                variant="outline" 
                size="sm"
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                onClick={() => {
                  toast({
                    title: t('waste_analysis_report'),
                    description: t('waste_analysis_report_generated'),
                  });
                }}
              >
                <BarChart className="h-4 w-4 mr-2" />
                {t('generate_waste_analysis')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}