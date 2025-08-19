import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Star, BarChart3, Package, Truck, Building2, ShoppingCart, ArrowUpRight, Filter, SlidersHorizontal, Gauge, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { VendorPerformanceEvaluationDialog } from "./VendorPerformanceEvaluationDialog";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/contexts/TranslationContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

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

// Get performance status based on overall score
const getPerformanceStatus = (score: number | null, t: (key: string) => string): string => {
  if (score === null) return t('not_rated');
  if (score >= 80) return t('excellent');
  if (score >= 60) return t('good');
  return t('needs_improvement');
};

// Get badge variant based on performance status
const getStatusVariant = (score: number | null): "default" | "secondary" | "destructive" | "outline" => {
  if (score === null) return "outline";
  if (score >= 80) return "default";
  if (score >= 60) return "secondary";
  return "destructive";
};

// Get icon for vendor type
const getVendorTypeIcon = (type: string) => {
  switch (type) {
    case "ASSET":
      return <Package className="h-3.5 w-3.5" />;
    case "VEHICLE":
      return <Truck className="h-3.5 w-3.5" />;
    case "FOOD":
      return <ShoppingCart className="h-3.5 w-3.5" />;
    case "FACILITY":
      return <Building2 className="h-3.5 w-3.5" />;
    default:
      return <Package className="h-3.5 w-3.5" />;
  }
};

export function VendorPerformanceReminders() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isEvaluationDialogOpen, setIsEvaluationDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"lastReview" | "score">("lastReview");
  const [filterType, setFilterType] = useState<string | null>(null);
  const { t, dir } = useTranslation();

  const loadVendors = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/vendors");
      if (!response.ok) {
        throw new Error("Failed to load vendors");
      }
      const data = await response.json();
      setVendors(data);
    } catch (error) {
      console.error("Error loading vendors:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  // Filter vendors based on selected type
  const filteredVendors = filterType
    ? vendors.filter((vendor) => vendor.type.includes(filterType))
    : vendors;

  // Get vendors needing review
  const vendorsNeedingReview = filteredVendors.filter((vendor) => needsReview(vendor.lastReviewDate));

  // Sort vendors based on selected sort option
  const sortedVendors = [...vendorsNeedingReview].sort((a, b) => {
    if (sortBy === "lastReview") {
      // Sort by days since last review (descending)
      const daysA = getDaysSinceLastReview(a.lastReviewDate) || Number.MAX_SAFE_INTEGER;
      const daysB = getDaysSinceLastReview(b.lastReviewDate) || Number.MAX_SAFE_INTEGER;
      return daysB - daysA;
    } else {
      // Sort by overall score (ascending, so worst scores first)
      const scoreA = calculateOverallScore(a) || 0;
      const scoreB = calculateOverallScore(b) || 0;
      return scoreA - scoreB;
    }
  });

  // Get all unique vendor types
  const vendorTypes = Array.from(new Set(vendors.flatMap((vendor) => vendor.type)));

  const handleOpenEvaluationDialog = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsEvaluationDialogOpen(true);
  };

  const handleCloseEvaluationDialog = () => {
    setIsEvaluationDialogOpen(false);
  };

  const handlePerformanceSubmitted = () => {
    loadVendors();
  };

  if (isLoading) {
    return (
      <Card className="border shadow-md hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-purple-500" />
            <span>{t('vendor_performance')}</span>
          </CardTitle>
          <CardDescription>{t('loading_vendor_data')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (vendorsNeedingReview.length === 0) {
    return (
      <Card className="border shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-purple-50 dark:from-gray-900 dark:to-purple-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Star className="h-5 w-5 text-purple-500" />
            </div>
            <span>{t('vendor_performance')}</span>
          </CardTitle>
          <CardDescription>{t('all_vendors_reviewed')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t('great_job')}
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Link href="/settings/vendor-performance" className="w-full">
            <Button variant="outline" className="w-full group">
              <span>{t('view_all_vendor_performance')}</span>
              <ArrowUpRight className="ml-2 h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <>
      <Card className="border shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden bg-gradient-to-br from-white to-purple-50 dark:from-gray-900 dark:to-purple-950/20">
        <CardHeader className="pb-2 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <Star className="h-5 w-5 text-purple-500" />
              </div>
              <span>{t('vendor_performance')}</span>
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                    <Filter className="h-3.5 w-3.5 text-purple-500" />
                    {filterType ? `${t('filter_by_type')}: ${t(filterType.toLowerCase())}` : t('filter_by_type')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setFilterType(null)}>
                    {t('all_types')}
                  </DropdownMenuItem>
                  <Separator className="my-1" />
                  {vendorTypes.map((type) => (
                    <DropdownMenuItem key={type} onClick={() => setFilterType(type)}>
                      <div className="flex items-center gap-2">
                        {getVendorTypeIcon(type)}
                        <span>{t(type.toLowerCase())}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-purple-500" />
                    {sortBy === "lastReview" ? t('sort_last_review') : t('sort_score')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy("lastReview")}>
                    {t('last_review_date')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("score")}>
                    {t('performance_score')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <CardDescription>
            {vendorsNeedingReview.length} {vendorsNeedingReview.length === 1 
              ? t('vendors_need_performance_review') 
              : t('vendors_need_performance_review_plural')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="p-4 space-y-4">
              {sortedVendors.map((vendor) => {
                const daysSinceLastReview = getDaysSinceLastReview(vendor.lastReviewDate);
                const overallScore = calculateOverallScore(vendor);
                const performanceStatus = getPerformanceStatus(overallScore, t);
                const statusVariant = getStatusVariant(overallScore);
                
                return (
                  <div 
                    key={vendor.id} 
                    className="group relative flex flex-col gap-3 border border-purple-100 dark:border-purple-800/50 p-4 rounded-lg hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-base group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                          {vendor.name}
                        </h3>
                        <Badge variant={statusVariant} className="text-xs">
                          {performanceStatus}
                        </Badge>
                      </div>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-900/20 px-2.5 py-1.5 rounded-full">
                              <Gauge className="h-4 w-4 text-purple-500" />
                              <span className="font-semibold text-sm text-purple-700 dark:text-purple-300">
                                {overallScore !== null ? `${overallScore}%` : t('not_rated')}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="text-xs">{t('overall_performance')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    
                    <div className="flex flex-wrap gap-1">
                      {vendor.type.map((type) => (
                        <Badge key={type} variant="outline" className="text-xs flex items-center gap-1 px-2 py-0 h-5">
                          {getVendorTypeIcon(type)}
                          <span>{t(type.toLowerCase())}</span>
                        </Badge>
                      ))}
                    </div>
                    
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 mr-1 text-amber-500" />
                      {vendor.lastReviewDate
                        ? `${t('last_review_date')}: ${daysSinceLastReview} ${t('days_ago')}`
                        : t('never_reviewed')}
                      
                      {daysSinceLastReview && daysSinceLastReview > 120 && (
                        <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0 h-4">
                          {t('overdue')}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Performance Metrics */}
                    <div className="grid grid-cols-3 gap-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">{t('reliability')}</span>
                                <span className="font-medium">
                                  {vendor.reliabilityScore !== null ? `${vendor.reliabilityScore}%` : "-"}
                                </span>
                              </div>
                              <Progress 
                                value={vendor.reliabilityScore || 0} 
                                className="h-1.5" 
                                indicatorClassName={`${vendor.reliabilityScore && vendor.reliabilityScore >= 80 ? "bg-green-500" : 
                                  vendor.reliabilityScore && vendor.reliabilityScore >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="text-xs">{t('reliability_description')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">{t('quality')}</span>
                                <span className="font-medium">
                                  {vendor.qualityScore !== null ? `${vendor.qualityScore}%` : "-"}
                                </span>
                              </div>
                              <Progress 
                                value={vendor.qualityScore || 0} 
                                className="h-1.5" 
                                indicatorClassName={`${vendor.qualityScore && vendor.qualityScore >= 80 ? "bg-green-500" : 
                                  vendor.qualityScore && vendor.qualityScore >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="text-xs">{t('quality_description')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">{t('response')}</span>
                                <span className="font-medium">
                                  {vendor.responseTimeScore !== null ? `${vendor.responseTimeScore}%` : "-"}
                                </span>
                              </div>
                              <Progress 
                                value={vendor.responseTimeScore || 0} 
                                className="h-1.5" 
                                indicatorClassName={`${vendor.responseTimeScore && vendor.responseTimeScore >= 80 ? "bg-green-500" : 
                                  vendor.responseTimeScore && vendor.responseTimeScore >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="text-xs">{t('response_time_description')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    
                    <div className="flex justify-end mt-2">
                      <Button
                        size="sm"
                        onClick={() => handleOpenEvaluationDialog(vendor)}
                        className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Star className="h-3.5 w-3.5" />
                        <span>{t('review')}</span>
                      </Button>
                    </div>
                    
                    {/* Priority indicator */}
                    {(!vendor.lastReviewDate || (daysSinceLastReview && daysSinceLastReview > 120)) && (
                      <div className="absolute top-0 right-0 w-0 h-0 border-t-[24px] border-t-red-500 border-l-[24px] border-l-transparent transform translate-x-3 -translate-y-1 rotate-45"></div>
                    )}
                  </div>
                );
              })}
              
              {/* Summary Stats */}
              <div className="mt-6 pt-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                  <div className="text-xs text-purple-700 dark:text-purple-300 font-medium mb-1">{t('total_vendors')}</div>
                  <div className="text-2xl font-bold text-purple-800 dark:text-purple-200">{vendors.length}</div>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                  <div className="text-xs text-amber-700 dark:text-amber-300 font-medium mb-1">{t('need_review')}</div>
                  <div className="text-2xl font-bold text-amber-800 dark:text-amber-200">{vendorsNeedingReview.length}</div>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <div className="text-xs text-green-700 dark:text-green-300 font-medium mb-1">{t('excellent')}</div>
                  <div className="text-2xl font-bold text-green-800 dark:text-green-200">
                    {vendors.filter(v => {
                      const score = calculateOverallScore(v);
                      return score !== null && score >= 80;
                    }).length}
                  </div>
                </div>
                
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                  <div className="text-xs text-red-700 dark:text-red-300 font-medium mb-1">{t('needs_improvement')}</div>
                  <div className="text-2xl font-bold text-red-800 dark:text-red-200">
                    {vendors.filter(v => {
                      const score = calculateOverallScore(v);
                      return score !== null && score < 60;
                    }).length}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </CardContent>
        
        <CardFooter className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border-t border-purple-100 dark:border-purple-800/50 p-4">
          <Link href="/settings/vendor-performance" className="w-full">
            <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white group">
              <span>{t('view_all_vendor_performance')}</span>
              <ArrowUpRight className="ml-2 h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </Button>
          </Link>
        </CardFooter>
      </Card>

      {selectedVendor && (
        <VendorPerformanceEvaluationDialog
          isOpen={isEvaluationDialogOpen}
          onClose={handleCloseEvaluationDialog}
          vendor={selectedVendor}
          onPerformanceSubmitted={handlePerformanceSubmitted}
        />
      )}
    </>
  );
}