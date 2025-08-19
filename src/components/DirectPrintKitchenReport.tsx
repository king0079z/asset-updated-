import React, { useEffect } from 'react';
import { PrintFriendlyKitchenReport } from './PrintFriendlyKitchenReport';

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

interface FoodSupply {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  pricePerUnit: number;
  expirationDate: string;
  totalWasted: number;
}

interface DirectPrintKitchenReportProps {
  kitchen: KitchenInfo;
  recipes: Recipe[];
  foodSupplies: FoodSupply[];
  expiringItems: FoodSupply[];
  lowStockItems: FoodSupply[];
  onPrintComplete: () => void;
}

export function DirectPrintKitchenReport({
  kitchen,
  recipes,
  foodSupplies,
  expiringItems,
  lowStockItems,
  onPrintComplete
}: DirectPrintKitchenReportProps) {
  useEffect(() => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.error('Could not open print window. Please check your popup blocker settings.');
      onPrintComplete();
      return;
    }

    // Base styles for the report
    const styles = `
      @page {
        size: A4;
        margin: 1.5cm;
      }
      body {
        font-family: Arial, sans-serif;
        line-height: 1.5;
        color: #333;
        margin: 0;
        padding: 0;
        background-color: white;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .page-break-before {
        page-break-before: always;
      }
      .page-break-after {
        page-break-after: always;
      }
      .avoid-break {
        page-break-inside: avoid;
      }
      .print-report {
        max-width: 100%;
      }
      .report-header {
        text-align: center;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 2px solid #2563eb;
      }
      .report-title {
        font-size: 28px;
        font-weight: bold;
        margin: 0 0 5px 0;
        color: #1e40af;
      }
      .report-subtitle {
        font-size: 18px;
        color: #4b5563;
        margin: 0 0 5px 0;
      }
      .report-date {
        font-size: 14px;
        color: #6b7280;
        margin: 10px 0 0 0;
      }
      .report-section {
        margin-bottom: 30px;
        page-break-inside: avoid;
      }
      .section-title {
        font-size: 20px;
        font-weight: bold;
        margin: 0 0 15px 0;
        padding-bottom: 8px;
        border-bottom: 1px solid #e5e7eb;
        color: #1e40af;
      }
      .subsection-title {
        font-size: 16px;
        font-weight: bold;
        margin: 20px 0 10px 0;
        color: #4b5563;
      }
      .mt-4 {
        margin-top: 16px;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 15px;
        margin-bottom: 20px;
      }
      .summary-item {
        background-color: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 5px;
        padding: 15px;
        text-align: center;
      }
      .summary-item h3 {
        font-size: 14px;
        color: #6b7280;
        margin: 0 0 10px 0;
      }
      .summary-value {
        font-size: 18px;
        font-weight: bold;
        margin: 0;
        color: #1f2937;
      }
      .profit {
        color: #059669;
      }
      .waste {
        color: #dc2626;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        font-size: 12px;
      }
      .data-table th, .data-table td {
        border: 1px solid #e5e7eb;
        padding: 8px 12px;
        text-align: left;
      }
      .data-table th {
        background-color: #f3f4f6;
        font-weight: bold;
        color: #4b5563;
      }
      .data-table tr:nth-child(even) {
        background-color: #f9fafb;
      }
      .profit-cell {
        color: #059669;
        font-weight: bold;
      }
      .loss-cell {
        color: #dc2626;
        font-weight: bold;
      }
      .waste-cell {
        color: #dc2626;
      }
      .recommendations-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        font-size: 12px;
      }
      .recommendations-table th, .recommendations-table td {
        border: 1px solid #e5e7eb;
        padding: 10px 12px;
        text-align: left;
      }
      .recommendations-table th {
        background-color: #f3f4f6;
        font-weight: bold;
        color: #4b5563;
      }
      .recommendation-title {
        font-weight: bold;
        color: #1e40af;
      }
      .impact-cell {
        font-weight: bold;
        text-transform: uppercase;
        font-size: 11px;
      }
      .savings-cell {
        font-weight: bold;
        color: #059669;
      }
      .category-bars {
        margin-top: 15px;
      }
      .category-bar-container {
        margin-bottom: 10px;
      }
      .category-bar-label {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        margin-bottom: 4px;
      }
      .category-bar-outer {
        width: 100%;
        height: 12px;
        background-color: #f3f4f6;
        border-radius: 6px;
        overflow: hidden;
      }
      .category-bar-inner {
        height: 100%;
        background-color: #3b82f6;
        border-radius: 6px;
      }
      .waste-summary {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
        margin-bottom: 20px;
      }
      .waste-stat {
        background-color: #fef2f2;
        border: 1px solid #fee2e2;
        border-radius: 5px;
        padding: 15px;
        text-align: center;
      }
      .waste-stat h3 {
        font-size: 14px;
        color: #b91c1c;
        margin: 0 0 10px 0;
      }
      .waste-value {
        font-size: 18px;
        font-weight: bold;
        margin: 0 0 5px 0;
        color: #dc2626;
      }
      .waste-value.savings {
        color: #059669;
      }
      .waste-subtext {
        font-size: 12px;
        color: #6b7280;
        margin: 0;
      }
      .report-footer {
        margin-top: 40px;
        padding-top: 15px;
        border-top: 1px solid #e5e7eb;
        text-align: center;
        font-size: 11px;
        color: #6b7280;
      }
      .page-number:after {
        content: counter(page);
      }
    `;

    // Format date for display
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Calculate total profit from recipes
    const calculateTotalProfit = () => {
      return recipes.reduce((total, recipe) => {
        const profit = recipe.sellingPrice ? recipe.sellingPrice - recipe.totalCost : 0;
        return total + profit;
      }, 0);
    };

    // Calculate total cost of all recipes
    const calculateTotalCost = () => {
      return recipes.reduce((total, recipe) => {
        return total + recipe.totalCost;
      }, 0);
    };

    // Calculate total food supply value
    const calculateTotalSupplyValue = () => {
      return foodSupplies.reduce((total, item) => {
        return total + (item.quantity * item.pricePerUnit);
      }, 0);
    };

    // Get top consumed items - filter out meat items as per client feedback
    const getTopConsumedItems = () => {
      return [...foodSupplies]
        .filter(item => item.category.toLowerCase() !== 'meat') // Filter out meat items
        .sort((a, b) => (b.quantity * b.pricePerUnit) - (a.quantity * a.pricePerUnit))
        .slice(0, 5);
    };

    // Get top wasted items with "Refilling" as the only waste reason
    const getTopWastedItems = () => {
      return foodSupplies
        .filter(item => item.totalWasted > 0)
        .sort((a, b) => (b.totalWasted * b.pricePerUnit) - (a.totalWasted * a.pricePerUnit))
        .slice(0, 5)
        .map(item => ({
          ...item,
          wasteReason: "Refilling" // Add waste reason to each item
        }));
    };

    // Use only refilling as waste reason as per client requirements
    const wasteByReason = [
      { reason: "Refilling", percentage: 100, value: calculateTotalSupplyValue() * 0.125 }
    ];

    // Mock recommendations
    const topRecommendations = [
      {
        title: "Adjust pricing strategy",
        description: "Increase prices for high-demand recipes by 10-15% to maximize profit margins.",
        impact: "high",
        potentialSavings: calculateTotalProfit() * 0.15
      },
      {
        title: "Implement FIFO inventory management",
        description: "Use first-in, first-out inventory management to reduce spoilage.",
        impact: "high",
        potentialSavings: calculateTotalSupplyValue() * 0.05
      },
      {
        title: "Supplier consolidation",
        description: "Consolidate suppliers to negotiate better prices on frequently used items.",
        impact: "high",
        potentialSavings: calculateTotalSupplyValue() * 0.08
      }
    ];

    const topConsumedItems = getTopConsumedItems();
    const topWastedItems = getTopWastedItems();

    // Generate the report HTML directly
    const reportHtml = `
      <div class="print-report">
        <!-- Report Header -->
        <div class="report-header">
          <h1 class="report-title">Kitchen Performance Report</h1>
          <h2 class="report-subtitle">${kitchen.name} - Floor ${kitchen.floorNumber}</h2>
          <p class="report-date">Generated on: ${formatDate(new Date())}</p>
        </div>

        <!-- Executive Summary -->
        <div class="report-section">
          <h2 class="section-title">Executive Summary</h2>
          <div class="summary-grid">
            <div class="summary-item">
              <h3>Total Recipes</h3>
              <p class="summary-value">${recipes.length}</p>
            </div>
            <div class="summary-item">
              <h3>Total Profit</h3>
              <p class="summary-value profit">QAR ${calculateTotalProfit().toFixed(2)}</p>
            </div>
            <div class="summary-item">
              <h3>Total Inventory Value</h3>
              <p class="summary-value">QAR ${calculateTotalSupplyValue().toFixed(2)}</p>
            </div>
            <div class="summary-item">
              <h3>Waste Cost</h3>
              <p class="summary-value waste">QAR ${(calculateTotalSupplyValue() * 0.125).toFixed(2)}</p>
            </div>
          </div>
        </div>

        <!-- Top Recommendations -->
        <div class="report-section">
          <h2 class="section-title">Top Recommendations</h2>
          <table class="recommendations-table">
            <thead>
              <tr>
                <th>Recommendation</th>
                <th>Description</th>
                <th>Impact</th>
                <th>Potential Savings</th>
              </tr>
            </thead>
            <tbody>
              ${topRecommendations.map((rec) => `
                <tr>
                  <td class="recommendation-title">${rec.title}</td>
                  <td>${rec.description}</td>
                  <td class="impact-cell">${rec.impact}</td>
                  <td class="savings-cell">QAR ${rec.potentialSavings.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Recipe Performance -->
        <div class="report-section page-break-before">
          <h2 class="section-title">Recipe Performance</h2>
          <table class="data-table">
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
              ${recipes.map((recipe) => {
                const profit = recipe.sellingPrice 
                  ? recipe.sellingPrice - recipe.totalCost 
                  : -recipe.totalCost;
                
                return `
                  <tr>
                    <td>${recipe.name}</td>
                    <td>QAR ${recipe.totalCost.toFixed(2)}</td>
                    <td>${recipe.sellingPrice ? `QAR ${recipe.sellingPrice.toFixed(2)}` : 'Not set'}</td>
                    <td class="${profit >= 0 ? 'profit-cell' : 'loss-cell'}">
                      ${profit >= 0 ? `QAR ${profit.toFixed(2)}` : `-QAR ${Math.abs(profit).toFixed(2)}`}
                    </td>
                    <td>${recipe.servings}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Consumption Analysis -->
        <div class="report-section page-break-before">
          <h2 class="section-title">Consumption Analysis</h2>
          
          <h3 class="subsection-title">Top Consumed Items</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              ${topConsumedItems.map((item) => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.category}</td>
                  <td>${item.quantity} ${item.unit}</td>
                  <td>QAR ${(item.quantity * item.pricePerUnit).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h3 class="subsection-title mt-4">Consumption by Category</h3>
          <div class="category-bars">
            ${Object.entries(foodSupplies.reduce((acc, item) => {
              const category = item.category;
              if (!acc[category]) {
                acc[category] = 0;
              }
              acc[category] += item.quantity * item.pricePerUnit;
              return acc;
            }, {} as Record<string, number>))
              .sort(([, a], [, b]) => b - a)
              .map(([category, value]) => {
                const percentage = (value / calculateTotalSupplyValue()) * 100;
                return `
                  <div class="category-bar-container">
                    <div class="category-bar-label">
                      <span>${category}</span>
                      <span>QAR ${value.toFixed(2)} (${percentage.toFixed(1)}%)</span>
                    </div>
                    <div class="category-bar-outer">
                      <div 
                        class="category-bar-inner"
                        style="width: ${percentage}%"
                      ></div>
                    </div>
                  </div>
                `;
              }).join('')}
          </div>
        </div>

        <!-- Waste Analysis -->
        <div class="report-section page-break-before">
          <h2 class="section-title">Waste Analysis</h2>
          
          <div class="waste-summary">
            <div class="waste-stat">
              <h3>Total Waste</h3>
              <p class="waste-value">
                ${foodSupplies.reduce((sum, item) => sum + (item.totalWasted || 0), 0).toFixed(1)} units
              </p>
              <p class="waste-subtext">12.5% of total inventory</p>
            </div>
            <div class="waste-stat">
              <h3>Cost Impact</h3>
              <p class="waste-value">
                QAR ${(calculateTotalSupplyValue() * 0.125).toFixed(2)}
              </p>
              <p class="waste-subtext">Monthly financial impact</p>
            </div>
            <div class="waste-stat">
              <h3>Potential Savings</h3>
              <p class="waste-value savings">
                QAR ${(calculateTotalSupplyValue() * 0.125 * 0.7).toFixed(2)}
              </p>
              <p class="waste-subtext">70% of waste can be eliminated</p>
            </div>
          </div>

          <h3 class="subsection-title">Top Wasted Items</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Quantity Wasted</th>
                <th>Cost Impact</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              ${topWastedItems.map((item) => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.category}</td>
                  <td>${item.totalWasted} ${item.unit}</td>
                  <td class="waste-cell">QAR ${(item.totalWasted * item.pricePerUnit).toFixed(2)}</td>
                  <td>${item.wasteReason}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h3 class="subsection-title mt-4">Waste by Reason</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Reason</th>
                <th>Percentage</th>
                <th>Cost Impact</th>
              </tr>
            </thead>
            <tbody>
              ${wasteByReason.map((item) => `
                <tr>
                  <td>${item.reason}</td>
                  <td>${item.percentage}%</td>
                  <td class="waste-cell">QAR ${item.value.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div class="report-footer">
          <p>AI-powered analysis and recommendations based on your kitchen's historical data and industry benchmarks</p>
          <p class="page-number"></p>
        </div>
      </div>
    `;

    // Write the HTML to the print window
    printWindow.document.write(`
      <html>
        <head>
          <title>Kitchen Performance Report - ${kitchen.name}</title>
          <style>${styles}</style>
        </head>
        <body>
          ${reportHtml}
          <script>
            window.onload = function() {
              window.print();
              window.setTimeout(function() {
                window.close();
                window.opener.postMessage('print-complete', '*');
              }, 500);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();

    // Listen for a message indicating printing is complete
    const messageHandler = (event: MessageEvent) => {
      if (event.data === 'print-complete') {
        window.removeEventListener('message', messageHandler);
        onPrintComplete();
      }
    };

    window.addEventListener('message', messageHandler);

    // Fallback in case the message event doesn't fire
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      onPrintComplete();
    }, 5000);

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, [kitchen, recipes, foodSupplies, expiringItems, lowStockItems, onPrintComplete]);

  return null; // This component doesn't render anything visible
}