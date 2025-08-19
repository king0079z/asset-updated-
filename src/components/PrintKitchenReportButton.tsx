import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Printer, FileText, ChefHat, DollarSign, TrendingUp, Utensils, BarChart3 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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

interface PrintKitchenReportButtonProps {
  kitchen: KitchenInfo;
  recipes: Recipe[];
  foodSupplies: any[];
  expiringItems: any[];
  lowStockItems: any[];
}

export function PrintKitchenReportButton({ 
  kitchen, 
  recipes, 
  foodSupplies, 
  expiringItems, 
  lowStockItems 
}: PrintKitchenReportButtonProps) {
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
              .recipe-card {
                border: 1px solid #eee;
                border-radius: 5px;
                padding: 15px;
                margin-bottom: 15px;
              }
              .recipe-title {
                font-weight: bold;
                font-size: 16px;
                margin-bottom: 5px;
              }
              .recipe-description {
                color: #666;
                margin-bottom: 10px;
                font-size: 14px;
              }
              .recipe-meta {
                display: flex;
                gap: 15px;
                margin-bottom: 10px;
                font-size: 14px;
              }
              .recipe-meta-item {
                color: #555;
              }
              .recipe-financials {
                background-color: #f5f5f5;
                padding: 10px;
                border-radius: 5px;
                margin-top: 10px;
              }
              .profit-positive {
                color: #22c55e;
                font-weight: bold;
              }
              .profit-negative {
                color: #ef4444;
                font-weight: bold;
              }
              .alert-box {
                background-color: #fff8e1;
                border: 1px solid #ffe082;
                border-radius: 5px;
                padding: 15px;
                margin-bottom: 15px;
              }
              .alert-title {
                color: #f59e0b;
                font-weight: bold;
                margin-bottom: 5px;
              }
              .recommendation-box {
                background-color: #e8f5e9;
                border: 1px solid #c8e6c9;
                border-radius: 5px;
                padding: 15px;
                margin-bottom: 15px;
              }
              .recommendation-title {
                color: #22c55e;
                font-weight: bold;
                margin-bottom: 5px;
              }
              .item-list {
                margin-top: 10px;
              }
              .item-row {
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                border-bottom: 1px solid #eee;
              }
              .item-name {
                font-weight: 500;
              }
              .item-value {
                color: #555;
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
              .page-break {
                page-break-before: always;
              }
              @media print {
                body {
                  padding: 0;
                  margin: 0;
                }
                .no-print {
                  display: none;
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

  // Get most profitable recipes
  const getMostProfitableRecipes = () => {
    return [...recipes]
      .filter(recipe => recipe.sellingPrice && recipe.sellingPrice > recipe.totalCost)
      .sort((a, b) => {
        const profitA = a.sellingPrice! - a.totalCost;
        const profitB = b.sellingPrice! - b.totalCost;
        return profitB - profitA;
      })
      .slice(0, 5);
  };

  // Get recipes that need price adjustment (losing money)
  const getRecipesNeedingPriceAdjustment = () => {
    return recipes.filter(recipe => 
      recipe.sellingPrice && recipe.sellingPrice <= recipe.totalCost
    );
  };

  // Generate recommendations based on data
  const generateRecommendations = () => {
    const recommendations = [];
    
    // Check for expiring items
    if (expiringItems.length > 0) {
      recommendations.push({
        title: 'Use expiring ingredients soon',
        description: `You have ${expiringItems.length} items expiring soon. Consider creating special dishes using these ingredients to minimize waste.`
      });
    }
    
    // Check for low stock items
    if (lowStockItems.length > 0) {
      recommendations.push({
        title: 'Restock low inventory items',
        description: `${lowStockItems.length} items are running low. Place orders soon to avoid stockouts.`
      });
    }
    
    // Check for unprofitable recipes
    const unprofitableRecipes = getRecipesNeedingPriceAdjustment();
    if (unprofitableRecipes.length > 0) {
      recommendations.push({
        title: 'Adjust recipe pricing',
        description: `${unprofitableRecipes.length} recipes are currently unprofitable. Consider increasing their selling prices or optimizing ingredient costs.`
      });
    }
    
    // Check for unused recipes
    const unusedRecipes = recipes.filter(recipe => !recipe.usageCount || recipe.usageCount === 0);
    if (unusedRecipes.length > 0) {
      recommendations.push({
        title: 'Promote unused recipes',
        description: `${unusedRecipes.length} recipes haven't been used recently. Consider featuring them as specials or reviewing their appeal.`
      });
    }
    
    // Inventory optimization
    if (foodSupplies.length > 0) {
      recommendations.push({
        title: 'Optimize inventory levels',
        description: 'Review your inventory levels to ensure you're not overstocking items with low usage rates.'
      });
    }
    
    return recommendations;
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
                        <div className="item-list">
                          <div className="item-row">
                            <span className="item-name">Total Items:</span>
                            <span className="item-value">{foodSupplies.length} items</span>
                          </div>
                          <div className="item-row">
                            <span className="item-name">Expiring Soon:</span>
                            <span className="item-value">{expiringItems.length} items</span>
                          </div>
                          <div className="item-row">
                            <span className="item-name">Low Stock:</span>
                            <span className="item-value">{lowStockItems.length} items</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="info-box">
                        <div className="info-title">Recipe Summary</div>
                        <div className="item-list">
                          <div className="item-row">
                            <span className="item-name">Total Recipes:</span>
                            <span className="item-value">{recipes.length} recipes</span>
                          </div>
                          <div className="item-row">
                            <span className="item-name">Total Profit:</span>
                            <span className={`item-value ${calculateTotalProfit() > 0 ? 'profit-positive' : 'profit-negative'}`}>
                              QAR {calculateTotalProfit().toFixed(2)}
                            </span>
                          </div>
                          <div className="item-row">
                            <span className="item-name">Profitable Recipes:</span>
                            <span className="item-value">
                              {recipes.filter(r => r.sellingPrice && r.sellingPrice > r.totalCost).length} recipes
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Alerts Section */}
                  {(expiringItems.length > 0 || lowStockItems.length > 0) && (
                    <div className="section">
                      <div className="section-title">Alerts</div>
                      
                      {expiringItems.length > 0 && (
                        <div className="alert-box">
                          <div className="alert-title">Expiring Items</div>
                          <p>The following items will expire soon and should be used promptly:</p>
                          <table>
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th>Quantity</th>
                                <th>Expiration Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {expiringItems.slice(0, 5).map((item, index) => (
                                <tr key={index}>
                                  <td>{item.name}</td>
                                  <td>{item.quantity} {item.unit}</td>
                                  <td>{new Date(item.expirationDate).toLocaleDateString()}</td>
                                </tr>
                              ))}
                              {expiringItems.length > 5 && (
                                <tr>
                                  <td colSpan={3} style={{ textAlign: 'center' }}>
                                    And {expiringItems.length - 5} more items...
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                      
                      {lowStockItems.length > 0 && (
                        <div className="alert-box">
                          <div className="alert-title">Low Stock Items</div>
                          <p>The following items are running low and should be restocked:</p>
                          <table>
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th>Current Quantity</th>
                                <th>Category</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lowStockItems.slice(0, 5).map((item, index) => (
                                <tr key={index}>
                                  <td>{item.name}</td>
                                  <td>{item.quantity} {item.unit}</td>
                                  <td>{item.category}</td>
                                </tr>
                              ))}
                              {lowStockItems.length > 5 && (
                                <tr>
                                  <td colSpan={3} style={{ textAlign: 'center' }}>
                                    And {lowStockItems.length - 5} more items...
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Recipe Profitability Analysis */}
                  <div className="section page-break">
                    <div className="section-title">Recipe Profitability Analysis</div>
                    
                    <div className="info-box">
                      <div className="info-title">Overall Profitability</div>
                      <p>
                        Total profit from all recipes: 
                        <span className={`${calculateTotalProfit() > 0 ? 'profit-positive' : 'profit-negative'}`}>
                          &nbsp;QAR {calculateTotalProfit().toFixed(2)}
                        </span>
                      </p>
                      <p>
                        Average profit per recipe: 
                        <span className={`${(calculateTotalProfit() / (recipes.length || 1)) > 0 ? 'profit-positive' : 'profit-negative'}`}>
                          &nbsp;QAR {(calculateTotalProfit() / (recipes.length || 1)).toFixed(2)}
                        </span>
                      </p>
                    </div>
                    
                    {getMostProfitableRecipes().length > 0 && (
                      <div className="info-box">
                        <div className="info-title">Most Profitable Recipes</div>
                        <table>
                          <thead>
                            <tr>
                              <th>Recipe</th>
                              <th>Cost</th>
                              <th>Selling Price</th>
                              <th>Profit</th>
                              <th>Profit Margin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getMostProfitableRecipes().map((recipe, index) => {
                              const profit = recipe.sellingPrice! - recipe.totalCost;
                              const profitMargin = (profit / recipe.sellingPrice!) * 100;
                              
                              return (
                                <tr key={index}>
                                  <td>{recipe.name}</td>
                                  <td>QAR {recipe.totalCost.toFixed(2)}</td>
                                  <td>QAR {recipe.sellingPrice!.toFixed(2)}</td>
                                  <td className="profit-positive">QAR {profit.toFixed(2)}</td>
                                  <td>{profitMargin.toFixed(1)}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    
                    {getRecipesNeedingPriceAdjustment().length > 0 && (
                      <div className="info-box">
                        <div className="info-title">Recipes Needing Price Adjustment</div>
                        <table>
                          <thead>
                            <tr>
                              <th>Recipe</th>
                              <th>Cost</th>
                              <th>Current Price</th>
                              <th>Loss</th>
                              <th>Recommended Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getRecipesNeedingPriceAdjustment().map((recipe, index) => {
                              const loss = recipe.totalCost - recipe.sellingPrice!;
                              const recommendedPrice = recipe.totalCost * 1.3; // 30% markup
                              
                              return (
                                <tr key={index}>
                                  <td>{recipe.name}</td>
                                  <td>QAR {recipe.totalCost.toFixed(2)}</td>
                                  <td>QAR {recipe.sellingPrice!.toFixed(2)}</td>
                                  <td className="profit-negative">QAR {loss.toFixed(2)}</td>
                                  <td>QAR {recommendedPrice.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  
                  {/* Recommendations */}
                  <div className="section">
                    <div className="section-title">Recommendations</div>
                    
                    {generateRecommendations().map((recommendation, index) => (
                      <div className="recommendation-box" key={index}>
                        <div className="recommendation-title">{recommendation.title}</div>
                        <p>{recommendation.description}</p>
                      </div>
                    ))}
                    
                    {generateRecommendations().length === 0 && (
                      <div className="info-box">
                        <p>No specific recommendations at this time. The kitchen is operating efficiently.</p>
                      </div>
                    )}
                  </div>
                  
                  {/* All Recipes Summary */}
                  <div className="section page-break">
                    <div className="section-title">All Recipes Summary</div>
                    
                    <table>
                      <thead>
                        <tr>
                          <th>Recipe</th>
                          <th>Cost</th>
                          <th>Selling Price</th>
                          <th>Profit/Loss</th>
                          <th>Servings</th>
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
                              <td>{recipe.servings}</td>
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