// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { RecipeDetailsDialog } from "@/components/RecipeDetailsDialog";
import { EditRecipeDialog } from "@/components/EditRecipeDialog";
import { EnhancedRecipeManagementDialog } from "@/components/EnhancedRecipeManagementDialog";
import { RecipeBarcodeDialog } from "@/components/RecipeBarcodeDialog";
import { PrintRecipeReportButton } from "@/components/PrintRecipeReportButton";
import { RefillFoodSupplyDialog } from "@/components/RefillFoodSupplyDialog";
import { useTranslation } from "@/contexts/TranslationContext";
import { useAuth } from '@/contexts/AuthContext';
import { ChefHat, Clock, Users, DollarSign, Utensils, AlertCircle, Search, Filter, Barcode, RefreshCw } from "lucide-react";

interface RecipeIngredientFood {
  id: string;
  type: 'food';
  foodSupplyId: string;
  name: string;
  quantity: number;
  unit: string;
  cost: number;
  wastePercentage?: number;
}

interface RecipeIngredientSubrecipe {
  id: string;
  type: 'subrecipe';
  subRecipeId: string;
  subRecipeName: string;
  quantity: number;
  cost: number;
}

type RecipeIngredient = RecipeIngredientFood | RecipeIngredientSubrecipe;

interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  prepTime: number;
  ingredients: RecipeIngredient[];
  instructions: string;
  totalCost: number;
  costPerServing: number;
  sellingPrice?: number;
  usageCount?: number;
  lastUsed?: string;
  isSubrecipe?: boolean;
}

interface RecipesTabProps {
  kitchenId?: string;
}

export function RecipesTab({ kitchenId }: RecipesTabProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [kitchens, setKitchens] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeDetailsOpen, setRecipeDetailsOpen] = useState(false);
  const [recipeDetailsLoading, setRecipeDetailsLoading] = useState(false);
  const [editRecipeOpen, setEditRecipeOpen] = useState(false);
  const [serveDialogOpen, setServeDialogOpen] = useState(false);
  const [servingsCount, setServingsCount] = useState('1');
  const [selectedKitchen, setSelectedKitchen] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'main' | 'subrecipe'>('all');

  // State for EnhancedRecipeManagementDialog
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);
  const [subrecipeDialogOpen, setSubrecipeDialogOpen] = useState(false);

  // Build a mapping of subrecipeId -> subrecipe object for quick lookup
  const [subrecipeMap, setSubrecipeMap] = useState<{ [id: string]: Recipe }>({});
  // Build a mapping of main recipe id -> array of subrecipe objects it uses
  const [mainRecipeLinks, setMainRecipeLinks] = useState<{ [id: string]: RecipeIngredientSubrecipe[] }>({});
  // Store food supplies for waste calculations
  const [foodSupplies, setFoodSupplies] = useState<any[]>([]);

  // Utility function to calculate total waste amount for a recipe
  const calculateTotalWasteAmount = (recipe: Recipe) => {
    return recipe.ingredients
      .filter((ing): ing is RecipeIngredientFood => ing.type === 'food' && typeof ing.wastePercentage === 'number' && ing.wastePercentage > 0)
      .reduce((sum, ing) => {
        // Find the food supply to get the price per unit
        const foodSupply = foodSupplies.find(fs => fs.id === ing.foodSupplyId);
        const pricePerUnit = foodSupply ? foodSupply.pricePerUnit : 0;
        // Calculate waste amount: quantity * waste percentage * price per unit
        const wasteAmount = ing.quantity * ((ing.wastePercentage || 0) / 100) * pricePerUnit;
        return sum + wasteAmount;
      }, 0);
  };

  // Utility function to check for insufficient or expired ingredients (recursive for subrecipes)
  const checkIngredientIssues = (recipe: Recipe, servings = 1, checkedSubrecipes = new Set<string>()) => {
    let issues: { name: string; reason: string; required?: number; available?: number; expired?: boolean }[] = [];
    for (const ing of recipe.ingredients) {
      if (ing.type === 'food') {
        const food = foodSupplies.find(fs => fs.id === (ing as RecipeIngredientFood).foodSupplyId);
        const requiredQty = (ing.quantity || 0) * servings;
        if (!food) {
          issues.push({ name: ing.name, reason: 'not_found' });
        } else {
          // Check expiry
          const expired = food.expirationDate && new Date(food.expirationDate) < new Date();
          if (expired) {
            issues.push({ name: ing.name, reason: 'expired', expired: true });
          }
          // Check quantity
          if (food.quantity < requiredQty) {
            issues.push({ name: ing.name, reason: 'insufficient', required: requiredQty, available: food.quantity });
          }
        }
      } else if (ing.type === 'subrecipe') {
        // Prevent infinite recursion
        if (!checkedSubrecipes.has((ing as RecipeIngredientSubrecipe).subRecipeId)) {
          checkedSubrecipes.add((ing as RecipeIngredientSubrecipe).subRecipeId);
          const sub = subrecipeMap[(ing as RecipeIngredientSubrecipe).subRecipeId];
          if (sub) {
            // Multiply by quantity used in main recipe
            const subIssues = checkIngredientIssues(sub, (ing.quantity || 1) * servings, checkedSubrecipes);
            issues = issues.concat(subIssues);
          }
        }
      }
    }
    return issues;
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch recipes - if kitchenId is provided, fetch recipes for that kitchen
        const recipesUrl = kitchenId ? `/api/recipes?kitchenId=${kitchenId}` : '/api/recipes';
        const recipesResponse = await fetch(recipesUrl);
        if (recipesResponse.ok) {
          const recipesData: Recipe[] = await recipesResponse.json();
          setRecipes(recipesData);

          // Build subrecipe map and main recipe links
          const subMap: { [id: string]: Recipe } = {};
          const mainLinks: { [id: string]: RecipeIngredientSubrecipe[] } = {};
          for (const recipe of recipesData) {
            if (recipe.isSubrecipe) {
              subMap[recipe.id] = recipe;
            }
          }
          for (const recipe of recipesData) {
            if (!recipe.isSubrecipe) {
              // Find subrecipe ingredients
              const subLinks = recipe.ingredients.filter(
                (ing): ing is RecipeIngredientSubrecipe => ing.type === 'subrecipe'
              );
              mainLinks[recipe.id] = subLinks;
            }
          }
          setSubrecipeMap(subMap);
          setMainRecipeLinks(mainLinks);
        } else {
          console.error('Failed to fetch recipes');
        }

        // Fetch kitchens
        const kitchensResponse = await fetch('/api/kitchens');
        if (kitchensResponse.ok) {
          const kitchensData = await kitchensResponse.json();
          setKitchens(kitchensData);
          // If kitchenId is provided, use it as the selected kitchen
          if (kitchenId) {
            setSelectedKitchen(kitchenId);
          } else if (kitchensData.length > 0) {
            setSelectedKitchen(kitchensData[0].id);
          }
        } else {
          console.error('Failed to fetch kitchens');
        }

        // Fetch food supplies for waste calculations
        const foodSuppliesResponse = await fetch('/api/food-supply');
        if (foodSuppliesResponse.ok) {
          const foodSuppliesData = await foodSuppliesResponse.json();
          setFoodSupplies(foodSuppliesData);
        } else {
          console.error('Failed to fetch food supplies');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: t('error'),
          description: t('failed_to_load_data'),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [t, toast, kitchenId]);

  // Fetch full recipe details before opening dialog
  const handleViewRecipe = async (recipe: Recipe) => {
    setRecipeDetailsLoading(true);
    setRecipeDetailsOpen(true);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedRecipe({
          ...data,
          // fallback for missing fields
          id: data.id,
          name: data.name,
          description: data.description,
          servings: data.servings,
          prepTime: data.prepTime,
          usageCount: data.usageCount || 0,
          lastUsed: data.lastUsed || new Date().toISOString(),
          ingredients: data.ingredients || [],
          instructions: data.instructions,
          totalCost: data.totalCost,
          costPerServing: data.costPerServing,
          sellingPrice: data.sellingPrice,
          isSubrecipe: data.isSubrecipe,
          totalWasteAmount: data.totalWasteAmount,
          kitchenBreakdown: data.kitchenBreakdown,
        });
      } else {
        toast({
          title: t('error'),
          description: t('failed_to_load_recipe_details'),
          variant: "destructive",
        });
        setSelectedRecipe(recipe); // fallback to summary
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: t('failed_to_load_recipe_details'),
        variant: "destructive",
      });
      setSelectedRecipe(recipe); // fallback to summary
    } finally {
      setRecipeDetailsLoading(false);
    }
  };

  const handleServeClick = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setServingsCount('1');
    setServeDialogOpen(true);
  };
  
  const handleEditClick = (recipe: Recipe, e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); // Prevent triggering the card click (view recipe)
    setSelectedRecipe(recipe);
    setEditRecipeOpen(true);
  };

  const handleRegenerateAllBarcodes = async () => {
    if (isRegeneratingAll) return;
    
    setIsRegeneratingAll(true);
    try {
      const response = await fetch('/api/recipes/regenerate-all-barcodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate barcodes');
      }

      const data = await response.json();
      
      // Refresh recipes list
      const recipesUrl = kitchenId ? `/api/recipes?kitchenId=${kitchenId}` : '/api/recipes';
      const recipesResponse = await fetch(recipesUrl);
      if (recipesResponse.ok) {
        const recipesData = await recipesResponse.json();
        setRecipes(recipesData);
      }
      
      toast({
        title: t('success'),
        description: data.message || t('recipe_barcodes_regenerated'),
      });
      
    } catch (error) {
      console.error('Error regenerating all barcodes:', error);
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_regenerate_barcodes'),
        variant: "destructive",
      });
    } finally {
      setIsRegeneratingAll(false);
    }
  };

  const handleServeSubmit = async () => {
    if (!selectedRecipe || !selectedKitchen) {
      toast({
        title: t('error'),
        description: t('please_select_kitchen'),
        variant: "destructive",
      });
      return;
    }

    const servings = parseInt(servingsCount);
    if (isNaN(servings) || servings <= 0) {
      toast({
        title: t('error'),
        description: t('please_enter_valid_servings'),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/recipes/use', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipeId: selectedRecipe.id,
          kitchenId: selectedKitchen,
          notes: `Used recipe: ${selectedRecipe.name} (${servings} servings)`,
          servingsUsed: servings,
          forceUse: false
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle insufficient ingredients error
        if (errorData.insufficientIngredients) {
          toast({
            title: t('insufficient_ingredients'),
            description: t('not_enough_ingredients_for_recipe'),
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(errorData.error || 'Failed to use recipe');
      }

      // Success
      toast({
        title: t('success'),
        description: t('recipe_used_successfully'),
      });

      // Close dialog
      setServeDialogOpen(false);
      
      // Refresh recipes list
      const recipesUrl = kitchenId ? `/api/recipes?kitchenId=${kitchenId}` : '/api/recipes';
      const recipesResponse = await fetch(recipesUrl);
      if (recipesResponse.ok) {
        const recipesData = await recipesResponse.json();
        setRecipes(recipesData);
      }
      
      // Dispatch event to refresh consumption data
      const consumptionEvent = new CustomEvent('food-consumption-recorded', {
        detail: { 
          recipeId: selectedRecipe.id,
          recipeName: selectedRecipe.name,
          timestamp: new Date().toISOString()
        }
      });
      window.dispatchEvent(consumptionEvent);
      
    } catch (error) {
      console.error('Error using recipe:', error);
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_use_recipe'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // State for ingredient issue dialog
  const [ingredientIssueDialog, setIngredientIssueDialog] = useState<{
    open: boolean;
    recipe: Recipe | null;
    issues: { name: string; reason: string; required?: number; available?: number; expired?: boolean }[];
  }>({ open: false, recipe: null, issues: [] });

  // State for refill dialog
  const [refillDialogState, setRefillDialogState] = useState<{
    open: boolean;
    item: any;
  }>({ open: false, item: null });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('recipe_management')}</CardTitle>
              <CardDescription>{kitchenId ? t('manage_and_use_recipes_for_this_kitchen') : t('manage_and_use_recipes')}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="default"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setRecipeDialogOpen(true)}
              >
                <ChefHat className="h-4 w-4 mr-2" />
                {t('add_recipe') || 'Add Recipe'}
              </Button>
              <Button
                variant="outline"
                className="border-green-600 text-green-700"
                onClick={() => setSubrecipeDialogOpen(true)}
              >
                <ChefHat className="h-4 w-4 mr-2" />
                {t('add_subrecipe') || 'Add Subrecipe'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : recipes.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <div className="bg-muted/50 inline-flex rounded-full p-3 mb-4">
                <ChefHat className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">{t('no_recipes_found')}</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {t('create_your_first_recipe_to_get_started')}
              </p>
              <p className="text-muted-foreground max-w-md mx-auto mt-2 mb-6">
                {t('use_the_add_recipe_button_at_the_top')}
              </p>
              <Button variant="default">
                <ChefHat className="h-4 w-4 mr-2" />
                {t('create_first_recipe')}
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                    {t('all')}: {recipes.length}
                  </Badge>
                  <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                    {t('popular')}: {recipes.filter(r => (r.usageCount || 0) > 5).length}
                  </Badge>
                  {recipes.some(recipe => !recipe.id.startsWith('RCP-')) && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="ml-2 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                      onClick={handleRegenerateAllBarcodes}
                      disabled={isRegeneratingAll}
                    >
                      {isRegeneratingAll ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-amber-700 mr-2"></div>
                          {t('updating')}...
                        </>
                      ) : (
                        <>
                          <Barcode className="h-3.5 w-3.5 mr-1.5" />
                          {t('update_all_barcodes')}
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={t('search_recipes')} 
                      className="pl-9 h-10 w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  <Button
                    variant={filterType === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterType(f => f === 'all' ? 'main' : f === 'main' ? 'subrecipe' : 'all')}
                    title={`Filter: ${filterType}`}
                  >
                    <Filter className="h-3.5 w-3.5 mr-1.5" />
                    {filterType === 'all' ? t('all') : filterType === 'main' ? t('main_recipes') || 'Main' : t('subrecipes') || 'Subrecipes'}
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recipes
                  .filter(r => {
                    const q = searchQuery.trim().toLowerCase();
                    const matchesSearch = !q ||
                      r.name.toLowerCase().includes(q) ||
                      (r.description || '').toLowerCase().includes(q) ||
                      r.ingredients.some(ing =>
                        ing.type === 'food' ? (ing as RecipeIngredientFood).name.toLowerCase().includes(q) : false
                      );
                    const matchesFilter =
                      filterType === 'all' ||
                      (filterType === 'main' && !r.isSubrecipe) ||
                      (filterType === 'subrecipe' && r.isSubrecipe);
                    return matchesSearch && matchesFilter;
                  })
                  .map((recipe) => {
                  const ingredientIssues = checkIngredientIssues(recipe, 1, new Set());
                  const hasIssues = ingredientIssues.length > 0;
                  return (
                  <div key={recipe.id} className="relative">
                    <Card
                      className={
                        `hover:shadow-md transition-all overflow-hidden border-t-4 ` +
                        (recipe.isSubrecipe
                          ? 'border-t-purple-600 bg-purple-50 dark:bg-purple-900/10'
                          : 'border-t-amber-500') +
                        (hasIssues ? ' ring-2 ring-red-500' : '')
                      }
                    >
                      <CardContent className="p-0">
                        <div 
                          className="cursor-pointer p-4 pb-2" 
                          onClick={() => handleViewRecipe(recipe)}
                        >
                          <div className="flex justify-between items-start">
                            <h3 className="font-medium text-lg flex items-center gap-2">
                              {recipe.name}
                              {recipe.isSubrecipe && (
                                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-semibold">
                                  <ChefHat className="h-3 w-3 mr-1" /> Subrecipe
                                </span>
                              )}
                              {hasIssues && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-semibold">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  {t('ingredient_issue') || 'Ingredient Issue'}
                                </span>
                              )}
                            </h3>
                            <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                              QAR {recipe.costPerServing.toFixed(2)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{recipe.description}</p>
                        </div>
                        
                        {!recipe.isSubrecipe && (
                          <div className="grid grid-cols-3 border-y">
                            <div className="flex flex-col items-center justify-center py-2 px-1 text-center border-r">
                              <Users className="h-4 w-4 text-muted-foreground mb-1" />
                              <span className="text-sm font-medium">{recipe.servings}</span>
                              <span className="text-xs text-muted-foreground">{t('servings')}</span>
                            </div>
                            <div className="flex flex-col items-center justify-center py-2 px-1 text-center border-r">
                              <Clock className="h-4 w-4 text-muted-foreground mb-1" />
                              <span className="text-sm font-medium">{recipe.prepTime}</span>
                              <span className="text-xs text-muted-foreground">{t('min')}</span>
                            </div>
                            <div className="flex flex-col items-center justify-center py-2 px-1 text-center">
                              <DollarSign className="h-4 w-4 text-muted-foreground mb-1" />
                              <span className="text-sm font-medium">{recipe.totalCost.toFixed(0)}</span>
                              <span className="text-xs text-muted-foreground">QAR</span>
                            </div>
                          </div>
                        )}
                        
                        <div className="p-3">
                          <div className="flex flex-wrap gap-1 mb-3">
                            {recipe.ingredients
                              .filter((ing) => ing.type === 'food')
                              .slice(0, 3)
                              .map((ing) => (
                                <Badge key={ing.id} variant="secondary" className="text-xs">
                                  {(ing as RecipeIngredientFood).name}
                                </Badge>
                              ))}
                            {recipe.ingredients.filter((ing) => ing.type === 'food').length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{recipe.ingredients.filter((ing) => ing.type === 'food').length - 3} {t('more')}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Show subrecipes used by this main recipe */}
                          {!recipe.isSubrecipe && mainRecipeLinks[recipe.id] && mainRecipeLinks[recipe.id].length > 0 && (
                            <div className="mb-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-purple-700 flex items-center">
                                  <ChefHat className="h-3 w-3 mr-1" />
                                  {t('uses_subrecipes') || 'Uses Subrecipes'}
                                </span>
                                <span className="h-1 w-1 rounded-full bg-purple-400"></span>
                              </div>
                              <div className="flex flex-wrap gap-2 pl-2 relative">
                                {/* SVG lines: vertical from main card to each subrecipe mini-card */}
                                {mainRecipeLinks[recipe.id].map((sub, idx) => (
                                  <div key={sub.subRecipeId} className="relative flex items-center">
                                    <div className="w-2 h-6 flex flex-col items-center justify-center">
                                      <svg width="2" height="24" className="absolute left-1/2 top-0" style={{zIndex:0}}>
                                        <line x1="1" y1="0" x2="1" y2="24" stroke="#a78bfa" strokeWidth="2" />
                                      </svg>
                                    </div>
                                    <div
                                      className="rounded-lg border border-purple-300 bg-purple-50 dark:bg-purple-900/20 px-3 py-1 flex items-center gap-1 text-xs font-medium text-purple-800 dark:text-purple-200 shadow-sm"
                                      style={{ zIndex: 1 }}
                                    >
                                      <ChefHat className="h-3 w-3 mr-1" />
                                      {sub.subRecipeName}
                                      <span className="ml-1 text-[10px] text-purple-500">x{sub.quantity}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex justify-between items-center">
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-muted-foreground"
                                onClick={() => handleViewRecipe(recipe)}
                              >
                                {t('details')}
                              </Button>
                              <PrintRecipeReportButton
                                recipe={{
                                  ...recipe,
                                  totalWasteAmount: calculateTotalWasteAmount(recipe),
                                }}
                              />
                              {!recipe.isSubrecipe && (
                                <>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-blue-600"
                                    onClick={(e) => handleEditClick(recipe, e)}
                                  >
                                    {t('edit')}
                                  </Button>
                                  <RecipeBarcodeDialog 
                                    recipe={recipe} 
                                    onRecipeUpdate={(updatedRecipe) => {
                                      // Update the recipe in the local state
                                      setRecipes(prevRecipes => 
                                        prevRecipes.map(r => 
                                          r.id === recipe.id ? { ...r, id: updatedRecipe.id } : r
                                        )
                                      );
                                    }}
                                  />
                                </>
                              )}
                            </div>
                            {!recipe.isSubrecipe && (
                              <Button 
                                onClick={() => {
                                  if (hasIssues) {
                                    // Show error dialog instead of serve dialog
                                    setSelectedRecipe(recipe);
                                    setServeDialogOpen(false);
                                    setTimeout(() => {
                                      setIngredientIssueDialog({
                                        open: true,
                                        recipe,
                                        issues: ingredientIssues,
                                      });
                                    }, 50);
                                  } else {
                                    handleServeClick(recipe);
                                  }
                                }}
                                className="bg-amber-500 hover:bg-amber-600 text-white"
                                size="sm"
                              >
                                <Utensils className="h-4 w-4 mr-2" />
                                {t('serve')}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )})}
              </div>
              {recipes.filter(r => {
                const q = searchQuery.trim().toLowerCase();
                const matchesSearch = !q || r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q);
                const matchesFilter = filterType === 'all' || (filterType === 'main' && !r.isSubrecipe) || (filterType === 'subrecipe' && r.isSubrecipe);
                return matchesSearch && matchesFilter;
              }).length === 0 && (searchQuery || filterType !== 'all') && (
                <div className="text-center py-10 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No recipes match your search.</p>
                  <button className="text-xs underline mt-1" onClick={() => { setSearchQuery(''); setFilterType('all'); }}>Clear filters</button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recipe Details Dialog */}
      {/* Recipe Details Dialog */}
      <Dialog open={recipeDetailsOpen} onOpenChange={setRecipeDetailsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
          {recipeDetailsLoading || !selectedRecipe ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mb-4"></div>
              <div className="text-amber-700 font-medium">{t('loading_recipe_details') || 'Loading recipe details...'}</div>
            </div>
          ) : (
            <RecipeDetailsDialog
              open={true}
              onOpenChange={setRecipeDetailsOpen}
              recipe={selectedRecipe}
              foodSupplies={foodSupplies}
              onEditClick={() => {
                setRecipeDetailsOpen(false);
                setEditRecipeOpen(true);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Recipe Dialog */}
      {selectedRecipe && (
        <EditRecipeDialog
          open={editRecipeOpen}
          onOpenChange={setEditRecipeOpen}
          recipe={{
            ...selectedRecipe,
            sellingPrice: selectedRecipe.sellingPrice || 0
          }}
          onRecipeUpdated={() => {
            // Refresh recipes list after update
            const fetchRecipes = async () => {
              try {
                const recipesUrl = kitchenId ? `/api/recipes?kitchenId=${kitchenId}` : '/api/recipes';
                const response = await fetch(recipesUrl);
                if (response.ok) {
                  const data = await response.json();
                  setRecipes(data);
                }
              } catch (error) {
                console.error('Error fetching recipes:', error);
              }
            };
            fetchRecipes();
          }}
        />
      )}

      {/* Serve Recipe Dialog */}
      <Dialog open={serveDialogOpen} onOpenChange={setServeDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('serve_recipe')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <h3 className="font-medium">{selectedRecipe?.name}</h3>
              <p className="text-sm text-muted-foreground">{selectedRecipe?.description}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="servings">{t('number_of_servings')}</Label>
              <Input
                id="servings"
                type="number"
                min="1"
                value={servingsCount}
                onChange={(e) => setServingsCount(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                {t('standard_recipe_serves')} {selectedRecipe?.servings} {t('people')}
              </p>
            </div>
            
            {/* If kitchenId is provided, use it directly; otherwise show kitchen selector */}
            {kitchenId ? (
              <input type="hidden" id="kitchen" value={kitchenId} />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="kitchen">{t('select_kitchen')}</Label>
                <select
                  id="kitchen"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={selectedKitchen}
                  onChange={(e) => setSelectedKitchen(e.target.value)}
                >
                  {kitchens.map((kitchen) => (
                    <option key={kitchen.id} value={kitchen.id}>
                      {kitchen.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="bg-amber-50 p-3 rounded-md flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div className="text-sm text-amber-800">
                {t('serving_this_recipe_will_deduct_ingredients')}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServeDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button 
              onClick={handleServeSubmit} 
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Utensils className="h-4 w-4 mr-2" />
              )}
              {t('submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ingredient Issue Dialog */}
      <Dialog open={ingredientIssueDialog.open} onOpenChange={open => setIngredientIssueDialog(d => ({ ...d, open }))}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{t('cannot_serve_recipe')}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="mb-2 text-red-700 font-semibold flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {t('the_following_ingredients_have_issues')}
            </div>
            <ul className="list-disc pl-6 text-sm mb-2">
              {ingredientIssueDialog.issues.map((issue, idx) => (
                <li key={idx}>
                  <span className="font-medium">{issue.name}</span>
                  {issue.reason === 'insufficient' && (
                    <>: {t('insufficient_quantity')} ({t('required')}: {issue.required}, {t('available')}: {issue.available})</>
                  )}
                  {issue.reason === 'expired' && (
                    <>: {t('expired')}</>
                  )}
                  {issue.reason === 'not_found' && (
                    <>: {t('not_found')}</>
                  )}
                  {/* Actionable button for refill/replace */}
                  {issue.reason !== 'not_found' && (
                    <span className="ml-2">
                      <Button
                        size="xs"
                        variant="outline"
                        className="border-blue-500 text-blue-700"
                        onClick={() => {
                          // Try to find the food supply in local state
                          const food = foodSupplies.find(fs => fs.name === issue.name || fs.id === issue.foodSupplyId);
                          if (food) {
                            setRefillDialogState({
                              open: true,
                              item: {
                                id: food.id,
                                name: food.name,
                                quantity: food.quantity,
                                unit: food.unit,
                                expirationDate: new Date(food.expirationDate),
                                isExpired: food.expirationDate && new Date(food.expirationDate) < new Date(),
                              }
                            });
                          } else {
                            // Fallback: redirect to food supply page with highlight param
                            window.location.href = `/food-supply?highlight=${encodeURIComponent(issue.foodSupplyId || '')}`;
                          }
                        }}
                      >
                        {t('refill_or_replace')}
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIngredientIssueDialog(d => ({ ...d, open: false }))}>
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refill Food Supply Dialog */}
      <RefillFoodSupplyDialog
        open={!!refillDialogState?.open}
        onOpenChange={open => setRefillDialogState(s => ({ ...s, open }))}
        item={refillDialogState?.item || {
          id: '',
          name: '',
          quantity: 0,
          unit: '',
          expirationDate: new Date(),
          isExpired: false,
        }}
        onRefill={async ({ id, newQuantity, newExpirationDate, disposedQuantity }) => {
          // Call API to update food supply
          try {
            const res = await fetch('/api/food-supply/refill', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id,
                newQuantity,
                newExpirationDate,
                disposedQuantity,
              }),
            });
            if (!res.ok) throw new Error('Failed to refill food supply');
            // Refresh food supplies
            const foodSuppliesResponse = await fetch('/api/food-supply');
            if (foodSuppliesResponse.ok) {
              const foodSuppliesData = await foodSuppliesResponse.json();
              setFoodSupplies(foodSuppliesData);
            }
            setRefillDialogState({ open: false, item: null });
            toast({
              title: t('success'),
              description: t('food_supply_refilled'),
            });
          } catch (error) {
            toast({
              title: t('error'),
              description: t('failed_to_refill_food_supply'),
              variant: "destructive",
            });
          }
        }}
      />
    {/* Add Recipe Dialog */}
    <EnhancedRecipeManagementDialog
      kitchenId={kitchenId}
      open={recipeDialogOpen}
      onOpenChange={setRecipeDialogOpen}
      subrecipeMode={false}
    />
    {/* Add Subrecipe Dialog */}
    <EnhancedRecipeManagementDialog
      kitchenId={kitchenId}
      open={subrecipeDialogOpen}
      onOpenChange={setSubrecipeDialogOpen}
      subrecipeMode={true}
    />
  </div>
  );
}