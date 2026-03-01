// @ts-nocheck
import React from 'react';
import { DashboardLayout } from "@/components/DashboardLayout";
import { EditAssetDialog } from "@/components/EditAssetDialog";
import BarcodeScanner from "@/components/BarcodeScanner2";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslation } from "@/contexts/TranslationContext";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  BarChart3, 
  Box, 
  ClipboardList,
  Computer,
  Edit,
  Filter,
  History,
  Info,
  LayoutDashboard,
  MapPin,
  Package,
  PlusCircle, 
  Printer, 
  QrCode,
  Search,
  Settings,
  Sofa,
  Tag,
  Trash2, 
  Truck,
  User
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useGeolocation } from "@/hooks/useGeolocation";
import { exportToExcel } from "@/util/excel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AssetDetailsDialog } from "@/components/AssetDetailsDialog";
import { AssetMobileCard } from "@/components/AssetMobileCard";
import { AssetDisposalDialog } from "@/components/AssetDisposalDialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PrintAssetReportButton } from "@/components/PrintAssetReportButton";
import AssetDuplicateButton from "@/components/AssetDuplicateButton";

const assetFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  type: z.enum(["FURNITURE", "EQUIPMENT", "ELECTRONICS"]),
  vendorId: z.string().min(1, "Please select a vendor"),
  floorNumber: z.string().min(1, "Floor number is required"),
  roomNumber: z.string().min(1, "Room number is required"),
  barcode: z.string().min(1, "Barcode is required"),
  imageUrl: z.string().optional(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  purchaseAmount: z.string().optional(),
  purchaseDate: z.string().optional(),
});

type Vendor = {
  id: string;
  name: string;
};

type Asset = {
  id: string;
  assetId: string;
  name: string;
  description?: string;
  barcode: string;
  type: string;
  imageUrl?: string;
  floorNumber?: string;
  roomNumber?: string;
  status: 'ACTIVE' | 'IN_TRANSIT' | 'DISPOSED';
  vendor?: { name: string };
  purchaseAmount?: number;
};

// Custom loading skeleton component
const TableSkeleton = () => (
  <div className="space-y-3">
    <div className="h-10 bg-muted animate-pulse rounded-md" />
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
    ))}
  </div>
);

export default function AssetsPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { toast } = useToast();
  const { latitude, longitude } = useGeolocation();

  const form = useForm<z.infer<typeof assetFormSchema>>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "FURNITURE",
      vendorId: "",
      floorNumber: "",
      roomNumber: "",
      barcode: "",
      imageUrl: "",
      latitude: null,
      longitude: null,
    },
  });

  const loadVendors = async () => {
    try {
      const response = await fetch("/api/vendors");
      if (!response.ok) throw new Error(`Failed to load vendors: ${response.status}`);
      const data = await response.json();
      setVendors(data);
    } catch (error) {
      console.error("Error loading vendors:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load vendors",
        variant: "destructive",
      });
    }
  };

  const loadAssets = async () => {
    try {
      const response = await fetch("/api/assets");
      if (!response.ok) throw new Error(`Failed to load assets: ${response.status}`);
      const data = await response.json();
      setAssets(data);
    } catch (error) {
      console.error("Error loading assets:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load assets",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // Load vendors and assets in parallel
    Promise.all([loadVendors(), loadAssets()]);

    // Add event listener for dispose asset button
    const handleDisposeAsset = (event: Event) => {
      const asset = (event as CustomEvent).detail;
      if (asset) {
        setSelectedAsset(asset);
        setShowDisposalDialog(true);
      }
    };

    window.addEventListener('dispose-asset', handleDisposeAsset);

    // Clean up event listener
    return () => {
      window.removeEventListener('dispose-asset', handleDisposeAsset);
    };
  }, []);

  const fetchHistory = async (assetId: string) => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/assets/${assetId}/history`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('History API error response:', errorData);
        throw new Error(`Failed to fetch history: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch asset history",
        variant: "destructive",
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch history when asset is selected and history tab is active
  useEffect(() => {
    if (selectedAsset) {
      fetchHistory(selectedAsset.id);
    }
  }, [selectedAsset]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isDisposing, setIsDisposing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const moveFormSchema = z.object({
    floorNumber: z.string().min(1, "Floor number is required"),
    roomNumber: z.string().min(1, "Room number is required"),
  });

  const moveForm = useForm<z.infer<typeof moveFormSchema>>({
    resolver: zodResolver(moveFormSchema),
    defaultValues: {
      floorNumber: "",
      roomNumber: "",
    },
  });

  const onMoveAsset = async (values: z.infer<typeof moveFormSchema>) => {
    if (!selectedAsset) return;

    try {
      setIsMoving(true);
      const response = await fetch(`/api/assets/${selectedAsset.id}/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Move asset API error response:', errorData);
        throw new Error(`Failed to move asset: ${response.status} ${response.statusText}`);
      }

      const updatedAsset = await response.json();
      setSelectedAsset(updatedAsset.asset);
      loadAssets();
      fetchHistory(selectedAsset.id);
      toast({
        title: "Success",
        description: "Asset has been moved successfully.",
      });
      moveForm.reset();
    } catch (error) {
      console.error("Error moving asset:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to move asset",
        variant: "destructive",
      });
    } finally {
      setIsMoving(false);
    }
  };

  const [showDisposalDialog, setShowDisposalDialog] = useState(false);

  const handleAssetDisposed = () => {
    loadAssets();
    if (selectedAsset) {
      fetchHistory(selectedAsset.id);
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewImage(null);
    }
  };

  const onSubmit = async (values: z.infer<typeof assetFormSchema>) => {
    try {
      setIsSubmitting(true);
      
      // Handle image upload first
      let imageUrl = "";
      const imageInput = document.querySelector<HTMLInputElement>('#image-upload');
      if (imageInput?.files?.[0]) {
        const formData = new FormData();
        formData.append('image', imageInput.files[0]);
        
        try {
          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('Image upload error response:', errorText);
            throw new Error(errorText || 'Failed to upload image');
          }
          const { url } = await uploadResponse.json();
          imageUrl = url;
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          toast({
            title: "Warning",
            description: uploadError instanceof Error 
              ? uploadError.message 
              : "Failed to upload image, but continuing with asset creation",
            variant: "default",
          });
        }
      }

      // Prepare the asset data
      const assetData = {
        ...values,
        imageUrl: imageUrl || null,
        latitude: latitude || null,
        longitude: longitude || null,
      };

      // Create the asset
      const response = await fetch("/api/assets/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(assetData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Create asset API error response:', errorData);
        throw new Error(
          errorData?.message || 
          errorData?.error || 
          `Failed to create asset: ${response.status} ${response.statusText}`
        );
      }

      const newAsset = await response.json();
      
      // Reset form and update UI
      setSelectedAsset(newAsset);
      setShowBarcodeDialog(true);
      setIsOpen(false);
      form.reset();
      setPreviewImage(null);
      loadAssets();

      toast({
        title: "Success",
        description: "Asset has been created successfully.",
      });
    } catch (error) {
      console.error('Asset creation error:', error);
      toast({
        title: "Error",
        description: error instanceof Error 
          ? error.message 
          : "Failed to create asset. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReport = async (assetToPrint?: Asset) => {
    const targetAsset = assetToPrint || selectedAsset;
    if (!targetAsset) return;
    
    try {
      // Show loading toast
      toast({
        title: "Generating report",
        description: "Please wait while we prepare your report...",
      });
      
      // Fetch history data
      const response = await fetch(`/api/assets/${targetAsset.id}/history`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('History API error response:', errorData);
        throw new Error(`Failed to fetch history: ${response.status} ${response.statusText}`);
      }
      
      const historyData = await response.json();
      
      // Fetch tickets data
      const ticketsResponse = await fetch(`/api/assets/${targetAsset.id}/tickets`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!ticketsResponse.ok) {
        console.warn('Failed to fetch tickets, continuing without tickets data');
      }
      
      const ticketsData = ticketsResponse.ok ? await ticketsResponse.json() : [];
      
      // Prepare asset data with tickets
      const assetWithTickets = {
        ...targetAsset,
        tickets: ticketsData
      };
      
      // Open new window for printing
      const printWindow = window.open('', '_blank', 'width=1000,height=800');
      if (!printWindow) {
        throw new Error('Unable to open print window. Please check your popup blocker settings.');
      }

      // Write the document HTML with proper styling
      printWindow.document.write(`
        <html>
          <head>
            <title>Asset Report - ${selectedAsset.name}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
            <style>
              @media print {
                body { padding: 20px; }
                @page { size: A4; margin: 20mm; }
                .print-content, .print-content * {
                  visibility: visible !important;
                }
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              }
            </style>
          </head>
          <body>
            <div id="report-content"></div>
          </body>
        </html>
      `);

      // Import the AssetReportDetailed component and render it
      const { AssetReportDetailed } = await import('@/components/AssetReportDetailed');
      const { createRoot } = await import('react-dom/client');
      
      const root = printWindow.document.getElementById('report-content');
      if (root) {
        const reactRoot = createRoot(root);
        
        // Use the detailed report component with the asset and history data
        reactRoot.render(
          <AssetReportDetailed 
            assets={[assetWithTickets]} 
            isFullReport={false} 
          />
        );
        
        // Wait for rendering to complete before printing
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          
          // Success toast
          toast({
            title: "Report generated",
            description: "Your asset report has been generated successfully.",
          });
        }, 1000);
      }
      
      printWindow.document.close();
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate asset report",
        variant: "destructive",
      });
    }
  };

  const handlePrintBarcode = () => {
    if (!selectedAsset) return;
    
    const printWindow = window.open('', '', 'width=400,height=400');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcode</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
            .barcode-container { margin: 20px 0; }
            .asset-info { margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="asset-info">
            <h2>${selectedAsset.name}</h2>
            <p>Asset ID: ${selectedAsset.assetId}</p>
          </div>
          <div class="barcode-container">
            <img src="https://bwipjs-api.metafloor.com/?bcid=code128&text=${selectedAsset.barcode}&scale=3&includetext&textxalign=center" />
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getAssetsByType = () => {
    const counts = {
      FURNITURE: 0,
      EQUIPMENT: 0,
      ELECTRONICS: 0,
    };
    assets.forEach(asset => {
      counts[asset.type]++;
    });
    return counts;
  };

  const assetCounts = getAssetsByType();

  const { t } = useTranslation();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('assets_management')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('track_and_manage_enterprise_assets')}</p>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <BarcodeScanner
              onScan={(result) => {
                // If result is an asset, open details dialog
                if ('id' in result && result.id) {
                  setSelectedAsset(result as Asset);
                  setShowBarcodeDialog(true);
                }
                // If result is a barcode (not found), open registration dialog and pre-fill barcode
                else if ('barcode' in result && result.barcode) {
                  setIsOpen(true);
                  // Set barcode in form
                  form.setValue('barcode', result.barcode);
                }
              }}
            />
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="whitespace-nowrap h-10 flex-1 sm:flex-auto" size="default">
                  <PlusCircle className="mr-2 h-5 w-5" />
                  <span className="hidden sm:inline">{t('register_new_asset')}</span>
                  <span className="sm:hidden">{t('new_asset')}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('register_new_asset')}</DialogTitle>
                  <DialogDescription>
                    {t('enter_asset_details_below')}
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('name')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('asset_name_placeholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('type')}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('select_asset_type')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="FURNITURE">{t('furniture')}</SelectItem>
                              <SelectItem value="EQUIPMENT">{t('equipment')}</SelectItem>
                              <SelectItem value="ELECTRONICS">{t('electronics')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="vendorId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('vendor')}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('select_vendor')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {vendors.map((vendor) => (
                                <SelectItem key={vendor.id} value={vendor.id}>
                                  {vendor.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="floorNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('floor_number')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('floor_number_placeholder')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="roomNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('room_number')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('room_number_placeholder')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="barcode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('barcode') || "Barcode"}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('asset_barcode_placeholder') || "Enter or scan barcode"} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('description')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('asset_description_placeholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="purchaseAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('purchase_amount')} (QAR)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              min="0" 
                              placeholder={t('enter_purchase_amount')} 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            {t('enter_purchase_amount_in_qar')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="purchaseDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('purchase_date')}</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              placeholder={t('select_purchase_date')} 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            {t('enter_date_when_asset_purchased')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormItem>
                      <FormLabel>{t('location_tracking')}</FormLabel>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                        <div className="flex-1">
                          {latitude && longitude ? (
                            <div className="flex items-center gap-2 text-sm">
                              <div className="h-2 w-2 rounded-full bg-green-500" />
                              <span className="text-green-600 font-medium">{t('location_detected')}</span>
                              <span className="text-muted-foreground">
                                ({latitude.toFixed(6)}, {longitude.toFixed(6)})
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm">
                              <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                              <span className="text-yellow-600 font-medium">{t('detecting_location')}</span>
                            </div>
                          )}
                        </div>
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <FormDescription>
                        {t('location_tracking_required')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>

                    <FormItem>
                      <FormLabel>{t('image')}</FormLabel>
                      <FormControl>
                        <Input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('upload_asset_image')}
                      </FormDescription>
                      {previewImage && (
                        <div className="mt-2 relative h-[200px] w-full">
                          <Image
                            src={previewImage}
                            alt="Preview"
                            fill
                            className="object-contain rounded-md border"
                            sizes="(max-width: 768px) 100vw, 50vw"
                            unoptimized
                          />
                        </div>
                      )}
                    </FormItem>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {t('registering')}
                        </>
                      ) : (
                        t('register_asset')
                      )}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Dashboard Overview */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-blue-950/50 dark:via-background dark:to-blue-950/50 transition-all duration-300 hover:shadow-md">
            <div className="absolute inset-0 bg-grid-black/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('total_assets')}</CardTitle>
              <div className="rounded-full p-2.5 bg-blue-100 dark:bg-blue-900/50">
                <Box className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight">{assets.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('registered_assets_in_system')}
              </p>
            </CardContent>
          </Card>
          
          <Card className="relative overflow-hidden bg-gradient-to-br from-green-50 via-white to-green-50 dark:from-green-950/50 dark:via-background dark:to-green-950/50 transition-all duration-300 hover:shadow-md">
            <div className="absolute inset-0 bg-grid-black/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('total_asset_value')}</CardTitle>
              <div className="rounded-full p-2.5 bg-green-100 dark:bg-green-900/50">
                <Tag className="h-5 w-5 text-green-700 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
                QAR {assets.reduce((sum, asset) => sum + (asset.purchaseAmount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('total_value_of_active_assets')}
              </p>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden bg-gradient-to-br from-green-50 via-white to-green-50 dark:from-green-950/50 dark:via-background dark:to-green-950/50 transition-all duration-300 hover:shadow-md">
            <div className="absolute inset-0 bg-grid-black/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('active_vendors')}</CardTitle>
              <div className="rounded-full p-2.5 bg-green-100 dark:bg-green-900/50">
                <Truck className="h-5 w-5 text-green-700 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight">{vendors.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('connected_suppliers_and_vendors')}
              </p>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-purple-50 dark:from-purple-950/50 dark:via-background dark:to-purple-950/50 transition-all duration-300 hover:shadow-md">
            <div className="absolute inset-0 bg-grid-black/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('asset_types')}</CardTitle>
              <div className="rounded-full p-2.5 bg-purple-100 dark:bg-purple-900/50">
                <BarChart3 className="h-5 w-5 text-purple-700 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="rounded-full p-1.5 bg-blue-100 dark:bg-blue-900/50">
                    <Sofa className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 mx-3">
                    <div className="w-full h-2 bg-blue-100 dark:bg-blue-900/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all"
                        style={{ width: assets.length ? `${(assetCounts.FURNITURE / assets.length) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium">{assetCounts.FURNITURE}</span>
                </div>
                <div className="flex items-center">
                  <div className="rounded-full p-1.5 bg-green-100 dark:bg-green-900/50">
                    <Package className="h-4 w-4 text-green-700 dark:text-green-400" />
                  </div>
                  <div className="flex-1 mx-3">
                    <div className="w-full h-2 bg-green-100 dark:bg-green-900/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all"
                        style={{ width: assets.length ? `${(assetCounts.EQUIPMENT / assets.length) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium">{assetCounts.EQUIPMENT}</span>
                </div>
                <div className="flex items-center">
                  <div className="rounded-full p-1.5 bg-purple-100 dark:bg-purple-900/50">
                    <Computer className="h-4 w-4 text-purple-700 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 mx-3">
                    <div className="w-full h-2 bg-purple-100 dark:bg-purple-900/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 dark:bg-purple-400 rounded-full transition-all"
                        style={{ width: assets.length ? `${(assetCounts.ELECTRONICS / assets.length) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium">{assetCounts.ELECTRONICS}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>{t('assets_list')}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t('manage_and_track_all_registered_assets')}
              </p>
            </div>
            <div className="grid grid-cols-3 sm:flex sm:flex-row gap-2 sm:gap-3">
              {/* Mobile-friendly action buttons with improved touch targets */}
              <Button 
                variant="outline" 
                size="default" 
                className="h-10 w-full justify-center"
                onClick={() => {
                  const exportData = assets.map(asset => ({
                    'Asset ID': asset.assetId,
                    'Name': asset.name,
                    'Type': asset.type,
                    'Description': asset.description || '',
                    'Floor': asset.floorNumber,
                    'Room': asset.roomNumber,
                    'Status': asset.status,
                    'Vendor': asset.vendor?.name || '',
                  }));
                  exportToExcel(exportData, `assets-${new Date().toISOString().split('T')[0]}`);
                }}
              >
                <Package className="h-5 w-5 sm:mr-2" />
                <span className="hidden sm:inline whitespace-nowrap">{t('export')}</span>
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="default" 
                    className="h-10 w-full justify-center"
                  >
                    <QrCode className="h-5 w-5 sm:mr-2" />
                    <span className="hidden sm:inline whitespace-nowrap">{t('scan')}</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('scan_asset_barcode')}</DialogTitle>
                    <DialogDescription>
                      {t('use_camera_to_scan')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4">
                    <BarcodeScanner />
                  </div>
                </DialogContent>
              </Dialog>
              <Button 
                variant="outline" 
                size="default" 
                className="h-10 w-full justify-center"
                onClick={() => {
                  // Create a new window for the full report
                  const printWindow = window.open('', '', 'width=1000,height=800');
                  if (!printWindow) return;

                  // Write the document HTML
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Assets Report</title>
                        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
                        <style>
                          @media print {
                            body { padding: 20px; }
                            @page { size: A4 landscape; margin: 20mm; }
                            table { page-break-inside: auto; }
                            tr { page-break-inside: avoid; page-break-after: auto; }
                          }
                        </style>
                      </head>
                      <body class="p-8">
                        <div class="max-w-[1200px] mx-auto">
                          <div class="text-center mb-8">
                            <h1 class="text-3xl font-bold mb-2">Assets Report</h1>
                            <p class="text-gray-600">Generated on ${new Date().toLocaleDateString()}</p>
                          </div>
                          <table class="min-w-full bg-white border border-gray-300">
                            <thead>
                              <tr class="bg-gray-100">
                                <th class="py-2 px-4 border text-left">Asset ID</th>
                                <th class="py-2 px-4 border text-left">Name</th>
                                <th class="py-2 px-4 border text-left">Type</th>
                                <th class="py-2 px-4 border text-left">Description</th>
                                <th class="py-2 px-4 border text-left">Location</th>
                                <th class="py-2 px-4 border text-left">Vendor</th>
                                <th class="py-2 px-4 border text-left">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${assets.map(asset => `
                                <tr class="border-t">
                                  <td class="py-2 px-4 border">${asset.assetId}</td>
                                  <td class="py-2 px-4 border">${asset.name}</td>
                                  <td class="py-2 px-4 border">${asset.type}</td>
                                  <td class="py-2 px-4 border">${asset.description || '-'}</td>
                                  <td class="py-2 px-4 border">Floor ${asset.floorNumber}, Room ${asset.roomNumber}</td>
                                  <td class="py-2 px-4 border">${asset.vendor?.name || '-'}</td>
                                  <td class="py-2 px-4 border">${asset.status}</td>
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                          <div class="text-center text-gray-600 text-sm mt-8">
                            <p>This report was automatically generated by the Asset Management System</p>
                          </div>
                        </div>
                        <script>
                          window.onload = () => {
                            window.print();
                          };
                        </script>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                }}
              >
                <ClipboardList className="h-5 w-5 sm:mr-2" />
                <span className="hidden sm:inline whitespace-nowrap">{t('print_report')}</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Mobile view */}
            <div className="md:hidden grid gap-4">
              {assets.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p className="text-lg font-semibold">{t('no_assets_found') || "No assets found"}</p>
                  <p className="text-sm mt-2">
                    {t('no_assets_found_description') ||
                      "No assets are currently registered for your organization. If you just registered, make sure you are logged in and have the correct permissions."}
                  </p>
                </div>
              ) : (
                assets.map((asset) => (
                  <AssetMobileCard
                    key={asset.id}
                    asset={asset}
                    onViewDetails={(asset) => {
                      setSelectedAsset(asset);
                      setShowBarcodeDialog(true);
                    }}
                    onEdit={(asset) => {
                      setSelectedAsset(asset);
                      setShowEditDialog(true);
                    }}
                    onPrintReport={(asset) => {
                      setSelectedAsset(asset);
                      handlePrintReport(asset);
                    }}
                  />
                ))
              )}
            </div>
            
            {/* Desktop view */}
            <div className="hidden md:block rounded-md border">
              {assets.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <p className="text-lg font-semibold">{t('no_assets_found') || "No assets found"}</p>
                  <p className="text-sm mt-2">
                    {t('no_assets_found_description') ||
                      "No assets are currently registered for your organization. If you just registered, make sure you are logged in and have the correct permissions."}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[100px]">{t('asset_id')}</TableHead>
                      <TableHead>{t('asset_details')}</TableHead>
                      <TableHead>{t('type')}</TableHead>
                      <TableHead>{t('location')}</TableHead>
                      <TableHead>{t('vendor')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((asset) => (
                      <TableRow
                        key={asset.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedAsset(asset);
                          setShowBarcodeDialog(true);
                        }}
                      >
                        <TableCell className="font-medium">{asset.assetId}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 rounded-full overflow-hidden border bg-muted">
                              {asset.imageUrl ? (
                                <Image
                                  src={asset.imageUrl}
                                  alt={asset.name}
                                  fill
                                  className="object-cover"
                                  sizes="40px"
                                  priority
                                  unoptimized
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-muted">
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{asset.name}</div>
                              {asset.description && (
                                <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                                  {asset.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`rounded-full p-2 ${
                              asset.type === "FURNITURE" ? "bg-blue-100 dark:bg-blue-900/50" :
                              asset.type === "EQUIPMENT" ? "bg-green-100 dark:bg-green-900/50" :
                              "bg-purple-100 dark:bg-purple-900/50"
                            }`}>
                              {asset.type === "FURNITURE" && <Sofa className="h-4 w-4 text-blue-700 dark:text-blue-400" />}
                              {asset.type === "EQUIPMENT" && <Package className="h-4 w-4 text-green-700 dark:text-green-400" />}
                              {asset.type === "ELECTRONICS" && <Computer className="h-4 w-4 text-purple-700 dark:text-purple-400" />}
                            </div>
                            <span className={`text-sm font-medium ${
                              asset.type === "FURNITURE" ? "text-blue-700 dark:text-blue-400" :
                              asset.type === "EQUIPMENT" ? "text-green-700 dark:text-green-400" :
                              "text-purple-700 dark:text-purple-400"
                            }`}>{asset.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="rounded-full p-2 bg-muted">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">Floor {asset.floorNumber}</span>
                              <span className="text-xs text-muted-foreground">Room {asset.roomNumber}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="rounded-full p-2 bg-muted">
                              <Truck className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span className="text-sm">{asset.vendor?.name || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={asset.status === 'ACTIVE' ? 'default' : 
                                    asset.status === 'DISPOSED' ? 'destructive' : 
                                    'secondary'}
                            className="flex items-center gap-1"
                          >
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              asset.status === 'ACTIVE' ? 'bg-green-500' :
                              asset.status === 'DISPOSED' ? 'bg-red-500' :
                              'bg-yellow-500'
                            }`} />
                            {asset.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAsset(asset);
                                setShowEditDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <AssetDuplicateButton 
                              asset={asset}
                              onDuplicationComplete={loadAssets}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <PrintAssetReportButton
                              asset={asset}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <Printer className="h-4 w-4 text-muted-foreground" />
                            </PrintAssetReportButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <AssetDetailsDialog 
        asset={selectedAsset} 
        open={showBarcodeDialog} 
        onOpenChange={setShowBarcodeDialog} 
      />

      <EditAssetDialog
        asset={selectedAsset}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onAssetUpdated={() => {
          loadAssets();
          if (selectedAsset) {
            fetchHistory(selectedAsset.id);
          }
        }}
      />

      <AssetDisposalDialog
        asset={selectedAsset}
        open={showDisposalDialog}
        onOpenChange={setShowDisposalDialog}
        onAssetDisposed={handleAssetDisposed}
      />
    </DashboardLayout>
  );
}