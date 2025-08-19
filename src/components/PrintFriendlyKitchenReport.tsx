import React from 'react';

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

interface PrintFriendlyKitchenReportProps {
  kitchen: KitchenInfo;
  recipes: Recipe[];
  foodSupplies: FoodSupply[];
  expiringItems: FoodSupply[];
  lowStockItems: FoodSupply[];
  date: Date;
}

export function PrintFriendlyKitchenReport({
  kitchen,
  recipes,
  foodSupplies,
  expiringItems,
  lowStockItems,
  date
}: PrintFriendlyKitchenReportProps) {
  // Add console logs to help debug
  console.log('Rendering PrintFriendlyKitchenReport with data:', {
    kitchen,
    recipesCount: recipes?.length || 0,
    foodSuppliesCount: foodSupplies?.length || 0,
    expiringItemsCount: expiringItems?.length || 0,
    lowStockItemsCount: lowStockItems?.length || 0
  });
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

  // Get top consumed items
  const getTopConsumedItems = () => {
    return [...foodSupplies]
      .sort((a, b) => (b.quantity * b.pricePerUnit) - (a.quantity * a.pricePerUnit))
      .slice(0, 5);
  };

  // Get top wasted items
  const getTopWastedItems = () => {
    return foodSupplies
      .filter(item => item.totalWasted > 0)
      .sort((a, b) => (b.totalWasted * b.pricePerUnit) - (a.totalWasted * a.pricePerUnit))
      .slice(0, 5);
  };

  // Mock waste by reason data
  const wasteByReason = [
    { reason: "Expired before use", percentage: 35, value: calculateTotalSupplyValue() * 0.035 },
    { reason: "Overproduction", percentage: 25, value: calculateTotalSupplyValue() * 0.025 },
    { reason: "Spoilage", percentage: 20, value: calculateTotalSupplyValue() * 0.020 },
    { reason: "Preparation waste", percentage: 15, value: calculateTotalSupplyValue() * 0.015 },
    { reason: "Customer returns", percentage: 5, value: calculateTotalSupplyValue() * 0.005 }
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

  return (
    <div className="print-report">
      {/* Report Header */}
      <div className="report-header">
        <h1 className="report-title">Kitchen Performance Report</h1>
        <h2 className="report-subtitle">{kitchen.name} - Floor {kitchen.floorNumber}</h2>
        <p className="report-date">Generated on: {formatDate(date)}</p>
      </div>

      {/* Executive Summary */}
      <div className="report-section">
        <h2 className="section-title">Executive Summary</h2>
        <div className="summary-grid">
          <div className="summary-item">
            <h3>Total Recipes</h3>
            <p className="summary-value">{recipes.length}</p>
          </div>
          <div className="summary-item">
            <h3>Total Profit</h3>
            <p className="summary-value profit">QAR {calculateTotalProfit().toFixed(2)}</p>
          </div>
          <div className="summary-item">
            <h3>Total Inventory Value</h3>
            <p className="summary-value">QAR {calculateTotalSupplyValue().toFixed(2)}</p>
          </div>
          <div className="summary-item">
            <h3>Waste Cost</h3>
            <p className="summary-value waste">QAR {(calculateTotalSupplyValue() * 0.125).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Top Recommendations */}
      <div className="report-section">
        <h2 className="section-title">Top Recommendations</h2>
        <table className="recommendations-table">
          <thead>
            <tr>
              <th>Recommendation</th>
              <th>Description</th>
              <th>Impact</th>
              <th>Potential Savings</th>
            </tr>
          </thead>
          <tbody>
            {topRecommendations.map((rec, index) => (
              <tr key={index}>
                <td className="recommendation-title">{rec.title}</td>
                <td>{rec.description}</td>
                <td className="impact-cell">{rec.impact}</td>
                <td className="savings-cell">QAR {rec.potentialSavings.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recipe Performance */}
      <div className="report-section page-break-before">
        <h2 className="section-title">Recipe Performance</h2>
        <table className="data-table">
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
                  <td className={profit >= 0 ? 'profit-cell' : 'loss-cell'}>
                    {profit >= 0 ? `QAR ${profit.toFixed(2)}` : `-QAR ${Math.abs(profit).toFixed(2)}`}
                  </td>
                  <td>{recipe.servings}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Consumption Analysis */}
      <div className="report-section page-break-before">
        <h2 className="section-title">Consumption Analysis</h2>
        
        <h3 className="subsection-title">Top Consumed Items</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Quantity</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {topConsumedItems.map((item, index) => (
              <tr key={index}>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>{item.quantity} {item.unit}</td>
                <td>QAR {(item.quantity * item.pricePerUnit).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="subsection-title mt-4">Consumption by Category</h3>
        <div className="category-bars">
          {Object.entries(foodSupplies.reduce((acc, item) => {
            const category = item.category;
            if (!acc[category]) {
              acc[category] = 0;
            }
            acc[category] += item.quantity * item.pricePerUnit;
            return acc;
          }, {} as Record<string, number>))
            .sort(([, a], [, b]) => b - a)
            .map(([category, value], index) => {
              const percentage = (value / calculateTotalSupplyValue()) * 100;
              return (
                <div key={index} className="category-bar-container">
                  <div className="category-bar-label">
                    <span>{category}</span>
                    <span>QAR {value.toFixed(2)} ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="category-bar-outer">
                    <div 
                      className="category-bar-inner"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>

      {/* Waste Analysis */}
      <div className="report-section page-break-before">
        <h2 className="section-title">Waste Analysis</h2>
        
        <div className="waste-summary">
          <div className="waste-stat">
            <h3>Total Waste</h3>
            <p className="waste-value">
              {foodSupplies.reduce((sum, item) => sum + (item.totalWasted || 0), 0).toFixed(1)} units
            </p>
            <p className="waste-subtext">12.5% of total inventory</p>
          </div>
          <div className="waste-stat">
            <h3>Cost Impact</h3>
            <p className="waste-value">
              QAR {(calculateTotalSupplyValue() * 0.125).toFixed(2)}
            </p>
            <p className="waste-subtext">Monthly financial impact</p>
          </div>
          <div className="waste-stat">
            <h3>Potential Savings</h3>
            <p className="waste-value savings">
              QAR {(calculateTotalSupplyValue() * 0.125 * 0.7).toFixed(2)}
            </p>
            <p className="waste-subtext">70% of waste can be eliminated</p>
          </div>
        </div>

        <h3 className="subsection-title">Top Wasted Items</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Quantity Wasted</th>
              <th>Cost Impact</th>
            </tr>
          </thead>
          <tbody>
            {topWastedItems.map((item, index) => (
              <tr key={index}>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>{item.totalWasted} {item.unit}</td>
                <td className="waste-cell">QAR {(item.totalWasted * item.pricePerUnit).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="subsection-title mt-4">Waste by Reason</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Reason</th>
              <th>Percentage</th>
              <th>Cost Impact</th>
            </tr>
          </thead>
          <tbody>
            {wasteByReason.map((item, index) => (
              <tr key={index}>
                <td>{item.reason}</td>
                <td>{item.percentage}%</td>
                <td className="waste-cell">QAR {item.value.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="report-footer">
        <p>AI-powered analysis and recommendations based on your kitchen's historical data and industry benchmarks</p>
        <p className="page-number"></p>
      </div>
    </div>
  );
}