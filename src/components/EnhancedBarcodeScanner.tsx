import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Loader2, Check, ScanLine } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/TranslationContext";

interface FoodSupply {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expirationDate?: string | null;
  kitchenId: string;
  kitchenName: string;
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  ingredients: any[];
}

const consumptionFormSchema = z.object({
  quantity: z.number().min(0.1, "Quantity must be greater than 0"),
  notes: z.string().optional(),
});

interface EnhancedBarcodeScannerProps {
  kitchenId: string;
  onScanComplete?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function EnhancedBarcodeScanner({ kitchenId, onScanComplete, open: externalOpen, onOpenChange }: EnhancedBarcodeScannerProps) {
  const [internalShowScanner, setInternalShowScanner] = useState(false);
  
  // Use external state if provided, otherwise use internal state
  const showScanner = externalOpen !== undefined ? externalOpen : internalShowScanner;
  const setShowScanner = (value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalShowScanner(value);
    }
  };
  const [manualCode, setManualCode] = useState('');
  const [foundSupply, setFoundSupply] = useState<FoodSupply | null>(null);
  const [foundRecipe, setFoundRecipe] = useState<Recipe | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [servingsCount, setServingsCount] = useState('1');
  const { toast } = useToast();
  const { t } = useTranslation();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { user } = useAuth();
  const scannerContainerId = 'enhanced-barcode-scanner';

  const consumptionForm = useForm<z.infer<typeof consumptionFormSchema>>({
    resolver: zodResolver(consumptionFormSchema),
    defaultValues: {
      quantity: 1,
      notes: '',
    },
  });

  const [cameraPermissionStatus, setCameraPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  useEffect(() => {
    if (showScanner) {
      const initializeScanner = async () => {
        try {
          // First, check if we have camera permissions
          const permissionResult = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setCameraPermissionStatus(permissionResult.state as 'prompt' | 'granted' | 'denied');

          // If permission is denied, don't proceed
          if (permissionResult.state === 'denied') {
            toast({
              title: t('camera_access_required'),
              description: t('please_allow_camera_access'),
              variant: "destructive",
            });
            return;
          }

          // If we need to request permission or already have it
          try {
            // This will trigger the permission prompt if needed
            await navigator.mediaDevices.getUserMedia({ video: true });
            
            if (!scannerRef.current) {
              scannerRef.current = new Html5Qrcode(scannerContainerId);
              
              const devices = await Html5Qrcode.getCameras();
              if (devices && devices.length > 0) {
                // Try to find back camera
                const backCamera = devices.find(device => 
                  device.label.toLowerCase().includes('back') ||
                  device.label.toLowerCase().includes('rear')
                ) || devices[0]; // Fallback to first camera if back camera not found

                await scannerRef.current.start(
                  backCamera.id,
                  {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1,
                  },
                  handleScan,
                  handleError
                );
              } else {
                throw new Error("No cameras found");
              }
            }
          } catch (error) {
            if ((error as Error).name === 'NotAllowedError') {
              setCameraPermissionStatus('denied');
              toast({
                title: t('camera_access_denied'),
                description: t('camera_access_denied_message'),
                variant: "destructive",
              });
            } else {
              throw error;
            }
          }
        } catch (error) {
          console.error("Camera initialization error:", error);
          toast({
            title: t('camera_error'),
            description: t('camera_initialization_error'),
            variant: "destructive",
          });
        }
      };

      initializeScanner();

      return () => {
        if (scannerRef.current) {
          scannerRef.current.stop()
            .then(() => {
              scannerRef.current = null;
            })
            .catch(console.error);
        }
      };
    }
  }, [showScanner, toast, t]);

  const handleScan = async (decodedText: string) => {
    try {
      // Stop scanning after successful scan
      if (scannerRef.current) {
        await scannerRef.current.pause();
      }

      // First try to find a food supply item with this barcode
      let response = await fetch(`/api/food-supply?barcode=${decodedText}&kitchenId=${kitchenId}`);
      let data = await response.json();
      
      // If not found in current kitchen, try without kitchen ID
      if (!data.supply && kitchenId !== 'default') {
        response = await fetch(`/api/food-supply?barcode=${decodedText}`);
        data = await response.json();
      }
      
      if (data.supply) {
        setFoundSupply(data.supply);
        toast({
          title: t('item_found'),
          description: data.supply.kitchenId === kitchenId
            ? `${t('found')} ${data.supply.name} ${t('in_current_kitchen')}`
            : `${t('found')} ${data.supply.name} ${t('in')} ${data.supply.kitchenName}`,
        });
        return;
      }

      // If no food supply found, try to find a recipe with this ID
      response = await fetch(`/api/recipes/${decodedText}`);
      
      if (response.ok) {
        const recipe = await response.json();
        setFoundRecipe(recipe);
        toast({
          title: t('recipe_found'),
          description: `${recipe.name}`,
        });
        return;
      }

      // If neither food supply nor recipe found
      toast({
        title: t('not_found'),
        description: t('no_item_or_recipe_found_with_this_code'),
        variant: "destructive",
      });
      
      // Resume scanning if nothing found
      if (scannerRef.current) {
        await scannerRef.current.resume();
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: t('failed_to_search_for_item_or_recipe'),
        variant: "destructive",
      });
      // Resume scanning on error
      if (scannerRef.current) {
        await scannerRef.current.resume();
      }
    }
  };

  const handleError = (err: any) => {
    console.warn(err);
  };

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode) {
      await handleScan(manualCode);
      setManualCode('');
    }
  };

  const handleDialogClose = async (open: boolean) => {
    if (!open && scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
        setShowScanner(false);
        setFoundSupply(null);
        setFoundRecipe(null);
        setServingsCount('1');
        consumptionForm.reset();
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
    } else {
      setShowScanner(open);
    }
  };

  const onRecordConsumption = async (values: z.infer<typeof consumptionFormSchema>) => {
    if (!foundSupply) return;

    try {
      setIsProcessing(true);
      const response = await fetch('/api/food-supply/consume', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          supplyId: foundSupply.id,
          quantity: values.quantity,
          kitchenId: foundSupply.kitchenId, // Use the kitchen ID where the item was found
          notes: values.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to record consumption");
      }

      toast({
        title: t('success'),
        description: t('consumption_recorded_successfully'),
      });
      
      // Dispatch a custom event to notify that consumption was recorded
      const consumptionEvent = new CustomEvent('food-consumption-recorded', {
        detail: { 
          supplyId: foundSupply.id, 
          quantity: values.quantity,
          timestamp: new Date().toISOString()
        }
      });
      window.dispatchEvent(consumptionEvent);
      
      handleDialogClose(false);
      if (onScanComplete) {
        onScanComplete();
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_record_consumption'),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseRecipe = async () => {
    if (!foundRecipe) return;

    const servings = parseInt(servingsCount);
    if (isNaN(servings) || servings <= 0) {
      toast({
        title: t('error'),
        description: t('please_enter_valid_servings'),
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/recipes/use', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipeId: foundRecipe.id,
          kitchenId: kitchenId,
          notes: `${t('used_recipe')}: ${foundRecipe.name} (${servings} ${t('servings')})`,
          servingsUsed: servings,
          forceUse: false
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle insufficient ingredients error
        if (errorData.insufficientIngredients) {
          toast({
            title: t('insufficient_ingredients'),
            description: t('not_enough_ingredients_for_recipe'),
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(errorData.error || t('failed_to_use_recipe'));
      }

      // Success
      toast({
        title: t('success'),
        description: t('recipe_used_successfully'),
      });

      // Dispatch event to refresh consumption data
      const consumptionEvent = new CustomEvent('food-consumption-recorded', {
        detail: { 
          recipeId: foundRecipe.id,
          recipeName: foundRecipe.name,
          timestamp: new Date().toISOString()
        }
      });
      window.dispatchEvent(consumptionEvent);
      
      // Close dialog
      handleDialogClose(false);
      
      if (onScanComplete) {
        onScanComplete();
      }
    } catch (error) {
      console.error('Error using recipe:', error);
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_use_recipe'),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScanAnother = async () => {
    setFoundSupply(null);
    setFoundRecipe(null);
    setServingsCount('1');
    consumptionForm.reset();
    if (scannerRef.current) {
      try {
        await scannerRef.current.resume();
      } catch (error) {
        console.error("Error resuming scanner:", error);
      }
    }
  };

  return (
    <>
      {/* Only render the button if this component is not being controlled externally */}
      {externalOpen === undefined && (
        <Button onClick={() => setShowScanner(true)}>
          {t('scan_item_or_recipe')}
        </Button>
      )}

      <Dialog open={showScanner} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('kitchen_scanner')}</DialogTitle>
          </DialogHeader>
          
          {foundSupply ? (
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-2">{foundSupply.name}</h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('available_quantity')}</p>
                    <p>{foundSupply.quantity} {foundSupply.unit}</p>
                  </div>
                  {foundSupply.expirationDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">{t('expiration_date')}</p>
                      <p>{new Date(foundSupply.expirationDate).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">{t('kitchen')}</p>
                  <p className="font-medium">{foundSupply.kitchenName}</p>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">{t('staff_member')}</p>
                  <p className="font-medium">{user?.email}</p>
                </div>

                <Form {...consumptionForm}>
                  <form onSubmit={consumptionForm.handleSubmit(onRecordConsumption)} className="space-y-4">
                    <FormField
                      control={consumptionForm.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('consumption_quantity')} ({foundSupply.unit})</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.1"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={consumptionForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('notes')} ({t('optional')})</FormLabel>
                          <FormControl>
                            <Input 
                              type="text"
                              placeholder={t('add_any_additional_notes')}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2">
                      <Button 
                        type="submit" 
                        className="flex-1"
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('recording')}...
                          </>
                        ) : (
                          t('record_consumption')
                        )}
                      </Button>
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={handleScanAnother}
                        className="flex-1"
                      >
                        <ScanLine className="mr-2 h-4 w-4" />
                        {t('scan_another')}
                      </Button>
                    </div>
                  </form>
                </Form>
              </Card>
            </div>
          ) : foundRecipe ? (
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-2">{foundRecipe.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{foundRecipe.description}</p>
                
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('standard_servings')}</p>
                    <p>{foundRecipe.servings}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('ingredients')}</p>
                    <p>{foundRecipe.ingredients.length} {t('items')}</p>
                  </div>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">{t('staff_member')}</p>
                  <p className="font-medium">{user?.email}</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="servings">{t('number_of_servings')}</Label>
                    <Input
                      id="servings"
                      type="number"
                      min="1"
                      value={servingsCount}
                      onChange={(e) => setServingsCount(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      {t('standard_recipe_serves')} {foundRecipe.servings} {t('people')}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleUseRecipe} 
                      className="flex-1"
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('processing')}
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          {t('use_recipe')}
                        </>
                      )}
                    </Button>
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={handleScanAnother}
                      className="flex-1"
                    >
                      <ScanLine className="mr-2 h-4 w-4" />
                      {t('scan_another')}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <Tabs defaultValue="camera" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="camera">{t('camera_scanner')}</TabsTrigger>
                <TabsTrigger value="manual">{t('manual_entry')}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="camera" className="mt-4">
                <div id={scannerContainerId} className="w-full min-h-[300px] border rounded-lg overflow-hidden"></div>
              </TabsContent>
              
              <TabsContent value="manual" className="mt-4">
                <form onSubmit={handleManualSearch} className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder={t('enter_barcode_or_recipe_code')}
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      {t('enter_code_manually_or_scan')}
                    </p>
                  </div>
                  <Button type="submit" className="w-full">{t('search')}</Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}