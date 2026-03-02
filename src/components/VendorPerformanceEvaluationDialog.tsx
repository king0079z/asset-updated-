import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  AlertTriangle, 
  Loader2, 
  Package, 
  Star, 
  Info, 
  BarChart3, 
  Gauge, 
  ThumbsUp, 
  ThumbsDown,
  CheckCircle,
  Wrench,
  Clock,
  ShieldAlert,
  Timer,
  Activity
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import { useTranslation } from "@/contexts/TranslationContext";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const performanceFormSchema = z.object({
  reliabilityScore: z.number().min(0).max(100).optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  responseTimeScore: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

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

type VendorPerformanceEvaluationDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  vendor: Vendor;
  onPerformanceSubmitted: () => void;
};

export function VendorPerformanceEvaluationDialog({
  isOpen,
  onClose,
  vendor,
  onPerformanceSubmitted,
}: VendorPerformanceEvaluationDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetHealthScore, setAssetHealthScore] = useState<number | null>(null);
  const [assetCount, setAssetCount] = useState<number>(0);
  const [assetStatusCounts, setAssetStatusCounts] = useState<Record<string, number>>({});
  const [isLoadingAssets, setIsLoadingAssets] = useState<boolean>(false);
  const { t } = useTranslation();
  
  // Fetch asset health data if vendor is an ASSET vendor
  useEffect(() => {
    const fetchAssetHealth = async () => {
      if (!vendor || !vendor.type.includes("ASSET")) return;
      
      setIsLoadingAssets(true);
      try {
        const response = await fetch(`/api/vendors/${vendor.id}/assets`);
        if (response.ok) {
          const data = await response.json();
          if (data.evaluation) {
            setAssetHealthScore(data.evaluation.overallHealthScore);
            setAssetCount(data.evaluation.totalAssets);
            setAssetStatusCounts(data.evaluation.assetStatusCounts);
          }
        }
      } catch (error) {
        console.error("Error fetching asset health:", error);
      } finally {
        setIsLoadingAssets(false);
      }
    };
    
    if (isOpen) {
      fetchAssetHealth();
    }
  }, [vendor, isOpen]);

  const form = useForm<z.infer<typeof performanceFormSchema>>({
    resolver: zodResolver(performanceFormSchema),
    defaultValues: {
      reliabilityScore: vendor?.reliabilityScore || undefined,
      qualityScore: vendor?.qualityScore || undefined,
      responseTimeScore: vendor?.responseTimeScore || undefined,
      notes: vendor?.notes || "",
    },
  });

  useEffect(() => {
    if (vendor) {
      form.reset({
        reliabilityScore: vendor.reliabilityScore || undefined,
        qualityScore: vendor.qualityScore || undefined,
        responseTimeScore: vendor.responseTimeScore || undefined,
        notes: vendor.notes || "",
      });
    }
    setError(null);
  }, [vendor, form, isOpen]);

  const onSubmit = async (values: z.infer<typeof performanceFormSchema>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Add the current date as the review date
      const dataToSubmit = {
        ...values,
        lastReviewDate: new Date(),
      };

      const response = await fetch(`/api/vendors/${vendor.id}/performance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSubmit),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit performance evaluation");
      }

      toast({
        title: "Success",
        description: "Vendor performance evaluation has been submitted successfully.",
      });

      onPerformanceSubmitted();
      onClose();
    } catch (error) {
      console.error("Error submitting performance evaluation:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
      toast({
        title: "Error",
        description: "Failed to submit performance evaluation",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to render star rating input
  const renderStarRating = (value: number | undefined, onChange: (value: number) => void) => {
    const stars = [];
    const rating = value || 0;
    const normalizedRating = Math.round(rating / 20); // Convert 0-100 scale to 0-5 stars

    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`h-6 w-6 cursor-pointer ${
            i <= normalizedRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
          }`}
          onClick={() => onChange(i * 20)} // Convert back to 0-100 scale
        />
      );
    }

    return <div className="flex space-x-1">{stars}</div>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('evaluate_vendor_performance')}</DialogTitle>
          <DialogDescription>
            {t('rate_performance_of')} <span className="font-medium">{vendor?.name}</span>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="manual">{t('manual_evaluation')}</TabsTrigger>
            {vendor.type.includes("ASSET") && (
              <TabsTrigger value="assets">{t('asset_health')}</TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="manual">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Performance Metrics</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Rate this vendor's performance on a scale of 0-100 in the following areas.
                    </p>
                  </div>
              
              <FormField
                control={form.control}
                name="reliabilityScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reliability Score (0-100)</FormLabel>
                    <div className="flex items-center gap-4">
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          max="100" 
                          placeholder="Enter reliability score" 
                          {...field} 
                          onChange={(e) => {
                            const value = e.target.value === "" ? undefined : Number(e.target.value);
                            field.onChange(value);
                          }}
                          className="w-24"
                        />
                      </FormControl>
                      {renderStarRating(field.value, field.onChange)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Measures how consistently the vendor delivers on time and as promised.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="qualityScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quality Score (0-100)</FormLabel>
                    <div className="flex items-center gap-4">
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          max="100" 
                          placeholder="Enter quality score" 
                          {...field} 
                          onChange={(e) => {
                            const value = e.target.value === "" ? undefined : Number(e.target.value);
                            field.onChange(value);
                          }}
                          className="w-24"
                        />
                      </FormControl>
                      {renderStarRating(field.value, field.onChange)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Rates the quality of products or services provided by this vendor.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="responseTimeScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Response Time Score (0-100)</FormLabel>
                    <div className="flex items-center gap-4">
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          max="100" 
                          placeholder="Enter response time score" 
                          {...field} 
                          onChange={(e) => {
                            const value = e.target.value === "" ? undefined : Number(e.target.value);
                            field.onChange(value);
                          }}
                          className="w-24"
                        />
                      </FormControl>
                      {renderStarRating(field.value, field.onChange)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Measures how quickly the vendor responds to inquiries and issues.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Performance Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any notes about vendor performance"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="flex justify-between pt-4">
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('submitting')}
                    </>
                  ) : (
                    t('submit_evaluation')
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
          </TabsContent>
          
          {vendor.type.includes("ASSET") && (
            <TabsContent value="assets">
              <div className="space-y-4">
                {isLoadingAssets ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : assetCount === 0 ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>No Assets Found</AlertTitle>
                    <AlertDescription>
                      This vendor has no associated assets to evaluate.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div>
                      <h3 className="text-sm font-medium mb-2">Asset Health & Quality Evaluation</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Automatic evaluation based on the health and quality of {assetCount} assets purchased from this vendor.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-card shadow-sm rounded-xl border overflow-hidden hover:shadow-md transition-shadow duration-200">
                        <div className="p-3 border-b bg-muted/20 flex items-center gap-2">
                          <div className="p-1.5 rounded-full bg-primary/10">
                            <Gauge className="h-4 w-4 text-primary" />
                          </div>
                          <h3 className="text-sm font-medium">Health Score</h3>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Overall asset health</span>
                            <Badge
                              variant={assetHealthScore === null ? "outline" :
                                      assetHealthScore >= 80 ? "default" :
                                      assetHealthScore >= 60 ? "secondary" : "destructive"}
                              className="px-2.5 py-0.5"
                            >
                              {assetHealthScore !== null ? `${assetHealthScore}%` : "Calculating..."}
                            </Badge>
                          </div>
                          <div className="relative pt-1">
                            <div className="overflow-hidden h-3 text-xs flex rounded-full bg-muted">
                              <div 
                                style={{ width: `${assetHealthScore || 0}%` }} 
                                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${
                                  assetHealthScore === null ? "bg-gray-500" :
                                  assetHealthScore >= 80 ? "bg-green-500" :
                                  assetHealthScore >= 60 ? "bg-yellow-500" : "bg-red-500"
                                }`}>
                              </div>
                            </div>
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="w-full">
                                <div className="flex items-center justify-center gap-1 text-xs p-1 rounded bg-muted/50 hover:bg-muted/80 transition-colors cursor-help">
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">View score breakdown</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs">
                                <p>This score is calculated based on asset status, maintenance history, and age of all assets from this vendor.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                      
                      <div className="bg-card shadow-sm rounded-xl border overflow-hidden hover:shadow-md transition-shadow duration-200">
                        <div className="p-3 border-b bg-muted/20 flex items-center gap-2">
                          <div className="p-1.5 rounded-full bg-primary/10">
                            <Star className="h-4 w-4 text-primary" />
                          </div>
                          <h3 className="text-sm font-medium">Quality Score</h3>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Item quality rating</span>
                            <Badge
                              variant={form.getValues().qualityScore === undefined ? "outline" :
                                      form.getValues().qualityScore >= 80 ? "default" :
                                      form.getValues().qualityScore >= 60 ? "secondary" : "destructive"}
                              className="px-2.5 py-0.5"
                            >
                              {form.getValues().qualityScore !== undefined ? `${form.getValues().qualityScore}%` : "Not rated"}
                            </Badge>
                          </div>
                          <div className="relative pt-1">
                            <div className="overflow-hidden h-3 text-xs flex rounded-full bg-muted">
                              <div 
                                style={{ width: `${form.getValues().qualityScore || 0}%` }} 
                                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${
                                  form.getValues().qualityScore === undefined ? "bg-gray-500" :
                                  form.getValues().qualityScore >= 80 ? "bg-green-500" :
                                  form.getValues().qualityScore >= 60 ? "bg-yellow-500" : "bg-red-500"
                                }`}>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <Info className="h-3 w-3 text-yellow-500" />
                            <p className="text-xs text-muted-foreground">
                              Consider updating this score based on the quality metrics below.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 bg-card shadow-sm rounded-xl border overflow-hidden">
                      <div className="p-3 border-b bg-muted/20">
                        <h3 className="text-sm font-medium flex items-center gap-2">
                          <Activity className="h-4 w-4 text-primary" />
                          Asset Status Distribution
                        </h3>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {Object.entries(assetStatusCounts).map(([status, count]) => {
                            const percentage = Math.round((count / assetCount) * 100);
                            const getStatusColor = (status: string) => {
                              switch(status) {
                                case "ACTIVE":
                                case "LIKE_NEW": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
                                case "IN_TRANSIT": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
                                case "MAINTENANCE": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
                                case "DAMAGED":
                                case "CRITICAL": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
                                case "DISPOSED": return "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400";
                                default: return "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400";
                              }
                            };
                            
                            return (
                              <div key={status} className="flex flex-col p-3 rounded-lg border bg-card">
                                <div className="flex items-center justify-between mb-2">
                                  <div className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(status)}`}>
                                    {status.replace("_", " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {percentage}%
                                  </Badge>
                                </div>
                                <div className="relative pt-1 mb-1">
                                  <div className="overflow-hidden h-1.5 text-xs flex rounded-full bg-muted">
                                    <div 
                                      style={{ width: `${percentage}%` }} 
                                      className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                                        status === "ACTIVE" || status === "LIKE_NEW" ? "bg-green-500" :
                                        status === "IN_TRANSIT" ? "bg-blue-500" :
                                        status === "MAINTENANCE" ? "bg-yellow-500" :
                                        status === "DAMAGED" || status === "CRITICAL" ? "bg-red-500" :
                                        "bg-gray-500"
                                      }`}>
                                    </div>
                                  </div>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {count} asset{count !== 1 ? "s" : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 bg-muted/20 p-5 rounded-lg border">
                      <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="h-5 w-5 text-primary" />
                        <h3 className="text-base font-medium">Item Quality Evaluation</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        These metrics provide a comprehensive assessment of the quality of items supplied by this vendor.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="bg-card rounded-xl shadow-sm overflow-hidden border hover:shadow-md transition-shadow duration-200">
                          <div className="p-3 border-b bg-muted/20">
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="h-4 w-4 text-red-500" />
                              <h3 className="font-medium text-sm">Disposal Rate</h3>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs">
                                    <p>Lower is better. This measures how many items needed to be disposed of prematurely.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                          <div className="p-3 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Disposed items</span>
                              <Badge variant={((assetStatusCounts.DISPOSED || 0) / assetCount * 100) <= 10 ? "default" : 
                                          ((assetStatusCounts.DISPOSED || 0) / assetCount * 100) <= 20 ? "secondary" : "destructive"}>
                                {((assetStatusCounts.DISPOSED || 0) / assetCount * 100).toFixed(1)}%
                              </Badge>
                            </div>
                            <Progress
                              value={(assetStatusCounts.DISPOSED || 0) / assetCount * 100}
                              max={100}
                              className="h-2"
                              indicatorClassName={((assetStatusCounts.DISPOSED || 0) / assetCount * 100) > 20 ? "bg-red-500" : 
                                                ((assetStatusCounts.DISPOSED || 0) / assetCount * 100) > 10 ? "bg-yellow-500" : "bg-green-500"}
                            />
                          </div>
                        </div>
                        
                        <div className="bg-card rounded-xl shadow-sm overflow-hidden border hover:shadow-md transition-shadow duration-200">
                          <div className="p-3 border-b bg-muted/20">
                            <div className="flex items-center gap-2">
                              <Wrench className="h-4 w-4 text-yellow-500" />
                              <h3 className="font-medium text-sm">Maintenance Rate</h3>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs">
                                    <p>Lower is better. This measures how frequently items require maintenance or repair.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                          <div className="p-3 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Items in maintenance</span>
                              <Badge variant={((assetStatusCounts.MAINTENANCE || 0) / assetCount * 100) <= 10 ? "default" : 
                                          ((assetStatusCounts.MAINTENANCE || 0) / assetCount * 100) <= 20 ? "secondary" : "destructive"}>
                                {((assetStatusCounts.MAINTENANCE || 0) / assetCount * 100).toFixed(1)}%
                              </Badge>
                            </div>
                            <Progress
                              value={(assetStatusCounts.MAINTENANCE || 0) / assetCount * 100}
                              max={100}
                              className="h-2"
                              indicatorClassName={((assetStatusCounts.MAINTENANCE || 0) / assetCount * 100) > 15 ? "bg-orange-500" : "bg-green-500"}
                            />
                          </div>
                        </div>
                        
                        <div className="bg-card rounded-xl shadow-sm overflow-hidden border hover:shadow-md transition-shadow duration-200">
                          <div className="p-3 border-b bg-muted/20">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                              <h3 className="font-medium text-sm">Damage Rate</h3>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs">
                                    <p>Lower is better. This tracks how many items have been damaged during normal use.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                          <div className="p-3 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Damaged/critical items</span>
                              <Badge variant={((assetStatusCounts.DAMAGED || 0) + (assetStatusCounts.CRITICAL || 0)) / assetCount * 100 <= 5 ? "default" : 
                                          ((assetStatusCounts.DAMAGED || 0) + (assetStatusCounts.CRITICAL || 0)) / assetCount * 100 <= 10 ? "secondary" : "destructive"}>
                                {(((assetStatusCounts.DAMAGED || 0) + (assetStatusCounts.CRITICAL || 0)) / assetCount * 100).toFixed(1)}%
                              </Badge>
                            </div>
                            <Progress
                              value={((assetStatusCounts.DAMAGED || 0) + (assetStatusCounts.CRITICAL || 0)) / assetCount * 100}
                              max={100}
                              className="h-2"
                              indicatorClassName={((assetStatusCounts.DAMAGED || 0) + (assetStatusCounts.CRITICAL || 0)) / assetCount * 100 > 10 ? "bg-red-500" : "bg-green-500"}
                            />
                          </div>
                        </div>
                        
                        <div className="bg-card rounded-xl shadow-sm overflow-hidden border hover:shadow-md transition-shadow duration-200">
                          <div className="p-3 border-b bg-muted/20">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <h3 className="font-medium text-sm">Like New Rate</h3>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs">
                                    <p>Higher is better. This shows the percentage of items that remain in excellent condition.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                          <div className="p-3 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Items in excellent condition</span>
                              <Badge variant={(assetStatusCounts.LIKE_NEW || 0) / assetCount * 100 >= 50 ? "default" : 
                                          (assetStatusCounts.LIKE_NEW || 0) / assetCount * 100 >= 30 ? "secondary" : "outline"}>
                                {((assetStatusCounts.LIKE_NEW || 0) / assetCount * 100).toFixed(1)}%
                              </Badge>
                            </div>
                            <Progress
                              value={(assetStatusCounts.LIKE_NEW || 0) / assetCount * 100}
                              max={100}
                              className="h-2"
                              indicatorClassName={(assetStatusCounts.LIKE_NEW || 0) / assetCount * 100 > 50 ? "bg-green-500" : 
                                                (assetStatusCounts.LIKE_NEW || 0) / assetCount * 100 > 30 ? "bg-yellow-500" : "bg-gray-500"}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-5 bg-card rounded-xl border shadow-sm overflow-hidden">
                      <div className="p-3 border-b bg-muted/20 flex items-center gap-2">
                        <div className="p-1.5 rounded-full bg-primary/10">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <h3 className="font-medium">Quality Assessment Recommendation</h3>
                      </div>
                      <div className="p-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">Recommended Quality Score:</span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <p>This recommendation is based on asset health metrics, maintenance rates, and overall condition of items from this vendor.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                className="px-3 py-1 text-sm" 
                                variant={((assetStatusCounts.DAMAGED || 0) + (assetStatusCounts.CRITICAL || 0) + (assetStatusCounts.DISPOSED || 0)) / assetCount > 0.3 
                                  ? "destructive" 
                                  : (assetStatusCounts.LIKE_NEW || 0) / assetCount > 0.5 
                                    ? "default" 
                                    : "secondary"}
                              >
                                {((assetStatusCounts.DAMAGED || 0) + (assetStatusCounts.CRITICAL || 0) + (assetStatusCounts.DISPOSED || 0)) / assetCount > 0.3 
                                  ? "Needs Improvement" 
                                  : (assetStatusCounts.LIKE_NEW || 0) / assetCount > 0.5 
                                    ? "Excellent" 
                                    : "Good"}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {((assetStatusCounts.DAMAGED || 0) + (assetStatusCounts.CRITICAL || 0) + (assetStatusCounts.DISPOSED || 0)) / assetCount > 0.3 ? (
                                <ThumbsDown className="h-8 w-8 text-red-500" />
                              ) : (assetStatusCounts.LIKE_NEW || 0) / assetCount > 0.5 ? (
                                <ThumbsUp className="h-8 w-8 text-green-500" />
                              ) : (
                                <Info className="h-8 w-8 text-yellow-500" />
                              )}
                              <div className="text-3xl font-bold">
                                {((assetStatusCounts.DAMAGED || 0) + (assetStatusCounts.CRITICAL || 0) + (assetStatusCounts.DISPOSED || 0)) / assetCount > 0.3 
                                  ? "60-70%" 
                                  : (assetStatusCounts.LIKE_NEW || 0) / assetCount > 0.5 
                                    ? "85-95%" 
                                    : "75-85%"}
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                // Calculate the middle of the range
                                const score = ((assetStatusCounts.DAMAGED || 0) + (assetStatusCounts.CRITICAL || 0) + (assetStatusCounts.DISPOSED || 0)) / assetCount > 0.3 
                                  ? 65
                                  : (assetStatusCounts.LIKE_NEW || 0) / assetCount > 0.5 
                                    ? 90
                                    : 80;
                                form.setValue('qualityScore', score);
                                toast({
                                  title: t('quality_score_updated'),
                                  description: `${t('quality_score_set_to')} ${score}% ${t('based_on_asset_analysis')}`,
                                });
                              }}
                              className="text-xs"
                            >
                              {t('apply_recommendation')}
                            </Button>
                          </div>
                          
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Assessment Rationale</h4>
                            <div className="text-sm text-muted-foreground p-3 border rounded-md bg-card">
                              {((assetStatusCounts.DAMAGED || 0) + (assetStatusCounts.CRITICAL || 0) + (assetStatusCounts.DISPOSED || 0)) / assetCount > 0.3 ? (
                                <div className="flex flex-col gap-2">
                                  <p>
                                    The high rate of damaged, critical, or disposed items suggests potential quality issues that should be addressed with the vendor.
                                  </p>
                                  <div className="flex items-center gap-1 text-xs text-red-500">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>Consider discussing these quality concerns with the vendor.</span>
                                  </div>
                                </div>
                              ) : (assetStatusCounts.LIKE_NEW || 0) / assetCount > 0.5 ? (
                                <div className="flex flex-col gap-2">
                                  <p>
                                    The high rate of like-new items indicates excellent quality and durability of products from this vendor.
                                  </p>
                                  <div className="flex items-center gap-1 text-xs text-green-500">
                                    <CheckCircle className="h-3 w-3" />
                                    <span>This vendor consistently provides high-quality items.</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <p>
                                    The metrics suggest good overall quality with some room for improvement in specific areas.
                                  </p>
                                  <div className="flex items-center gap-1 text-xs text-yellow-500">
                                    <Info className="h-3 w-3" />
                                    <span>Monitor maintenance rates for potential quality improvements.</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end mt-4">
                      <Button variant="outline" onClick={onClose}>
                        {t('close')}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}