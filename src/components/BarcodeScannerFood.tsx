import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useAuth } from "@/contexts/AuthContext";

interface FoodSupply {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expirationDate?: string | null;
  kitchenId: string;
  kitchenName: string;
}

const consumptionFormSchema = z.object({
  quantity: z.number().min(0.1, "Quantity must be greater than 0"),
  notes: z.string().optional(),
});

interface BarcodeScannerFoodProps {
  kitchenId: string;
  onScanComplete?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function BarcodeScannerFood({ kitchenId, onScanComplete, open: externalOpen, onOpenChange }: BarcodeScannerFoodProps) {
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
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { user } = useAuth();
  const scannerContainerId = 'food-reader';

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
              title: "Camera Access Required",
              description: "Please allow camera access in your browser settings to use the scanner.",
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
                title: "Camera Access Denied",
                description: "You've denied camera access. Please enable it in your browser settings to use the scanner.",
                variant: "destructive",
              });
            } else {
              throw error;
            }
          }
        } catch (error) {
          console.error("Camera initialization error:", error);
          toast({
            title: "Camera Error",
            description: "Failed to initialize camera. Please make sure your device has a working camera.",
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
  }, [showScanner, toast]);

  const handleScan = async (decodedText: string) => {
    try {
      if (scannerRef.current) await scannerRef.current.pause();

      // 1. Try with current kitchen
      let response = await fetch(`/api/food-supply?barcode=${encodeURIComponent(decodedText)}&kitchenId=${kitchenId}`);
      let data = await response.json();

      // 2. If not found, try any kitchen (cross-kitchen lookup)
      if (!data.supply) {
        response = await fetch(`/api/food-supply?barcode=${encodeURIComponent(decodedText)}`);
        data = await response.json();
      }

      if (data.supply) {
        setFoundSupply(data.supply);
        toast({
          title: "Item Found",
          description: `Found ${data.supply.name} in ${data.supply.kitchenName}`,
        });
      } else if (data.recipeId) {
        toast({
          title: "Recipe Barcode",
          description: `This barcode belongs to recipe: ${data.recipeName}. Use the recipe scanner instead.`,
          variant: "warning",
        });
        if (scannerRef.current) await scannerRef.current.resume();
      } else {
        toast({
          title: "Not Found",
          description: "No food supply found with this barcode",
          variant: "destructive",
        });
        if (scannerRef.current) await scannerRef.current.resume();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to search for food supply", variant: "destructive" });
      if (scannerRef.current) await scannerRef.current.resume();
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
        title: "Success",
        description: "Consumption recorded successfully",
      });
      
      // Dispatch a custom event to notify that consumption was recorded
      console.log('Dispatching food-consumption-recorded event from BarcodeScannerFood');
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
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to record consumption",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScanAnother = async () => {
    setFoundSupply(null);
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
          Scan Food Item
        </Button>
      )}

      <Dialog open={showScanner} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Food Supply Scanner</DialogTitle>
          </DialogHeader>
          
          {foundSupply ? (
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-2">{foundSupply.name}</h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Available Quantity</p>
                    <p>{foundSupply.quantity} {foundSupply.unit}</p>
                  </div>
                  {foundSupply.expirationDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">Expiration Date</p>
                      <p>{new Date(foundSupply.expirationDate).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">Kitchen</p>
                  <p className="font-medium">{foundSupply.kitchenName}</p>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">Staff Member</p>
                  <p className="font-medium">{user?.email}</p>
                </div>

                <Form {...consumptionForm}>
                  <form onSubmit={consumptionForm.handleSubmit(onRecordConsumption)} className="space-y-4">
                    <FormField
                      control={consumptionForm.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Consumption Quantity ({foundSupply.unit})</FormLabel>
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
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="text"
                              placeholder="Add any additional notes"
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
                            Recording...
                          </>
                        ) : (
                          "Record Consumption"
                        )}
                      </Button>
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={handleScanAnother}
                        className="flex-1"
                      >
                        Scan Another Item
                      </Button>
                    </div>
                  </form>
                </Form>
              </Card>
            </div>
          ) : (
            <Tabs defaultValue="camera" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="camera">Camera Scanner</TabsTrigger>
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              </TabsList>
              
              <TabsContent value="camera" className="mt-4">
                <div id={scannerContainerId} className="w-full min-h-[300px] border rounded-lg overflow-hidden"></div>
              </TabsContent>
              
              <TabsContent value="manual" className="mt-4">
                <form onSubmit={handleManualSearch} className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder="Enter food supply barcode"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      Enter the barcode manually or scan it with a handheld scanner
                    </p>
                  </div>
                  <Button type="submit" className="w-full">Search Item</Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}