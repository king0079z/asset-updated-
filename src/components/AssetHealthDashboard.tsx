import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AssetHealthScoreCard } from "./AssetHealthScoreCard";
import { PredictiveMaintenanceCard } from "./PredictiveMaintenanceCard";
import { AssetLifecycleVisualization } from "./AssetLifecycleVisualization";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar, Clock, Download, FileText, RefreshCw, DollarSign, PieChart } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Asset {
  id: string;
  name: string;
  type: string;
  purchaseDate?: string | Date | null;
  lastMovedAt?: string | Date;
  status: string;
  purchaseAmount?: number;
}

interface MaintenancePrediction {
  id: string;
  assetId: string;
  type: 'ROUTINE' | 'PREVENTIVE' | 'CRITICAL';
  description: string;
  recommendedDate: string;
  confidence: number;
  status: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'IGNORED';
}

interface AssetHealthDashboardProps {
  asset: Asset;
}

export function AssetHealthDashboard({ asset }: AssetHealthDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [healthData, setHealthData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("health");
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<MaintenancePrediction | null>(null);
  const { toast } = useToast();

  const fetchHealthData = async () => {
    setIsLoading(true);
    try {
      // Add a timeout to the fetch request to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`/api/assets/${asset.id}/health`, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Server responded with ${response.status}: ${errorText}`);
        throw new Error(`Failed to fetch asset health data: ${response.status}`);
      }
      
      const data = await response.json();
      setHealthData(data);
    } catch (error) {
      console.error('Error fetching asset health data:', error);
      
      // More descriptive error message based on the error type
      let errorMessage = "Failed to load asset health data. Please try again.";
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        errorMessage = "Request timed out. The server took too long to respond.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (asset?.id) {
      fetchHealthData();
    }
  }, [asset]);

  const handleScheduleMaintenance = (prediction: MaintenancePrediction) => {
    setSelectedPrediction(prediction);
    setIsScheduleDialogOpen(true);
  };

  const handleConfirmSchedule = async () => {
    if (!selectedPrediction) return;
    
    toast({
      title: "Maintenance Scheduled",
      description: "The maintenance task has been scheduled successfully.",
    });
    
    setIsScheduleDialogOpen(false);
    
    // Refresh health data to reflect the scheduled maintenance
    fetchHealthData();
  };

  const handleGenerateReport = () => {
    if (!healthData) return;
    
    toast({
      title: "Generating Report",
      description: "Asset health report is being generated...",
    });
    
    // In a real implementation, this would generate a PDF report
    setTimeout(() => {
      toast({
        title: "Report Ready",
        description: "Asset health report has been generated successfully.",
      });
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[300px] w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-[400px] w-full rounded-lg" />
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (!healthData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="rounded-full p-3 bg-red-100 dark:bg-red-900/50 mb-4">
              <RefreshCw className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-medium mb-2">Failed to Load Health Data</h3>
            <p className="text-muted-foreground mb-4">
              We couldn't retrieve the health information for this asset.
            </p>
            <Button onClick={fetchHealthData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Asset Health Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Comprehensive health monitoring and predictive maintenance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchHealthData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleGenerateReport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="health">Health Score</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
        </TabsList>
        
        <TabsContent value="health" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AssetHealthScoreCard 
              asset={asset}
              healthScore={healthData.healthScore.score}
              healthFactors={healthData.healthScore.factors}
            />
            
            <Card className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-orange-950/50 dark:via-background dark:to-orange-950/50 transition-all duration-300 hover:shadow-md">
              <div className="absolute inset-0 bg-grid-black/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Health Insights</CardTitle>
                <div className="rounded-full p-2.5 bg-orange-100 dark:bg-orange-900/50">
                  <FileText className="h-5 w-5 text-orange-700 dark:text-orange-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Generate insights based on health score */}
                  {healthData.healthScore.score >= 80 && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <h3 className="font-medium mb-1">Excellent Condition</h3>
                      <p className="text-sm text-muted-foreground">
                        This asset is in excellent condition and requires only routine maintenance.
                      </p>
                    </div>
                  )}
                  
                  {healthData.healthScore.score < 80 && healthData.healthScore.score >= 60 && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h3 className="font-medium mb-1">Good Condition</h3>
                      <p className="text-sm text-muted-foreground">
                        This asset is in good condition but may benefit from preventive maintenance.
                      </p>
                    </div>
                  )}
                  
                  {healthData.healthScore.score < 60 && healthData.healthScore.score >= 40 && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <h3 className="font-medium mb-1">Fair Condition</h3>
                      <p className="text-sm text-muted-foreground">
                        This asset is showing signs of wear and requires attention to prevent further deterioration.
                      </p>
                    </div>
                  )}
                  
                  {healthData.healthScore.score < 40 && healthData.healthScore.score >= 20 && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <h3 className="font-medium mb-1">Poor Condition</h3>
                      <p className="text-sm text-muted-foreground">
                        This asset is in poor condition and requires immediate maintenance attention.
                      </p>
                    </div>
                  )}
                  
                  {healthData.healthScore.score < 20 && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <h3 className="font-medium mb-1">Critical Condition</h3>
                      <p className="text-sm text-muted-foreground">
                        This asset is in critical condition and may need replacement or major repairs.
                      </p>
                    </div>
                  )}
                  
                  {/* Factor-specific insights */}
                  {healthData.healthScore.factors.age < 50 && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <h3 className="font-medium mb-1">Age Concern</h3>
                      <p className="text-sm text-muted-foreground">
                        This asset is approaching the end of its expected lifespan. Consider planning for replacement.
                      </p>
                    </div>
                  )}
                  
                  {healthData.healthScore.factors.maintenance < 60 && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <h3 className="font-medium mb-1">Maintenance History</h3>
                      <p className="text-sm text-muted-foreground">
                        This asset has unresolved maintenance issues that should be addressed.
                      </p>
                    </div>
                  )}
                  
                  {healthData.healthScore.factors.usage < 50 && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h3 className="font-medium mb-1">High Usage</h3>
                      <p className="text-sm text-muted-foreground">
                        This asset has been moved frequently, which may contribute to wear and tear.
                      </p>
                    </div>
                  )}
                  
                  {healthData.healthScore.factors.condition < 60 && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <h3 className="font-medium mb-1">Condition Alert</h3>
                      <p className="text-sm text-muted-foreground">
                        The current condition of this asset requires attention to prevent failure.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Total Cost of Ownership Card */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-green-50 via-white to-green-50 dark:from-green-950/50 dark:via-background dark:to-green-950/50 transition-all duration-300 hover:shadow-md mt-6">
            <div className="absolute inset-0 bg-grid-black/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost of Ownership</CardTitle>
              <div className="rounded-full p-2.5 bg-green-100 dark:bg-green-900/50">
                <DollarSign className="h-5 w-5 text-green-700 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="text-3xl font-bold tracking-tight">
                    {healthData.totalCostOfOwnership?.totalCost.toLocaleString()} {healthData.totalCostOfOwnership?.currency}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Estimated lifetime cost including purchase, maintenance, and operations
                  </p>
                </div>
                
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex items-center justify-between gap-8">
                    <span className="text-muted-foreground">Initial Purchase:</span>
                    <span className="font-medium">{healthData.totalCostOfOwnership?.breakdown.initialCost.toLocaleString()} {healthData.totalCostOfOwnership?.currency}</span>
                  </div>
                  <div className="flex items-center justify-between gap-8">
                    <span className="text-muted-foreground">Maintenance Costs:</span>
                    <span className="font-medium">{healthData.totalCostOfOwnership?.breakdown.maintenanceCosts.toLocaleString()} {healthData.totalCostOfOwnership?.currency}</span>
                  </div>
                  <div className="flex items-center justify-between gap-8">
                    <span className="text-muted-foreground">Operational Costs:</span>
                    <span className="font-medium">{healthData.totalCostOfOwnership?.breakdown.operationalCosts.toLocaleString()} {healthData.totalCostOfOwnership?.currency}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <PieChart className="h-5 w-5 text-green-700 dark:text-green-400" />
                  <h3 className="font-medium">Cost Breakdown</h3>
                </div>
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ 
                        width: `${(healthData.totalCostOfOwnership?.breakdown.initialCost / healthData.totalCostOfOwnership?.totalCost) * 100}%` 
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Initial Purchase</span>
                    <span>{Math.round((healthData.totalCostOfOwnership?.breakdown.initialCost / healthData.totalCostOfOwnership?.totalCost) * 100)}%</span>
                  </div>
                  
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div 
                      className="bg-yellow-500 h-2.5 rounded-full" 
                      style={{ 
                        width: `${(healthData.totalCostOfOwnership?.breakdown.maintenanceCosts / healthData.totalCostOfOwnership?.totalCost) * 100}%` 
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Maintenance</span>
                    <span>{Math.round((healthData.totalCostOfOwnership?.breakdown.maintenanceCosts / healthData.totalCostOfOwnership?.totalCost) * 100)}%</span>
                  </div>
                  
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div 
                      className="bg-green-500 h-2.5 rounded-full" 
                      style={{ 
                        width: `${(healthData.totalCostOfOwnership?.breakdown.operationalCosts / healthData.totalCostOfOwnership?.totalCost) * 100}%` 
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Operational</span>
                    <span>{Math.round((healthData.totalCostOfOwnership?.breakdown.operationalCosts / healthData.totalCostOfOwnership?.totalCost) * 100)}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="maintenance" className="mt-4">
          <PredictiveMaintenanceCard 
            assetId={asset.id}
            predictions={healthData.maintenancePredictions}
            onScheduleMaintenance={handleScheduleMaintenance}
          />
        </TabsContent>
        
        <TabsContent value="lifecycle" className="mt-4">
          <AssetLifecycleVisualization 
            asset={asset}
            lifecycleEvents={healthData.lifecycleEvents}
          />
        </TabsContent>
      </Tabs>

      {/* Schedule Maintenance Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Maintenance</DialogTitle>
            <DialogDescription>
              Schedule the recommended maintenance task for this asset.
            </DialogDescription>
          </DialogHeader>
          
          {selectedPrediction && (
            <div className="space-y-4 py-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">{selectedPrediction.description}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Calendar className="h-4 w-4" />
                  <span>Recommended by: {new Date(selectedPrediction.recommendedDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Confidence:</span>
                  <span className="font-medium">{selectedPrediction.confidence}%</span>
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmSchedule}>
                  Confirm Schedule
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}