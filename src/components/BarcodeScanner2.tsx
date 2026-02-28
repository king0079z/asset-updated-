// @ts-nocheck
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Eye, Move, Trash2, Loader2, Camera, QrCode, RotateCcw, AlertTriangle, CheckCircle2, Scan, BarChart4, RefreshCcw, PlusCircle } from "lucide-react";
import { ChangeAssetStatusDialog } from "@/components/ChangeAssetStatusDialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import Image from 'next/image';

interface Asset {
  id: string;
  name: string;
  floorNumber?: string;
  roomNumber?: string;
  status: string;
  description?: string | null;
  imageUrl?: string | null;
  type?: string;
  vendor?: {
    name: string;
  } | null;
  barcode?: string;
  assetId?: string;
}

const moveFormSchema = z.object({
  floorNumber: z.string().min(1, "Floor number is required"),
  roomNumber: z.string().min(1, "Room number is required"),
});

interface BarcodeScannerProps {
  onScan?: (assetOrBarcode: Asset | { barcode: string }) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function BarcodeScanner({ onScan, open: externalOpen, onOpenChange }: BarcodeScannerProps) {
  const [internalShowScanner, setInternalShowScanner] = useState(false);
  const showScanner = externalOpen !== undefined ? externalOpen : internalShowScanner;
  const setShowScanner = (value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalShowScanner(value);
    }
  };
  const [manualCode, setManualCode] = useState('');
  const [foundAsset, setFoundAsset] = useState<Asset | null>(null);
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isDisposing, setIsDisposing] = useState(false);
  const { toast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'asset-reader';

  const moveForm = useForm<z.infer<typeof moveFormSchema>>({
    resolver: zodResolver(moveFormSchema),
    defaultValues: {
      floorNumber: "",
      roomNumber: "",
    },
  });

  const [cameraPermissionStatus, setCameraPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isInitializing, setIsInitializing] = useState(false);
  const [activeCamera, setActiveCamera] = useState<string | null>(null);
  const [cameraInitError, setCameraInitError] = useState<string | null>(null);

  // Helper to initialize the camera, can be retried
  const initializeScanner = async () => {
    setIsInitializing(true);
    setCameraInitError(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setCameraPermissionStatus("denied");
      setCameraInitError(
        "Your browser or device does not support camera access for barcode scanning. Please use manual entry or try a different device/browser."
      );
      setIsInitializing(false);
      return;
    }

    let permissionState: 'prompt' | 'granted' | 'denied' = 'prompt';
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const permissionResult = await navigator.permissions.query({ name: 'camera' as PermissionName });
        permissionState = permissionResult.state as 'prompt' | 'granted' | 'denied';
        setCameraPermissionStatus(permissionState);

        if (permissionResult.state === 'denied') {
          setCameraInitError(
            "Camera access is denied in your browser settings. Please allow camera access and try again."
          );
          setIsInitializing(false);
          return;
        }
      }
    } catch (err) {
      setCameraPermissionStatus('prompt');
    }

    try {
      await navigator.mediaDevices.getUserMedia({ video: true });

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerContainerId);

        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          const backCamera = devices.find(device =>
            device.label.toLowerCase().includes('back') ||
            device.label.toLowerCase().includes('rear')
          ) || devices[0];

          setActiveCamera(backCamera.id);
          await scannerRef.current.start(
            backCamera.id,
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1,
              formatsToSupport: [
                Html5Qrcode.FORMATS.CODE_128,
                Html5Qrcode.FORMATS.CODE_39,
                Html5Qrcode.FORMATS.EAN_13,
                Html5Qrcode.FORMATS.EAN_8,
                Html5Qrcode.FORMATS.QR_CODE,
                Html5Qrcode.FORMATS.DATA_MATRIX,
                Html5Qrcode.FORMATS.AZTEC,
                Html5Qrcode.FORMATS.PDF_417
              ]
            },
            handleScan,
            handleError
          );
        } else {
          setCameraPermissionStatus("denied");
          setCameraInitError("No camera was detected on your device. Please use manual entry instead.");
          setIsInitializing(false);
          return;
        }
      }
    } catch (error: any) {
      if (error && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')) {
        setCameraPermissionStatus('denied');
        setCameraInitError(
          "Camera access is denied. Please check your browser settings and allow camera access for this site, then retry."
        );
      } else if (error && (error.name === "NotFoundError" || error.name === "DevicesNotFoundError")) {
        setCameraPermissionStatus("denied");
        setCameraInitError("No camera was detected on your device. Please use manual entry instead.");
      } else if (error && (error.name === "NotReadableError" || error.name === "TrackStartError")) {
        setCameraPermissionStatus("denied");
        setCameraInitError("Your camera is in use by another application or encountered an error. Please close other apps and retry.");
      } else if (
        /ios|iphone|ipad|ipod|safari/i.test(navigator.userAgent) &&
        window.location.protocol !== "https:"
      ) {
        setCameraPermissionStatus("denied");
        setCameraInitError("On iOS Safari, camera access only works over HTTPS. Please use a secure connection.");
      } else {
        setCameraPermissionStatus("denied");
        setCameraInitError("Failed to initialize camera. Please make sure your device has a working camera and browser supports camera access.");
      }
      setIsInitializing(false);
      return;
    }

    setIsInitializing(false);
  };

  useEffect(() => {
    if (showScanner) {
      initializeScanner();
      return () => {
        if (scannerRef.current) {
          scannerRef.current.stop()
            .then(() => {
              scannerRef.current = null;
              setActiveCamera(null);
            })
            .catch(console.error);
        }
      };
    }
    // eslint-disable-next-line
  }, [showScanner]);

  const handleScan = async (result: string) => {
    if (!result) return;
    setNotFoundCode(null);

    try {
      if (scannerRef.current) {
        await scannerRef.current.pause();
      }

      // Try multiple search approaches for better compatibility
      let response = await fetch(`/api/assets?search=${encodeURIComponent(result)}`);
      let data = await response.json();

      if (!data.asset && response.status === 404) {
        response = await fetch(`/api/assets?barcode=${encodeURIComponent(result)}`);
        data = await response.json();
      }

      if (!data.asset && response.status === 404) {
        response = await fetch(`/api/assets?assetId=${encodeURIComponent(result)}`);
        data = await response.json();
      }

      if (data.asset) {
        setFoundAsset(data.asset);
        setNotFoundCode(null);
        toast({
          title: "Asset Found",
          description: `Found ${data.asset.name}`,
        });
        // Notify parent if callback provided
        if (onScan) {
          onScan(data.asset);
          handleDialogClose(false);
          return;
        }
      } else {
        setFoundAsset(null);
        setNotFoundCode(result);
        toast({
          title: "Not Found",
          description: "No asset found with this code. You can register a new asset.",
          variant: "destructive",
        });
        if (scannerRef.current) {
          await scannerRef.current.resume();
        }
      }
    } catch (error) {
      setFoundAsset(null);
      setNotFoundCode(result);
      toast({
        title: "Error",
        description: "Failed to search for asset. Please try again.",
        variant: "destructive",
      });
      if (scannerRef.current) {
        await scannerRef.current.resume();
      }
    }
  };

  const handleError = (err: any) => {
    console.warn("Barcode scanner error:", err);

    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      toast({
        title: "Camera Permission Denied",
        description: "Please allow camera access in your browser settings to use the scanner.",
        variant: "destructive",
      });
    } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      toast({
        title: "Camera Not Found",
        description: "No camera was detected on your device. Please use manual entry instead.",
        variant: "destructive",
      });
    } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      toast({
        title: "Camera Error",
        description: "Your camera is in use by another application or encountered an error.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Scanner Error",
        description: "An error occurred with the barcode scanner. Please try manual entry.",
        variant: "destructive",
      });
    }
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
        setFoundAsset(null);
        setNotFoundCode(null);
        setShowDetailsDialog(false);
        setShowMoveDialog(false);
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
    } else {
      setShowScanner(open);
    }
  };

  const onMoveAsset = async (values: z.infer<typeof moveFormSchema>) => {
    if (!foundAsset) return;

    try {
      setIsMoving(true);
      const response = await fetch(`/api/assets/${foundAsset.id}/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error("Failed to move asset");
      }

      const updatedAsset = await response.json();
      setFoundAsset(updatedAsset.asset);
      setShowMoveDialog(false);
      moveForm.reset();
      toast({
        title: "Success",
        description: "Asset has been moved successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to move asset",
        variant: "destructive",
      });
    } finally {
      setIsMoving(false);
    }
  };

  const handleDisposeAsset = async () => {
    if (!foundAsset) return;

    try {
      setIsDisposing(true);
      const response = await fetch(`/api/assets/${foundAsset.id}/dispose`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to dispose asset');
      }

      const updatedAsset = await response.json();
      setFoundAsset(updatedAsset.asset);
      toast({
        title: "Success",
        description: "Asset has been marked as disposed",
      });
      handleDialogClose(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to dispose asset",
        variant: "destructive",
      });
    } finally {
      setIsDisposing(false);
    }
  };

  const handleScanAnother = async () => {
    setFoundAsset(null);
    setNotFoundCode(null);
    if (scannerRef.current) {
      try {
        await scannerRef.current.resume();
      } catch (error) {
        console.error("Error resuming scanner:", error);
      }
    }
  };

  // Only render the standalone button if no external open state is provided
  const renderStandaloneButton = externalOpen === undefined;

  return (
    <>
      {renderStandaloneButton && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setShowScanner(true)}
                className="min-h-10 flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                size="lg"
              >
                <Scan className="h-5 w-5" />
                Scan Asset
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Scan asset barcode or QR code to view or manage</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Main Scanner Dialog */}
      <Dialog open={showScanner} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl flex items-center gap-2">
              <BarChart4 className="h-5 w-5" />
              Asset Scanner
            </DialogTitle>
            <DialogDescription>
              Scan an asset barcode or QR code to view details or manage its location
            </DialogDescription>
          </DialogHeader>

          {foundAsset ? (
            <div className="p-6 pt-2 space-y-4">
              <Card className="overflow-hidden border-2 border-primary/10">
                <CardHeader className="bg-muted/40 pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{foundAsset.name}</CardTitle>
                    <Badge variant={foundAsset.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {foundAsset.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {foundAsset.type || 'Asset'} • ID: {foundAsset.id?.substring(0, 8)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Location</p>
                      <p className="font-medium flex items-center gap-1">
                        <span className="text-primary">Floor:</span> {foundAsset.floorNumber || 'N/A'}
                      </p>
                      <p className="font-medium flex items-center gap-1">
                        <span className="text-primary">Room:</span> {foundAsset.roomNumber || 'N/A'}
                      </p>
                    </div>
                    {foundAsset.vendor && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Vendor</p>
                        <p className="font-medium">{foundAsset.vendor.name}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/30 p-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowDetailsDialog(true)}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Details
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowMoveDialog(true)}
                    className="flex-1"
                  >
                    <Move className="h-4 w-4 mr-2" />
                    Move
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowStatusDialog(true)}
                    className="flex-1 w-full mt-2"
                  >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Change Status
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 mt-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Dispose
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will mark the asset as disposed. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDisposeAsset}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={isDisposing}
                        >
                          {isDisposing ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Disposing...
                            </>
                          ) : (
                            "Dispose Asset"
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
              <Button
                variant="outline"
                onClick={handleScanAnother}
                className="w-full flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Scan Another Asset
              </Button>
            </div>
          ) : notFoundCode ? (
            <div className="p-6 flex flex-col items-center gap-4">
              <AlertTriangle className="h-10 w-10 text-destructive mb-2" />
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-1">Asset Not Found</h3>
                <p className="text-muted-foreground mb-2">
                  No asset found with code: <span className="font-mono">{notFoundCode}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  You can register a new asset with this code.
                </p>
              </div>
              <Button
                variant="default"
                className="w-full flex items-center gap-2"
                onClick={() => {
                  if (onScan) {
                    onScan({ barcode: notFoundCode });
                    handleDialogClose(false);
                  }
                }}
              >
                <PlusCircle className="h-5 w-5" />
                Register New Asset
              </Button>
              <Button
                variant="outline"
                className="w-full flex items-center gap-2"
                onClick={handleScanAnother}
              >
                <RotateCcw className="h-4 w-4" />
                Scan Again
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="camera" className="w-full">
              <div className="px-6">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="camera" className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Camera Scanner
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    Manual Entry
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="camera" className="mt-0 border-t">
                <div className="relative">
                  {(cameraInitError || cameraPermissionStatus === 'denied') && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 z-10 p-6 text-center">
                      <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Camera Error</h3>
                      <p className="text-muted-foreground mb-4">
                        {cameraInitError ||
                          "Camera access denied. Please allow camera access in your browser settings to use the scanner."}
                      </p>
                      <div className="flex flex-col gap-2 w-full">
                        <Button
                          variant="default"
                          onClick={initializeScanner}
                          className="w-full"
                          disabled={isInitializing}
                        >
                          {isInitializing ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Retrying...
                            </>
                          ) : (
                            "Retry Camera"
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDialogClose(false)}
                          className="w-full"
                        >
                          Close Scanner
                        </Button>
                      </div>
                    </div>
                  )}

                  {isInitializing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 z-10">
                      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                      <p className="text-muted-foreground">Initializing camera...</p>
                    </div>
                  )}

                  <div className="p-6 space-y-4">
                    <div className="relative">
                      <div id={scannerContainerId} className="w-full h-[350px] rounded-lg overflow-hidden"></div>
                      {activeCamera && !isInitializing && cameraPermissionStatus !== 'denied' && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                          <div className="border-2 border-primary w-[250px] h-[250px] rounded-lg relative">
                            <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary animate-[scanline_2s_ease-in-out_infinite]"></div>
                            <div className="absolute top-0 left-0 w-[20px] h-[20px] border-t-2 border-l-2 border-primary"></div>
                            <div className="absolute top-0 right-0 w-[20px] h-[20px] border-t-2 border-r-2 border-primary"></div>
                            <div className="absolute bottom-0 left-0 w-[20px] h-[20px] border-b-2 border-l-2 border-primary"></div>
                            <div className="absolute bottom-0 right-0 w-[20px] h-[20px] border-b-2 border-r-2 border-primary"></div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-muted/40 rounded-lg p-3 flex items-start gap-3">
                      <div className="bg-primary/10 p-2 rounded-full mt-0.5">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Scanning Tips</p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>• Hold the device steady and ensure good lighting</li>
                          <li>• Position barcode or QR code within the highlighted area</li>
                          <li>• Make sure the code is clearly visible and not damaged</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="mt-0 border-t">
                <div className="p-6">
                  <form onSubmit={handleManualSearch} className="space-y-4">
                    <Card className="border-primary/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Manual Code Entry</CardTitle>
                        <CardDescription>
                          Enter the asset ID, barcode, or QR code value manually
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Input
                            type="text"
                            placeholder="Enter asset ID, barcode, or QR code value"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            className="font-mono text-center text-lg"
                          />
                        </div>
                      </CardContent>
                    </Card>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={!manualCode.trim()}
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      Search Asset
                    </Button>
                  </form>
                </div>
              </TabsContent>
            </Tabs>
          )}

        </DialogContent>
      </Dialog>

      {/* Asset Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Asset Details
              </DialogTitle>
              <Badge variant={foundAsset?.status === 'ACTIVE' ? 'default' : 'secondary'}>
                {foundAsset?.status}
              </Badge>
            </div>
            <DialogDescription>
              Detailed information about {foundAsset?.name}
            </DialogDescription>
          </DialogHeader>

          {foundAsset && (
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-primary/10 shadow-sm">
                  <CardHeader className="bg-muted/30 pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart4 className="h-4 w-4 text-primary" />
                      Asset Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Type</p>
                        <p className="font-medium">{foundAsset.type || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">ID</p>
                        <p className="font-medium font-mono text-sm">{foundAsset.id}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Floor</p>
                        <p className="font-medium">{foundAsset.floorNumber || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Room</p>
                        <p className="font-medium">{foundAsset.roomNumber || 'N/A'}</p>
                      </div>
                      {foundAsset.vendor && (
                        <div className="col-span-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Vendor</p>
                          <p className="font-medium">{foundAsset.vendor.name}</p>
                        </div>
                      )}
                    </div>

                    {foundAsset.description && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                        <p className="text-sm">{foundAsset.description}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {foundAsset.imageUrl ? (
                  <Card className="border-primary/10 shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/30 pb-3">
                      <CardTitle className="text-base">Asset Image</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 relative h-[300px]">
                      <Image
                        src={foundAsset.imageUrl}
                        alt={foundAsset.name}
                        fill
                        className="object-contain p-4"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        priority
                        unoptimized
                      />
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-primary/10 shadow-sm flex flex-col items-center justify-center p-6 bg-muted/20">
                    <div className="rounded-full bg-muted/50 p-4 mb-4">
                      <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-center">No image available for this asset</p>
                  </Card>
                )}
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailsDialog(false)}
                  className="gap-2"
                >
                  Close Details
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Move Asset Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="p-0 overflow-hidden max-w-md">
          <DialogHeader className="p-6 pb-2 border-b">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Move className="h-5 w-5 text-primary" />
              Move Asset
            </DialogTitle>
            <DialogDescription>
              Update the location of {foundAsset?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6">
            <Form {...moveForm}>
              <form onSubmit={moveForm.handleSubmit(onMoveAsset)} className="space-y-4">
                <Card className="border-primary/10">
                  <CardContent className="p-4 space-y-4">
                    <FormField
                      control={moveForm.control}
                      name="floorNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Floor Number</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter floor number"
                              {...field}
                              className="bg-background"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={moveForm.control}
                      name="roomNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Room Number</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter room number"
                              {...field}
                              className="bg-background"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowMoveDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isMoving}
                  >
                    {isMoving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Moving...
                      </>
                    ) : (
                      <>
                        <Move className="mr-2 h-4 w-4" />
                        Move Asset
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      {foundAsset && (
        <ChangeAssetStatusDialog
          asset={foundAsset}
          open={showStatusDialog}
          onOpenChange={setShowStatusDialog}
          onStatusChanged={() => {
            if (foundAsset) {
              fetch(`/api/assets/${foundAsset.id}`)
                .then(response => response.json())
                .then(data => {
                  if (data.asset) {
                    setFoundAsset(data.asset);
                    toast({
                      title: "Status Updated",
                      description: `Asset status has been updated to ${data.asset.status}`,
                    });
                  }
                })
                .catch(error => {
                  console.error("Error refreshing asset data:", error);
                });
            }
          }}
        />
      )}
    </>
  );
}