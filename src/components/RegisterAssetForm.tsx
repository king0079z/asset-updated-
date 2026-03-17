import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEnhancedGeolocation } from "@/hooks/useEnhancedGeolocation";
import { useToast } from "@/components/ui/use-toast";
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
import { Button } from "@/components/ui/button";
import { MapPin, Copy } from "lucide-react";
import Image from "next/image";
import AssetDuplicationDialog from "./AssetDuplicationDialog";
import AssetLocationMap from "./AssetLocationMap";

const assetFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  type: z.enum(["FURNITURE", "EQUIPMENT", "ELECTRONICS"]),
  vendorId: z.string().min(1, "Please select a vendor"),
  floorNumber: z.string().min(1, "Floor number is required"),
  roomNumber: z.string().min(1, "Room number is required"),
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

interface RegisterAssetFormProps {
  onSuccess?: (newAsset: any) => void;
  onCancel?: () => void;
}

export function RegisterAssetForm({ onSuccess, onCancel }: RegisterAssetFormProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showDuplicationDialog, setShowDuplicationDialog] = useState(false);
  const [existingAssetsInRoom, setExistingAssetsInRoom] = useState<boolean>(false);
  const [checkingExistingAssets, setCheckingExistingAssets] = useState<boolean>(false);
  const { toast } = useToast();
  const { 
    latitude, 
    longitude, 
    accuracy, 
    locationSource, 
    locationAccuracyDescription,
    isLoading: isLoadingLocation,
    isRefreshing: isRefreshingLocation,
    refreshLocation,
    error: locationError
  } = useEnhancedGeolocation({
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0
  });
  const { t } = useTranslation();

  const form = useForm<z.infer<typeof assetFormSchema>>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "FURNITURE",
      vendorId: "",
      floorNumber: "",
      roomNumber: "",
      imageUrl: "",
      latitude: null,
      longitude: null,
    },
  });

  useEffect(() => {
    const loadVendors = async () => {
      try {
        const response = await fetch("/api/vendors");
        const data = await response.json();
        setVendors(data);
      } catch (error) {
        console.error("Error loading vendors:", error);
        toast({
          title: t("error"),
          description: t("failed_to_load_vendors"),
          variant: "destructive",
        });
      }
    };

    loadVendors();
  }, [t, toast]);
  
  // Check for existing assets of the same type in the same room
  const checkExistingAssets = async () => {
    const type = form.getValues("type");
    const floorNumber = form.getValues("floorNumber");
    const roomNumber = form.getValues("roomNumber");
    
    if (!type || !floorNumber || !roomNumber) {
      setExistingAssetsInRoom(false);
      return;
    }
    
    setCheckingExistingAssets(true);
    try {
      const response = await fetch(`/api/assets?type=${type}&floorNumber=${floorNumber}&roomNumber=${roomNumber}`);
      if (!response.ok) {
        throw new Error("Failed to check existing assets");
      }
      
      const data = await response.json();
      setExistingAssetsInRoom(data.length > 0);
    } catch (error) {
      console.error("Error checking existing assets:", error);
      setExistingAssetsInRoom(false);
    } finally {
      setCheckingExistingAssets(false);
    }
  };
  
  // Watch for changes in type, floorNumber, and roomNumber to check for existing assets
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "type" || name === "floorNumber" || name === "roomNumber") {
        checkExistingAssets();
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form.watch]);

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
            throw new Error(await uploadResponse.text());
          }
          const { url } = await uploadResponse.json();
          imageUrl = url;
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          toast({
            title: t("warning"),
            description: t("failed_to_upload_image_continuing"),
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
        locationAccuracy: accuracy || null,
        locationSource: locationSource || null,
      };

      // Create the asset
      const response = await fetch("/api/assets/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(assetData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message || 
          errorData?.error || 
          t("failed_to_create_asset")
        );
      }

      const newAsset = await response.json();
      
      // Handle document uploads if any
      const documentInput = document.querySelector<HTMLInputElement>('#document-upload');
      if (documentInput?.files?.length) {
        const documentUploadPromises = [];
        
        for (let i = 0; i < documentInput.files.length; i++) {
          const formData = new FormData();
          formData.append('document', documentInput.files[i]);
          formData.append('assetId', newAsset.id);
          
          const uploadPromise = fetch('/api/assets/documents/upload', {
            method: 'POST',
            body: formData,
          }).then(async (response) => {
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`Failed to upload document ${i + 1}:`, errorText);
              return { success: false, index: i + 1, error: errorText };
            }
            return { success: true, index: i + 1 };
          }).catch(error => {
            console.error(`Error uploading document ${i + 1}:`, error);
            return { success: false, index: i + 1, error: error.message };
          });
          
          documentUploadPromises.push(uploadPromise);
        }
        
        // Wait for all document uploads to complete
        const results = await Promise.all(documentUploadPromises);
        
        // Check if any document uploads failed
        const failedUploads = results.filter(result => !result.success);
        if (failedUploads.length > 0) {
          toast({
            title: t("warning"),
            description: `${failedUploads.length} document(s) failed to upload. Asset was created successfully.`,
            variant: "default",
          });
        } else if (results.length > 0) {
          toast({
            title: t("success"),
            description: `${results.length} document(s) uploaded successfully.`,
          });
        }
      }
      
      // Reset form and update UI
      form.reset();
      setPreviewImage(null);

      toast({
        title: t("success"),
        description: t("asset_created_successfully"),
      });

      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess(newAsset);
      }
    } catch (error) {
      console.error('Asset creation error:', error);
      toast({
        title: t("error"),
        description: error instanceof Error 
          ? error.message 
          : t("failed_to_create_asset_try_again"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("name")}</FormLabel>
              <FormControl>
                <Input placeholder={t("asset_name_placeholder")} {...field} />
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
              <FormLabel>{t("type")}</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("select_asset_type")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="FURNITURE">{t("furniture")}</SelectItem>
                  <SelectItem value="EQUIPMENT">{t("equipment")}</SelectItem>
                  <SelectItem value="ELECTRONICS">{t("electronics")}</SelectItem>
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
              <FormLabel>{t("vendor")}</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("select_vendor")} />
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
                <FormLabel>{t("floor_number")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("floor_number_placeholder")} {...field} />
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
                <FormLabel>{t("room_number")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("room_number_placeholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("description")}</FormLabel>
              <FormControl>
                <Input placeholder={t("asset_description_placeholder")} {...field} />
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
              <FormLabel>{t("purchase_amount")} (QAR)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  placeholder={t("enter_purchase_amount")} 
                  {...field} 
                />
              </FormControl>
              <FormDescription>
                {t("enter_purchase_amount_in_qar")}
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
              <FormLabel>{t("purchase_date")}</FormLabel>
              <FormControl>
                <Input 
                  type="date" 
                  placeholder={t("select_purchase_date")} 
                  {...field} 
                />
              </FormControl>
              <FormDescription>
                {t("enter_purchase_date")}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormItem>
          <FormLabel>{t("location_tracking")}</FormLabel>
          <AssetLocationMap
            latitude={latitude}
            longitude={longitude}
            accuracy={accuracy}
            locationSource={locationSource}
            locationAccuracyDescription={locationAccuracyDescription}
            isLoading={isLoadingLocation}
            isRefreshing={isRefreshingLocation}
            onRefresh={refreshLocation}
          />
          <FormDescription>
            {locationError ? (
              <span className="text-red-500 text-xs">{locationError}</span>
            ) : (
              t("location_tracking_description")
            )}
          </FormDescription>
          <FormMessage />
        </FormItem>

        <FormItem>
          <FormLabel>{t("image")}</FormLabel>
          <FormControl>
            <Input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
            />
          </FormControl>
          <FormDescription>
            {t("upload_asset_image")}
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
        
        <FormItem>
          <FormLabel>{t("documents")} (Optional)</FormLabel>
          <FormControl>
            <Input
              id="document-upload"
              type="file"
              accept=".pdf,.doc,.docx,image/*"
              multiple
            />
          </FormControl>
          <FormDescription>
            Upload documents related to this asset (PDF, Word, or images)
          </FormDescription>
        </FormItem>
        
        {existingAssetsInRoom && (
          <div className="flex items-center p-4 border rounded-md bg-blue-50 border-blue-200">
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">
                Assets of this type already exist in this room.
              </p>
              <p className="text-xs text-blue-700 mt-1">
                You can duplicate them to quickly add multiple identical assets.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="ml-4 gap-2"
              onClick={() => setShowDuplicationDialog(true)}
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </Button>
          </div>
        )}
        
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
            >
              {t("cancel")}
            </Button>
          )}
          <Button 
            type="submit" 
            className="flex-1" 
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t("registering")}
              </>
            ) : (
              t("register_asset")
            )}
          </Button>
        </div>
        
        {/* Asset Duplication Dialog */}
        <AssetDuplicationDialog
          isOpen={showDuplicationDialog}
          onClose={() => setShowDuplicationDialog(false)}
          assetType={form.getValues("type")}
          roomNumber={form.getValues("roomNumber")}
          floorNumber={form.getValues("floorNumber")}
          vendorId={form.getValues("vendorId")}
          onDuplicate={async (count) => {
            // Prepare the duplication data
            const values = form.getValues();
            const duplicationData = {
              count,
              name: values.name || `${values.type} Asset`,
              description: values.description || "",
              type: values.type,
              vendorId: values.vendorId,
              floorNumber: values.floorNumber,
              roomNumber: values.roomNumber,
              purchaseAmount: values.purchaseAmount,
              purchaseDate: values.purchaseDate,
            };
            
            // Call the API to duplicate assets
            const response = await fetch("/api/assets/duplicate", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(duplicationData),
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => null);
              throw new Error(
                errorData?.message || 
                errorData?.error || 
                "Failed to duplicate assets"
              );
            }
            
            const duplicatedAssets = await response.json();
            return duplicatedAssets;
          }}
        />
      </form>
    </Form>
  );
}