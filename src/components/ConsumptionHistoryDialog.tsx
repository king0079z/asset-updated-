import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Calendar, Building2, User, Package, Printer } from "lucide-react";
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { printContent } from '@/util/print';
import { useTranslation } from "@/contexts/TranslationContext";

type ConsumptionHistoryProps = {
  foodSupplyId: string;
  foodSupplyName: string;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  buttonClassName?: string;
  showIcon?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ConsumptionRecord = {
  id: string;
  quantity: number;
  date: string;
  expirationDate?: string;
  kitchen: {
    name: string;
    floorNumber: string;
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

export function ConsumptionHistoryDialog({ 
  foodSupplyId, 
  foodSupplyName,
  buttonVariant = "outline",
  buttonSize = "sm",
  buttonClassName = "",
  showIcon = true,
  open: controlledOpen,
  onOpenChange
}: ConsumptionHistoryProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  
  // Use controlled open state if provided, otherwise use uncontrolled
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = onOpenChange || setUncontrolledOpen;
  const [history, setHistory] = useState<ConsumptionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalMoneyConsumed, setTotalMoneyConsumed] = useState(0);
  const { t } = useTranslation();

  const loadHistory = async () => {
    if (!open) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/food-supply/consumption-history?foodSupplyId=${foodSupplyId}`);
      if (!response.ok) throw new Error('Failed to load consumption history');
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error('Error loading consumption history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadHistory();
    }
  }, [open]);

  useEffect(() => {
    const total = history.reduce((sum, record) => {
      return sum + (record.quantity * record.foodSupply.pricePerUnit);
    }, 0);
    setTotalMoneyConsumed(total);
  }, [history]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={buttonVariant} 
          size={buttonSize}
          className={buttonClassName}
        >
          {showIcon && <History className="h-4 w-4 mr-2" />}
          {t('history')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]" showPrintButton>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>{foodSupplyName} - {t('consumption_history')}</span>
          </DialogTitle>
          <DialogDescription>
            {t('track_all_consumption_records')}
          </DialogDescription>
          {!loading && history.length > 0 && (
            <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-green-700 dark:text-green-400 font-semibold">
                {t('total_value_consumed')}: QAR {totalMoneyConsumed.toFixed(2)}
              </p>
            </div>
          )}
        </DialogHeader>
        <Separator className="my-2" />
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-sm text-muted-foreground">{t('loading_history')}</p>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <History className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-medium">{t('no_consumption_history_found')}</p>
              <p className="text-sm text-muted-foreground">{t('once_items_consumed_appear_here')}</p>
            </div>
          ) : (
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
                              {record.quantity} {record.foodSupply.unit}
                            </Badge>
                            <Badge variant="secondary" className="text-md">
                              QAR {(record.quantity * record.foodSupply.pricePerUnit).toFixed(2)}
                            </Badge>
                            {record.isWaste && (
                              <Badge variant="outline" className="bg-red-50 text-red-700">
                                {t('waste')}
                              </Badge>
                            )}
                            {record.isWaste && record.source === 'recipe' && (
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
                            {record.kitchen.name}
                            {record.kitchen.floorNumber !== '-' && ` (Floor ${record.kitchen.floorNumber})`}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate" title={record.user.email}>
                            {record.user.email}
                          </span>
                        </div>
                      </div>
                      
                      {record.expirationDate && (
                        <div className="text-sm bg-amber-50 dark:bg-amber-900/20 p-2 rounded-md">
                          <span className="font-medium">{t('expiration_date_at_consumption')}: </span>
                          <span className="text-amber-700 dark:text-amber-400">
                            {format(new Date(record.expirationDate), 'PP')}
                          </span>
                        </div>
                      )}
                      
                      {record.notes && record.notes.includes("Used in recipe:") && (
                        <div className="text-sm bg-amber-50 p-2 rounded-md flex items-center">
                          <span className="font-medium mr-2">{t('recipe')}: </span>
                          <Badge variant="outline" className="bg-amber-100 text-amber-800">
                            {record.notes.replace("Used in recipe: ", "")}
                          </Badge>
                        </div>
                      )}
                      
                      {record.isWaste && record.reason && (
                        <div className="text-sm bg-red-50 p-2 rounded-md">
                          <span className="font-medium">{t('waste_reason')}: </span>
                          <span className="text-red-700">{t(record.reason)}</span>
                          {record.notes && (
                            <p className="mt-1 text-muted-foreground">{record.notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}