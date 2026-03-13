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
import { Star, ArrowUpRight, Gauge, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/contexts/TranslationContext";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

// Get vendor type icon
const getVendorTypeIcon = (type: string) => {
  switch (type) {
    case "ASSET":
      return <div className="h-2 w-2 bg-blue-500 rounded-full"></div>;
    case "VEHICLE":
      return <div className="h-2 w-2 bg-amber-500 rounded-full"></div>;
    case "FOOD":
      return <div className="h-2 w-2 bg-emerald-500 rounded-full"></div>;
    case "FACILITY":
      return <div className="h-2 w-2 bg-purple-500 rounded-full"></div>;
    default:
      return <div className="h-2 w-2 bg-gray-500 rounded-full"></div>;
  }
};

export function EnhancedVendorPerformanceCard() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Sort vendors by overall score (highest first)
  const sortedVendors = [...vendors].sort((a, b) => {
    const scoreA = calculateOverallScore(a) || 0;
    const scoreB = calculateOverallScore(b) || 0;
    return scoreB - scoreA;
  });

  if (isLoading) {
    return (
      <Card className="border shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-purple-50 dark:from-gray-900 dark:to-purple-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Star className="h-5 w-5 text-purple-500" />
            </div>
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

  if (vendors.length === 0) {
    return (
      <Card className="border shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-purple-50 dark:from-gray-900 dark:to-purple-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Star className="h-5 w-5 text-purple-500" />
            </div>
            <span>{t('vendor_performance')}</span>
          </CardTitle>
          <CardDescription>{t('no_vendors_found')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
            <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertCircle className="h-8 w-8 text-amber-500" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t('no_vendor_data_available')}
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Link href="/settings/vendor-performance" className="w-full">
            <Button variant="outline" className="w-full group">
              <span>{t('manage_vendors')}</span>
              <ArrowUpRight className="ml-2 h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden bg-gradient-to-br from-white to-purple-50 dark:from-gray-900 dark:to-purple-950/20">
      <CardHeader className="pb-2 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30">
            <Star className="h-5 w-5 text-purple-500" />
          </div>
          <span>{t('vendor_performance')}</span>
        </CardTitle>
        <CardDescription>
          {t('overall_vendor_performance_scores')}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-3">
            {sortedVendors.map((vendor) => {
              const overallScore = calculateOverallScore(vendor);
              const performanceStatus = getPerformanceStatus(overallScore, t);
              const statusVariant = getStatusVariant(overallScore);
              
              return (
                <div 
                  key={vendor.id} 
                  className="group relative flex items-center justify-between p-3 rounded-lg border border-purple-100 dark:border-purple-800/50 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 flex items-center justify-center bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 rounded-full shadow-sm group-hover:shadow-md transition-shadow">
                      <Gauge className="h-6 w-6 text-purple-500 group-hover:scale-110 transition-transform duration-300" />
                      {overallScore !== null && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-sm border border-purple-200 dark:border-purple-800">
                          <div className="text-[10px] font-bold text-purple-700 dark:text-purple-300">
                            {vendor.type.length > 0 && getVendorTypeIcon(vendor.type[0])}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-base group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                        {vendor.name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {vendor.type.map((type, index) => (
                          <span key={type} className="flex items-center">
                            {index > 0 && <span className="mx-1">•</span>}
                            <span>{t(type.toLowerCase())}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`
                          flex items-center justify-center w-16 h-16 rounded-full 
                          ${overallScore === null ? 'bg-gray-100 dark:bg-gray-800' : 
                            overallScore >= 80 ? 'bg-green-100 dark:bg-green-900/30' : 
                            overallScore >= 60 ? 'bg-amber-100 dark:bg-amber-900/30' : 
                            'bg-red-100 dark:bg-red-900/30'}
                          group-hover:scale-110 transition-transform duration-300 shadow-sm group-hover:shadow-md
                        `}>
                          <div className="text-center">
                            <div className={`
                              text-xl font-bold 
                              ${overallScore === null ? 'text-gray-500 dark:text-gray-400' : 
                                overallScore >= 80 ? 'text-green-600 dark:text-green-400' : 
                                overallScore >= 60 ? 'text-amber-600 dark:text-amber-400' : 
                                'text-red-600 dark:text-red-400'}
                            `}>
                              {overallScore !== null ? `${overallScore}%` : '-'}
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {performanceStatus}
                            </div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p className="text-xs">{t('overall_performance_score')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              );
            })}
            
            {/* Performance Summary */}
            <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-3">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <div className="flex justify-center mb-2">
                  <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-800/50">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="text-xs text-green-700 dark:text-green-300 font-medium mb-1">{t('excellent')}</div>
                <div className="text-xl font-bold text-green-800 dark:text-green-200">
                  {vendors.filter(v => {
                    const score = calculateOverallScore(v);
                    return score !== null && score >= 80;
                  }).length}
                </div>
              </div>
              
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                <div className="flex justify-center mb-2">
                  <div className="p-1.5 rounded-full bg-amber-100 dark:bg-amber-800/50">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-300 font-medium mb-1">{t('good')}</div>
                <div className="text-xl font-bold text-amber-800 dark:text-amber-200">
                  {vendors.filter(v => {
                    const score = calculateOverallScore(v);
                    return score !== null && score >= 60 && score < 80;
                  }).length}
                </div>
              </div>
              
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                <div className="flex justify-center mb-2">
                  <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-800/50">
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <div className="text-xs text-red-700 dark:text-red-300 font-medium mb-1">{t('needs_improvement')}</div>
                <div className="text-xl font-bold text-red-800 dark:text-red-200">
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
  );
}