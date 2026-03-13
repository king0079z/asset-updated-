import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Trash2, 
  AlertTriangle, 
  BarChart3, 
  PieChart,
  Clock,
  DollarSign,
  Lightbulb
} from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';

interface DetailedWasteAnalysisProps {
  foodSupplies: any[];
}

export function DetailedWasteAnalysis({ foodSupplies }: DetailedWasteAnalysisProps) {
  const { t } = useTranslation();
  
  // Calculate total value of food supplies
  const calculateTotalValue = () => {
    return foodSupplies.reduce((sum, item) => sum + (item.quantity * item.pricePerUnit), 0);
  };
  
  // Mock waste data
  const totalWaste = foodSupplies.reduce((sum, item) => sum + (item.totalWasted || 0), 0);
  const wastePercentage = 12.5; // Mock percentage
  const costImpact = calculateTotalValue() * (wastePercentage / 100);
  
  // Get top wasted items with "Refilling" as the only waste reason
  const getTopWastedItems = () => {
    // Filter items with waste and sort by waste value
    return foodSupplies
      .filter(item => item.totalWasted > 0)
      .sort((a, b) => (b.totalWasted * b.pricePerUnit) - (a.totalWasted * a.pricePerUnit))
      .slice(0, 5)
      .map(item => ({
        name: item.name,
        quantity: item.totalWasted,
        unit: item.unit,
        category: item.category,
        cost: item.totalWasted * item.pricePerUnit,
        reason: "Refilling"
      }));
  };
  
  // Waste by reason data - only showing refilling as the reason
  const wasteByReason = [
    { reason: "Refilling", percentage: 100, value: costImpact }
  ];
  
  // Mock waste reduction recommendations
  const wasteReductionRecommendations = [
    {
      title: "Implement FIFO inventory management",
      description: "Use first-in, first-out inventory management to reduce spoilage.",
      impact: "high",
      potentialSavings: costImpact * 0.30
    },
    {
      title: "Improve storage practices",
      description: "Train staff on proper storage techniques to extend shelf life of perishables.",
      impact: "medium",
      potentialSavings: costImpact * 0.20
    },
    {
      title: "Adjust order quantities",
      description: "Order smaller quantities more frequently for highly perishable items.",
      impact: "medium",
      potentialSavings: costImpact * 0.15
    },
    {
      title: "Repurpose excess ingredients",
      description: "Create daily specials using ingredients approaching expiration dates.",
      impact: "medium",
      potentialSavings: costImpact * 0.25
    }
  ];
  
  // Get category color
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      meat: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
      vegetables: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
      dairy: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
      grains: "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
      fruits: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
      beverages: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400"
    };
    
    return colors[category.toLowerCase()] || "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
  };
  
  // Helper function to get impact badge color
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'medium':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'low':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };
  
  const topWastedItems = getTopWastedItems();

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 rounded-lg border border-red-200 dark:border-red-800/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-red-100 dark:bg-red-900/50 p-2 rounded-full">
            <Trash2 className="h-5 w-5 text-red-700 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-red-900 dark:text-red-300">
              Detailed Waste Analysis
            </h2>
            <p className="text-red-700 dark:text-red-400 text-sm">
              Comprehensive breakdown of food waste and reduction opportunities
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-red-100 dark:border-red-800/20 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Total Waste</h3>
            </div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">
              {totalWaste.toFixed(1)} units
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {wastePercentage}% of total inventory
            </p>
            <Progress value={wastePercentage} className="h-2 bg-red-100 dark:bg-red-900/30" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Industry average: 8-10%
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-red-100 dark:border-red-800/20 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-5 w-5 text-red-600 dark:text-red-400" />
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Cost Impact</h3>
            </div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">
              QAR {costImpact.toFixed(0)}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Monthly financial impact
            </p>
            <Progress value={wastePercentage} className="h-2 bg-red-100 dark:bg-red-900/30" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {(costImpact / calculateTotalValue() * 100).toFixed(1)}% of total inventory value
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-red-100 dark:border-red-800/20 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Potential Savings</h3>
            </div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
              QAR {(costImpact * 0.70).toFixed(0)}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Achievable monthly savings
            </p>
            <Progress value={70} className="h-2 bg-green-100 dark:bg-green-900/30" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              70% of current waste can be eliminated
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Wasted Items */}
          <Card className="border-red-100 dark:border-red-800/30 shadow-sm">
            <CardHeader className="pb-3 bg-white dark:bg-gray-800/50 border-b border-red-100 dark:border-red-800/30">
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <BarChart3 className="h-5 w-5 text-red-600 dark:text-red-400" />
                Top Wasted Items
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {topWastedItems.map((item, index) => (
                  <div key={index} className="bg-red-50/50 dark:bg-red-900/10 rounded-lg p-3 border border-red-100 dark:border-red-800/30">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">{item.name}</h4>
                      <Badge className={getCategoryColor(item.category)}>
                        {item.category}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Quantity Wasted</p>
                        <p className="text-sm font-medium">
                          {item.quantity} {item.unit}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cost Impact</p>
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">
                          QAR {item.cost.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Primary Reason</p>
                      <p className="text-sm">{item.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Waste by Reason */}
          <Card className="border-red-100 dark:border-red-800/30 shadow-sm">
            <CardHeader className="pb-3 bg-white dark:bg-gray-800/50 border-b border-red-100 dark:border-red-800/30">
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <PieChart className="h-5 w-5 text-red-600 dark:text-red-400" />
                Waste by Reason
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {wasteByReason.map((item, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item.reason}</span>
                      <span className="text-sm font-medium">
                        {item.percentage}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 dark:bg-red-600" 
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>QAR {item.value.toFixed(0)} impact</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Waste Reduction Recommendations */}
        <Card className="border-green-100 dark:border-green-800/30 shadow-sm mt-6">
          <CardHeader className="pb-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-b border-green-100 dark:border-green-800/30">
            <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-300">
              <Lightbulb className="h-5 w-5 text-green-600 dark:text-green-400" />
              Waste Reduction Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {wasteReductionRecommendations.map((rec, index) => (
                <div key={index} className="bg-green-50/50 dark:bg-green-900/10 rounded-lg p-3 border border-green-100 dark:border-green-800/30">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-green-900 dark:text-green-300 flex items-center">
                      <Lightbulb className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                      {rec.title}
                    </h4>
                    <Badge className={getImpactColor(rec.impact)}>
                      {rec.impact} impact
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{rec.description}</p>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Potential Savings:</span>
                    <span className="font-medium text-green-700 dark:text-green-400">
                      QAR {rec.potentialSavings.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}