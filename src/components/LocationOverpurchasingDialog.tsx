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
import { AlertTriangle, TrendingUp, Info, Building2, ShoppingCart } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface LocationOverpurchasing {
  location: string;
  floorNumber: string;
  roomNumber: string;
  totalAssets: number;
  totalValue: number;
  recentPurchases: number;
  severity: 'high' | 'medium' | 'low';
}

interface LocationOverpurchasingDialogProps {
  locationData: LocationOverpurchasing;
  trigger?: React.ReactNode;
}

export function LocationOverpurchasingDialog({ 
  locationData, 
  trigger 
}: LocationOverpurchasingDialogProps) {
  const [open, setOpen] = useState(false);

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Calculate percentage of recent purchases compared to total assets
  const recentPurchasePercentage = (locationData.recentPurchases / locationData.totalAssets) * 100;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            View Details
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-600" />
            Location Overpurchasing Alert
            <Badge className={`ml-2 ${getSeverityBadgeColor(locationData.severity)}`}>
              {locationData.severity === 'high' ? 'Critical' : locationData.severity === 'medium' ? 'Warning' : 'Info'}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Analysis of unusual asset acquisition patterns at {locationData.location}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card className={`border ${getSeverityColor(locationData.severity)}`}>
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{locationData.location}</h3>
                  <p className="text-sm text-slate-500 flex items-center">
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    {locationData.recentPurchases} recent purchases
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">Total Asset Value</p>
                  <p className="text-lg font-bold">{formatCurrency(locationData.totalValue)}</p>
                </div>
              </div>
              
              <div className="mt-4">
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-slate-600">Recent Purchases</span>
                  <span className="text-sm font-medium">{recentPurchasePercentage.toFixed(0)}% of total assets</span>
                </div>
                <Progress value={recentPurchasePercentage} className="h-2" />
              </div>
              
              <div className="mt-4 text-sm">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-slate-600">Total Assets</span>
                  <span className="font-medium">{locationData.totalAssets}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-slate-600">Recent Acquisitions</span>
                  <span className="font-medium">{locationData.recentPurchases}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-slate-600">Average Asset Value</span>
                  <span className="font-medium">
                    {formatCurrency(locationData.totalValue / locationData.totalAssets)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="pt-2">
            <h3 className="font-medium mb-2">Analysis</h3>
            <p className="text-sm text-slate-600 mb-3">
              {locationData.severity === 'high' 
                ? `This location has acquired a significant number of new assets (${locationData.recentPurchases}) in the past 30 days, which is substantially higher than the average acquisition rate across other locations. This pattern suggests potential overpurchasing or duplicate acquisitions.`
                : locationData.severity === 'medium'
                ? `This location shows moderately elevated asset acquisition rates with ${locationData.recentPurchases} new assets in the past 30 days. While not critical, this pattern warrants attention to ensure efficient resource allocation.`
                : `This location has slightly higher than average asset acquisition rates with ${locationData.recentPurchases} new assets recently. Monitor the trend to prevent potential overpurchasing.`}
            </p>
            
            <h3 className="font-medium mb-2">Recommendations</h3>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Review recent purchase requisitions for this location</li>
              <li>Verify if assets are being properly utilized</li>
              <li>Implement approval workflows for future purchases</li>
              <li>Consider redistributing underutilized assets from this location</li>
              <li>Conduct an asset utilization audit</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}