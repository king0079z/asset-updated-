import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Calendar, Clock, ArrowRight } from "lucide-react";
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
}

interface ExpiringItemsCardProps {
  foodSupplies: FoodSupply[];
}

export function ExpiringItemsCard({ foodSupplies }: ExpiringItemsCardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [expiringItems, setExpiringItems] = useState<FoodSupply[]>([]);

  useEffect(() => {
    // Filter and sort items by expiration date
    const today = new Date();
    const filtered = foodSupplies.filter(supply => {
      const expirationDate = new Date(supply.expirationDate);
      const daysUntilExpiration = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiration <= 30; // Show items expiring within 30 days
    });
    
    // Sort by expiration date (soonest first)
    const sorted = filtered.sort((a, b) => {
      return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
    });
    
    setExpiringItems(sorted);
  }, [foodSupplies]);

  const getExpirationStatus = (expirationDate: string) => {
    const today = new Date();
    const expDate = new Date(expirationDate);
    const daysUntilExpiration = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiration <= 3) {
      return {
        color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
        icon: <AlertTriangle className="h-4 w-4" />,
        label: t('critical'),
        days: daysUntilExpiration
      };
    } else if (daysUntilExpiration <= 7) {
      return {
        color: 'bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-300',
        icon: <AlertTriangle className="h-4 w-4" />,
        label: t('urgent'),
        days: daysUntilExpiration
      };
    } else if (daysUntilExpiration <= 14) {
      return {
        color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
        icon: <Clock className="h-4 w-4" />,
        label: t('soon'),
        days: daysUntilExpiration
      };
    } else {
      return {
        color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/10 dark:text-yellow-300',
        icon: <Calendar className="h-4 w-4" />,
        label: t('upcoming'),
        days: daysUntilExpiration
      };
    }
  };

  const handleMarkAsUsed = (item: FoodSupply) => {
    toast({
      title: t('item_marked_for_priority_use'),
      description: `${item.name} ${t('has_been_marked_for_priority_use')}`,
    });
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          {t('expiring_items')}
        </CardTitle>
        <CardDescription>
          {t('items_expiring_within_30_days')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {expiringItems.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p>{t('no_expiring_items')}</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {expiringItems.map((item) => {
                const status = getExpirationStatus(item.expirationDate);
                return (
                  <div 
                    key={item.id}
                    className={`border rounded-lg p-3 transition-colors ${
                      status.days <= 3 ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10' :
                      status.days <= 7 ? 'border-red-100 bg-red-50/30 dark:border-red-800/70 dark:bg-red-900/5' :
                      status.days <= 14 ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10' :
                      'border-yellow-100 bg-yellow-50/30 dark:border-yellow-800/70 dark:bg-yellow-900/5'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{item.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={status.color}>
                            <span className="flex items-center gap-1">
                              {status.icon}
                              {status.label}: {status.days} {t('days')}
                            </span>
                          </Badge>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                            {item.quantity} {item.unit}
                          </Badge>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        onClick={() => handleMarkAsUsed(item)}
                      >
                        {t('mark_for_priority_use')}
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="text-muted-foreground">{t('expires_on')}: </span>
                      <span className={status.days <= 7 ? 'font-medium text-red-700' : 'font-medium'}>
                        {new Date(item.expirationDate).toLocaleDateString()}
                      </span>
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