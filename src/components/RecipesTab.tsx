// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';

// Module-level cache so previously fetched recipe details are reused across renders
const recipeDetailsCache = new Map<string, any>();
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

  // O(1) lookup map built once whenever foodSupplies changes
  const foodSuppliesMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const fs of foodSupplies) m.set(fs.id, fs);
    return m;
  }, [foodSupplies]);

  // Utility function to calculate total waste amount for a recipe
  const calculateTotalWasteAmount = (recipe: Recipe) => {
    return recipe.ingredients
      .filter((ing): ing is RecipeIngredientFood => ing.type === 'food' && typeof ing.wastePercentage === 'number' && ing.wastePercentage > 0)
      .reduce((sum, ing) => {
        const foodSupply = foodSuppliesMap.get(ing.foodSupplyId);
        const pricePerUnit = foodSupply ? foodSupply.pricePerUnit : 0;
        return sum + ing.quantity * ((ing.wastePercentage || 0) / 100) * pricePerUnit;
      }, 0);
  };

  // Utility function to check for insufficient or expired ingredients (recursive for subrecipes)
  const checkIngredientIssues = (recipe: Recipe, servings = 1, checkedSubrecipes = new Set<string>()) => {
    let issues: { name: string; reason: string; required?: number; available?: number; expired?: boolean }[] = [];
    for (const ing of recipe.ingredients) {
      if (ing.type === 'food') {
        const food = foodSuppliesMap.get((ing as RecipeIngredientFood).foodSupplyId);
        const requiredQty = (ing.quantity || 0) * servings;
        if (!food) {
          issues.push({ name: ing.name, reason: 'not_found' });
        } else {
          const expired = food.expirationDate && new Date(food.expirationDate) < new Date();
          if (expired) issues.push({ name: ing.name, reason: 'expired', expired: true });
          if (food.quantity < requiredQty) {
            issues.push({ name: ing.name, reason: 'insufficient', required: requiredQty, available: food.quantity });
          }
        }
      } else if (ing.type === 'subrecipe') {
        if (!checkedSubrecipes.has((ing as RecipeIngredientSubrecipe).subRecipeId)) {
          checkedSubrecipes.add((ing as RecipeIngredientSubrecipe).subRecipeId);
          const sub = subrecipeMap[(ing as RecipeIngredientSubrecipe).subRecipeId];
          if (sub) {
            issues = issues.concat(checkIngredientIssues(sub, (ing.quantity || 1) * servings, checkedSubrecipes));
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
        const recipesUrl = kitchenId ? `/api/recipes?kitchenId=${kitchenId}` : '/api/recipes';

        // Fire all 3 fetches in parallel instead of sequentially
        const [recipesResponse, kitchensResponse, foodSuppliesResponse] = await Promise.all([
          fetch(recipesUrl),
          fetch('/api/kitchens'),
          fetch('/api/food-supply'),
        ]);

        // Process recipes
        if (recipesResponse.ok) {
          const recipesData: Recipe[] = await recipesResponse.json();
          setRecipes(recipesData);

          const subMap: { [id: string]: Recipe } = {};
          const mainLinks: { [id: string]: RecipeIngredientSubrecipe[] } = {};
          for (const recipe of recipesData) {
            if (recipe.isSubrecipe) subMap[recipe.id] = recipe;
          }
          for (const recipe of recipesData) {
            if (!recipe.isSubrecipe) {
              mainLinks[recipe.id] = recipe.ingredients.filter(
                (ing): ing is RecipeIngredientSubrecipe => ing.type === 'subrecipe'
              );
            }
          }
          setSubrecipeMap(subMap);
          setMainRecipeLinks(mainLinks);
        }

        // Process kitchens
        if (kitchensResponse.ok) {
          const kitchensData = await kitchensResponse.json();
          setKitchens(kitchensData);
          if (kitchenId) {
            setSelectedKitchen(kitchenId);
          } else if (kitchensData.length > 0) {
            setSelectedKitchen(kitchensData[0].id);
          }
        }

        // Process food supplies
        if (foodSuppliesResponse.ok) {
          const foodSuppliesData = await foodSuppliesResponse.json();
          setFoodSupplies(foodSuppliesData);
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

  // Fetch full recipe details before opening dialog — uses module-level cache
  const handleViewRecipe = async (recipe: Recipe) => {
    setRecipeDetailsOpen(true);

    // Return immediately from cache if already fetched
    if (recipeDetailsCache.has(recipe.id)) {
      setSelectedRecipe(recipeDetailsCache.get(recipe.id));
      setRecipeDetailsLoading(false);
      return;
    }

    setRecipeDetailsLoading(true);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`);
      if (res.ok) {
        const data = await res.json();
        const enriched = {
          ...data,
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
        };
        recipeDetailsCache.set(recipe.id, enriched);
        setSelectedRecipe(enriched);
      } else {
        toast({ title: t('error'), description: t('failed_to_load_recipe_details'), variant: "destructive" });
        setSelectedRecipe(recipe);
      }
    } catch {
      toast({ title: t('error'), description: t('failed_to_load_recipe_details'), variant: "destructive" });
      setSelectedRecipe(recipe);
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

  const mainRecipeCount = recipes.filter(r => !r.isSubrecipe).length;
  const subrecipeCount = recipes.filter(r => r.isSubrecipe).length;
  const popularCount = recipes.filter(r => (r.usageCount || 0) > 5).length;

  return (
    <div className="space-y-5">
      {/* ── Hero Header ── */}
      <div className="relative rounded-2xl overflow-hidden ring-1 ring-border/60 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-600 to-orange-600" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative z-10 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30 shadow-inner flex-shrink-0">
              <ChefHat className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t('recipe_management') || 'Recipe Management'}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white ring-1 ring-white/30">
                  {mainRecipeCount} recipes
                </span>
                {subrecipeCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-purple-400/30 px-2.5 py-0.5 text-xs font-semibold text-white ring-1 ring-purple-300/30">
                    {subrecipeCount} subrecipes
                  </span>
                )}
                {popularCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-emerald-400/30 px-2.5 py-0.5 text-xs font-semibold text-white ring-1 ring-emerald-300/30">
                    {popularCount} popular
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border-0 ring-1 ring-white/30 backdrop-blur-sm gap-1.5"
              onClick={() => setRecipeDialogOpen(true)}
            >
              <ChefHat className="h-3.5 w-3.5" />
              {t('add_recipe') || 'Add Recipe'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 gap-1.5"
              onClick={() => setSubrecipeDialogOpen(true)}
            >
              <ChefHat className="h-3.5 w-3.5" />
              {t('add_subrecipe') || 'Add Subrecipe'}
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-0 ring-1 ring-border/60 shadow-sm">
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="rounded-2xl border border-border/60 overflow-hidden animate-pulse">
                  <div className="h-1 w-full bg-gradient-to-r from-amber-300 to-orange-300" />
                  <div className="p-4 space-y-3">
                    <div className="h-5 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div className="h-10 bg-muted rounded-xl" />
                      <div className="h-10 bg-muted rounded-xl" />
                      <div className="h-10 bg-muted rounded-xl" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <div className="h-8 bg-muted rounded flex-1" />
                      <div className="h-8 bg-muted rounded flex-1" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : recipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-amber-200/60 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-950/10 text-center">
              <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <ChefHat className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-base font-semibold mb-1">{t('no_recipes_found')}</h3>
              <p className="text-sm text-muted-foreground max-w-xs mb-5">
                {t('create_your_first_recipe_to_get_started') || 'Create your first recipe to start tracking production, costs, and ingredient usage.'}
              </p>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                onClick={() => setRecipeDialogOpen(true)}
              >
                <ChefHat className="h-4 w-4" />
                {t('create_first_recipe') || 'Create First Recipe'}
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
                  const isPopular = (recipe.usageCount || 0) > 5;
                  return (
                  <div key={recipe.id} className="relative">
                    <div
                      className={`rounded-2xl border overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer ${
                        recipe.isSubrecipe
                          ? 'border-purple-200 dark:border-purple-800/40 bg-purple-50/40 dark:bg-purple-950/10'
                          : hasIssues
                          ? 'border-red-200 dark:border-red-800/40 bg-red-50/20 dark:bg-red-950/5 ring-1 ring-red-300/50 dark:ring-red-700/30'
                          : 'border-border bg-card hover:border-amber-200 dark:hover:border-amber-800/40'
                      }`}
                      onClick={() => handleViewRecipe(recipe)}
                    >
                      {/* Top accent bar */}
                      <div className={`h-1 w-full bg-gradient-to-r ${
                        recipe.isSubrecipe
                          ? 'from-purple-500 to-violet-500'
                          : hasIssues
                          ? 'from-red-500 to-rose-500'
                          : 'from-amber-500 to-orange-500'
                      }`} />

                      <div className="p-4">
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-sm leading-tight truncate">{recipe.name}</h3>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {recipe.isSubrecipe && (
                                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 gap-0.5">
                                  <ChefHat className="h-2.5 w-2.5" /> Subrecipe
                                </span>
                              )}
                              {isPopular && !recipe.isSubrecipe && (
                                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 gap-0.5">
                                  ★ Popular
                                </span>
                              )}
                              {hasIssues && (
                                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 gap-0.5">
                                  <AlertCircle className="h-2.5 w-2.5" /> Issue
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                              QAR {recipe.costPerServing.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {recipe.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{recipe.description}</p>
                        )}

                        {/* Stats strip */}
                        {!recipe.isSubrecipe && (
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            <div className="flex flex-col items-center rounded-xl bg-muted/40 py-2 px-1">
                              <Users className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
                              <span className="text-sm font-bold tabular-nums">{recipe.servings}</span>
                              <span className="text-[10px] text-muted-foreground">{t('servings')}</span>
                            </div>
                            <div className="flex flex-col items-center rounded-xl bg-muted/40 py-2 px-1">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
                              <span className="text-sm font-bold tabular-nums">{recipe.prepTime || '—'}</span>
                              <span className="text-[10px] text-muted-foreground">{t('min')}</span>
                            </div>
                            <div className="flex flex-col items-center rounded-xl bg-muted/40 py-2 px-1">
                              <DollarSign className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
                              <span className="text-sm font-bold tabular-nums">{recipe.totalCost.toFixed(0)}</span>
                              <span className="text-[10px] text-muted-foreground">QAR</span>
                            </div>
                          </div>
                        )}
                        {/* Ingredient pills */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {recipe.ingredients
                            .filter((ing) => ing.type === 'food')
                            .slice(0, 3)
                            .map((ing) => (
                              <span key={ing.id} className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {(ing as RecipeIngredientFood).name}
                              </span>
                            ))}
                          {recipe.ingredients.filter((ing) => ing.type === 'food').length > 3 && (
                            <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              +{recipe.ingredients.filter((ing) => ing.type === 'food').length - 3} {t('more')}
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          
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

                          {/* Action buttons */}
                          <div className="flex items-center gap-1 pt-1" onClick={e => e.stopPropagation()}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => { e.stopPropagation(); handleViewRecipe(recipe); }}
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
                                  variant="ghost" 
                                  size="sm"
                                  className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                                  onClick={(e) => handleEditClick(recipe, e)}
                                >
                                  {t('edit')}
                                </Button>
                                <RecipeBarcodeDialog 
                                  recipe={recipe} 
                                  onRecipeUpdate={(updatedRecipe) => {
                                    setRecipes(prevRecipes => 
                                      prevRecipes.map(r => 
                                        r.id === recipe.id ? { ...r, id: updatedRecipe.id } : r
                                      )
                                    );
                                  }}
                                />
                              </>
                            )}
                            {!recipe.isSubrecipe && (
                              <Button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (hasIssues) {
                                    setSelectedRecipe(recipe);
                                    setServeDialogOpen(false);
                                    setTimeout(() => {
                                      setIngredientIssueDialog({ open: true, recipe, issues: ingredientIssues });
                                    }, 50);
                                  } else {
                                    handleServeClick(recipe);
                                  }
                                }}
                                className="ml-auto bg-amber-500 hover:bg-amber-600 text-white h-7 px-3 text-xs"
                                size="sm"
                              >
                                <Utensils className="h-3 w-3 mr-1" />
                                {t('serve')}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
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