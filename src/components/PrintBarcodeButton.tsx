import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Printer, QrCode, Barcode } from "lucide-react";
import { printBarcode, CodeType } from '@/util/barcode';
import { useToast } from "@/components/ui/use-toast";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface PrintBarcodeButtonProps {
  barcodeValue: string;
  displayText?: string;
  title?: string;
  subtitle?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

const PrintBarcodeButton: React.FC<PrintBarcodeButtonProps> = ({ 
  barcodeValue, 
  displayText,
  title,
  subtitle,
  variant = "outline",
  size = "default",
  className = ""
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handlePrint = async (codeType: CodeType) => {
    try {
      setIsLoading(true);
      
      if (!barcodeValue) {
        toast({
          title: "Print Error",
          description: "No code value available for printing",
          variant: "destructive",
        });
        return;
      }
      
      console.log(`Printing ${codeType}:`, { barcodeValue, displayText, title, subtitle });
      
      // Print the code using the utility function
      await printBarcode(
        barcodeValue,
        displayText || barcodeValue,
        title,
        subtitle,
        codeType
      );
      
      toast({
        title: "Success",
        description: `${codeType === 'barcode' ? 'Barcode' : 'QR Code'} sent to printer`,
      });
    } catch (error) {
      console.error("Error in print handler:", error);
      toast({
        title: "Print Error",
        description: "An unexpected error occurred while printing",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={isLoading}
          className={className}
        >
          <Printer className="h-4 w-4 mr-2" />
          {isLoading ? "Printing..." : "Print Code"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handlePrint('barcode')} className="cursor-pointer">
          <Barcode className="h-4 w-4 mr-2" />
          Print Barcode
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handlePrint('qrcode')} className="cursor-pointer">
          <QrCode className="h-4 w-4 mr-2" />
          Print QR Code
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default PrintBarcodeButton;