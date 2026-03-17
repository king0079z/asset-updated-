// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeError, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Camera, AlertCircle, CheckCircle2, RefreshCw, QrCode, Scan } from "lucide-react";
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Define ticket status and priority enums to match Prisma schema
enum TicketStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED"
}

enum TicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL"
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  barcode: string;
  assetId: string | null;
  asset: {
    id: string;
    name: string;
    assetId: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface TicketBarcodeScannerProps {
  onScan?: (ticket: Ticket) => void;
}

// Same format support as working asset scanner (QR + common 1D/2D barcodes including CODE_128 used for tickets)
const TICKET_SCANNER_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.PDF_417,
];

function normalizeScannedCode(raw: string): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\s+/g, ' ').replace(/[\x00-\x1F\x7F]/g, '').trim();
}

// Camera permission status type
type CameraPermissionStatus = 'prompt' | 'granted' | 'denied' | 'unsupported' | 'error';

// Scanner error type with more detailed information
interface ScannerError {
  message: string;
  code: string;
  isPermissionError?: boolean;
  isDeviceError?: boolean;
  isInitializationError?: boolean;
  originalError?: any;
}

export default function TicketBarcodeScanner({ onScan }: TicketBarcodeScannerProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [scannerError, setScannerError] = useState<ScannerError | null>(null);
  const [activeTab, setActiveTab] = useState('camera');
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionStatus>('prompt');
  const [isInitializing, setIsInitializing] = useState(false);
  const [activeCamera, setActiveCamera] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<Array<{id: string, label: string}>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const scannedRef = useRef(false);

  const { toast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'ticket-reader';
  const router = useRouter();

  // Function to check camera permissions
  const checkCameraPermission = useCallback(async (): Promise<CameraPermissionStatus> => {
    try {
      // Check if the browser supports the permissions API
      if (navigator.permissions && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        
        // Set up listener for permission changes
        permissionStatus.addEventListener('change', () => {
          setCameraPermission(permissionStatus.state as CameraPermissionStatus);
        });
        
        return permissionStatus.state as CameraPermissionStatus;
      } else {
        // If permissions API is not supported, try to access the camera directly
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          // Stop all tracks to release the camera
          stream.getTracks().forEach(track => track.stop());
          return 'granted';
        } catch (err) {
          if ((err as Error).name === 'NotAllowedError' || (err as Error).name === 'PermissionDeniedError') {
            return 'denied';
          } else if ((err as Error).name === 'NotFoundError' || (err as Error).name === 'DevicesNotFoundError') {
            return 'unsupported';
          } else {
            return 'error';
          }
        }
      }
    } catch (error) {
      console.error('Error checking camera permission:', error);
      return 'error';
    }
  }, []);

  // Function to get available cameras
  const getAvailableCameras = useCallback(async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setAvailableCameras(devices);
        
        // Try to find back camera first (for mobile devices)
        const backCamera = devices.find(device => 
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('rear')
        );
        
        // Set the selected camera to back camera if found, otherwise first camera
        const cameraToUse = backCamera || devices[0];
        setSelectedCameraId(cameraToUse.id);
        return cameraToUse.id;
      } else {
        setScannerError({
          message: 'No cameras found on your device',
          code: 'NO_CAMERAS',
          isDeviceError: true
        });
        return null;
      }
    } catch (error) {
      console.error('Error getting cameras:', error);
      setScannerError({
        message: 'Failed to access device cameras',
        code: 'CAMERA_ACCESS_ERROR',
        isDeviceError: true,
        originalError: error
      });
      return null;
    }
  }, []);

  // Initialize scanner when dialog opens — delay so #ticket-reader is in DOM
  useEffect(() => {
    if (!showScanner || activeTab !== 'camera') {
      clearScanner();
      return;
    }
    const t = setTimeout(() => {
      if (document.getElementById(scannerContainerId)) initializeScanner();
    }, 350);
    return () => {
      clearTimeout(t);
      clearScanner();
    };
  }, [showScanner, activeTab]);

  // Handle tab changes
  useEffect(() => {
    if (activeTab === 'camera' && showScanner) {
      // Clear any previous scanner instance
      clearScanner();
      // Initialize a new scanner
      initializeScanner();
    }
  }, [activeTab]);

  // Handle camera selection change
  useEffect(() => {
    if (selectedCameraId && activeCamera && selectedCameraId !== activeCamera) {
      // Restart scanner with new camera
      restartScanner();
    }
  }, [selectedCameraId]);

  const initializeScanner = async () => {
    await clearScanner();
    setScannerError(null);
    setIsInitializing(true);
    scannedRef.current = false;

    try {
      if (typeof window === 'undefined' || !document.getElementById(scannerContainerId)) {
        setIsInitializing(false);
        return;
      }

      const permissionStatus = await checkCameraPermission();
      setCameraPermission(permissionStatus);

      if (permissionStatus === 'denied') {
        setScannerError({
          message: 'Camera access denied. Please grant camera permission and try again.',
          code: 'PERMISSION_DENIED',
          isPermissionError: true
        });
        setIsInitializing(false);
        return;
      }
      if (permissionStatus === 'unsupported' || permissionStatus === 'error') {
        setScannerError({
          message: permissionStatus === 'unsupported' ? 'No camera detected. Please use manual entry.' : 'Error accessing camera. Please try again or use manual entry.',
          code: 'CAMERA_ACCESS_ERROR',
          isDeviceError: true
        });
        setIsInitializing(false);
        return;
      }

      let devices = await Html5Qrcode.getCameras();
      if (devices?.length) setAvailableCameras(devices);
      let cameraId = selectedCameraId;
      if (!cameraId && devices?.length) {
        const backCam = devices.find(d => /back|rear|environment/i.test(d.label || ''));
        const first = backCam || devices[0];
        setSelectedCameraId(first.id);
        cameraId = first.id;
      }
      if (!cameraId) {
        setScannerError({ message: 'No cameras found.', code: 'NO_CAMERAS', isDeviceError: true });
        setIsInitializing(false);
        return;
      }

      // Full-frame scan (no qrbox): 1D barcodes are detected much better when the whole frame is decoded instead of a cropped region
      const scanConfig = {
        fps: 8,
        disableFlip: false,
        videoConstraints: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: { ideal: 'environment' as const },
        },
      };

      scannerRef.current = new Html5Qrcode(scannerContainerId, {
        verbose: false,
        formatsToSupport: TICKET_SCANNER_FORMATS,
        useBarCodeDetectorIfSupported: false,
      });

      let started = false;
      try {
        if (devices?.length) {
          const backCam = devices.find(d => /back|rear|environment/i.test(d.label || ''));
          const camToUse = selectedCameraId && devices.some(d => d.id === selectedCameraId)
            ? devices.find(d => d.id === selectedCameraId)!
            : backCam || devices[0];
          try {
            await scannerRef.current!.start(camToUse.id, scanConfig, handleScan, handleScanError);
            setActiveCamera(camToUse.id);
            started = true;
          } catch {
            try {
              await scannerRef.current!.start(camToUse.id, { fps: 8, qrbox: { width: 400, height: 200 } }, handleScan, handleScanError);
              setActiveCamera(camToUse.id);
              started = true;
            } catch {
              await scannerRef.current!.start(camToUse.id, { fps: 8 }, handleScan, handleScanError);
              setActiveCamera(camToUse.id);
              started = true;
            }
          }
        }
        if (!started) {
          await scannerRef.current!.start({ facingMode: { ideal: 'environment' } }, scanConfig, handleScan, handleScanError);
          setActiveCamera('environment');
          started = true;
        }
      } catch (e) {
        if (!started && scannerRef.current) {
          await scannerRef.current.start({ facingMode: { ideal: 'environment' } }, scanConfig, handleScan, handleScanError);
          setActiveCamera('environment');
        }
      }
    } catch (error) {
      console.error('Error initializing scanner:', error);
      setScannerError({
        message: 'Failed to initialize the scanner. Please try again or use manual entry.',
        code: 'INITIALIZATION_ERROR',
        isInitializationError: true,
        originalError: error
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const clearScanner = async () => {
    if (scannerRef.current) {
      try {
        // Check if scanner is in scanning state before clearing
        if (scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
          console.log('Scanner stopped successfully');
        }
        scannerRef.current = null;
        setActiveCamera(null);
      } catch (error) {
        console.error("Error while clearing scanner:", error);
        // Still set to null to ensure we don't have a dangling reference
        scannerRef.current = null;
        setActiveCamera(null);
      }
    }
  };

  const restartScanner = async () => {
    setIsInitializing(true);
    await clearScanner();
    await initializeScanner();
  };

  const handleScan = async (result: string) => {
    const code = normalizeScannedCode(result);
    if (!code || scannedRef.current) return;
    scannedRef.current = true;

    try {
      setIsSearching(true);
      try {
        const audio = new Audio('/success-beep.mp3');
        audio.play().catch(() => {});
      } catch {}

      if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
        await scannerRef.current.pause();
      }

      const response = await fetch(`/api/tickets/barcode?barcode=${encodeURIComponent(code)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "Not Found",
            description: "No ticket found with this barcode",
            variant: "destructive",
          });
        } else {
          const errorData = await response.json();
          toast({
            title: "Error",
            description: errorData.error || "Failed to search for ticket",
            variant: "destructive",
          });
        }
        
        if (scannerRef.current) {
          try { await scannerRef.current.resume(); } catch {}
        }
        setIsSearching(false);
        setTimeout(() => { scannedRef.current = false; }, 1500);
        return;
      }

      const ticket = await response.json();
      if (onScan) {
        onScan(ticket);
        handleDialogClose(false);
      } else {
        toast({ title: "Ticket Found", description: `Found ticket: ${ticket.title}` });
        router.push(`/tickets/${ticket.id}`);
        handleDialogClose(false);
      }
    } catch (error) {
      console.error("Error scanning ticket barcode:", error);
      toast({
        title: "Error",
        description: "Failed to process the scanned barcode",
        variant: "destructive",
      });
      if (scannerRef.current) {
        try { await scannerRef.current.resume(); } catch {}
      }
      setTimeout(() => { scannedRef.current = false; }, 1500);
    } finally {
      setIsSearching(false);
    }
  };

  const handleScanError = (err: Html5QrcodeError) => {
    // Don't show UI or log for "no code in frame" — library fires this every frame when nothing is detected
    if (err.type === 'NotFoundException') {
      return;
    }
    const errMsg =
      typeof err === 'string'
        ? err
        : (err && typeof err === 'object'
          ? (err as { message?: string }).message ?? (err as { errorMessage?: string }).errorMessage ?? JSON.stringify(err)
          : String(err ?? ''));
    if (
      /No MultiFormat Readers were able to detect the code/i.test(errMsg) ||
      /QR code parse error/i.test(errMsg) ||
      /No barcode or QR code found/i.test(errMsg)
    ) {
      return;
    }

    // Handle specific error types
    if (err.type === 'NotAllowedError') {
      setCameraPermission('denied');
      setScannerError({
        message: 'Camera access denied. Please grant camera permission in your browser settings.',
        code: 'PERMISSION_DENIED',
        isPermissionError: true,
        originalError: err
      });
    } else if (err.type === 'NotFoundError') {
      setScannerError({
        message: 'No camera found on your device. Please use manual entry.',
        code: 'NO_CAMERA',
        isDeviceError: true,
        originalError: err
      });
    } else if (err.type === 'NotReadableError') {
      setScannerError({
        message: 'Camera is in use by another application or not accessible.',
        code: 'CAMERA_IN_USE',
        isDeviceError: true,
        originalError: err
      });
    } else {
      // For other errors, only log them but don't disrupt the UI
      console.error('Unhandled scanner error:', err);
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
    if (!open) {
      await clearScanner();
      setShowScanner(false);
      setScannerError(null);
      setManualCode('');
    } else {
      setShowScanner(open);
    }
  };

  const handleRetry = async () => {
    setCameraPermission('prompt');
    setScannerError(null);
    await initializeScanner();
  };

  const handleCameraChange = (cameraId: string) => {
    setSelectedCameraId(cameraId);
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              onClick={() => setShowScanner(true)} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <Camera className="h-4 w-4" />
              Scan Ticket Code
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Scan a ticket barcode or QR code to view details</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Main Scanner Dialog */}
      <Dialog open={showScanner} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Scan className="h-5 w-5 text-primary" />
              Ticket Code Scanner
            </DialogTitle>
            <DialogDescription>
              Scan a ticket barcode or QR code, or enter it manually to find ticket details
            </DialogDescription>
          </DialogHeader>
          
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
              <p className="text-center font-medium">Searching for ticket...</p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                  {/* Camera permission status indicator */}
                  {(cameraPermission === 'denied' || (scannerError && scannerError.isPermissionError)) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 z-10 p-6 text-center">
                      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Camera Access Denied</h3>
                      <p className="text-muted-foreground mb-4 max-w-md">
                        Please enable camera access in your browser settings to scan barcodes.
                      </p>
                      <Button 
                        onClick={handleRetry} 
                        variant="outline" 
                        className="mt-2"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Try Again
                      </Button>
                    </div>
                  )}
                  
                  {/* Device error indicator */}
                  {scannerError && scannerError.isDeviceError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 z-10 p-6 text-center">
                      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Camera Error</h3>
                      <p className="text-muted-foreground mb-4 max-w-md">
                        {scannerError.message}
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleRetry} 
                          variant="outline" 
                          className="mt-2"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Try Again
                        </Button>
                        <Button 
                          onClick={() => setActiveTab('manual')} 
                          variant="default" 
                          className="mt-2"
                        >
                          <QrCode className="h-4 w-4 mr-2" />
                          Use Manual Entry
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Loading state */}
                  {isInitializing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 z-10">
                      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                      <p className="text-muted-foreground">Initializing camera...</p>
                    </div>
                  )}
                  
                  <div className="p-6 space-y-4">
                    {/* Camera selector if multiple cameras available */}
                    {availableCameras.length > 1 && (
                      <Card className="border-primary/10">
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">Select Camera</CardTitle>
                        </CardHeader>
                        <CardContent className="py-0">
                          <div className="grid grid-cols-2 gap-2">
                            {availableCameras.map((camera) => (
                              <Button
                                key={camera.id}
                                variant={selectedCameraId === camera.id ? "default" : "outline"}
                                size="sm"
                                className="justify-start overflow-hidden"
                                onClick={() => handleCameraChange(camera.id)}
                              >
                                <Camera className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                                <span className="truncate">
                                  {camera.label.replace(/\([^)]*\)/g, '').trim() || `Camera ${camera.id.slice(-4)}`}
                                </span>
                              </Button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Scanner container */}
                    <Card className="border-primary/10 overflow-hidden">
                      <CardContent className="p-0">
                        <div className="relative">
                          <div 
                            id={scannerContainerId} 
                            className="w-full min-h-[320px] h-[420px] overflow-hidden bg-muted/30"
                          ></div>
                          
                          {/* Scanning overlay with animation */}
                          {activeCamera && !isInitializing && cameraPermission === 'granted' && (
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center border-2 border-dashed border-primary/50 rounded-lg">
                              <p className="text-xs font-medium text-primary/80 bg-background/80 px-2 py-1 rounded">Position QR or barcode anywhere in frame</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Scanning tips */}
                    <Card className="border-primary/10">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="bg-primary/10 p-2 rounded-full mt-0.5">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Scanning Tips</p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              <li>• Whole frame is scanned — position QR or barcode anywhere in view</li>
                              <li>• Hold steady with good lighting; keep barcode horizontal and in focus</li>
                              <li>• Barcode not reading? Enter the number below the barcode in Manual Entry</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
                          Enter the ticket barcode or QR code value manually
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Input
                            type="text"
                            placeholder="e.g. barcode value or TKT-20260316-0001"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            className="font-mono text-center text-lg"
                          />
                          <p className="text-xs text-muted-foreground">
                            Enter the barcode value or ticket ID (e.g. TKT-YYYYMMDD-NNNN) from the ticket
                          </p>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-0">
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={!manualCode.trim()}
                        >
                          <QrCode className="h-4 w-4 mr-2" />
                          Search Ticket
                        </Button>
                      </CardFooter>
                    </Card>
                  </form>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}