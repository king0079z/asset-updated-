import { useState, useEffect, useRef } from "react";
import { useTranslation } from "@/contexts/TranslationContext";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrintReportDialog, ReportOptions } from "@/components/PrintReportDialog";
import { ConsumptionSummaryCard } from "@/components/ConsumptionSummaryCard";
import { ConsumptionSummaryReport } from "@/components/ConsumptionSummaryReport";
import { Printer, FileText, Package, Utensils, Car, BrainCircuit, Calendar, User, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/router";
import { useToast } from "@/components/ui/use-toast";
import dynamic from "next/dynamic";
import ReactDOMServer from "react-dom/server";
import { printContent, printContentWithIframe } from '@/util/print';

interface ReportHistoryItem {
  id: string;
  userId: string;
  userEmail: string;
  reportType: string;
  itemScope: string;
  specificItemId: string | null;
  dateRange: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export default function PrintReportPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const printFrameRef = useRef<HTMLIFrameElement>(null);
  
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [currentReportType, setCurrentReportType] = useState<"asset" | "food" | "vehicle" | "ai">("asset");
  const [reportData, setReportData] = useState<any[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [options, setOptions] = useState<ReportOptions | null>(null);

  // Fetch report history
  useEffect(() => {
    const fetchReportHistory = async () => {
      try {
        const response = await fetch("/api/reports/history");
        if (response.ok) {
          const data = await response.json();
          setReportHistory(data);
        }
      } catch (error) {
        console.error("Error fetching report history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReportHistory();
  }, []);

  const handleReportIconClick = (reportType: "asset" | "food" | "vehicle" | "ai") => {
    setCurrentReportType(reportType);
    setReportDialogOpen(true);
  };

  const handleGenerateReport = async (reportOptions: ReportOptions) => {
    setIsPrinting(true);
    setOptions(reportOptions);
    try {
      console.log("Generating report with options:", reportOptions);
      
      // Add more detailed logging for debugging
      console.log(`Report type: ${reportOptions.reportType}, Item scope: ${reportOptions.itemScope}`);
      if (reportOptions.specificItemId) {
        console.log(`Specific item ID: ${reportOptions.specificItemId}`);
      }
      
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reportOptions),
      });

      // Handle non-OK responses with better error handling
      if (!response.ok) {
        let errorMessage = "Failed to generate report. Please try again.";
        try {
          const errorData = await response.json();
          console.error("API error response:", errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error("Error parsing error response:", parseError);
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        
        toast({
          title: "Error generating report",
          description: errorMessage,
          variant: "destructive",
        });
        setIsPrinting(false);
        return;
      }
      
      // Parse the response data with error handling
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("Error parsing response data:", parseError);
        toast({
          title: "Error processing report data",
          description: "The server returned invalid data. Please try again.",
          variant: "destructive",
        });
        setIsPrinting(false);
        return;
      }
      
      // Check if we have valid data
      if (!data || (Array.isArray(data) && data.length === 0)) {
        toast({
          title: "No data available",
          description: "No data found for the selected report criteria.",
          variant: "destructive",
        });
        setIsPrinting(false);
        return;
      }
      
      // Log the received data for debugging
      console.log(`Report data received:`, {
        isArray: Array.isArray(data),
        length: Array.isArray(data) ? data.length : 'not an array',
        firstItem: Array.isArray(data) && data.length > 0 ? 
          { id: data[0].id, type: data[0].type, hasHistory: !!data[0].history } : 
          'no items'
      });
      
      setReportData(data);
      
      // Refresh report history
      try {
        const historyResponse = await fetch("/api/reports/history");
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          setReportHistory(historyData);
        }
      } catch (historyError) {
        console.error("Error refreshing report history:", historyError);
        // Non-critical error, so we don't show a toast
      }

      // Prepare the report content for printing
      const reportTitle = getReportTypeName(reportOptions.reportType);
      const reportContent = formatReportContent();
      
      if (reportContent) {
        try {
          console.log("Printing report with content length:", reportContent.length);
          
          // Try the primary print method first
          try {
            await printContent(reportContent, reportTitle);
          } catch (primaryError) {
            console.error("Primary print method failed, trying fallback method:", primaryError);
            
            // If the primary method fails, try the iframe method as a fallback
            await printContentWithIframe(reportContent, reportTitle);
          }
          
          toast({
            title: t("report_generated"),
            description: format(new Date(), "PPP p"),
          });
        } catch (printError) {
          console.error("Error printing report:", printError);
          toast({
            title: "Error printing report",
            description: "There was a problem printing the report. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        console.error("No report content available");
        toast({
          title: "Error printing report",
          description: "No report content available. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Error generating report",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case "asset":
        return <Package className="h-4 w-4" />;
      case "food":
        return <Utensils className="h-4 w-4" />;
      case "vehicle":
        return <Car className="h-4 w-4" />;
      case "ai":
        return <BrainCircuit className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getReportTypeName = (type: string) => {
    switch (type) {
      case "asset":
        return t("asset_reports");
      case "food":
        return t("food_reports");
      case "vehicle":
        return t("vehicle_reports");
      case "ai":
        return t("ai_reports");
      default:
        return type;
    }
  };

  // Import the report components
  const AssetReportDetailed = dynamic(() => import('@/components/AssetReportDetailed').then(mod => mod.AssetReportDetailed), {
    ssr: false,
  });
  
  const FoodSupplyReportDetailed = dynamic(() => import('@/components/FoodSupplyReportDetailed').then(mod => mod.FoodSupplyReportDetailed), {
    ssr: false,
  });
  
  // Add proper error handling for API requests
  const handleApiError = (error: any) => {
    console.error("API Error:", error);
    toast({
      title: "Error generating report",
      description: "There was a problem generating your report. Please try again.",
      variant: "destructive",
    });
  };

  // Function to render the report directly in the page
  const renderReport = () => {
    if (!reportData || !reportData.length) return null;

    // Add more detailed logging for debugging
    console.log(`Rendering ${currentReportType} report with data:`, {
      dataType: typeof reportData,
      isArray: Array.isArray(reportData),
      length: Array.isArray(reportData) ? reportData.length : 'not an array',
      itemScope: options?.itemScope,
      firstItem: Array.isArray(reportData) && reportData.length > 0 ? {
        id: reportData[0].id,
        hasHistory: Array.isArray(reportData[0].history),
        historyLength: Array.isArray(reportData[0].history) ? reportData[0].history.length : 'no history',
        hasTickets: Array.isArray(reportData[0].tickets),
        ticketsLength: Array.isArray(reportData[0].tickets) ? reportData[0].tickets.length : 'no tickets'
      } : 'no items'
    });

    switch (currentReportType) {
      case "asset":
        return (
          <AssetReportDetailed 
            assets={reportData} 
            isFullReport={options?.itemScope === 'all'} 
          />
        );
      case "food":
        return (
          <FoodSupplyReportDetailed 
            foodSupplies={reportData} 
            isFullReport={options?.itemScope === 'all'} 
          />
        );
      default:
        return null;
    }
  };
  
  // Function to render the Consumption Summary Report
  const renderConsumptionSummaryReport = (data: any) => {
    return ReactDOMServer.renderToString(
      <ConsumptionSummaryReport data={data} isPrintMode={true} />
    );
  };

  // Function to format the report content for printing in the iframe
  const formatReportContent = () => {
    if (!reportData) {
      console.error("No report data available for formatting");
      return null;
    }
    
    // Ensure reportData is always an array
    const dataArray = Array.isArray(reportData) ? reportData : [reportData];
    
    if (dataArray.length === 0) {
      console.error("Empty report data array");
      return null;
    }

    console.log("Formatting report content for type:", currentReportType);
    console.log("Report data sample:", {
      isArray: Array.isArray(reportData),
      length: dataArray.length,
      firstItem: dataArray.length > 0 ? {
        id: dataArray[0].id,
        name: dataArray[0].name || dataArray[0].assetId || 'no name',
        type: dataArray[0].type || 'no type'
      } : 'no items'
    });

    const reportTitle = getReportTypeName(currentReportType);
    const dateStr = format(new Date(), "PPP p");
    const dir = t('language') === 'العربية' ? 'rtl' : 'ltr';
    const textAlign = dir === 'rtl' ? 'right' : 'left';

    // Different report formats based on type
    let reportContentHtml = '';
    switch (currentReportType) {
      case "asset":
        // For asset reports, we'll create a detailed HTML representation
        if (options?.itemScope === 'specific' && reportData.length === 1) {
          // Single asset detailed report with history and tickets
          const asset = reportData[0];
          
          // Format history records if available
          let historyHtml = '';
          if (asset.history && asset.history.length > 0) {
            // Create a timeline-style history display
            historyHtml = `
              <h2 class="text-xl font-bold mb-4 mt-6">Asset History</h2>
              <div class="relative">
                <!-- Timeline line -->
                <div style="position: absolute; left: 24px; top: 0; bottom: 0; width: 2px; background-color: #e5e7eb;"></div>
                
                <!-- Timeline events -->
                <div style="margin-left: 50px;">
                  ${asset.history.map((record: any, index: number) => {
                    // Determine action color and icon
                    let actionColor = "background-color: #f3f4f6; color: #1f2937; border-color: #d1d5db;";
                    let actionIcon = "●"; // Default icon
                    
                    switch(record.action) {
                      case 'CREATED':
                        actionColor = "background-color: #dcfce7; color: #166534; border-color: #86efac;";
                        actionIcon = "✚"; // Plus symbol
                        break;
                      case 'UPDATED':
                        actionColor = "background-color: #dbeafe; color: #1e40af; border-color: #93c5fd;";
                        actionIcon = "✎"; // Edit symbol
                        break;
                      case 'MOVED':
                        actionColor = "background-color: #fef9c3; color: #854d0e; border-color: #fde047;";
                        actionIcon = "↹"; // Move symbol
                        break;
                      case 'DISPOSED':
                        actionColor = "background-color: #fee2e2; color: #991b1b; border-color: #fca5a5;";
                        actionIcon = "✕"; // X symbol
                        break;
                      case 'MAINTENANCE':
                        actionColor = "background-color: #f3e8ff; color: #6b21a8; border-color: #d8b4fe;";
                        actionIcon = "⚙"; // Gear symbol
                        break;
                      case 'TICKET_CREATED':
                        actionColor = "background-color: #e0e7ff; color: #3730a3; border-color: #a5b4fc;";
                        actionIcon = "🎫"; // Ticket symbol
                        break;
                    }
                    
                    // Format action label
                    const actionLabel = 
                      record.action === 'TICKET_CREATED' ? 'TICKET CREATED' : 
                      record.action === 'CREATED' ? 'ASSET CREATED' :
                      record.action === 'UPDATED' ? 'ASSET UPDATED' :
                      record.action === 'MOVED' ? 'ASSET MOVED' :
                      record.action === 'DISPOSED' ? 'ASSET DISPOSED' :
                      record.action === 'MAINTENANCE' ? 'MAINTENANCE' :
                      record.action;
                    
                    // Format details based on action type
                    let details = 'N/A';
                    if (record.action === 'MOVED' && record.details) {
                      details = `Moved from Floor ${record.details.fromFloor || 'N/A'}, Room ${record.details.fromRoom || 'N/A'} to 
                                Floor ${record.details.toFloor || 'N/A'}, Room ${record.details.toRoom || 'N/A'}`;
                    } else if (record.action === 'TICKET_CREATED' && record.details) {
                      details = `Ticket "${record.details.ticketTitle}" created`;
                    } else if (record.action === 'DISPOSED' && record.details) {
                      details = `Disposal reason: ${record.details.reason || 'Not specified'}`;
                    } else if (record.action === 'MAINTENANCE' && record.details) {
                      details = `Maintenance details: ${record.details.notes || 'Not specified'}`;
                    } else if (record.action === 'UPDATED' && record.details) {
                      details = `Updated fields: ${Object.keys(record.details).join(', ')}`;
                    } else if (record.details) {
                      if (typeof record.details === 'object') {
                        details = Object.entries(record.details)
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(', ');
                      } else {
                        details = String(record.details);
                      }
                    }
                    
                    // Format the date
                    let formattedDate = 'N/A';
                    try {
                      formattedDate = format(new Date(record.createdAt), 'PPP');
                    } catch (error) {
                      formattedDate = 'Invalid Date';
                    }
                    
                    // Create timeline event
                    return `
                      <div style="position: relative; margin-bottom: 24px;">
                        <!-- Timeline dot -->
                        <div style="position: absolute; left: -50px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid; ${actionColor} z-index: 10;">
                          <span style="font-size: 20px;">${actionIcon}</span>
                        </div>
                        
                        <!-- Content card -->
                        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 8px; background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <div>
                              <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 500; ${actionColor} margin-bottom: 4px;">
                                ${actionLabel}
                              </span>
                              <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">${formattedDate}</div>
                            </div>
                            <div style="font-size: 14px; color: #4b5563;">
                              By: ${record.user?.email || 'N/A'}
                            </div>
                          </div>
                          <div style="margin-top: 12px; font-size: 14px; color: #1f2937; border-top: 1px solid #f3f4f6; padding-top: 8px;">
                            ${details !== 'N/A' ? 
                              `<p style="font-weight: 500;">${details}</p>` : 
                              `<p style="font-style: italic; color: #6b7280;">No additional details</p>`
                            }
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          } else {
            historyHtml = `
              <h2 class="text-xl font-bold mb-4 mt-6">Asset History</h2>
              <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; text-align: center;">
                <p style="color: #6b7280; font-weight: 500; padding: 8px 0;">No history records found for this asset.</p>
              </div>
            `;
          }
          
          // Format tickets if available
          let ticketsHtml = '';
          if (asset.tickets && asset.tickets.length > 0) {
            ticketsHtml = `
              <h2 class="text-xl font-bold mb-4 mt-6">Asset Tickets</h2>
              <table class="w-full border-collapse">
                <thead>
                  <tr class="bg-gray-100">
                    <th class="border p-2 text-left">Title</th>
                    <th class="border p-2 text-left">Description</th>
                    <th class="border p-2 text-left">Status</th>
                    <th class="border p-2 text-left">Priority</th>
                    <th class="border p-2 text-left">Created</th>
                    <th class="border p-2 text-left">Assigned To</th>
                  </tr>
                </thead>
                <tbody>
                  ${asset.tickets.map((ticket: any) => {
                    // Format the date
                    let formattedDate = 'N/A';
                    try {
                      formattedDate = format(new Date(ticket.createdAt), 'PPP');
                    } catch (error) {
                      formattedDate = 'Invalid Date';
                    }
                    
                    return `
                      <tr class="border-b">
                        <td class="border p-2">${ticket.title || 'N/A'}</td>
                        <td class="border p-2">${ticket.description || 'N/A'}</td>
                        <td class="border p-2">${ticket.status || 'N/A'}</td>
                        <td class="border p-2">${ticket.priority || 'N/A'}</td>
                        <td class="border p-2">${formattedDate}</td>
                        <td class="border p-2">${ticket.user?.email || 'Unassigned'}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `;
          } else {
            ticketsHtml = `
              <h2 class="text-xl font-bold mb-4 mt-6">Asset Tickets</h2>
              <div class="bg-gray-50 p-4 rounded-lg text-center">
                <p class="text-gray-500 font-medium py-2">No tickets found for this asset.</p>
              </div>
            `;
          }
          
          // Create the detailed asset report
          reportContentHtml = `
            <div>
              <h2 class="text-xl font-bold mb-4">Asset Information</h2>
              <div class="bg-gray-50 p-4 rounded-lg mb-6">
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <p class="text-gray-600">Asset ID:</p>
                    <p class="font-medium">${asset.assetId || asset.id || 'N/A'}</p>
                  </div>
                  <div>
                    <p class="text-gray-600">Name:</p>
                    <p class="font-medium">${asset.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p class="text-gray-600">Type:</p>
                    <p class="font-medium">${asset.type || 'N/A'}</p>
                  </div>
                  <div>
                    <p class="text-gray-600">Status:</p>
                    <p class="font-medium">${asset.status || 'N/A'}</p>
                  </div>
                  <div>
                    <p class="text-gray-600">Location:</p>
                    <p class="font-medium">
                      ${asset.location 
                        ? `${asset.location.building || ''} - Floor ${asset.location.floorNumber || 'N/A'}, Room ${asset.location.roomNumber || 'N/A'}` 
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p class="text-gray-600">Vendor:</p>
                    <p class="font-medium">${asset.vendor?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p class="text-gray-600">Purchase Amount:</p>
                    <p class="font-medium">$${asset.purchaseAmount ? asset.purchaseAmount.toFixed(2) : 'N/A'}</p>
                  </div>
                </div>
              </div>
              
              ${historyHtml}
              
              ${ticketsHtml}
            </div>
          `;
        } else {
          // For all assets, include basic information
          reportContentHtml = `
            <div>
              <h2 class="text-xl font-bold mb-4">Asset Inventory</h2>
              <table class="w-full border-collapse">
                <thead>
                  <tr class="bg-gray-100">
                    <th class="border p-2 text-left">Asset ID</th>
                    <th class="border p-2 text-left">Name</th>
                    <th class="border p-2 text-left">Type</th>
                    <th class="border p-2 text-left">Status</th>
                    <th class="border p-2 text-left">Location</th>
                    <th class="border p-2 text-left">Purchase Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${reportData.map((asset: any) => `
                    <tr class="border-b">
                      <td class="border p-2">${asset.assetId || asset.id || 'N/A'}</td>
                      <td class="border p-2">${asset.name || 'N/A'}</td>
                      <td class="border p-2">${asset.type || 'N/A'}</td>
                      <td class="border p-2">${asset.status || 'N/A'}</td>
                      <td class="border p-2">${asset.location 
                        ? `Floor ${asset.location.floorNumber || 'N/A'}, Room ${asset.location.roomNumber || 'N/A'}` 
                        : 'N/A'}</td>
                      <td class="border p-2">$${asset.purchaseAmount ? asset.purchaseAmount.toFixed(2) : 'N/A'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }
        break;

      case "food":
        // Generate a unique report ID for compliance footer
        const foodReportId = `FOOD-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        
        reportContentHtml = `
          <div>
            <h2 class="text-xl font-bold mb-4">Food Supply Inventory</h2>
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-gray-100">
                  <th class="border p-2 text-left">Name</th>
                  <th class="border p-2 text-left">Quantity</th>
                  <th class="border p-2 text-left">Unit</th>
                  <th class="border p-2 text-left">Price Per Unit</th>
                  <th class="border p-2 text-left">Total Value</th>
                  <th class="border p-2 text-left">Consumption Records</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.map((item: any) => `
                  <tr class="border-b">
                    <td class="border p-2">${item.name || 'N/A'}</td>
                    <td class="border p-2">${item.quantity || 0}</td>
                    <td class="border p-2">${item.unit || 'N/A'}</td>
                    <td class="border p-2">QAR ${item.pricePerUnit ? item.pricePerUnit.toFixed(2) : 'N/A'}</td>
                    <td class="border p-2">QAR ${((item.quantity || 0) * (item.pricePerUnit || 0)).toFixed(2)}</td>
                    <td class="border p-2">${Array.isArray(item.consumption) ? item.consumption.length : 0}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <!-- Compliance Footer -->
            <div class="mt-12 pt-6 border-t border-gray-200 print:border-gray-300">
              <div class="flex justify-between items-center text-gray-500 text-sm mb-4">
                <p>Enterprise Asset Management System</p>
                <p>Report ID: ${foodReportId}</p>
              </div>
              
              <!-- Compliance Information Section -->
              <div class="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4 print:bg-blue-50 print:border-blue-300">
                <h4 class="text-sm font-semibold text-blue-800 mb-2">Global Standards Compliance Information</h4>
                <div class="flex flex-wrap gap-2">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">ISO 27001</span>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">GDPR</span>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">SOC2</span>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">ISO 22000</span>
                </div>
                <p class="text-xs text-blue-700 mt-2">
                  This report complies with international data protection and information security standards.
                  All data handling follows approved security protocols and retention policies.
                </p>
              </div>
              
              <div class="flex justify-between items-center text-gray-500 text-xs">
                <p>Document Classification: CONFIDENTIAL</p>
                <p>Retention Period: 7 years</p>
              </div>
              
              <p class="text-center text-gray-400 text-xs mt-2">
                This report was automatically generated and is confidential. For internal use only.
              </p>
            </div>
          </div>
        `;
        break;

      case "vehicle":
        reportContentHtml = `
          <div>
            <h2 class="text-xl font-bold mb-4">Vehicle Fleet Report</h2>
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-gray-100">
                  <th class="border p-2 text-left">Make</th>
                  <th class="border p-2 text-left">Model</th>
                  <th class="border p-2 text-left">Year</th>
                  <th class="border p-2 text-left">Plate Number</th>
                  <th class="border p-2 text-left">Status</th>
                  <th class="border p-2 text-left">Rental Amount</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.map((vehicle: any) => `
                  <tr class="border-b">
                    <td class="border p-2">${vehicle.make || 'N/A'}</td>
                    <td class="border p-2">${vehicle.model || 'N/A'}</td>
                    <td class="border p-2">${vehicle.year || 'N/A'}</td>
                    <td class="border p-2">${vehicle.plateNumber || 'N/A'}</td>
                    <td class="border p-2">${vehicle.status || 'N/A'}</td>
                    <td class="border p-2">$${vehicle.rentalAmount ? vehicle.rentalAmount.toFixed(2) : 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
        break;

      case "ai":
        reportContentHtml = `
          <div>
            <h2 class="text-xl font-bold mb-4">AI Analysis Report</h2>
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-gray-100">
                  <th class="border p-2 text-left">Type</th>
                  <th class="border p-2 text-left">Severity</th>
                  <th class="border p-2 text-left">Title</th>
                  <th class="border p-2 text-left">Description</th>
                  <th class="border p-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.map((alert: any) => `
                  <tr class="border-b">
                    <td class="border p-2">${alert.type || 'N/A'}</td>
                    <td class="border p-2">${alert.severity || 'N/A'}</td>
                    <td class="border p-2">${alert.title || 'N/A'}</td>
                    <td class="border p-2">${alert.description || 'N/A'}</td>
                    <td class="border p-2">${alert.createdAt ? format(new Date(alert.createdAt), 'PPP') : 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
        break;
    }

    return `
      <div class="p-8 max-w-full">
        <div class="flex justify-between items-center mb-6 border-b pb-4">
          <div>
            <h1 class="text-2xl font-bold">${reportTitle}</h1>
            <p class="text-gray-500">Generated on ${dateStr}</p>
            <p class="text-gray-500">Generated by ${user?.email || 'System'}</p>
          </div>
          <div class="text-right">
            <div class="font-bold text-xl">Enterprise Asset Management</div>
            <div class="text-gray-500">Report ID: ${Math.random().toString(36).substring(2, 10).toUpperCase()}</div>
          </div>
        </div>

        ${reportContentHtml}

        <div class="mt-8 pt-4 border-t text-gray-500 text-sm">
          <p>This report was automatically generated by the Enterprise Asset Management System.</p>
          <p>© ${new Date().getFullYear()} Enterprise Asset Management</p>
        </div>
      </div>
    `;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">{t("print_reports")}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Asset Reports */}
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleReportIconClick("asset")}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-lg">
                <Package className="mr-2 h-5 w-5 text-indigo-600" />
                {t("asset_reports")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center py-6">
                <div className="bg-indigo-50 p-4 rounded-full">
                  <Package className="h-12 w-12 text-indigo-600" />
                </div>
              </div>
              <Button variant="outline" className="w-full mt-2" onClick={(e) => { e.stopPropagation(); handleReportIconClick("asset"); }}>
                <Printer className="mr-2 h-4 w-4" />
                {t("print_report")}
              </Button>
            </CardContent>
          </Card>

          {/* Food Supply Reports */}
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleReportIconClick("food")}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-lg">
                <Utensils className="mr-2 h-5 w-5 text-emerald-600" />
                {t("food_reports")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center py-6">
                <div className="bg-emerald-50 p-4 rounded-full">
                  <Utensils className="h-12 w-12 text-emerald-600" />
                </div>
              </div>
              <Button variant="outline" className="w-full mt-2" onClick={(e) => { e.stopPropagation(); handleReportIconClick("food"); }}>
                <Printer className="mr-2 h-4 w-4" />
                {t("print_report")}
              </Button>
            </CardContent>
          </Card>

          {/* Vehicle Reports */}
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleReportIconClick("vehicle")}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-lg">
                <Car className="mr-2 h-5 w-5 text-blue-600" />
                {t("vehicle_reports")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center py-6">
                <div className="bg-blue-50 p-4 rounded-full">
                  <Car className="h-12 w-12 text-blue-600" />
                </div>
              </div>
              <Button variant="outline" className="w-full mt-2" onClick={(e) => { e.stopPropagation(); handleReportIconClick("vehicle"); }}>
                <Printer className="mr-2 h-4 w-4" />
                {t("print_report")}
              </Button>
            </CardContent>
          </Card>

          {/* AI Analysis Reports */}
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleReportIconClick("ai")}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-lg">
                <BrainCircuit className="mr-2 h-5 w-5 text-purple-600" />
                {t("ai_reports")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center py-6">
                <div className="bg-purple-50 p-4 rounded-full">
                  <BrainCircuit className="h-12 w-12 text-purple-600" />
                </div>
              </div>
              <Button variant="outline" className="w-full mt-2" onClick={(e) => { e.stopPropagation(); handleReportIconClick("ai"); }}>
                <Printer className="mr-2 h-4 w-4" />
                {t("print_report")}
              </Button>
            </CardContent>
          </Card>

          {/* Consumption Summary Report */}
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
            setIsPrinting(true);
            fetch("/api/reports/consumption-summary")
              .then(response => {
                if (!response.ok) throw new Error("Failed to fetch consumption data");
                return response.json();
              })
              .then(data => {
                setReportData(data);
                setTimeout(() => {
                  if (printFrameRef.current?.contentWindow) {
                    printFrameRef.current.contentWindow.document.body.innerHTML = `
                      <div id="consumption-report">
                        ${renderConsumptionSummaryReport(data)}
                      </div>
                    `;
                    printFrameRef.current.contentWindow.print();
                    toast({
                      title: t("report_generated"),
                      description: format(new Date(), "PPP p"),
                    });
                  }
                  setIsPrinting(false);
                }, 800);
              })
              .catch(error => {
                console.error("Error fetching consumption data:", error);
                toast({
                  title: "Error generating report",
                  description: "Failed to fetch consumption data. Please try again.",
                  variant: "destructive",
                });
                setIsPrinting(false);
              });
          }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-lg">
                <TrendingUp className="mr-2 h-5 w-5 text-amber-600" />
                {t("consumption_summary")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center py-6">
                <div className="bg-amber-50 p-4 rounded-full">
                  <TrendingUp className="h-12 w-12 text-amber-600" />
                </div>
              </div>
              <Button variant="outline" className="w-full mt-2" onClick={(e) => {
                e.stopPropagation();
                setIsPrinting(true);
                fetch("/api/reports/consumption-summary")
                  .then(response => {
                    if (!response.ok) throw new Error("Failed to fetch consumption data");
                    return response.json();
                  })
                  .then(data => {
                    setReportData(data);
                    setTimeout(() => {
                      if (printFrameRef.current?.contentWindow) {
                        printFrameRef.current.contentWindow.document.body.innerHTML = `
                          <div id="consumption-report">
                            ${renderConsumptionSummaryReport(data)}
                          </div>
                        `;
                        printFrameRef.current.contentWindow.print();
                        toast({
                          title: t("report_generated"),
                          description: format(new Date(), "PPP p"),
                        });
                      }
                      setIsPrinting(false);
                    }, 800);
                  })
                  .catch(error => {
                    console.error("Error fetching consumption data:", error);
                    toast({
                      title: "Error generating report",
                      description: "Failed to fetch consumption data. Please try again.",
                      variant: "destructive",
                    });
                    setIsPrinting(false);
                  });
              }}>
                <Printer className="mr-2 h-4 w-4" />
                {t("print_report")}
              </Button>
            </CardContent>
          </Card>
        </div>
        
        {/* Consumption Summary Card */}
        <ConsumptionSummaryCard className="mt-6" />

        {/* Report History */}
        <Card>
          <CardHeader>
            <CardTitle>{t("print_report_history")}</CardTitle>
            <CardDescription>
              {t("print_report_history")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : reportHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {t("no_reports_found")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("report_type")}</TableHead>
                      <TableHead>{t("report_details")}</TableHead>
                      <TableHead>{t("report_date")}</TableHead>
                      <TableHead>{t("report_user")}</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportHistory.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            {getReportTypeIcon(report.reportType)}
                            <span className="ml-2">{getReportTypeName(report.reportType)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-medium">
                              {report.itemScope === "all" ? t("all_items") : t("specific_item")}
                            </span>
                            <span className="text-gray-500 ml-2">
                              {report.dateRange === "full" ? t("full_date_range") : t("custom_date_range")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                            {format(new Date(report.createdAt), "PPP p")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-2 text-gray-500" />
                            {report.userEmail}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCurrentReportType(report.reportType as any);
                              handleGenerateReport({
                                reportType: report.reportType as any,
                                itemScope: report.itemScope as any,
                                specificItemId: report.specificItemId || undefined,
                                dateRange: report.dateRange as any,
                                startDate: report.startDate ? new Date(report.startDate) : undefined,
                                endDate: report.endDate ? new Date(report.endDate) : undefined,
                              });
                            }}
                          >
                            <Printer className="h-4 w-4" />
                            <span className="sr-only">{t("print_report")}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Report Dialog */}
      <PrintReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        reportType={currentReportType}
        onGenerateReport={handleGenerateReport}
      />

      {/* Hidden iframe for printing - using a unique name to avoid conflicts */}
      <iframe
        ref={printFrameRef}
        className="hidden"
        title="Print Frame"
        name={`print_frame_${Date.now()}`}
        srcDoc={`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${getReportTypeName(currentReportType)}</title>
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                h1, h2 { margin-bottom: 16px; }
                @media print {
                  @page { margin: 1cm; }
                }
              </style>
            </head>
            <body>
              ${formatReportContent()}
            </body>
          </html>
        `}
      />
    </DashboardLayout>
  );
}