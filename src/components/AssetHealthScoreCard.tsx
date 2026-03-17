import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Calendar, Clock, Info, Zap } from "lucide-react";

interface AssetHealthScoreCardProps {
  asset: {
    id: string;
    name: string;
    type: string;
    purchaseDate?: string | Date;
    lastMovedAt?: string | Date;
    status: string;
  };
  healthScore: number;
  healthFactors: {
    age: number;
    maintenance: number;
    usage: number;
    condition: number;
  };
}

export function AssetHealthScoreCard({ asset, healthScore, healthFactors }: AssetHealthScoreCardProps) {
  // Determine health status based on score
  const getHealthStatus = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400' };
    if (score >= 60) return { label: 'Good', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400' };
    if (score >= 40) return { label: 'Fair', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400' };
    if (score >= 20) return { label: 'Poor', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400' };
    return { label: 'Critical', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400' };
  };
  
  // Get status badge color based on asset status
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'LIKE_NEW':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400';
      case 'ACTIVE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400';
      case 'IN_TRANSIT':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-400';
      case 'MAINTENANCE':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400';
      case 'DAMAGED':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400';
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400';
      case 'DISPOSED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-400';
    }
  };

  // Get color for progress bar based on score
  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500 dark:bg-green-400';
    if (score >= 60) return 'bg-blue-500 dark:bg-blue-400';
    if (score >= 40) return 'bg-yellow-500 dark:bg-yellow-400';
    if (score >= 20) return 'bg-orange-500 dark:bg-orange-400';
    return 'bg-red-500 dark:bg-red-400';
  };

  const healthStatus = getHealthStatus(healthScore);
  const progressColor = getProgressColor(healthScore);

  // Calculate asset age if purchase date is available
  const getAssetAge = () => {
    if (!asset.purchaseDate) return 'Unknown';
    
    try {
      // Handle both string and Date objects
      const purchaseDateStr = typeof asset.purchaseDate === 'object' 
        ? asset.purchaseDate.toISOString() 
        : String(asset.purchaseDate);
      
      console.log('Purchase date string:', purchaseDateStr); // Debug log
      
      // Try to parse the date string
      const purchaseDate = new Date(purchaseDateStr);
      
      // Check if date is valid
      if (isNaN(purchaseDate.getTime())) {
        console.warn('Invalid purchase date:', purchaseDateStr);
        return 'Unknown';
      }
      
      const now = new Date();
      
      // Calculate days since purchase
      const diffTime = Math.abs(now.getTime() - purchaseDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      // Calculate months and years for display
      const ageInMonths = (now.getFullYear() - purchaseDate.getFullYear()) * 12 + 
                          (now.getMonth() - purchaseDate.getMonth());
      
      if (ageInMonths < 1) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
      } else if (ageInMonths < 12) {
        return `${ageInMonths} month${ageInMonths !== 1 ? 's' : ''} (${diffDays} days)`;
      } else {
        const years = Math.floor(ageInMonths / 12);
        const months = ageInMonths % 12;
        return `${years} year${years !== 1 ? 's' : ''}${months > 0 ? `, ${months} month${months !== 1 ? 's' : ''}` : ''} (${diffDays} days)`;
      }
    } catch (error) {
      console.error('Error calculating asset age:', error);
      return 'Unknown';
    }
  };
  
  // Format purchase date for display
  const formatPurchaseDate = () => {
    if (!asset.purchaseDate) return 'Not available';
    
    try {
      // Handle both string and Date objects
      const purchaseDateStr = typeof asset.purchaseDate === 'object' 
        ? asset.purchaseDate.toISOString() 
        : String(asset.purchaseDate);
      
      // Try to parse the date string
      const purchaseDate = new Date(purchaseDateStr);
      
      // Check if date is valid
      if (isNaN(purchaseDate.getTime())) {
        console.warn('Invalid purchase date for display:', purchaseDateStr);
        return 'Not available';
      }
      
      return purchaseDate.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting purchase date:', error);
      return 'Not available';
    }
  };

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-blue-950/50 dark:via-background dark:to-blue-950/50 transition-all duration-300 hover:shadow-md">
      <div className="absolute inset-0 bg-grid-black/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Asset Health Score</CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-full p-2.5 bg-blue-100 dark:bg-blue-900/50 cursor-help">
                <Zap className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">
                The health score is calculated based on asset age, maintenance history, usage patterns, and current condition.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-2">
          <div className="text-3xl font-bold tracking-tight">{healthScore}</div>
          <Badge className={healthStatus.color}>
            {healthStatus.label}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">Current Status:</span>
          <Badge className={getStatusBadgeColor(asset.status)}>
            {asset.status.replace('_', ' ')}
          </Badge>
        </div>
        
        <Progress 
          value={healthScore} 
          className="h-2 mb-4" 
          indicatorClassName={progressColor}
        />
        
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Age:</span>
              <span className="font-medium">{getAssetAge()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Last Activity:</span>
              <span className="font-medium">
                {asset.lastMovedAt 
                  ? (() => {
                      try {
                        const date = new Date(asset.lastMovedAt);
                        return isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString();
                      } catch (error) {
                        console.error('Error formatting last activity date:', error);
                        return 'Unknown';
                      }
                    })()
                  : 'None'}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Purchase Date:</span>
              <span className="font-medium">{formatPurchaseDate()}</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Age Factor</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Based on the asset's age relative to expected lifespan</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="font-medium">{healthFactors.age}%</span>
            </div>
            <Progress value={healthFactors.age} className="h-1" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Maintenance Factor</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Based on maintenance history and ticket resolution</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="font-medium">{healthFactors.maintenance}%</span>
            </div>
            <Progress value={healthFactors.maintenance} className="h-1" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Usage Factor</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Based on frequency of use and movement history</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="font-medium">{healthFactors.usage}%</span>
            </div>
            <Progress value={healthFactors.usage} className="h-1" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Condition Factor</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Based on reported issues and current status</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="font-medium">{healthFactors.condition}%</span>
            </div>
            <Progress value={healthFactors.condition} className="h-1" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}