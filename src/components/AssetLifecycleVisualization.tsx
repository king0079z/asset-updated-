import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  AlertCircle, 
  ArrowRight, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Info, 
  LifeBuoy, 
  Trash2, 
  Truck 
} from "lucide-react";

interface AssetLifecycleEvent {
  id: string;
  type: 'ACQUISITION' | 'DEPLOYMENT' | 'MAINTENANCE' | 'REPAIR' | 'UPGRADE' | 'INSPECTION' | 'DISPOSAL' | 'MOVEMENT';
  date: string;
  description: string;
  cost?: number;
  performedBy?: string;
}

interface AssetLifecycleVisualizationProps {
  asset: {
    id: string;
    name: string;
    purchaseDate?: string | Date;
    purchaseAmount?: number;
    status: string;
  };
  lifecycleEvents: AssetLifecycleEvent[];
}

export function AssetLifecycleVisualization({ asset, lifecycleEvents }: AssetLifecycleVisualizationProps) {
  // Sort events by date (oldest first)
  const sortedEvents = [...lifecycleEvents].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate total cost of ownership
  const totalCost = sortedEvents.reduce((sum, event) => sum + (event.cost || 0), 0) + (asset.purchaseAmount || 0);

  // Calculate asset age
  const getAssetAge = () => {
    if (!asset.purchaseDate) return 'Unknown';
    
    const purchaseDate = new Date(asset.purchaseDate);
    const now = new Date();
    const ageInMonths = (now.getFullYear() - purchaseDate.getFullYear()) * 12 + 
                        (now.getMonth() - purchaseDate.getMonth());
    
    if (ageInMonths < 12) {
      return `${ageInMonths} month${ageInMonths !== 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(ageInMonths / 12);
      const months = ageInMonths % 12;
      return `${years} year${years !== 1 ? 's' : ''}${months > 0 ? `, ${months} month${months !== 1 ? 's' : ''}` : ''}`;
    }
  };

  // Get icon for event type
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'ACQUISITION':
        return <Truck className="h-4 w-4" />;
      case 'DEPLOYMENT':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'MAINTENANCE':
        return <Activity className="h-4 w-4" />;
      case 'REPAIR':
        return <LifeBuoy className="h-4 w-4" />;
      case 'UPGRADE':
        return <ArrowRight className="h-4 w-4" />;
      case 'INSPECTION':
        return <Info className="h-4 w-4" />;
      case 'DISPOSAL':
        return <Trash2 className="h-4 w-4" />;
      case 'MOVEMENT':
        return <ArrowRight className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  // Get color for event type
  const getEventColor = (type: string) => {
    switch (type) {
      case 'ACQUISITION':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400';
      case 'DEPLOYMENT':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400';
      case 'MAINTENANCE':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400';
      case 'REPAIR':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400';
      case 'UPGRADE':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-400';
      case 'INSPECTION':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-400';
      case 'DISPOSAL':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400';
      case 'MOVEMENT':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-green-50 via-white to-green-50 dark:from-green-950/50 dark:via-background dark:to-green-950/50 transition-all duration-300 hover:shadow-md">
      <div className="absolute inset-0 bg-grid-black/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Asset Lifecycle</CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-full p-2.5 bg-green-100 dark:bg-green-900/50 cursor-help">
                <Activity className="h-5 w-5 text-green-700 dark:text-green-400" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">
                Complete lifecycle visualization from acquisition to disposal, including all maintenance events.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="text-sm text-muted-foreground">Asset Age</div>
            <div className="text-lg font-semibold">{getAssetAge()}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Total Cost of Ownership</div>
            <div className="text-lg font-semibold">QAR {totalCost.toLocaleString()}</div>
          </div>
        </div>

        {/* Lifecycle Timeline */}
        <div className="relative mt-6 pl-6 border-l border-gray-200 dark:border-gray-800">
          {sortedEvents.map((event, index) => (
            <div key={event.id} className="mb-6 last:mb-0">
              {/* Timeline dot */}
              <div className="absolute left-0 mt-1.5 -ml-3 h-6 w-6 rounded-full bg-white dark:bg-gray-950 border-2 border-gray-200 dark:border-gray-800 flex items-center justify-center">
                {getEventIcon(event.type)}
              </div>
              
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={getEventColor(event.type)}>
                    {event.type}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(event.date)}
                  </span>
                </div>
                
                <p className="text-sm mb-1">{event.description}</p>
                
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {event.cost !== undefined && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>QAR {event.cost.toLocaleString()}</span>
                    </div>
                  )}
                  {event.performedBy && (
                    <div className="flex items-center gap-1">
                      <Info className="h-3.5 w-3.5" />
                      <span>By: {event.performedBy}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Purchase event (always shown) */}
          {asset.purchaseDate && (
            <div className="mb-0">
              <div className="absolute left-0 mt-1.5 -ml-3 h-6 w-6 rounded-full bg-white dark:bg-gray-950 border-2 border-gray-200 dark:border-gray-800 flex items-center justify-center">
                <Truck className="h-4 w-4" />
              </div>
              
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400">
                    ACQUISITION
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(asset.purchaseDate.toString())}
                  </span>
                </div>
                
                <p className="text-sm mb-1">Asset purchased and added to inventory</p>
                
                {asset.purchaseAmount && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>QAR {asset.purchaseAmount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}