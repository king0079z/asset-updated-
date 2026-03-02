import React, { useRef, useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useReactToPrint } from 'react-to-print';
import TicketReport from './TicketReport';
import { printBarcode } from '@/util/barcode';
import { printContent, printContentWithIframe } from '@/util/print';
import { useToast } from "@/components/ui/use-toast";
import ReactDOMServer from 'react-dom/server';
import { Progress } from "@/components/ui/progress";

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
  displayId: string | null;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  barcode?: string;
  assetId: string | null;
  asset: {
    id: string;
    name: string;
    assetId: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface PrintTicketButtonProps {
  ticket: Ticket;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  printBarcodeOnly?: boolean;
}

const PrintTicketButton: React.FC<PrintTicketButtonProps> = ({ 
  ticket, 
  variant = "outline",
  size = "icon",
  className = "",
  printBarcodeOnly = false
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Reset progress when loading state changes to false
  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
    }
  }, [isLoading]);
  
  // Simulate progress updates when loading
  useEffect(() => {
    if (isLoading) {
      const timer = setInterval(() => {
        setProgress((prevProgress) => {
          // Gradually increase progress, but never reach 100% until complete
          // This creates a realistic loading experience
          if (prevProgress >= 95) {
            clearInterval(timer);
            return prevProgress;
          }
          return prevProgress + (95 - prevProgress) * 0.1;
        });
      }, 300);
      
      return () => {
        clearInterval(timer);
      };
    }
  }, [isLoading]);

  const handlePrint = async () => {
    // Show loading animation immediately
    setIsLoading(true);
    
    try {
      if (printBarcodeOnly) {
        // First, check if we need to fetch the barcode
        if (!ticket.barcode) {
          console.log("No barcode available, fetching from API...");
          try {
            const response = await fetch(`/api/tickets/${ticket.id}`);
            if (response.ok) {
              const ticketData = await response.json();
              if (ticketData.barcode) {
                console.log("Barcode fetched successfully");
                // Set progress to 100% when barcode is ready
                setProgress(100);
                
                // Small delay to show 100% completion before printing
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Use the fetched barcode
                const displayId = ticket.displayId || `ID-${ticket.id.substring(0, 8)}`;
                printBarcode(
                  ticketData.barcode,
                  displayId,
                  ticket.title,
                  `Ticket ID: ${displayId}`
                );
                setIsLoading(false);
                return;
              }
            }
            // If we get here, we couldn't fetch a valid barcode
            throw new Error("Could not retrieve barcode for this ticket");
          } catch (fetchError) {
            console.error("Error fetching barcode:", fetchError);
            toast({
              title: "Print Error",
              description: "No barcode available for this ticket",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
        }
        
        console.log("Printing barcode for ticket:", ticket.id, "Barcode value:", ticket.barcode);
        
        // Set progress to 100% when barcode is ready
        setProgress(100);
        
        // Small delay to show 100% completion before printing
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Print just the barcode
        const displayId = ticket.displayId || `ID-${ticket.id.substring(0, 8)}`;
        printBarcode(
          ticket.barcode,
          displayId,
          ticket.title,
          `Ticket ID: ${displayId}`
        );
        setIsLoading(false);
      } else {
        // Print the full ticket report
        console.log("Preparing ticket report for:", ticket.id);
        
        try {
          // Fetch the complete ticket data with history, assignee, and requester info
          const response = await fetch(`/api/tickets/${ticket.id}`);
          if (!response.ok) {
            throw new Error("Failed to fetch ticket details");
          }
          
          const ticketData = await response.json();
          console.log("Ticket data fetched successfully");
          
          // Fetch ticket history
          const historyResponse = await fetch(`/api/tickets/${ticket.id}/history`);
          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            console.log(`Fetched ${historyData.length} history entries`);
            ticketData.history = historyData;
          } else {
            console.warn("Could not fetch ticket history");
            ticketData.history = [];
          }
          
          // Generate the report HTML directly
          const reportHtml = ReactDOMServer.renderToString(<TicketReport ticket={ticketData} />);
          
          // Log the content length for debugging
          console.log(`Generated ticket report HTML length: ${reportHtml.length}`);
          
          // Set progress to 100% when report is ready
          setProgress(100);
          
          // Small delay to show 100% completion before printing
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Use our iframe print method which is more reliable
          await printContentWithIframe(reportHtml, `Ticket_${ticketData.displayId || `ID-${ticketData.id.substring(0, 8)}`}`);
          
          toast({
            title: "Success",
            description: "Ticket report printed successfully",
          });
        } catch (printError) {
          console.error("Print error:", printError);
          toast({
            title: "Print Error",
            description: "Failed to print ticket report",
            variant: "destructive",
          });
        } finally {
          // Hide loading animation when done
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error("Error in print handler:", error);
      toast({
        title: "Print Error",
        description: "An unexpected error occurred while printing",
        variant: "destructive",
      });
      // Make sure loading animation is hidden in case of error
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handlePrint}
        title={printBarcodeOnly ? "Print ticket barcode" : "Print ticket report"}
        className={className}
        disabled={isLoading}
      >
        <Printer className="h-4 w-4" />
        {size !== "icon" && <span className="ml-2">{printBarcodeOnly ? "Print Barcode" : "Print"}</span>}
      </Button>
      
      {/* Hidden report template for printing */}
      {!printBarcodeOnly && (
        <div className="hidden">
          <div ref={reportRef}>
            <TicketReport ticket={ticket} />
          </div>
        </div>
      )}
      
      {/* Progress bar loading animation */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card p-8 rounded-lg shadow-lg w-[90%] max-w-md">
            <h3 className="text-xl font-semibold mb-4 text-center">
              {printBarcodeOnly ? "Generating Ticket Barcode" : "Generating Ticket Report"}
            </h3>
            
            <div className="mb-6">
              <Progress value={progress} className="h-3" />
            </div>
            
            <div className="text-center text-muted-foreground">
              <p className="mb-2">{Math.round(progress)}% Complete</p>
              <p className="text-sm">
                {printBarcodeOnly 
                  ? "Please wait while we prepare your barcode..." 
                  : "Please wait while we prepare your report..."}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PrintTicketButton;