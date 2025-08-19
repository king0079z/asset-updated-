import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { useTranslation } from "@/contexts/TranslationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { 
  AlertTriangle, 
  Clock, 
  Package, 
  Star, 
  Info, 
  BarChart3, 
  Gauge, 
  ThumbsUp, 
  ThumbsDown,
  CheckCircle,
  Wrench
} from "lucide-react";
import { VendorPerformanceEvaluationDialog } from "./VendorPerformanceEvaluationDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

type Vendor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  type: string[];
  reliabilityScore: number | null;
  qualityScore: number | null;
  responseTimeScore: number | null;
  lastReviewDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type VendorPerformanceCardProps = {
  vendor: Vendor;
  onPerformanceUpdated: () => void;
};

// Function to get color based on score
const getScoreColor = (score: number | null): string => {
  if (score === null) return "#6b7280"; // Gray for no score
  if (score >= 80) return "#10b981"; // Green for high scores
  if (score >= 60) return "#f59e0b"; // Amber for medium scores
  return "#ef4444"; // Red for low scores
};

// Get performance status based on overall score
const getPerformanceStatus = (score: number | null, t: (key: string) => string): string => {
  if (score === null) return t('not_rated');
  if (score >= 80) return t('excellent');
  if (score >= 60) return t('good');
  return t('needs_improvement');
};

// Calculate overall score for a vendor
const calculateOverallScore = (vendor: Vendor): number | null => {
  const scores = [
    vendor.reliabilityScore,
    vendor.qualityScore,
    vendor.responseTimeScore,
  ].filter((score) => score !== null) as number[];
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
};

// Calculate days since last review
const getDaysSinceLastReview = (lastReviewDate: string | null): number | null => {
  if (!lastReviewDate) return null;
  const lastReview = new Date(lastReviewDate);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - lastReview.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Determine if vendor needs review (more than 90 days)
const needsReview = (lastReviewDate: string | null): boolean => {
  const daysSinceLastReview = getDaysSinceLastReview(lastReviewDate);
  return daysSinceLastReview === null || daysSinceLastReview > 90;
};

export function VendorPerformanceCard({ vendor, onPerformanceUpdated }: VendorPerformanceCardProps) {
  const { t, dir } = useTranslation();
  const [isEvaluationDialogOpen, setIsEvaluationDialogOpen] = useState(false);
  const [assetHealthScore, setAssetHealthScore] = useState<number | null>(null);
  const [assetCount, setAssetCount] = useState<number>(0);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState<boolean>(false);
  const [assetStatusCounts, setAssetStatusCounts] = useState<Record<string, number>>({});
  
  const overallScore = calculateOverallScore(vendor);
  const performanceStatus = getPerformanceStatus(overallScore, t);
  const daysSinceLastReview = getDaysSinceLastReview(vendor.lastReviewDate);
  const reviewNeeded = needsReview(vendor.lastReviewDate);
  
  // Fetch asset health data if vendor is an ASSET vendor
  useEffect(() => {
    const fetchAssetHealth = async () => {
      if (!vendor.type.includes("ASSET")) return;
      
      setIsLoadingAssets(true);
      try {
        const response = await fetch(`/api/vendors/${vendor.id}/assets`);
        if (response.ok) {
          const data = await response.json();
          if (data.evaluation) {
            setAssetHealthScore(data.evaluation.overallHealthScore);
            setAssetCount(data.evaluation.totalAssets);
            setQualityScore(data.evaluation.qualityMetrics?.qualityScore || null);
            setAssetStatusCounts(data.evaluation.assetStatusCounts || {});
          }
        }
      } catch (error) {
        console.error("Error fetching asset health:", error);
      } finally {
        setIsLoadingAssets(false);
      }
    };
    
    fetchAssetHealth();
  }, [vendor.id, vendor.type]);

  const handleOpenEvaluationDialog = () => {
    setIsEvaluationDialogOpen(true);
  };

  const handleCloseEvaluationDialog = () => {
    setIsEvaluationDialogOpen(false);
  };

  const handlePerformanceSubmitted = () => {
    onPerformanceUpdated();
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{vendor.name}</CardTitle>
              <CardDescription>
                {vendor.type.map((type) => (
                  <Badge key={type} variant="outline" className="mr-1">
                    {type.replace("_", " ")}
                  </Badge>
                ))}
              </CardDescription>
            </div>
            <Badge
              variant={
                performanceStatus === "Excellent"
                  ? "default"
                  : performanceStatus === "Good"
                  ? "secondary"
                  : "outline"
              }
              className="text-xs"
            >
              {performanceStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {reviewNeeded && (
            <Alert variant="warning" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('review_needed')}</AlertTitle>
              <AlertDescription>
                {vendor.lastReviewDate
                  ? `${t('last_performance_review_was')} ${daysSinceLastReview} ${t('days_ago')}.`
                  : t('never_reviewed')}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            {vendor.type.includes("ASSET") && (
              <div className="bg-card shadow-sm rounded-xl border overflow-hidden">
                <div className="bg-muted/30 p-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-full bg-primary/10">
                      <Gauge className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-medium">{t('asset_health_evaluation')}</h3>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 transition-colors">
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{assetCount} {t('assets')}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('based_on_health_of')} {assetCount} {t('assets_from_vendor')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <div className="p-4">
                  {isLoadingAssets ? (
                    <div className="flex justify-center py-2">
                      <p className="text-sm text-muted-foreground">{t('loading_asset_data')}</p>
                    </div>
                  ) : assetHealthScore === null ? (
                    <div className="flex justify-center py-2">
                      <p className="text-sm text-muted-foreground">{t('no_asset_data_available')}</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <Badge
                          variant={assetHealthScore >= 80 ? "default" : 
                                  assetHealthScore >= 60 ? "secondary" : "destructive"}
                          className="px-2.5 py-0.5 text-xs"
                        >
                          {assetHealthScore >= 80 ? t('excellent') : 
                           assetHealthScore >= 60 ? t('good') : t('needs_attention')}
                        </Badge>
                        <span className="text-lg font-semibold">{assetHealthScore}%</span>
                      </div>
                      <div className="relative pt-1">
                        <div className="overflow-hidden h-3 text-xs flex rounded-full bg-muted">
                          <div 
                            style={{ width: `${assetHealthScore}%` }} 
                            className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${
                              assetHealthScore >= 80 ? "bg-green-500" : 
                              assetHealthScore >= 60 ? "bg-yellow-500" : 
                              assetHealthScore >= 40 ? "bg-orange-500" : "bg-red-500"
                            }`}>
                          </div>
                        </div>
                      </div>
                      
                      {Object.keys(assetStatusCounts).length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mt-4">
                          {Object.entries(assetStatusCounts)
                            .filter(([status, count]) => count > 0)
                            .slice(0, 4)
                            .map(([status, count]) => (
                              <div key={status} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/40">
                                <span>{status.replace("_", " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</span>
                                <Badge variant="outline" className="text-xs">
                                  {Math.round((count / assetCount) * 100)}%
                                </Badge>
                              </div>
                            ))
                          }
                        </div>
                      )}
                      
                      <p className="text-xs text-muted-foreground mt-3">
                        Overall health assessment based on asset status, maintenance history, and age.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
            
            <div className="bg-card shadow-sm rounded-xl border overflow-hidden">
              <div className="bg-muted/30 p-3 border-b">
                <h3 className="font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  {t('performance_metrics')}
                </h3>
              </div>
              
              <div className="p-4 space-y-5">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30">
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-sm font-medium">{t('reliability')}</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p>{t('reliability_description')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Badge
                      variant={vendor.reliabilityScore === null ? "outline" :
                              vendor.reliabilityScore >= 80 ? "default" :
                              vendor.reliabilityScore >= 60 ? "secondary" : "destructive"}
                      className="px-2.5"
                    >
                      {vendor.reliabilityScore !== null ? vendor.reliabilityScore : t('not_rated')}
                    </Badge>
                  </div>
                  <div className="relative">
                    <div className="overflow-hidden h-2 text-xs flex rounded-full bg-muted">
                      <div 
                        style={{ width: `${vendor.reliabilityScore || 0}%` }} 
                        className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${
                          vendor.reliabilityScore === null ? "bg-gray-500" :
                          vendor.reliabilityScore >= 80 ? "bg-green-500" :
                          vendor.reliabilityScore >= 60 ? "bg-yellow-500" : "bg-red-500"
                        }`}>
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
                      <span>0</span>
                      <span>25</span>
                      <span>50</span>
                      <span>75</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900/30">
                        <Star className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-sm font-medium">{t('quality')}</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p>{t('quality_description')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-2">
                      {vendor.type.includes("ASSET") && qualityScore !== null && vendor.qualityScore !== null && 
                        Math.abs(qualityScore - vendor.qualityScore) > 15 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                <BarChart3 className="h-3 w-3" />
                                <span>{t('suggested')}: {qualityScore}%</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>{t('asset_analysis_suggests')} {qualityScore}%</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Badge
                        variant={vendor.qualityScore === null ? "outline" :
                                vendor.qualityScore >= 80 ? "default" :
                                vendor.qualityScore >= 60 ? "secondary" : "destructive"}
                        className="px-2.5"
                      >
                        {vendor.qualityScore !== null ? vendor.qualityScore : t('not_rated')}
                      </Badge>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="overflow-hidden h-2 text-xs flex rounded-full bg-muted">
                      <div 
                        style={{ width: `${vendor.qualityScore || 0}%` }} 
                        className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${
                          vendor.qualityScore === null ? "bg-gray-500" :
                          vendor.qualityScore >= 80 ? "bg-green-500" :
                          vendor.qualityScore >= 60 ? "bg-yellow-500" : "bg-red-500"
                        }`}>
                      </div>
                    </div>
                  </div>
                  {vendor.type.includes("ASSET") && qualityScore !== null && vendor.qualityScore !== null && 
                    Math.abs(qualityScore - vendor.qualityScore) > 15 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Info className="h-3 w-3 text-yellow-500" />
                      <p className="text-xs text-muted-foreground">
                        {t('item_quality_analysis_suggests')}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-full bg-purple-100 dark:bg-purple-900/30">
                        <Clock className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <span className="text-sm font-medium">{t('response')}</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p>{t('response_time_description')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Badge
                      variant={vendor.responseTimeScore === null ? "outline" :
                              vendor.responseTimeScore >= 80 ? "default" :
                              vendor.responseTimeScore >= 60 ? "secondary" : "destructive"}
                      className="px-2.5"
                    >
                      {vendor.responseTimeScore !== null ? vendor.responseTimeScore : t('not_rated')}
                    </Badge>
                  </div>
                  <div className="relative">
                    <div className="overflow-hidden h-2 text-xs flex rounded-full bg-muted">
                      <div 
                        style={{ width: `${vendor.responseTimeScore || 0}%` }} 
                        className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${
                          vendor.responseTimeScore === null ? "bg-gray-500" :
                          vendor.responseTimeScore >= 80 ? "bg-green-500" :
                          vendor.responseTimeScore >= 60 ? "bg-yellow-500" : "bg-red-500"
                        }`}>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Separator className="my-2" />
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-full bg-primary/10">
                        <BarChart3 className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">{t('overall_performance')}</span>
                    </div>
                    <Badge
                      variant={overallScore === null ? "outline" :
                              overallScore >= 80 ? "default" :
                              overallScore >= 60 ? "secondary" : "destructive"}
                      className="px-3 py-1 text-sm"
                    >
                      {overallScore !== null ? `${overallScore}%` : t('not_rated')}
                    </Badge>
                  </div>
                  <div className="relative pt-1">
                    <div className="overflow-hidden h-4 text-xs flex rounded-full bg-muted">
                      <div 
                        style={{ width: `${overallScore || 0}%` }} 
                        className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${
                          overallScore === null ? "bg-gray-500" :
                          overallScore >= 80 ? "bg-green-500" :
                          overallScore >= 60 ? "bg-yellow-500" : "bg-red-500"
                        }`}>
                        {overallScore !== null && <span className="font-semibold">{overallScore}%</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {vendor.lastReviewDate && (
            <div className="flex items-center text-sm text-muted-foreground mt-2">
              <Clock className="h-4 w-4 mr-1" />
              {t('last_review_date')}: {format(new Date(vendor.lastReviewDate), "PPP")}
            </div>
          )}

          {vendor.notes && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-1">{t('notes')}</h4>
              <p className="text-sm text-muted-foreground">{vendor.notes}</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleOpenEvaluationDialog}
            className="w-full"
            variant={reviewNeeded ? "default" : "outline"}
          >
            <Star className="mr-2 h-4 w-4" />
            {reviewNeeded ? t('review_now') : t('update_performance_review')}
          </Button>
        </CardFooter>
      </Card>

      <VendorPerformanceEvaluationDialog
        isOpen={isEvaluationDialogOpen}
        onClose={handleCloseEvaluationDialog}
        vendor={vendor}
        onPerformanceSubmitted={handlePerformanceSubmitted}
      />
    </>
  );
}