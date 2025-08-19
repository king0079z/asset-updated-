import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { printContentWithIframe } from '@/util/print';
import FoodSupplyReportPrint from './FoodSupplyReportPrint';
import { useTranslation } from "@/contexts/TranslationContext";

type PrintFoodSupplyReportButtonProps = {
  foodSupplies: any[];
  stats: {
    totalSupplies: number;
    expiringSupplies: number;
    categoryStats: Array<{ category: string; _count: number }>;
    recentSupplies: any[];
    totalConsumed?: number;
  } | null;
  categories: Array<{ value: string; label: string; color: string }>;
};

const PrintFoodSupplyReportButton: React.FC<PrintFoodSupplyReportButtonProps> = ({
  foodSupplies,
  stats,
  categories
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [consumptionHistory, setConsumptionHistory] = useState<any[]>([]);
  const { toast } = useToast();
  const { t } = useTranslation();

  const loadConsumptionHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/food-supply/full-consumption-report');
      if (!response.ok) throw new Error('Failed to load consumption history');
      const data = await response.json();
      
      // Ensure we have valid data with all required properties
      const validatedData = Array.isArray(data) ? data.map(record => ({
        ...record,
        quantity: record.quantity || 0,
        date: record.date || new Date().toISOString(),
        foodSupply: record.foodSupply || { 
          name: 'Unknown Item', 
          unit: 'units', 
          pricePerUnit: 0 
        },
        kitchen: record.kitchen || { 
          name: 'Unknown Kitchen', 
          floorNumber: null 
        },
        user: record.user || { 
          email: 'Unknown User' 
        }
      })) : [];
      
      setConsumptionHistory(validatedData);
    } catch (error) {
      console.error('Error loading consumption history:', error);
      toast({
        title: t('error'),
        description: t('failed_to_load_consumption_history'),
        variant: "destructive",
      });
      // Set empty array to prevent errors when rendering
      setConsumptionHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintReport = async () => {
    try {
      setIsLoading(true);
      
      // Show loading toast
      toast({
        title: t('loading_report_data'),
        description: t('please_wait_while_we_prepare'),
      });
      
      // Load consumption history if not already loaded
      if (consumptionHistory.length === 0) {
        await loadConsumptionHistory();
      }
      
      // Create a temporary div to render the report
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);
      
      // Render the report component to a string
      const reportContent = (
        <FoodSupplyReportPrint 
          foodSupplies={foodSupplies}
          stats={stats}
          categories={categories}
          consumptionHistory={consumptionHistory}
          date={new Date().toLocaleDateString()}
        />
      );
      
      // Convert React component to HTML string
      const reportHtml = `
        <html>
          <head>
            <title>Food Supply Inventory Report</title>
            <style>
              @media print {
                @page {
                  size: A4;
                  margin: 1cm;
                }
                body {
                  font-family: Arial, sans-serif;
                  color: #333;
                  line-height: 1.5;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                }
                th, td {
                  padding: 8px;
                  text-align: left;
                }
                th {
                  background-color: #f3f4f6;
                  font-weight: 600;
                }
                tr:nth-child(even) {
                  background-color: #f9fafb;
                }
              }
            </style>
          </head>
          <body>
            ${tempDiv.innerHTML}
          </body>
        </html>
      `;
      
      // Use the print utility to print the content
      await printContentWithIframe(reportHtml, 'Food Supply Inventory Report');
      
      // Clean up
      document.body.removeChild(tempDiv);
      
      // Success toast
      toast({
        title: t('report_ready'),
        description: t('your_report_has_been_prepared'),
      });
    } catch (error) {
      console.error("Error printing report:", error);
      toast({
        title: t('error'),
        description: t('failed_to_print_report'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        onClick={() => {
          setIsOpen(true);
          loadConsumptionHistory();
        }}
        className="flex items-center gap-2"
      >
        <Printer className="h-4 w-4" />
        {t('print_inventory_report')}
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>{t('food_supply_inventory_report')}</DialogTitle>
          </DialogHeader>
          
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[70vh]">
              <FoodSupplyReportPrint 
                foodSupplies={foodSupplies}
                stats={stats}
                categories={categories}
                consumptionHistory={consumptionHistory}
                date={new Date().toLocaleDateString()}
              />
            </div>
          )}
          
          <div className="flex justify-end gap-4 mt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              {t('close')}
            </Button>
            <Button 
              onClick={handlePrintReport}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              {t('print_report')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PrintFoodSupplyReportButton;