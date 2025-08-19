import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Calendar, Clock, Info, Wrench, AlertTriangle, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";

interface MaintenancePrediction {
  id: string;
  assetId: string;
  type: 'ROUTINE' | 'PREVENTIVE' | 'CRITICAL';
  description: string;
  recommendedDate: string;
  confidence: number;
  status: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'IGNORED';
}

interface PredictiveMaintenanceCardProps {
  assetId: string;
  predictions?: MaintenancePrediction[];
  onScheduleMaintenance: (prediction: MaintenancePrediction) => void;
}

export function PredictiveMaintenanceCard({ assetId, predictions: initialPredictions, onScheduleMaintenance }: PredictiveMaintenanceCardProps) {
  const [predictions, setPredictions] = useState<MaintenancePrediction[]>(initialPredictions || []);
  const [isLoading, setIsLoading] = useState<boolean>(!initialPredictions);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If predictions were provided as props, use those
    if (initialPredictions) {
      setPredictions(initialPredictions);
      return;
    }

    // Otherwise fetch predictions from the API
    const fetchPredictions = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log(`Fetching maintenance predictions for asset: ${assetId}`);
        const response = await fetch(`/api/assets/${assetId}/maintenance-predictions`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch predictions: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Maintenance predictions data:', data);
        
        if (data.maintenancePredictions && Array.isArray(data.maintenancePredictions)) {
          setPredictions(data.maintenancePredictions);
        } else {
          console.warn('Unexpected response format:', data);
          setPredictions([]);
        }
      } catch (err) {
        console.error('Error fetching maintenance predictions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load maintenance predictions');
        setPredictions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPredictions();
  }, [assetId, initialPredictions]);
  // Sort predictions by urgency (critical first, then by date)
  const sortedPredictions = [...predictions].sort((a, b) => {
    // First sort by type (CRITICAL first)
    if (a.type === 'CRITICAL' && b.type !== 'CRITICAL') return -1;
    if (a.type !== 'CRITICAL' && b.type === 'CRITICAL') return 1;
    
    // Then sort by status (PENDING first)
    if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
    if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
    
    // Then sort by date
    return new Date(a.recommendedDate).getTime() - new Date(b.recommendedDate).getTime();
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CRITICAL':
        return <AlertTriangle className="h-4 w-4" />;
      case 'PREVENTIVE':
        return <AlertCircle className="h-4 w-4" />;
      case 'ROUTINE':
        return <Wrench className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400';
      case 'PREVENTIVE':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400';
      case 'ROUTINE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'SCHEDULED':
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case 'IGNORED':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'Completed';
      case 'SCHEDULED':
        return 'Scheduled';
      case 'IGNORED':
        return 'Ignored';
      default:
        return 'Pending';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Calculate days until recommended date
  const getDaysUntil = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateString);
    targetDate.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days overdue`;
    } else if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else {
      return `In ${diffDays} days`;
    }
  };

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-purple-50 dark:from-purple-950/50 dark:via-background dark:to-purple-950/50 transition-all duration-300 hover:shadow-md">
      <div className="absolute inset-0 bg-grid-black/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Predictive Maintenance</CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-full p-2.5 bg-purple-100 dark:bg-purple-900/50 cursor-help">
                <Wrench className="h-5 w-5 text-purple-700 dark:text-purple-400" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">
                AI-powered maintenance predictions based on asset health, usage patterns, and industry standards.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Loader2 className="h-10 w-10 text-purple-500 mb-2 animate-spin" />
            <p className="text-muted-foreground">Loading maintenance predictions...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
            <p className="text-muted-foreground">Failed to load predictions</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        ) : sortedPredictions.length > 0 ? (
          <div className="space-y-4">
            {sortedPredictions.map((prediction) => (
              <div 
                key={prediction.id} 
                className="border rounded-lg p-3 bg-white dark:bg-gray-950/50 hover:shadow-sm transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <Badge className={getTypeColor(prediction.type)}>
                    <div className="flex items-center gap-1">
                      {getTypeIcon(prediction.type)}
                      <span>{prediction.type} Maintenance</span>
                    </div>
                  </Badge>
                  <div className="flex items-center gap-1 text-sm">
                    {getStatusIcon(prediction.status)}
                    <span className="text-muted-foreground">{getStatusText(prediction.status)}</span>
                  </div>
                </div>
                
                <p className="text-sm mb-3">{prediction.description}</p>
                
                <div className="flex justify-between items-center text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{formatDate(prediction.recommendedDate)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{getDaysUntil(prediction.recommendedDate)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Info className="h-3.5 w-3.5" />
                    <span>{prediction.confidence}% confidence</span>
                  </div>
                </div>
                
                {prediction.status === 'PENDING' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => onScheduleMaintenance(prediction)}
                  >
                    <Calendar className="h-3.5 w-3.5 mr-2" />
                    Schedule Maintenance
                  </Button>
                )}
              </div>
            ))}
            
            <Button variant="link" className="w-full text-sm" size="sm">
              View all maintenance history
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
            <p className="text-muted-foreground">No maintenance predictions at this time</p>
            <p className="text-xs text-muted-foreground mt-1">
              This asset is currently in good condition
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}