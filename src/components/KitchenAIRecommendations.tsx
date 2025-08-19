import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Lightbulb, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Utensils, 
  Trash2, 
  AlertTriangle,
  Brain,
  Sparkles
} from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';

interface KitchenAIRecommendationsProps {
  kitchenId: string;
  kitchenName: string;
  recipes: any[];
  foodSupplies: any[];
}

export function KitchenAIRecommendations({ 
  kitchenId, 
  kitchenName, 
  recipes, 
  foodSupplies 
}: KitchenAIRecommendationsProps) {
  const { t } = useTranslation();
  
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

  // Mock data for AI recommendations
  const profitRecommendations = [
    {
      title: "Adjust pricing strategy",
      description: "Increase prices for high-demand recipes by 10-15% to maximize profit margins.",
      impact: "high",
      potentialSavings: calculateTotalProfit() * 0.15
    },
    {
      title: "Optimize ingredient usage",
      description: "Reduce waste by implementing portion control and standardized recipes.",
      impact: "medium",
      potentialSavings: calculateTotalCost() * 0.08
    },
    {
      title: "Menu engineering",
      description: "Promote high-profit recipes and redesign or replace low-profit items.",
      impact: "medium",
      potentialSavings: calculateTotalProfit() * 0.10
    }
  ];

  const wasteRecommendations = [
    {
      title: "Implement FIFO inventory management",
      description: "Use first-in, first-out inventory management to reduce spoilage.",
      impact: "high",
      potentialSavings: calculateTotalSupplyValue() * 0.05
    },
    {
      title: "Improve storage practices",
      description: "Train staff on proper storage techniques to extend shelf life of perishables.",
      impact: "medium",
      potentialSavings: calculateTotalSupplyValue() * 0.03
    },
    {
      title: "Repurpose excess ingredients",
      description: "Create daily specials using ingredients approaching expiration dates.",
      impact: "medium",
      potentialSavings: calculateTotalSupplyValue() * 0.04
    }
  ];

  const consumptionOptimizations = [
    {
      title: "Seasonal menu adjustments",
      description: "Adjust menu based on seasonal ingredient availability to reduce costs.",
      impact: "medium",
      potentialSavings: calculateTotalCost() * 0.07
    },
    {
      title: "Supplier consolidation",
      description: "Consolidate suppliers to negotiate better prices on frequently used items.",
      impact: "high",
      potentialSavings: calculateTotalSupplyValue() * 0.08
    },
    {
      title: "Portion standardization",
      description: "Implement standardized portions to reduce overconsumption and waste.",
      impact: "medium",
      potentialSavings: calculateTotalCost() * 0.05
    }
  ];

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

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-lg border border-purple-200 dark:border-purple-800/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-full">
            <Brain className="h-5 w-5 text-purple-700 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-purple-900 dark:text-purple-300">
              AI-Powered Kitchen Analysis
            </h2>
            <p className="text-purple-700 dark:text-purple-400 text-sm">
              Intelligent insights and recommendations for {kitchenName}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-purple-100 dark:border-purple-800/20 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Profit Optimization</h3>
            </div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
              +{(calculateTotalProfit() * 0.25).toFixed(0)} QAR
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Potential monthly profit increase
            </p>
            <Progress value={75} className="h-2 bg-green-100 dark:bg-green-900/30" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              75% confidence level
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-purple-100 dark:border-purple-800/20 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Trash2 className="h-5 w-5 text-red-600 dark: text-red-400" />
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Waste Reduction</h3>
            </div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">
              -{(calculateTotalSupplyValue() * 0.12).toFixed(0)} QAR
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Potential monthly waste savings
            </p>
            <Progress value={82} className="h-2 bg-red-100 dark:bg-red-900/30" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              82% confidence level
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-purple-100 dark:border-purple-800/20 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Utensils className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Consumption Optimization</h3>
            </div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
              -{(calculateTotalCost() * 0.15).toFixed(0)} QAR
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Potential monthly consumption savings
            </p>
            <Progress value={68} className="h-2 bg-blue-100 dark:bg-blue-900/30" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              68% confidence level
            </p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profit Recommendations */}
        <Card className="border-green-100 dark:border-green-800/30 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-b border-green-100 dark:border-green-800/30">
            <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-300">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              Profit Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              {profitRecommendations.map((rec, index) => (
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
        
        {/* Waste Recommendations */}
        <Card className="border-red-100 dark:border-red-800/30 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-b border-red-100 dark:border-red-800/30">
            <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-300">
              <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              Waste Reduction
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              {wasteRecommendations.map((rec, index) => (
                <div key={index} className="bg-red-50/50 dark:bg-red-900/10 rounded-lg p-3 border border-red-100 dark:border-red-800/30">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-red-900 dark:text-red-300 flex items-center">
                      <Lightbulb className="h-4 w-4 mr-2 text-red-600 dark:text-red-400" />
                      {rec.title}
                    </h4>
                    <Badge className={getImpactColor(rec.impact)}>
                      {rec.impact} impact
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{rec.description}</p>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Potential Savings:</span>
                    <span className="font-medium text-red-700 dark:text-red-400">
                      QAR {rec.potentialSavings.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Consumption Recommendations */}
        <Card className="border-blue-100 dark:border-blue-800/30 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-b border-blue-100 dark:border-blue-800/30">
            <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-300">
              <Utensils className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Consumption Optimization
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              {consumptionOptimizations.map((rec, index) => (
                <div key={index} className="bg-blue-50/50 dark:bg-blue-900/10 rounded-lg p-3 border border-blue-100 dark:border-blue-800/30">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-blue-900 dark:text-blue-300 flex items-center">
                      <Lightbulb className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                      {rec.title}
                    </h4>
                    <Badge className={getImpactColor(rec.impact)}>
                      {rec.impact} impact
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{rec.description}</p>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Potential Savings:</span>
                    <span className="font-medium text-blue-700 dark:text-blue-400">
                      QAR {rec.potentialSavings.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
        <div className="flex items-center justify-center gap-1">
          <Sparkles className="h-4 w-4 text-purple-500 dark:text-purple-400" />
          <span>AI-powered recommendations are based on your kitchen's historical data and industry benchmarks</span>
        </div>
      </div>
    </div>
  );
}