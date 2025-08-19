import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Package, 
  ShieldAlert, 
  Wrench, 
  BarChart3, 
  Activity, 
  Timer, 
  Gauge, 
  ThumbsUp, 
  ThumbsDown,
  Info
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Asset = {
  id: string;
  assetId: string;
  name: string;
  description: string | null;
  status: string;
  type: string | null;
  floorNumber: string | null;
  roomNumber: string | null;
  purchaseAmount: number | null;
  purchaseDate: string | null;
  healthScore: number;
  createdAt: string;
};

type VendorEvaluation = {
  overallHealthScore: number;
  assetStatusCounts: Record<string, number>;
  totalAssets: number;
  healthDistribution: Record<string, number>;
  qualityMetrics: {
    disposalRate: number;
    maintenanceRate: number;
    damageRate: number;
    averageLifespan: number | null;
    qualityScore: number;
  };
};

type VendorAssetSummaryProps = {
  vendorId: string;
};

// Function to get color based on health score
const getHealthScoreColor = (score: number): string => {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
};

// Function to get status badge variant
const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "ACTIVE":
    case "LIKE_NEW":
      return "default";
    case "IN_TRANSIT":
      return "secondary";
    case "MAINTENANCE":
    case "DAMAGED":
    case "CRITICAL":
      return "destructive";
    case "DISPOSED":
    default:
      return "outline";
  }
};

// Function to format status text
const formatStatus = (status: string): string => {
  return status.replace("_", " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

// Function to get status icon
const getStatusIcon = (status: string) => {
  switch (status) {
    case "ACTIVE":
    case "LIKE_NEW":
      return <CheckCircle className="h-4 w-4" />;
    case "IN_TRANSIT":
      return <Package className="h-4 w-4" />;
    case "MAINTENANCE":
      return <Wrench className="h-4 w-4" />;
    case "DAMAGED":
    case "CRITICAL":
      return <AlertTriangle className="h-4 w-4" />;
    case "DISPOSED":
      return <ShieldAlert className="h-4 w-4" />;
    default:
      return null;
  }
};

export function VendorAssetSummary({ vendorId }: VendorAssetSummaryProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [evaluation, setEvaluation] = useState<VendorEvaluation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVendorAssets = async () => {
      if (!vendorId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/vendors/${vendorId}/assets`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch vendor assets");
        }
        
        const data = await response.json();
        setAssets(data.assets);
        setEvaluation(data.evaluation);
      } catch (error) {
        console.error("Error fetching vendor assets:", error);
        setError("Failed to load vendor assets. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchVendorAssets();
  }, [vendorId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-[200px] w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-[100px] w-full" />
          <Skeleton className="h-[100px] w-full" />
          <Skeleton className="h-[100px] w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!evaluation || assets.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No Assets Found</AlertTitle>
        <AlertDescription>This vendor has no associated assets.</AlertDescription>
      </Alert>
    );
  }

  // Sort assets by health score (descending)
  const sortedAssets = [...assets].sort((a, b) => b.healthScore - a.healthScore);

  // Get status distribution for chart
  const statusDistribution = Object.entries(evaluation.healthDistribution).map(([status, percentage]) => ({
    status,
    percentage,
  }));

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-2">
        <CardHeader className="bg-muted/50 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                Asset Health Evaluation
              </CardTitle>
              <CardDescription>
                Overall health assessment based on {evaluation.totalAssets} assets
              </CardDescription>
            </div>
            <Badge 
              variant={evaluation.overallHealthScore >= 80 ? "default" : 
                     evaluation.overallHealthScore >= 60 ? "secondary" : "destructive"}
              className="px-3 py-1 text-sm"
            >
              {evaluation.overallHealthScore >= 80 ? "Excellent" : 
               evaluation.overallHealthScore >= 60 ? "Good" : "Needs Attention"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Overall Health Score</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>This score represents the overall health of all assets from this vendor, calculated based on status, maintenance history, and age.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="text-lg font-semibold">{evaluation.overallHealthScore}%</span>
            </div>
            <div className="relative pt-1">
              <div className="overflow-hidden h-4 text-xs flex rounded-full bg-muted">
                <div 
                  style={{ width: `${evaluation.overallHealthScore}%` }} 
                  className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${getHealthScoreColor(evaluation.overallHealthScore)}`}>
                </div>
              </div>
              <div className="flex text-xs justify-between mt-1 text-muted-foreground">
                <span>Critical</span>
                <span>Poor</span>
                <span>Average</span>
                <span>Good</span>
                <span>Excellent</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(evaluation.assetStatusCounts).map(([status, count]) => {
              const percentage = Math.round((count / evaluation.totalAssets) * 100);
              return (
                <div 
                  key={status} 
                  className={`border-l-4 ${
                    status === "ACTIVE" || status === "LIKE_NEW" ? "border-l-green-500" :
                    status === "IN_TRANSIT" ? "border-l-blue-500" :
                    status === "MAINTENANCE" ? "border-l-yellow-500" :
                    status === "DAMAGED" || status === "CRITICAL" ? "border-l-red-500" :
                    "border-l-gray-500"
                  } rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200 bg-card`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-full bg-muted">
                        {getStatusIcon(status)}
                      </div>
                      <span className="font-medium">{formatStatus(status)}</span>
                    </div>
                    <Badge variant="outline" className="ml-auto">
                      {percentage}%
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <Progress
                      value={percentage}
                      max={100}
                      className="h-1.5"
                      indicatorClassName={
                        status === "ACTIVE" || status === "LIKE_NEW" ? "bg-green-500" :
                        status === "IN_TRANSIT" ? "bg-blue-500" :
                        status === "MAINTENANCE" ? "bg-yellow-500" :
                        status === "DAMAGED" || status === "CRITICAL" ? "bg-red-500" :
                        "bg-gray-500"
                      }
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      {count} asset{count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
        <CardFooter className="bg-muted/30 border-t px-6 py-3">
          <div className="flex items-center text-sm text-muted-foreground">
            <Activity className="h-4 w-4 mr-2" />
            <span>Last updated: {format(new Date(), "MMM d, yyyy")}</span>
          </div>
        </CardFooter>
      </Card>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Assets</TabsTrigger>
          <TabsTrigger value="issues">
            Issues ({
              (evaluation.assetStatusCounts.MAINTENANCE || 0) +
              (evaluation.assetStatusCounts.DAMAGED || 0) +
              (evaluation.assetStatusCounts.CRITICAL || 0)
            })
          </TabsTrigger>
          <TabsTrigger value="disposed">
            Disposed ({evaluation.assetStatusCounts.DISPOSED || 0})
          </TabsTrigger>
          <TabsTrigger value="quality">Quality Metrics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Assets</CardTitle>
              <CardDescription>
                Complete list of assets purchased from this vendor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Health Score</TableHead>
                    <TableHead>Purchase Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAssets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">{asset.assetId}</TableCell>
                      <TableCell>{asset.name}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(asset.status)}>
                          {formatStatus(asset.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={asset.healthScore}
                            max={100}
                            className="h-2 w-16"
                            indicatorClassName={getHealthScoreColor(asset.healthScore)}
                          />
                          <span>{asset.healthScore}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {asset.purchaseDate 
                          ? format(new Date(asset.purchaseDate), "MMM d, yyyy")
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="issues" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Assets with Issues</CardTitle>
              <CardDescription>
                Assets that require attention or maintenance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sortedAssets.filter(asset => 
                ["MAINTENANCE", "DAMAGED", "CRITICAL"].includes(asset.status)
              ).length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  No assets with issues found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Health Score</TableHead>
                      <TableHead>Purchase Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAssets
                      .filter(asset => ["MAINTENANCE", "DAMAGED", "CRITICAL"].includes(asset.status))
                      .map((asset) => (
                        <TableRow key={asset.id}>
                          <TableCell className="font-medium">{asset.assetId}</TableCell>
                          <TableCell>{asset.name}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(asset.status)}>
                              {formatStatus(asset.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={asset.healthScore}
                                max={100}
                                className="h-2 w-16"
                                indicatorClassName={getHealthScoreColor(asset.healthScore)}
                              />
                              <span>{asset.healthScore}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {asset.purchaseDate 
                              ? format(new Date(asset.purchaseDate), "MMM d, yyyy")
                              : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="disposed" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Disposed Assets</CardTitle>
              <CardDescription>
                Assets that have been disposed of
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sortedAssets.filter(asset => asset.status === "DISPOSED").length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  No disposed assets found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Health Score</TableHead>
                      <TableHead>Purchase Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAssets
                      .filter(asset => asset.status === "DISPOSED")
                      .map((asset) => (
                        <TableRow key={asset.id}>
                          <TableCell className="font-medium">{asset.assetId}</TableCell>
                          <TableCell>{asset.name}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(asset.status)}>
                              {formatStatus(asset.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={asset.healthScore}
                                max={100}
                                className="h-2 w-16"
                                indicatorClassName={getHealthScoreColor(asset.healthScore)}
                              />
                              <span>{asset.healthScore}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {asset.purchaseDate 
                              ? format(new Date(asset.purchaseDate), "MMM d, yyyy")
                              : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="quality" className="mt-4">
          <Card className="overflow-hidden border-2">
            <CardHeader className="bg-muted/50 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Item Quality Evaluation
                  </CardTitle>
                  <CardDescription>
                    Comprehensive analysis of item quality based on performance metrics
                  </CardDescription>
                </div>
                <Badge 
                  variant={evaluation.qualityMetrics.qualityScore >= 80 ? "default" : 
                         evaluation.qualityMetrics.qualityScore >= 60 ? "secondary" : "destructive"}
                  className="px-3 py-1 text-sm"
                >
                  {evaluation.qualityMetrics.qualityScore >= 80 ? "Premium Quality" : 
                   evaluation.qualityMetrics.qualityScore >= 60 ? "Standard Quality" : "Quality Concerns"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="bg-muted/30 p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className={`h-5 w-5 ${evaluation.qualityMetrics.qualityScore >= 70 ? "text-green-500" : "text-muted-foreground"}`} />
                    <h3 className="text-base font-medium">Overall Quality Score</h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>This score combines all quality metrics into a single rating that reflects the overall quality of items from this vendor.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span className="text-xl font-bold">{evaluation.qualityMetrics.qualityScore}%</span>
                </div>
                <div className="relative pt-1">
                  <div className="overflow-hidden h-5 text-xs flex rounded-full bg-muted">
                    <div 
                      style={{ width: `${evaluation.qualityMetrics.qualityScore}%` }} 
                      className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${getHealthScoreColor(evaluation.qualityMetrics.qualityScore)}`}>
                      <span className="font-semibold">{evaluation.qualityMetrics.qualityScore}%</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  This comprehensive score evaluates the overall quality of items based on multiple factors including disposal rates, maintenance requirements, damage frequency, and average lifespan.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card rounded-xl shadow-sm overflow-hidden border hover:shadow-md transition-shadow duration-200">
                  <div className="p-4 border-b bg-muted/20">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-red-500" />
                      <h3 className="font-medium">Disposal Rate</h3>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Percentage of disposed items</span>
                      <div className="flex items-center gap-1">
                        <Badge variant={evaluation.qualityMetrics.disposalRate <= 10 ? "default" : 
                                      evaluation.qualityMetrics.disposalRate <= 20 ? "secondary" : "destructive"}>
                          {evaluation.qualityMetrics.disposalRate}%
                        </Badge>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p>Lower is better. Industry average is ~15%</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <div className="relative pt-1">
                      <div className="overflow-hidden h-3 text-xs flex rounded bg-muted">
                        <div 
                          style={{ width: `${evaluation.qualityMetrics.disposalRate}%` }} 
                          className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${evaluation.qualityMetrics.disposalRate > 20 ? "bg-red-500" : evaluation.qualityMetrics.disposalRate > 10 ? "bg-yellow-500" : "bg-green-500"}`}>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Lower disposal rates indicate higher quality items that last longer. This metric tracks how many items needed to be disposed of prematurely.
                    </p>
                  </div>
                </div>
                
                <div className="bg-card rounded-xl shadow-sm overflow-hidden border hover:shadow-md transition-shadow duration-200">
                  <div className="p-4 border-b bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-yellow-500" />
                      <h3 className="font-medium">Maintenance Rate</h3>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Items requiring maintenance</span>
                      <div className="flex items-center gap-1">
                        <Badge variant={evaluation.qualityMetrics.maintenanceRate <= 10 ? "default" : 
                                      evaluation.qualityMetrics.maintenanceRate <= 20 ? "secondary" : "destructive"}>
                          {evaluation.qualityMetrics.maintenanceRate}%
                        </Badge>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p>Lower is better. Industry average is ~12%</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <div className="relative pt-1">
                      <div className="overflow-hidden h-3 text-xs flex rounded bg-muted">
                        <div 
                          style={{ width: `${evaluation.qualityMetrics.maintenanceRate}%` }} 
                          className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${evaluation.qualityMetrics.maintenanceRate > 15 ? "bg-orange-500" : "bg-green-500"}`}>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Lower maintenance rates suggest more reliable items. This metric measures how frequently items require maintenance or repair.
                    </p>
                  </div>
                </div>
                
                <div className="bg-card rounded-xl shadow-sm overflow-hidden border hover:shadow-md transition-shadow duration-200">
                  <div className="p-4 border-b bg-muted/20">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <h3 className="font-medium">Damage Rate</h3>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Damaged or critical items</span>
                      <div className="flex items-center gap-1">
                        <Badge variant={evaluation.qualityMetrics.damageRate <= 5 ? "default" : 
                                      evaluation.qualityMetrics.damageRate <= 10 ? "secondary" : "destructive"}>
                          {evaluation.qualityMetrics.damageRate}%
                        </Badge>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p>Lower is better. Industry average is ~8%</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <div className="relative pt-1">
                      <div className="overflow-hidden h-3 text-xs flex rounded bg-muted">
                        <div 
                          style={{ width: `${evaluation.qualityMetrics.damageRate}%` }} 
                          className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${evaluation.qualityMetrics.damageRate > 10 ? "bg-red-500" : "bg-green-500"}`}>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Lower damage rates indicate more durable items. This metric tracks how many items have been damaged during normal use.
                    </p>
                  </div>
                </div>
                
                <div className="bg-card rounded-xl shadow-sm overflow-hidden border hover:shadow-md transition-shadow duration-200">
                  <div className="p-4 border-b bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Timer className="h-5 w-5 text-blue-500" />
                      <h3 className="font-medium">Average Lifespan</h3>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">For disposed items</span>
                      <div className="flex items-center gap-1">
                        <Badge variant={evaluation.qualityMetrics.averageLifespan && evaluation.qualityMetrics.averageLifespan > 365 ? "default" : 
                                      evaluation.qualityMetrics.averageLifespan && evaluation.qualityMetrics.averageLifespan > 180 ? "secondary" : "destructive"}>
                          {evaluation.qualityMetrics.averageLifespan 
                            ? `${evaluation.qualityMetrics.averageLifespan} days` 
                            : "No data"}
                        </Badge>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p>Higher is better. Industry average is ~300 days</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    {evaluation.qualityMetrics.averageLifespan && (
                      <div className="relative pt-1">
                        <div className="overflow-hidden h-3 text-xs flex rounded bg-muted">
                          <div 
                            style={{ width: `${Math.min((evaluation.qualityMetrics.averageLifespan / 730) * 100, 100)}%` }} 
                            className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                              evaluation.qualityMetrics.averageLifespan > 365 ? "bg-green-500" : 
                              evaluation.qualityMetrics.averageLifespan > 180 ? "bg-yellow-500" : "bg-red-500"
                            }`}>
                          </div>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Longer lifespans indicate higher quality, more durable items. This metric measures how long items typically last before disposal.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted/20 p-5 rounded-lg border mt-6">
                <div className="flex items-start gap-3">
                  {evaluation.qualityMetrics.qualityScore >= 80 ? (
                    <ThumbsUp className="h-6 w-6 text-green-500 flex-shrink-0 mt-1" />
                  ) : evaluation.qualityMetrics.qualityScore >= 60 ? (
                    <Info className="h-6 w-6 text-yellow-500 flex-shrink-0 mt-1" />
                  ) : (
                    <ThumbsDown className="h-6 w-6 text-red-500 flex-shrink-0 mt-1" />
                  )}
                  <div>
                    <h3 className="text-base font-medium mb-2">Quality Assessment Summary</h3>
                    <p className="text-sm">
                      {evaluation.qualityMetrics.qualityScore >= 80 
                        ? "This vendor consistently provides high-quality items with excellent durability and minimal maintenance requirements. Assets from this vendor demonstrate superior performance and longevity, making them a reliable choice for critical operations."
                        : evaluation.qualityMetrics.qualityScore >= 60
                          ? "This vendor provides good quality items with reasonable durability and maintenance needs. While generally reliable, there may be occasional quality inconsistencies that require monitoring."
                          : "This vendor's items show quality concerns, with higher than average disposal and maintenance rates. Consider discussing these issues with the vendor or exploring alternative suppliers for critical assets."}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t px-6 py-3">
              <div className="flex items-center text-sm text-muted-foreground">
                <Activity className="h-4 w-4 mr-2" />
                <span>Quality metrics last updated: {format(new Date(), "MMM d, yyyy")}</span>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}