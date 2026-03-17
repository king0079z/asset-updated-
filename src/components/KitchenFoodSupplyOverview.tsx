import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/contexts/TranslationContext';
import { Package, AlertTriangle, UtensilsCrossed, RefreshCw } from 'lucide-react';
import { FoodSupply, getExpiringItems, getLowStockItems, getFoodSupplies } from '@/lib/foodSupplyService';

interface KitchenFoodSupplyOverviewProps {
  kitchenId: string;
  kitchenName: string;
}

/**
 * A component that displays an overview of food supplies for a specific kitchen
 */
export function KitchenFoodSupplyOverview({ kitchenId, kitchenName }: KitchenFoodSupplyOverviewProps) {
  const [foodSupplies, setFoodSupplies] = useState<FoodSupply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Track last fetch time to avoid excessive refreshes
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  // Cache timeout - 2 minutes
  const CACHE_TIMEOUT = 2 * 60 * 1000;

  const loadFoodSupplies = async (forceRefresh = false) => {
    setIsLoading(true);
    
    // Check if we should use cached data (unless force refresh is requested)
    const now = Date.now();
    if (!forceRefresh && (now - lastFetchTime < CACHE_TIMEOUT) && foodSupplies.length > 0) {
      // If we've fetched recently, just use the existing state data
      setIsLoading(false);
      return;
    }
    
    try {
      const data = await getFoodSupplies(kitchenId, forceRefresh);
      setFoodSupplies(data);
      setLastFetchTime(now);
    } catch (error) {
      console.error('Error loading food supplies:', error);
      toast({
        title: 'Error',
        description: 'Failed to load food supplies for this kitchen',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (kitchenId) {
      // Use a small timeout to prevent immediate loading on mount
      // This helps when multiple components are loading data simultaneously
      const timer = setTimeout(() => {
        loadFoodSupplies();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [kitchenId]);

  const expiringItems = getExpiringItems(foodSupplies);
  const lowStockItems = getLowStockItems(foodSupplies);

  // Calculate total value of inventory
  const totalValue = foodSupplies.reduce(
    (sum, item) => sum + item.quantity * item.pricePerUnit,
    0
  );

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl flex items-center">
              <Package className="h-5 w-5 mr-2 text-primary" />
              {t('kitchen_inventory')}
            </CardTitle>
            <CardDescription>{kitchenName}</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => loadFoodSupplies(true)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-lg p-3 text-center">
                <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">{t('total_items')}</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                  {foodSupplies.length}
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-lg p-3 text-center">
                <p className="text-sm text-amber-600 dark:text-amber-400 mb-1">{t('expiring_soon')}</p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                  {expiringItems.length}
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 rounded-lg p-3 text-center">
                <p className="text-sm text-green-600 dark:text-green-400 mb-1">{t('total_value')}</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">
                  QAR {totalValue.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Alerts Section */}
            {(expiringItems.length > 0 || lowStockItems.length > 0) && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">{t('inventory_alerts')}</h3>
                
                {expiringItems.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <h4 className="font-medium text-amber-700 dark:text-amber-300">{t('expiring_items')}</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {expiringItems.slice(0, 5).map(item => (
                        <Badge key={item.id} variant="outline" className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                          {item.name}
                        </Badge>
                      ))}
                      {expiringItems.length > 5 && (
                        <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                          +{expiringItems.length - 5} {t('more')}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                
                {lowStockItems.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <UtensilsCrossed className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <h4 className="font-medium text-red-700 dark:text-red-300">{t('low_stock_items')}</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {lowStockItems.slice(0, 5).map(item => (
                        <Badge key={item.id} variant="outline" className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                          {item.name}
                        </Badge>
                      ))}
                      {lowStockItems.length > 5 && (
                        <Badge variant="outline" className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                          +{lowStockItems.length - 5} {t('more')}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recent Items */}
            <div>
              <h3 className="text-sm font-medium mb-3">{t('recent_inventory')}</h3>
              <div className="space-y-2">
                {foodSupplies.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('no_food_supplies_found')}</p>
                  </div>
                ) : (
                  foodSupplies.slice(0, 5).map(item => (
                    <div 
                      key={item.id} 
                      className="flex justify-between items-center p-2 border rounded-md hover:bg-accent/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                          {item.quantity} {item.unit}
                        </Badge>
                        <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                          QAR {item.pricePerUnit}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {foodSupplies.length > 5 && (
                <div className="mt-3 text-center">
                  <Button variant="link" size="sm" asChild>
                    <Link href="/food-supply">{t('view_all_supplies')}</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}