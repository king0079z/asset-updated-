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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { VendorAssetSummary } from "./VendorAssetSummary";

const vendorTypes = [
  { id: "ASSET", label: "Asset" },
  { id: "FOOD_SUPPLY", label: "Food Supply" },
  { id: "VEHICLE", label: "Vehicle" },
] as const;

const vendorFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  type: z.array(z.enum(["ASSET", "FOOD_SUPPLY", "VEHICLE"])).min(1, "Select at least one vendor type"),
  reliabilityScore: z.number().min(0).max(100).optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  responseTimeScore: z.number().min(0).max(100).optional(),
  lastReviewDate: z.date().optional().nullable(),
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

type VendorManagementDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  vendor?: Vendor;
  onVendorUpdated: () => void;
};

export function VendorManagementDialog({
  isOpen,
  onClose,
  vendor,
  onVendorUpdated,
}: VendorManagementDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [associatedItems, setAssociatedItems] = useState<{assetsCount: number, foodSuppliesCount: number} | null>(null);
  const [isCheckingAssociations, setIsCheckingAssociations] = useState(false);

  const isEditMode = !!vendor;

  const form = useForm<z.infer<typeof vendorFormSchema>>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      name: vendor?.name || "",
      email: vendor?.email || "",
      phone: vendor?.phone || "",
      address: vendor?.address || "",
      type: vendor?.type || [],
    },
  });

  useEffect(() => {
    if (vendor) {
      form.reset({
        name: vendor.name,
        email: vendor.email || "",
        phone: vendor.phone || "",
        address: vendor.address || "",
        type: vendor.type,
        reliabilityScore: vendor.reliabilityScore || undefined,
        qualityScore: vendor.qualityScore || undefined,
        responseTimeScore: vendor.responseTimeScore || undefined,
        lastReviewDate: vendor.lastReviewDate ? new Date(vendor.lastReviewDate) : null,
        notes: vendor.notes || "",
      });
    } else {
      form.reset({
        name: "",
        email: "",
        phone: "",
        address: "",
        type: [],
        reliabilityScore: undefined,
        qualityScore: undefined,
        responseTimeScore: undefined,
        lastReviewDate: null,
        notes: "",
      });
    }
    setError(null);
    setAssociatedItems(null);
  }, [vendor, form, isOpen]);

  const checkVendorAssociations = async () => {
    if (!vendor) return;
    
    setIsCheckingAssociations(true);
    try {
      // Use a HEAD request to check associations without actually attempting to delete
      const response = await fetch(`/api/vendors/${vendor.id}?check=associations`, {
        method: "HEAD",
      });
      
      // If we get a 409 status, it means there are associations
      if (response.status === 409) {
        // Now make a real request to get the details
        const detailsResponse = await fetch(`/api/vendors/${vendor.id}?check=associations`, {
          method: "GET",
        });
        
        if (detailsResponse.ok) {
          const data = await detailsResponse.json();
          if (data.details) {
            setAssociatedItems(data.details);
          }
        }
      }
    } catch (error) {
      console.error("Error checking vendor associations:", error);
    } finally {
      setIsCheckingAssociations(false);
    }
  };

  useEffect(() => {
    if (isOpen && isEditMode) {
      checkVendorAssociations();
    }
  }, [isOpen, isEditMode]);

  const onSubmit = async (values: z.infer<typeof vendorFormSchema>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Format the data properly for submission
      const dataToSubmit = {
        ...values,
        // Convert string values to numbers for performance metrics if they exist
        reliabilityScore: values.reliabilityScore !== undefined ? Number(values.reliabilityScore) : null,
        qualityScore: values.qualityScore !== undefined ? Number(values.qualityScore) : null,
        responseTimeScore: values.responseTimeScore !== undefined ? Number(values.responseTimeScore) : null,
        // If we're in edit mode and there are performance metrics, update the review date
        lastReviewDate: (values.reliabilityScore !== undefined || 
                         values.qualityScore !== undefined || 
                         values.responseTimeScore !== undefined) ? 
                         new Date() : values.lastReviewDate
      };

      console.log("Submitting vendor data:", dataToSubmit);

      const url = isEditMode ? `/api/vendors/${vendor.id}` : "/api/vendors";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSubmit),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save vendor");
      }

      toast({
        title: "Success",
        description: `Vendor has been ${isEditMode ? "updated" : "created"} successfully.`,
      });

      onVendorUpdated();
      onClose();
    } catch (error) {
      console.error("Error saving vendor:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
      toast({
        title: "Error",
        description: `Failed to ${isEditMode ? "update" : "create"} vendor`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVendor = async () => {
    if (!vendor) return;
    
    // Don't attempt to delete if we already know there are associations
    if (associatedItems && (associatedItems.assetsCount > 0 || associatedItems.foodSuppliesCount > 0)) {
      setError("Cannot delete vendor with associated items. Please reassign or remove all associated assets and food supplies first.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/vendors/${vendor.id}`, {
        method: "DELETE",
      });

      // If the response is not ok, parse the error data
      if (!response.ok) {
        const data = await response.json();
        
        if (response.status === 409 && data.details) {
          // Handle conflict due to associated items
          setAssociatedItems(data.details);
          throw new Error(data.resolution || data.message || "Cannot delete vendor with associated items");
        } else {
          throw new Error(data.message || "Failed to delete vendor");
        }
      }

      toast({
        title: "Success",
        description: "Vendor has been deleted successfully.",
      });

      onVendorUpdated();
      onClose();
    } catch (error) {
      console.error("Error deleting vendor:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
      toast({
        title: "Error",
        description: "Failed to delete vendor",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Vendor" : "Add New Vendor"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update the vendor details below" : "Enter the vendor details below"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {associatedItems && (associatedItems.assetsCount > 0 || associatedItems.foodSuppliesCount > 0) && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Vendor has associated items</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                This vendor is associated with {associatedItems.assetsCount} assets and {associatedItems.foodSuppliesCount} food supplies. 
                You cannot delete this vendor until these associations are removed.
              </p>
              
              {associatedItems.assetExamples && associatedItems.assetExamples.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium text-sm">Associated assets include:</p>
                  <ul className="list-disc pl-5 text-sm">
                    {associatedItems.assetExamples.map((asset: any) => (
                      <li key={asset.id}>{asset.name} (ID: {asset.assetId || asset.id})</li>
                    ))}
                    {associatedItems.assetsCount > associatedItems.assetExamples.length && (
                      <li className="italic">...and {associatedItems.assetsCount - associatedItems.assetExamples.length} more</li>
                    )}
                  </ul>
                </div>
              )}
              
              {associatedItems.foodSupplyExamples && associatedItems.foodSupplyExamples.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium text-sm">Associated food supplies include:</p>
                  <ul className="list-disc pl-5 text-sm">
                    {associatedItems.foodSupplyExamples.map((supply: any) => (
                      <li key={supply.id}>{supply.name}</li>
                    ))}
                    {associatedItems.foodSuppliesCount > associatedItems.foodSupplyExamples.length && (
                      <li className="italic">...and {associatedItems.foodSuppliesCount - associatedItems.foodSupplyExamples.length} more</li>
                    )}
                  </ul>
                </div>
              )}
              
              <p className="text-sm mt-2">
                To delete this vendor, first reassign or remove all associated items from the Assets and Food Supplies sections.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Basic Details</TabsTrigger>
                <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
                {isEditMode && vendor?.type.includes("ASSET") && (
                  <TabsTrigger value="assets">Asset Summary</TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="details" className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name*</FormLabel>
                  <FormControl>
                    <Input placeholder="Vendor name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Email address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="Phone number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={() => (
                <FormItem>
                  <FormLabel>Vendor Type*</FormLabel>
                  <div className="space-y-2">
                    {vendorTypes.map((type) => (
                      <FormField
                        key={type.id}
                        control={form.control}
                        name="type"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={type.id}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(type.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, type.id])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== type.id
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {type.label}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
              </TabsContent>
              
              <TabsContent value="performance" className="space-y-4 pt-4">
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
                          />
                        </FormControl>
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
                          />
                        </FormControl>
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
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground mt-1">
                          Measures how quickly the vendor responds to inquiries and issues.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="lastReviewDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Last Performance Review Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value || undefined}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
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
              </TabsContent>
              
              {isEditMode && vendor?.type.includes("ASSET") && (
                <TabsContent value="assets" className="pt-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-medium">Asset Health Evaluation</h3>
                        <p className="text-sm text-muted-foreground">
                          Automatic evaluation based on the health of assets purchased from this vendor
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-1"
                        onClick={() => {
                          // Force re-render of the VendorAssetSummary component
                          const tempVendorId = vendor.id;
                          setAssociatedItems(null);
                          setTimeout(() => {
                            checkVendorAssociations();
                          }, 100);
                        }}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Refresh
                      </Button>
                    </div>
                    
                    <div className="max-h-[60vh] overflow-y-auto pr-2">
                      {vendor && <VendorAssetSummary vendorId={vendor.id} />}
                    </div>
                    
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground">
                        This evaluation is automatically calculated based on the health status of assets purchased from this vendor.
                        Assets in maintenance, damaged, or critical status will negatively impact the overall score.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              )}
            </Tabs>

            <DialogFooter className="flex justify-between pt-4">
              {isEditMode && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleDeleteVendor}
                  disabled={isSubmitting || isCheckingAssociations || (associatedItems && (associatedItems.assetsCount > 0 || associatedItems.foodSuppliesCount > 0))}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Vendor"
                  )}
                </Button>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEditMode ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    isEditMode ? "Update Vendor" : "Add Vendor"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}