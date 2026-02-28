import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import TicketsSummaryReport from './TicketsSummaryReport';
import { renderToStaticMarkup } from 'react-dom/server';
import { printContent, printContentWithIframe } from '@/util/print';

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
  assetId: string | null;
  asset: {
    id: string;
    name: string;
    assetId: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface PrintTicketsReportButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

const PrintTicketsReportButton: React.FC<PrintTicketsReportButtonProps> = ({
  variant = "outline",
  size = "default",
  className = "",
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePrint = async () => {
    setIsLoading(true);
    
    try {
      // Fetch tickets data
      const response = await fetch('/api/tickets', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tickets: ${response.status} ${response.statusText}`);
      }
      
      const tickets = await response.json();
      
      if (!Array.isArray(tickets) || tickets.length === 0) {
        toast({
          title: "No tickets found",
          description: "There are no tickets to include in the report.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      const reportHtml = renderToStaticMarkup(<TicketsSummaryReport tickets={tickets} />);
      
      // Try to print using the iframe method first
      try {
        await printContentWithIframe(reportHtml, 'Tickets Summary Report');
        toast({
          title: "Report printed",
          description: "The tickets summary report has been sent to your printer.",
        });
      } catch (iframeError) {
        console.error('Error printing with iframe:', iframeError);
        
        // Fallback to the window method
        try {
          await printContent(reportHtml, 'Tickets Summary Report');
          toast({
            title: "Report printed",
            description: "The tickets summary report has been sent to your printer.",
          });
        } catch (windowError) {
          console.error('Error printing with window:', windowError);
          throw new Error('Failed to print report. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error printing tickets report:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to print tickets report",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handlePrint}
      disabled={isLoading}
      className={className}
    >
      <Printer className="mr-2 h-4 w-4" />
      {isLoading ? "Preparing..." : "Print Report"}
    </Button>
  );
};

export default PrintTicketsReportButton;