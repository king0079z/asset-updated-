import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingCart, Clock, Package, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";

interface FoodSupply {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  expirationDate: string;
  pricePerUnit: number;
  notes?: string;
  vendor: {
    id: string;
    name: string;
  };
  leadTime?: number; // In days
  reorderPoint?: number;
}

interface LeadTimeNotificationsCardProps {
  foodSupplies: FoodSupply[];
}

export function LeadTimeNotificationsCard({ foodSupplies }: LeadTimeNotificationsCardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [itemsToReorder, setItemsToReorder] = useState<(FoodSupply & { daysUntilReorder: number })[]>([]);

  useEffect(() => {
    // Calculate which items need to be reordered based on quantity and consumption rate
    // This is a simplified version - in a real app, this would use actual consumption data
    const items = foodSupplies.map(supply => {
      // Default lead time is 7 days if not specified
      const leadTime = supply.leadTime || 7;
      
      // Default reorder point is 20% of current quantity if not specified
      const reorderPoint = supply.reorderPoint || (supply.quantity * 0.2);
      
      // Simulate consumption rate (in a real app, this would be calculated from actual consumption data)
      // For this example, we'll assume daily consumption is between 1-5% of current quantity
      const dailyConsumptionRate = supply.quantity * (Math.random() * 0.04 + 0.01);
      
      // Calculate days until reorder point is reached
      const daysUntilReorder = Math.max(0, Math.floor((supply.quantity - reorderPoint) / dailyConsumptionRate));
      
      return {
        ...supply,
        leadTime,
        reorderPoint,
        daysUntilReorder
      };
    });
    
    // Filter items that need attention (will need reordering within 14 days)
    const filteredItems = items.filter(item => item.daysUntilReorder <= 14);
    
    // Sort by days until reorder (most urgent first)
    const sortedItems = filteredItems.sort((a, b) => a.daysUntilReorder - b.daysUntilReorder);
    
    setItemsToReorder(sortedItems);
  }, [foodSupplies]);

  const getReorderStatus = (daysUntilReorder: number, leadTime: number) => {
    if (daysUntilReorder <= 0) {
      return {
        color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
        icon: <AlertCircle className="h-4 w-4" />,
        label: t('order_now'),
        urgency: 'critical'
      };
    } else if (daysUntilReorder <= leadTime) {
      return {
        color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
        icon: <Clock className="h-4 w-4" />,
        label: t('order_soon'),
        urgency: 'urgent'
      };
    } else {
      return {
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
        icon: <ShoppingCart className="h-4 w-4" />,
        label: t('plan_to_order'),
        urgency: 'normal'
      };
    }
  };

  const handleCreateOrder = (item: FoodSupply & { daysUntilReorder: number }) => {
    toast({
      title: t('order_created'),
      description: `${t('order_created_for')} ${item.name}`,
    });
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-blue-500" />
          {t('lead_time_notifications')}
        </CardTitle>
        <CardDescription>
          {t('items_that_need_to_be_reordered_soon')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {itemsToReorder.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p>{t('no_items_need_reordering')}</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {itemsToReorder.map((item) => {
                const status = getReorderStatus(item.daysUntilReorder, item.leadTime || 7);
                return (
                  <div 
                    key={item.id}
                    className={`border rounded-lg p-3 transition-colors ${
                      status.urgency === 'critical' ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10' :
                      status.urgency === 'urgent' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10' :
                      'border-blue-100 bg-blue-50/30 dark:border-blue-800/70 dark:bg-blue-900/5'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{item.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={status.color}>
                            <span className="flex items-center gap-1">
                              {status.icon}
                              {status.label}
                            </span>
                          </Badge>
                          <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                            {item.quantity} {item.unit} {t('remaining')}
                          </Badge>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                        onClick={() => handleCreateOrder(item)}
                      >
                        {t('create_order')}
                      </Button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t('vendor')}: </span>
                        <span className="font-medium">{item.vendor.name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('lead_time')}: </span>
                        <span className="font-medium">{item.leadTime} {t('days')}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('reorder_in')}: </span>
                        <span className={`font-medium ${
                          item.daysUntilReorder <= 0 ? 'text-red-600' : 
                          item.daysUntilReorder <= item.leadTime ? 'text-amber-600' : ''
                        }`}>
                          {item.daysUntilReorder <= 0 ? t('immediately') : `${item.daysUntilReorder} ${t('days')}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('estimated_cost')}: </span>
                        <span className="font-medium">QAR {(item.pricePerUnit * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}