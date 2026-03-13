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

  // Single effect: generate the active tab's code whenever barcode or activeTab changes
  useEffect(() => {
    if (!barcode) return;

    let timer: ReturnType<typeof setTimeout>;
    let retries = 0;
    const maxRetries = 5;

    const attempt = () => {
      if (activeTab === 'barcode') {
        if (barcodeCanvasRef.current) {
          generateBarcode();
        } else if (retries < maxRetries) {
          retries++;
          timer = setTimeout(attempt, 200);
        }
      } else {
        if (qrCodeCanvasRef.current) {
          generateQRCode();
        } else if (retries < maxRetries) {
          retries++;
          timer = setTimeout(attempt, 200);
        }
      }
    };

    timer = setTimeout(attempt, 50);
    return () => clearTimeout(timer);
  }, [barcode, activeTab]);

  const handleDownload = () => {
    const canvasRef = activeTab === 'barcode' ? barcodeCanvasRef : qrCodeCanvasRef;
    if (canvasRef.current) {
      try {
        const dataUrl = canvasRef.current.toDataURL('image/png');
        // Use Blob + object URL to avoid ERR_INVALID_URL from data URLs in some browsers
        const byteString = atob(dataUrl.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: 'image/png' });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `ticket-${ticketDisplayId}-${activeTab}.png`;
        link.href = objectUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
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