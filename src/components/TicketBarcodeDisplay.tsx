import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Printer, Barcode, QrCode } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { printBarcode } from '@/util/barcode';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QRCode from 'qrcode';
import { formatTicketId } from '@/util/ticketFormat';

interface TicketBarcodeDisplayProps {
  ticketId: string;
  ticketTitle: string;
  barcode: string;
  displayId?: string | null;
}

export default function TicketBarcodeDisplay({ ticketId, ticketTitle, barcode, displayId }: TicketBarcodeDisplayProps) {
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrCodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTab, setActiveTab] = useState<'barcode' | 'qrcode'>('qrcode');
  
  // Use the formatTicketId utility function for consistent display
  const ticketDisplayId = formatTicketId(displayId, ticketId);

  // Function to generate barcode
  const generateBarcode = () => {
    if (barcodeCanvasRef.current && barcode) {
      try {
        console.log("Generating barcode on canvas with value:", barcode);
        
        // Clear the canvas first
        const canvas = barcodeCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Use the barcode value for encoding but display the standardized ticket ID
        JsBarcode(canvas, barcode, {
          format: "CODE128",
          lineColor: "#000",
          width: 2,
          height: 80,
          displayValue: false, // Don't show text in the barcode itself
          fontSize: 16,
          margin: 5,
          background: "#fff"
        });
        console.log("Barcode generated successfully on canvas");
      } catch (error) {
        console.error("Error generating barcode:", error);
        toast({
          title: "Error",
          description: "Failed to generate barcode display. Please try refreshing the page.",
          variant: "destructive",
        });
      }
    } else {
      console.error("Cannot generate barcode: canvas ref or barcode value is missing", {
        hasCanvasRef: !!barcodeCanvasRef.current,
        barcodeValue: barcode
      });
    }
  };

  // Function to generate QR code
  const generateQRCode = () => {
    if (qrCodeCanvasRef.current && barcode) {
      try {
        console.log("Generating QR code on canvas with value:", barcode);
        
        // Clear the canvas first
        const canvas = qrCodeCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        QRCode.toCanvas(canvas, barcode, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        }, (error) => {
          if (error) {
            console.error("Error generating QR code:", error);
            toast({
              title: "Error",
              description: "Failed to generate QR code display. Please try refreshing the page.",
              variant: "destructive",
            });
          } else {
            console.log("QR code generated successfully on canvas");
          }
        });
      } catch (error) {
        console.error("Error generating QR code:", error);
        toast({
          title: "Error",
          description: "Failed to generate QR code display. Please try refreshing the page.",
          variant: "destructive",
        });
      }
    } else {
      console.error("Cannot generate QR code: canvas ref or barcode value is missing", {
        hasCanvasRef: !!qrCodeCanvasRef.current,
        barcodeValue: barcode
      });
    }
  };

  // Generate codes when component mounts or barcode/displayId changes
  useEffect(() => {
    if (barcode) {
      console.log("Barcode value changed, regenerating codes:", barcode);
      
      // Use a more robust approach with multiple retries
      let retryCount = 0;
      const maxRetries = 5;
      const retryDelay = 200;
      
      const attemptGeneration = () => {
        // Check if we need to generate barcode
        if (activeTab === 'barcode' || !activeTab) {
          if (barcodeCanvasRef.current) {
            generateBarcode();
          } else if (retryCount < maxRetries) {
            console.log(`Barcode canvas ref not available yet, retry ${retryCount + 1}/${maxRetries}...`);
            retryCount++;
            setTimeout(attemptGeneration, retryDelay);
            return; // Exit to avoid QR code generation until barcode is done
          } else {
            console.warn("Barcode canvas ref still not available after maximum retries");
          }
        }
        
        // Reset retry count for QR code
        retryCount = 0;
        
        // Check if we need to generate QR code
        if (activeTab === 'qrcode' || !activeTab) {
          if (qrCodeCanvasRef.current) {
            generateQRCode();
          } else if (retryCount < maxRetries) {
            console.log(`QR code canvas ref not available yet, retry ${retryCount + 1}/${maxRetries}...`);
            retryCount++;
            setTimeout(attemptGeneration, retryDelay);
          } else {
            console.warn("QR code canvas ref still not available after maximum retries");
          }
        }
      };
      
      // Start the first attempt after a short delay to ensure DOM is ready
      const initialTimer = setTimeout(attemptGeneration, 100);
      
      return () => clearTimeout(initialTimer);
    }
  }, [barcode, ticketDisplayId, activeTab]);

  // Regenerate codes when tab changes
  useEffect(() => {
    if (!barcode) return;
    
    console.log(`Tab changed to ${activeTab}, regenerating code`);
    
    // Use a more robust approach with multiple retries
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelay = 200;
    
    const attemptTabGeneration = () => {
      if (activeTab === 'barcode') {
        if (barcodeCanvasRef.current) {
          generateBarcode();
        } else if (retryCount < maxRetries) {
          console.log(`Barcode canvas ref not available yet after tab change, retry ${retryCount + 1}/${maxRetries}...`);
          retryCount++;
          setTimeout(attemptTabGeneration, retryDelay);
        } else {
          console.warn("Barcode canvas ref still not available after maximum retries following tab change");
        }
      } else if (activeTab === 'qrcode') {
        if (qrCodeCanvasRef.current) {
          generateQRCode();
        } else if (retryCount < maxRetries) {
          console.log(`QR code canvas ref not available yet after tab change, retry ${retryCount + 1}/${maxRetries}...`);
          retryCount++;
          setTimeout(attemptTabGeneration, retryDelay);
        } else {
          console.warn("QR code canvas ref still not available after maximum retries following tab change");
        }
      }
    };
    
    // Start the first attempt after a short delay to ensure DOM is ready
    const initialTimer = setTimeout(attemptTabGeneration, 100);
    
    return () => clearTimeout(initialTimer);
  }, [activeTab]);

  const handleDownload = () => {
    const canvasRef = activeTab === 'barcode' ? barcodeCanvasRef : qrCodeCanvasRef;
    if (canvasRef.current) {
      try {
        const link = document.createElement('a');
        // Use displayId in the filename when available
        link.download = `ticket-${ticketDisplayId}-${activeTab}.png`;
        link.href = canvasRef.current.toDataURL('image/png');
        link.click();
      } catch (error) {
        console.error(`Error downloading ${activeTab}:`, error);
        toast({
          title: "Download Failed",
          description: `Could not download the ${activeTab === 'barcode' ? 'barcode' : 'QR code'} image. Please try again.`,
          variant: "destructive",
        });
      }
    }
  };

  const handlePrint = async () => {
    if (!barcode) {
      console.error("No barcode value available for printing");
      toast({
        title: "Print Error",
        description: "No code value available for printing",
        variant: "destructive",
      });
      return;
    }
    
    try {
      console.log(`Printing ${activeTab} with value:`, barcode);
      // Use the common barcode printing utility with a unique timestamp to avoid conflicts
      printBarcode(
        barcode,
        ticketDisplayId,
        ticketTitle,
        `Ticket ID: ${ticketDisplayId}`,
        activeTab === 'barcode' ? 'barcode' : 'qrcode'
      );
      
      toast({
        title: "Success",
        description: `${activeTab === 'barcode' ? 'Barcode' : 'QR code'} sent to printer`,
      });
    } catch (error) {
      console.error(`Error printing ${activeTab}:`, error);
      toast({
        title: "Print Error",
        description: `Failed to print ${activeTab === 'barcode' ? 'barcode' : 'QR code'}. Please try again.`,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ticket Code</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'barcode' | 'qrcode')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="barcode" className="flex items-center gap-2">
              <Barcode className="h-4 w-4" />
              Barcode
            </TabsTrigger>
            <TabsTrigger value="qrcode" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              QR Code
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="barcode" className="flex flex-col items-center">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <canvas ref={barcodeCanvasRef} width="250" height="120" className="max-w-full"></canvas>
            </div>
            <div className="text-center mt-2 font-medium text-foreground bg-background px-3 py-1 rounded-md border border-border">
              {ticketDisplayId}
            </div>
          </TabsContent>
          
          <TabsContent value="qrcode" className="flex flex-col items-center">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <canvas ref={qrCodeCanvasRef} width="200" height="200" className="max-w-full"></canvas>
            </div>
            <div className="text-center mt-2 font-medium text-foreground bg-background px-3 py-1 rounded-md border border-border">
              {ticketDisplayId}
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}