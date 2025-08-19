import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";
import { Html5Qrcode } from 'html5-qrcode';
import { Loader2, ScanLine, Search, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  ingredients: any[];
}

interface RecipeScannerDialogProps {
  kitchenId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanComplete?: () => void;
}

export function RecipeScannerDialog({ kitchenId, open, onOpenChange, onScanComplete }: RecipeScannerDialogProps) {
  const [manualCode, setManualCode] = useState('');
  const [foundRecipe, setFoundRecipe] = useState<Recipe | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [servingsCount, setServingsCount] = useState('1');
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'recipe-scanner';
  
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  useEffect(() => {
    if (open) {
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
  }, [open, toast, t]);

  const handleScan = async (decodedText: string) => {
    try {
      // Stop scanning after successful scan
      if (scannerRef.current) {
        await scannerRef.current.pause();
      }

      // Fetch recipe by ID
      const response = await fetch(`/api/recipes/${decodedText}`);
      
      if (response.ok) {
        const recipe = await response.json();
        setFoundRecipe(recipe);
        toast({
          title: t('recipe_found'),
          description: `${recipe.name}`,
        });
      } else {
        toast({
          title: t('not_found'),
          description: t('no_recipe_found_with_this_code'),
          variant: "destructive",
        });
        // Resume scanning if no recipe found
        if (scannerRef.current) {
          await scannerRef.current.resume();
        }
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: t('failed_to_search_for_recipe'),
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
        setFoundRecipe(null);
        setServingsCount('1');
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
    }
    onOpenChange(open);
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
          notes: `Used recipe: ${foundRecipe.name} (${servings} servings)`,
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
        
        throw new Error(errorData.error || 'Failed to use recipe');
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
    setFoundRecipe(null);
    setServingsCount('1');
    if (scannerRef.current) {
      try {
        await scannerRef.current.resume();
      } catch (error) {
        console.error("Error resuming scanner:", error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('recipe_scanner')}</DialogTitle>
        </DialogHeader>
        
        {foundRecipe ? (
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
                    placeholder={t('enter_recipe_code')}
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('enter_code_manually_or_scan')}
                  </p>
                </div>
                <Button type="submit" className="w-full">
                  <Search className="mr-2 h-4 w-4" />
                  {t('search_recipe')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}