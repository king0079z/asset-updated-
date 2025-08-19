import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/contexts/TranslationContext";

interface KitchenAnomalyDetail {
  foodName: string;
  avgConsumption: number;
  kitchenConsumption: number;
  percentageAboveAvg: string;
  unit: string;
}

interface KitchenAnomaly {
  id: string;
  name: string;
  floorNumber: string;
  severity: 'high' | 'medium' | 'low';
  anomalyScore: number;
  details: KitchenAnomalyDetail[];
}

interface KitchenConsumptionAnomalyDialogProps {
  anomaly: KitchenAnomaly;
  trigger?: React.ReactNode;
}

export function KitchenConsumptionAnomalyDialog({ 
  anomaly, 
  trigger 
}: KitchenConsumptionAnomalyDialogProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-rose-500" />;
      case 'medium':
        return <TrendingUp className="h-5 w-5 text-amber-500" />;
      default:
        return <Info className="h-5 w-5 text-sky-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'medium':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      default:
        return 'bg-sky-50 border-sky-200 text-sky-700';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-rose-100 text-rose-700 hover:bg-rose-200';
      case 'medium':
        return 'bg-amber-100 text-amber-700 hover:bg-amber-200';
      default:
        return 'bg-sky-100 text-sky-700 hover:bg-sky-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            {t('view_details')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getSeverityIcon(anomaly.severity)}
            {t('kitchen_consumption_anomaly')}
            <Badge className={`ml-2 ${getSeverityBadgeColor(anomaly.severity)}`}>
              {anomaly.severity === 'high' ? t('critical') : anomaly.severity === 'medium' ? t('warning') : t('info')}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {t('detailed_analysis_of_unusual_consumption')} {anomaly.name} {t('on_floor')} {anomaly.floorNumber}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card className={`border ${getSeverityColor(anomaly.severity)}`}>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h3 className="font-semibold text-lg">{anomaly.name}</h3>
                  <p className="text-sm text-slate-500">{t('floor')} {anomaly.floorNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{t('anomaly_score')}</p>
                  <p className="text-lg font-bold">{(anomaly.anomalyScore * 100).toFixed(0)}%</p>
                </div>
              </div>
              
              <p className="text-sm mt-2">
                {t('kitchen_consuming_more_resources')}
              </p>
            </CardContent>
          </Card>
          
          <div>
            <h3 className="font-medium mb-2">{t('consumption_details')}</h3>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {anomaly.details.map((detail, index) => (
                  <div key={index} className="p-3 bg-slate-50 rounded-md border">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">{detail.foodName}</h4>
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700">
                        {detail.percentageAboveAvg} {t('above_avg')}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                      <div>
                        <p className="text-slate-500">{t('average_consumption')}</p>
                        <p className="font-medium">{typeof detail.avgConsumption === 'number' ? detail.avgConsumption.toFixed(2) : detail.avgConsumption} {detail.unit}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">{t('kitchen_consumption')}</p>
                        <p className="font-medium">{typeof detail.kitchenConsumption === 'number' ? detail.kitchenConsumption.toFixed(2) : detail.kitchenConsumption} {detail.unit}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          
          <div className="pt-2">
            <h3 className="font-medium mb-2">{t('recommendations')}</h3>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>{t('investigate_potential_waste')}</li>
              <li>{t('review_inventory_management')}</li>
              <li>{t('consider_staff_training')}</li>
              <li>{t('implement_consumption_tracking')}</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}