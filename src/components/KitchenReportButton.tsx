import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Printer, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PrintLoadingAnimation } from './PrintLoadingAnimation';

interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  prepTime: number;
  ingredients: any[];
  instructions: string;
  totalCost: number;
  costPerServing: number;
  sellingPrice?: number;
  usageCount?: number;
}

interface KitchenInfo {
  id: string;
  name: string;
  floorNumber: string;
  description?: string;
}

interface KitchenReportButtonProps {
  kitchen: KitchenInfo;
  recipes: Recipe[];
  foodSupplies: any[];
  expiringItems: any[];
  lowStockItems: any[];
}

export function KitchenReportButton({ 
  kitchen, 
  recipes, 
  foodSupplies, 
  expiringItems, 
  lowStockItems 
}: KitchenReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handlePrint = async () => {
    setIsPrinting(true);
    
    try {
      // Prepare the report content
      const reportContent = document.getElementById('kitchen-report-content');
      if (!reportContent) {
        throw new Error('Report content not found');
      }
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Could not open print window');
      }
      
      // Add necessary styles
      printWindow.document.write(`
        <html>
          <head>
            <title>Kitchen Report - ${kitchen.name}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.5;
                color: #333;
                padding: 20px;
              }
              .report-header {
                text-align: center;
                margin-bottom: 20px;
                padding-bottom: 20px;
                border-bottom: 1px solid #ddd;
              }
              .report-title {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 5px;
              }
              .report-subtitle {
                font-size: 16px;
                color: #666;
              }
              .report-date {
                font-size: 14px;
                color: #888;
                margin-top: 10px;
              }
              .section {
                margin-bottom: 30px;
              }
              .section-title {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 15px;
                padding-bottom: 5px;
                border-bottom: 1px solid #eee;
              }
              .info-box {
                background-color: #f9f9f9;
                border: 1px solid #eee;
                border-radius: 5px;
                padding: 15px;
                margin-bottom: 15px;
              }
              .info-title {
                font-weight: bold;
                margin-bottom: 5px;
              }
              .info-value {
                color: #555;
              }
              .grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
              }
              .profit-positive {
                color: #22c55e;
                font-weight: bold;
              }
              .profit-negative {
                color: #ef4444;
                font-weight: bold;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 15px;
              }
              th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
              }
              th {
                background-color: #f5f5f5;
              }
              @media print {
                body {
                  padding: 0;
                  margin: 0;
                }
              }
            </style>
          </head>
          <body>
            ${reportContent.innerHTML}
            <script>
              window.onload = function() {
                window.print();
                window.setTimeout(function() {
                  window.close();
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      
      printWindow.document.close();
      
      toast({
        title: t('report_generated'),
        description: t('kitchen_report_generated_successfully'),
      });
    } catch (error) {
      console.error('Error printing report:', error);
      toast({
        title: t('error'),
        description: t('failed_to_generate_report'),
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
      setOpen(false);
    }
  };

  // Calculate total profit from recipes
  const calculateTotalProfit = () => {
    return recipes.reduce((total, recipe) => {
      const profit = recipe.sellingPrice ? recipe.sellingPrice - recipe.totalCost : 0;
      return total + profit;
    }, 0);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <>
      <Button 
        variant="outline" 
        className="flex items-center gap-2"
        onClick={() => setOpen(true)}
      >
        <Printer className="h-4 w-4" />
        {t('print_report')}
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('kitchen_report')} - {kitchen.name}
            </DialogTitle>
          </DialogHeader>
          
          {isPrinting ? (
            <div className="flex flex-col items-center justify-center py-12">
              <PrintLoadingAnimation />
              <p className="mt-4 text-muted-foreground">{t('generating_report')}</p>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 max-h-[60vh]">
                <div id="kitchen-report-content" className="p-4">
                  {/* Report Header */}
                  <div className="report-header">
                    <div className="report-title">Kitchen Summary Report</div>
                    <div className="report-subtitle">{kitchen.name} - Floor {kitchen.floorNumber}</div>
                    <div className="report-date">Generated on: {formatDate(new Date())}</div>
                  </div>
                  
                  {/* Kitchen Overview */}
                  <div className="section">
                    <div className="section-title">Kitchen Overview</div>
                    <div className="info-box">
                      <div className="info-title">Description</div>
                      <div className="info-value">{kitchen.description || 'No description available'}</div>
                    </div>
                    
                    <div className="grid">
                      <div className="info-box">
                        <div className="info-title">Inventory Summary</div>
                        <div>
                          <div>Total Items: {foodSupplies.length} items</div>
                          <div>Expiring Soon: {expiringItems.length} items</div>
                          <div>Low Stock: {lowStockItems.length} items</div>
                        </div>
                      </div>
                      
                      <div className="info-box">
                        <div className="info-title">Recipe Summary</div>
                        <div>
                          <div>Total Recipes: {recipes.length} recipes</div>
                          <div>
                            Total Profit: 
                            <span className={calculateTotalProfit() > 0 ? 'profit-positive' : 'profit-negative'}>
                              QAR {calculateTotalProfit().toFixed(2)}
                            </span>
                          </div>
                          <div>
                            Profitable Recipes: 
                            {recipes.filter(r => r.sellingPrice && r.sellingPrice > r.totalCost).length} recipes
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Recipe Summary */}
                  <div className="section">
                    <div className="section-title">Recipe Profitability</div>
                    <table>
                      <thead>
                        <tr>
                          <th>Recipe</th>
                          <th>Cost</th>
                          <th>Selling Price</th>
                          <th>Profit/Loss</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipes.map((recipe, index) => {
                          const profit = recipe.sellingPrice 
                            ? recipe.sellingPrice - recipe.totalCost 
                            : -recipe.totalCost;
                          
                          return (
                            <tr key={index}>
                              <td>{recipe.name}</td>
                              <td>QAR {recipe.totalCost.toFixed(2)}</td>
                              <td>{recipe.sellingPrice ? `QAR ${recipe.sellingPrice.toFixed(2)}` : 'Not set'}</td>
                              <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                                QAR {profit.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </ScrollArea>
              
              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  {t('print_report')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}