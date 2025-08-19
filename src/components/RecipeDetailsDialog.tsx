import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Clock, DollarSign, ChefHat, Barcode } from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";
import { RecipeBarcodeDialog } from "./RecipeBarcodeDialog";
import { PrintRecipeReportButton } from "./PrintRecipeReportButton";

interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  wastePercentage?: number;
  type?: string;
  foodSupplyId?: string;
}

interface KitchenBreakdownEntry {
  kitchenId: string;
  kitchenName: string;
  usageCount: number;
  totalCost: number;
  totalWaste: number;
  totalSellingPrice: number;
  totalProfit: number;
  ingredientWaste?: number;
}

interface Recipe {
  id: string;
  name: string;
  description?: string;
  servings: number;
  prepTime?: number;
  usageCount: number;
  lastUsed: string;
  ingredients: RecipeIngredient[];
  instructions?: string;
  sellingPrice?: number;
  totalCost?: number;
  costPerServing?: number;
  isSubrecipe?: boolean;
  totalWasteAmount?: number;
  kitchenBreakdown?: KitchenBreakdownEntry[];
}

interface RecipeDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: Recipe | null;
  foodSupplies?: any[];
  onEditClick?: () => void;
}

export function RecipeDetailsDialog({
  open,
  onOpenChange,
  recipe,
  foodSupplies = [],
  onEditClick
}: RecipeDetailsDialogProps) {
  const { t } = useTranslation();

  if (!recipe) return null;

  // Calculate total waste amount if not provided
  const totalWasteAmount = recipe.totalWasteAmount !== undefined 
    ? recipe.totalWasteAmount 
    : recipe.ingredients
        .filter(ing => ing.type === 'food' && typeof ing.wastePercentage === 'number' && ing.wastePercentage > 0)
        .reduce((sum, ing) => {
          const foodSupply = foodSupplies.find(fs => fs.id === ing.foodSupplyId);
          const pricePerUnit = foodSupply ? foodSupply.pricePerUnit : 0;
          const wasteAmount = ing.quantity * ((ing.wastePercentage || 0) / 100) * pricePerUnit;
          return sum + wasteAmount;
        }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center">
            <ChefHat className="h-5 w-5 mr-2 text-amber-500" />
            {recipe.name}
          </DialogTitle>
          <DialogDescription>
            {recipe.description || t('no_description_available')}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center justify-center p-3 bg-amber-50 dark:bg-amber-950/40 rounded-md">
                <Users className="h-5 w-5 mb-1 text-amber-600 dark:text-amber-400" />
                <span className="font-medium">{recipe.servings}</span>
                <span className="text-xs text-muted-foreground">{t('servings')}</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 bg-amber-50 dark:bg-amber-950/40 rounded-md">
                <Clock className="h-5 w-5 mb-1 text-amber-600 dark:text-amber-400" />
                <span className="font-medium">{recipe.prepTime || '-'}</span>
                <span className="text-xs text-muted-foreground">{t('minutes')}</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 bg-amber-50 dark:bg-amber-950/40 rounded-md">
                <DollarSign className="h-5 w-5 mb-1 text-amber-600 dark:text-amber-400" />
                <span className="font-medium">{recipe.usageCount}</span>
                <span className="text-xs text-muted-foreground">{t('times_used')}</span>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-3 text-lg flex items-center">
                <span className="bg-amber-100 dark:bg-amber-900/30 w-6 h-6 inline-flex items-center justify-center rounded-full mr-2 text-amber-800 dark:text-amber-300">1</span>
                {t('ingredients')}
              </h3>
              <div className="space-y-2 pl-8">
                {recipe.ingredients.map((ing, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm p-2 bg-slate-50 dark:bg-slate-800/50 rounded-md">
                    <span className="font-medium">{ing.name}</span>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                      {ing.quantity} {ing.unit}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
            
            {recipe.instructions && (
              <div>
                <h3 className="font-medium mb-3 text-lg flex items-center">
                  <span className="bg-amber-100 dark:bg-amber-900/30 w-6 h-6 inline-flex items-center justify-center rounded-full mr-2 text-amber-800 dark:text-amber-300">2</span>
                  {t('instructions')}
                </h3>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-md text-sm whitespace-pre-line pl-8">
                  {recipe.instructions}
                </div>
              </div>
            )}
            
            <div>
              <h3 className="font-medium mb-3 text-lg flex items-center">
                <span className="bg-amber-100 dark:bg-amber-900/30 w-6 h-6 inline-flex items-center justify-center rounded-full mr-2 text-amber-800 dark:text-amber-300">3</span>
                {t('cost_information')}
              </h3>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-md text-sm pl-8">
                {recipe.totalCost !== undefined && (
                  <p className="mb-2">
                    <span className="font-medium">{t('total_cost')}: </span>
                    QAR {recipe.totalCost.toFixed(2)}
                  </p>
                )}
                {recipe.costPerServing !== undefined && (
                  <p className="mb-2">
                    <span className="font-medium">{t('cost_per_serving')}: </span>
                    QAR {recipe.costPerServing.toFixed(2)}
                  </p>
                )}
                {/* Show total waste amount */}
                <p className="mb-2">
                  <span className="font-medium">{t('total_waste_amount') || 'Total Waste Amount'}: </span>
                  <span className="text-amber-700 dark:text-amber-400">
                    QAR {totalWasteAmount.toFixed(2)}
                  </span>
                </p>
                {recipe.sellingPrice !== undefined && recipe.sellingPrice > 0 && (
                  <p className="mb-2">
                    <span className="font-medium">{t('selling_price')}: </span>
                    QAR {recipe.sellingPrice.toFixed(2)}
                  </p>
                )}
                {recipe.sellingPrice !== undefined && recipe.totalCost !== undefined && recipe.sellingPrice > 0 && (
                  <p className={recipe.sellingPrice > recipe.totalCost ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                    <span className="font-medium">{t('profit')}: </span>
                    QAR {(recipe.sellingPrice - recipe.totalCost).toFixed(2)}
                  </p>
                )}
                {/* Net after waste (selling price - total waste) - only for main recipes */}
                {!recipe.isSubrecipe && recipe.sellingPrice !== undefined && recipe.sellingPrice > 0 && (
                  <p className="mb-2">
                    <span className="font-medium">{t('net_after_waste') || 'Net After Waste'}: </span>
                    <span className="text-amber-700 dark:text-amber-400">
                      QAR {(recipe.sellingPrice - totalWasteAmount).toFixed(2)}
                    </span>
                  </p>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-3 text-lg flex items-center">
                <span className="bg-amber-100 dark:bg-amber-900/30 w-6 h-6 inline-flex items-center justify-center rounded-full mr-2 text-amber-800 dark:text-amber-300">4</span>
                {t('usage_information')}
              </h3>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-md text-sm pl-8">
                <p className="mb-2">
                  <span className="font-medium">{t('last_used')}: </span>
                  {new Date(recipe.lastUsed).toLocaleDateString()}
                </p>
                <p>
                  <span className="font-medium">{t('total_usage')}: </span>
                  {recipe.usageCount} {t('times')}
                </p>
              </div>
              {/* Kitchen breakdown */}
              {recipe.kitchenBreakdown && recipe.kitchenBreakdown.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2 text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-amber-500" />
                    {t('kitchen_breakdown') || 'Kitchen Breakdown'}
                  </h4>
                  <div className="overflow-x-auto rounded-lg border bg-white dark:bg-slate-900/60 shadow-sm">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200">
                          <th className="p-2 text-left">{t('kitchen') || 'Kitchen'}</th>
                          <th className="p-2 text-left">{t('times_used') || 'Times Used'}</th>
                          <th className="p-2 text-left">{t('total_cost') || 'Total Cost'}</th>
                          <th className="p-2 text-left">{t('total_waste') || 'Total Waste'}</th>
                          <th className="p-2 text-left">{t('total_selling_price') || 'Total Selling Price'}</th>
                          <th className="p-2 text-left">{t('total_profit') || 'Total Profit'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipe.kitchenBreakdown.map((entry, idx) => (
                          <tr
                            key={entry.kitchenId}
                            className={
                              "border-t " +
                              (idx % 2 === 0
                                ? "bg-slate-50 dark:bg-slate-800/40"
                                : "bg-white dark:bg-slate-900/30") +
                              " hover:bg-amber-100/60 dark:hover:bg-amber-900/40 transition"
                            }
                          >
                            <td className="p-2 font-medium flex items-center gap-2">
                              <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                <Users className="h-3 w-3 mr-1" /> {entry.kitchenName}
                              </Badge>
                            </td>
                            <td className="p-2">{entry.usageCount}</td>
                            <td className="p-2">QAR {entry.totalCost?.toFixed(2) ?? '0.00'}</td>
                            <td className="p-2">QAR {entry.totalWaste?.toFixed(2) ?? '0.00'}</td>
                            <td className="p-2">QAR {entry.totalSellingPrice?.toFixed(2) ?? '0.00'}</td>
                            <td className="p-2">
                              {entry.totalProfit !== undefined
                                ? (
                                  <Badge
                                    variant="outline"
                                    className={
                                      entry.totalProfit >= 0
                                        ? "bg-green-50 text-green-700 border-green-200"
                                        : "bg-red-50 text-red-700 border-red-200"
                                    }
                                  >
                                    {entry.totalProfit >= 0 ? "▲" : "▼"} QAR {entry.totalProfit.toFixed(2)}
                                  </Badge>
                                )
                                : 'QAR 0.00'}
                            </td>
                          </tr>
                        ))}
                        {/* Summary row */}
                        <tr className="border-t bg-amber-50/80 dark:bg-amber-900/30 font-semibold">
                          <td className="p-2">{t('total') || 'Total'}</td>
                          <td className="p-2">
                            {recipe.kitchenBreakdown.reduce((sum, k) => sum + (k.usageCount || 0), 0)}
                          </td>
                          <td className="p-2">
                            QAR {recipe.kitchenBreakdown.reduce((sum, k) => sum + (k.totalCost || 0), 0).toFixed(2)}
                          </td>
                          <td className="p-2">
                            QAR {recipe.kitchenBreakdown.reduce((sum, k) => sum + (k.totalWaste || 0), 0).toFixed(2)}
                          </td>
                          <td className="p-2">
                            QAR {recipe.kitchenBreakdown.reduce((sum, k) => sum + (k.totalSellingPrice || 0), 0).toFixed(2)}
                          </td>
                          <td className="p-2">
                            <Badge
                              variant="outline"
                              className={
                                recipe.kitchenBreakdown.reduce((sum, k) => sum + (k.totalProfit || 0), 0) >= 0
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                              }
                            >
                              {recipe.kitchenBreakdown.reduce((sum, k) => sum + (k.totalProfit || 0), 0) >= 0 ? "▲" : "▼"} QAR {recipe.kitchenBreakdown.reduce((sum, k) => sum + (k.totalProfit || 0), 0).toFixed(2)}
                            </Badge>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
        
        <DialogFooter className="pt-4 border-t mt-4 flex flex-wrap gap-2 justify-between items-center">
          <div className="flex gap-2">
            <RecipeBarcodeDialog 
              recipe={recipe} 
              onRecipeUpdate={(updatedRecipe) => {
                // If the recipe ID changes, close this dialog
                // The parent component will handle the update
                if (updatedRecipe.id !== recipe.id) {
                  onOpenChange(false);
                }
              }}
            />
            <PrintRecipeReportButton recipe={recipe} />
          </div>
          {onEditClick && (
            <Button onClick={onEditClick} className="bg-blue-600 hover:bg-blue-700">
              {t('edit_recipe')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}