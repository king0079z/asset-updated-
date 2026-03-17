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
import { AlertTriangle, TrendingUp, Info, Trash2 } from "lucide-react";

interface AssetDisposal {
  id: string;
  name: string;
  disposedAt: string;
  floorNumber: string;
  roomNumber: string;
  purchaseAmount: number;
  severity: 'high' | 'medium' | 'low';
}

interface AssetDisposalDetailsDialogProps {
  disposal: AssetDisposal;
  trigger?: React.ReactNode;
}

export function AssetDisposalDetailsDialog({ 
  disposal, 
  trigger 
}: AssetDisposalDetailsDialogProps) {
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

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
            <Trash2 className="h-5 w-5 text-slate-600" />
            Asset Disposal Details
            <Badge className={`ml-2 ${getSeverityBadgeColor(disposal.severity)}`}>
              {disposal.severity === 'high' ? 'High Value' : disposal.severity === 'medium' ? 'Medium Value' : 'Low Value'}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Details of the disposed asset and its financial impact
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card className={`border ${getSeverityColor(disposal.severity)}`}>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div>
                  <h3 className="font-semibold text-lg">{disposal.name}</h3>
                  <p className="text-sm text-slate-500">
                    Floor {disposal.floorNumber}, Room {disposal.roomNumber}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-sm font-medium">Asset Value</p>
                  <p className="text-lg font-bold">{formatCurrency(disposal.purchaseAmount)}</p>
                </div>
              </div>
              
              <div className="mt-4 text-sm">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-slate-600">Disposed At</span>
                  <span className="font-medium">{formatDate(disposal.disposedAt)}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-slate-600">Asset ID</span>
                  <span className="font-medium">{disposal.id}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-slate-600">Location</span>
                  <span className="font-medium">Floor {disposal.floorNumber}, Room {disposal.roomNumber}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="pt-2">
            <h3 className="font-medium mb-2">Financial Impact</h3>
            <p className="text-sm text-slate-600 mb-3">
              {disposal.severity === 'high' 
                ? 'This high-value asset disposal represents a significant financial write-off. Consider reviewing the disposal reason and exploring potential asset recovery options in the future.'
                : disposal.severity === 'medium'
                ? 'This medium-value asset disposal has a moderate financial impact. Review if the asset could have been repurposed or repaired instead.'
                : 'This low-value asset disposal has minimal financial impact but should still be tracked for inventory accuracy.'}
            </p>
            
            <h3 className="font-medium mb-2">Recommendations</h3>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Review the reason for disposal to identify potential patterns</li>
              <li>Consider implementing a pre-disposal assessment process</li>
              <li>Evaluate if similar assets are being disposed prematurely</li>
              <li>Update asset lifecycle management policies if needed</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}