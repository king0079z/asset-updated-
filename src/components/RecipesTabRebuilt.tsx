import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { ChefHat, Search, Plus, Utensils, AlertCircle, Users, Clock, DollarSign } from "lucide-react";
import { EnhancedRecipeManagementDialog } from "@/components/EnhancedRecipeManagementDialog";
import { RecipeDetailsDialog } from "@/components/RecipeDetailsDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/contexts/TranslationContext";

interface RecipeIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  wastePercentage?: number;
  type: 'food' | 'subrecipe';
  foodSupplyId?: string;
  subRecipeId?: string;
  subRecipeName?: string;
}

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
  totalWasteAmount?: number;
}

export function RecipesTabRebuilt({ kitchenId }: { kitchenId?: string }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'main' | 'sub'>('main');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [serveDialogOpen, setServeDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [servingsCount, setServingsCount] = useState('1');
  const [kitchens, setKitchens] = useState<{ id: string; name: string }[]>([]);
  const [selectedKitchen, setSelectedKitchen] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [insufficientIngredients, setInsufficientIngredients] = useState<any[] | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchRecipes = async () => {
      setIsLoading(true);
      try {
        const url = kitchenId ? `/api/recipes?kitchenId=${kitchenId}` : '/api/recipes';
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch recipes');
        const data = await res.json();
        setRecipes(data);
      } catch (e) {
        toast({ title: t('error'), description: t('failed_to_load_data'), variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecipes();
  }, [kitchenId, t, toast]);

  // Fetch kitchens for the serve dialog
  useEffect(() => {
    if (kitchenId) {
      setKitchens([]);
      setSelectedKitchen(kitchenId);
      return;
    }
    const fetchKitchens = async () => {
      try {
        const res = await fetch('/api/kitchens');
        if (!res.ok) throw new Error('Failed to fetch kitchens');
        const data = await res.json();
        setKitchens(data);
        if (data.length > 0) setSelectedKitchen(data[0].id);
      } catch (e) {
        setKitchens([]);
      }
    };
    fetchKitchens();
  }, [kitchenId]);

  const filteredMain = recipes.filter(r =>
    !r.isSubrecipe &&
    (r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(search.toLowerCase()))
  );
  const filteredSub = recipes.filter(r =>
    r.isSubrecipe &&
    (r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(search.toLowerCase()))
  );

  // Calculate total waste for a recipe (recursively, including subrecipes)
  const calcWaste = (recipe: Recipe, allRecipes: Recipe[] = recipes, foodSupplies: any[] = []) => {
    let totalWaste = 0;
    for (const ing of recipe.ingredients) {
      if (ing.type === 'food' && typeof ing.wastePercentage === 'number' && ing.wastePercentage > 0) {
        // Find pricePerUnit from foodSupplies if available, else fallback to cost/quantity
        let pricePerUnit = 0;
        if (foodSupplies.length > 0) {
          const fs = foodSupplies.find(fs => fs.id === ing.foodSupplyId);
          pricePerUnit = fs ? fs.pricePerUnit : (ing.cost && ing.quantity ? ing.cost / ing.quantity : 0);
        } else {
          pricePerUnit = ing.cost && ing.quantity ? ing.cost / ing.quantity : 0;
        }
        const wasteAmount = ing.quantity * ((ing.wastePercentage || 0) / 100) * pricePerUnit;
        totalWaste += wasteAmount;
      } else if (ing.type === 'subrecipe' && ing.subRecipeId) {
        const sub = allRecipes.find(r => r.id === ing.subRecipeId);
        if (sub && Array.isArray(sub.ingredients)) {
          const subWaste = calcWaste(sub, allRecipes, foodSupplies);
          totalWaste += subWaste * (ing.quantity || 1);
        }
      }
    }
    return totalWaste;
  };

  return (
    <div>
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'main' | 'sub')}>
        <TabsList className="mb-4">
          <TabsTrigger value="main">
            <Utensils className="h-4 w-4 mr-2" />
            {t('main_recipes') || 'Main Recipes'}
          </TabsTrigger>
          <TabsTrigger value="sub">
            <ChefHat className="h-4 w-4 mr-2" />
            {t('subrecipes') || 'Subrecipes'}
          </TabsTrigger>
        </TabsList>
        <div className="flex justify-between items-center mb-4">
          <Input
            placeholder={t('search_recipes') || 'Search recipes'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-64"
          />
          <div className="flex gap-2">
            {activeTab === 'main' ? (
              <Button onClick={() => setDialogOpen(true)} className="bg-green-600 text-white">
                <Plus className="h-4 w-4 mr-2" />
                {t('add_recipe') || 'Add Recipe'}
              </Button>
            ) : (
              <Button onClick={() => setSubDialogOpen(true)} className="bg-purple-600 text-white">
                <Plus className="h-4 w-4 mr-2" />
                {t('add_subrecipe') || 'Add Subrecipe'}
              </Button>
            )}
          </div>
        </div>
        <TabsContent value="main">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredMain.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <ChefHat className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">{t('no_recipes_found')}</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {t('create_your_first_recipe_to_get_started')}
              </p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('add_recipe')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMain.map(recipe => (
                <Card
                  key={recipe.id}
                  className="hover:shadow-md transition-all overflow-hidden border-t-4 border-t-amber-500"
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3
                        className="font-medium text-lg cursor-pointer"
                        onClick={() => { handleOpenDetails(recipe.id); }}
                      >
                        {recipe.name}
                      </h3>
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        QAR {recipe.costPerServing.toFixed(2)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{recipe.description}</p>
                    <div className="flex gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" /> {recipe.servings} {t('servings')}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" /> {recipe.prepTime} {t('min')}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        <DollarSign className="h-3 w-3 mr-1" /> QAR {recipe.totalCost.toFixed(2)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {recipe.ingredients
                        .filter(ing => ing.type === 'food')
                        .slice(0, 3)
                        .map(ing => (
                          <Badge key={ing.id} variant="secondary" className="text-xs">
                            {ing.name}
                          </Badge>
                        ))}
                      {recipe.ingredients.filter(ing => ing.type === 'food').length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{recipe.ingredients.filter(ing => ing.type === 'food').length - 3} {t('more')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 mb-4">
                      <Badge variant="outline" className="bg-amber-50 text-amber-700">
                        {t('ingredient_waste') || 'Ingredient Waste'}: QAR {calcWaste(recipe, recipes).toFixed(2)}
                      </Badge>
                      {recipe.sellingPrice && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {t('selling_price')}: QAR {recipe.sellingPrice.toFixed(2)}
                        </Badge>
                      )}
                      {recipe.sellingPrice && recipe.sellingPrice > 0 && (
                        <Badge
                          variant="outline"
                          className={
                            recipe.sellingPrice > recipe.totalCost
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }
                        >
                          {t('profit') || 'Profit'}: QAR {(recipe.sellingPrice - recipe.totalCost).toFixed(2)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => {
                          setSelectedRecipe(recipe);
                          setServeDialogOpen(true);
                        }}
                      >
                        <Utensils className="h-4 w-4 mr-2" />
                        {t('serve') || 'Serve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { handleOpenDetails(recipe.id); }}
                      >
                        {t('details') || 'Details'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-600 text-blue-700"
                        onClick={() => {
                          setSelectedRecipe(recipe);
                          setEditDialogOpen(true);
                        }}
                      >
                        {t('edit') || 'Edit'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="sub">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredSub.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <ChefHat className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">{t('no_subrecipes_found')}</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {t('create_your_first_subrecipe_to_get_started')}
              </p>
              <Button className="mt-4" onClick={() => setSubDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('add_subrecipe')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSub.map(recipe => (
                <Card
                  key={recipe.id}
                  className="hover:shadow-md transition-all overflow-hidden border-t-4 border-t-purple-600 bg-purple-50 dark:bg-purple-900/10"
                  onClick={() => { handleOpenDetails(recipe.id); }}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium text-lg flex items-center gap-2">
                        <ChefHat className="h-4 w-4 text-purple-600" /> {recipe.name}
                      </h3>
                      <Badge variant="outline" className="bg-purple-50 text-purple-700">
                        QAR {recipe.costPerServing.toFixed(2)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{recipe.description}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {recipe.ingredients
                        .filter(ing => ing.type === 'food')
                        .slice(0, 3)
                        .map(ing => (
                          <Badge key={ing.id} variant="secondary" className="text-xs">
                            {ing.name}
                          </Badge>
                        ))}
                      {recipe.ingredients.filter(ing => ing.type === 'food').length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{recipe.ingredients.filter(ing => ing.type === 'food').length - 3} {t('more')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="bg-amber-50 text-amber-700">
                        {t('ingredient_waste') || 'Ingredient Waste'}: QAR {calcWaste(recipe, recipes).toFixed(2)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      {/* Add Recipe Dialog */}
      <EnhancedRecipeManagementDialog
        kitchenId={kitchenId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        subrecipeMode={false}
      />
      {/* Add Subrecipe Dialog */}
      <EnhancedRecipeManagementDialog
        kitchenId={kitchenId}
        open={subDialogOpen}
        onOpenChange={setSubDialogOpen}
        subrecipeMode={true}
      />

      {/* Edit Recipe Dialog */}
      <EnhancedRecipeManagementDialog
        kitchenId={kitchenId}
        open={editDialogOpen}
        onOpenChange={open => setEditDialogOpen(open)}
        subrecipeMode={false}
        recipe={selectedRecipe || undefined}
        onRecipeUpdated={async () => {
          setEditDialogOpen(false);
          // Refresh recipes list after update
          const url = kitchenId ? `/api/recipes?kitchenId=${kitchenId}` : '/api/recipes';
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            setRecipes(data);
          }
        }}
      />
      {/* Recipe Details Dialog */}
      {selectedRecipe && (
        <RecipeDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          recipe={selectedRecipe}
        />
      )}

      {/* Serve Recipe Dialog */}
      <Dialog open={serveDialogOpen} onOpenChange={setServeDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('serve_recipe') || 'Serve Recipe'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <h3 className="font-medium">{selectedRecipe?.name}</h3>
              <p className="text-sm text-muted-foreground">{selectedRecipe?.description}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="servings">{t('number_of_servings') || 'Number of Servings'}</Label>
              <Input
                id="servings"
                type="number"
                min="1"
                value={servingsCount}
                onChange={(e) => setServingsCount(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                {t('standard_recipe_serves') || 'Standard recipe serves'} {selectedRecipe?.servings} {t('people') || 'people'}
              </p>
            </div>
            {/* If kitchenId is provided, use it directly; otherwise show kitchen selector */}
            {kitchenId ? (
              <input type="hidden" id="kitchen" value={kitchenId} />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="kitchen">{t('select_kitchen') || 'Select Kitchen'}</Label>
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
                {t('serving_this_recipe_will_deduct_ingredients') || 'Serving this recipe will deduct ingredients from stock.'}
              </div>
            </div>
            {insufficientIngredients && insufficientIngredients.length > 0 && (
              <div className="mt-4">
                <Card className="border-red-500 border-2 bg-red-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      {t('insufficient_ingredients') || 'Insufficient Ingredients'}
                    </CardTitle>
                    <CardDescription className="text-red-600">
                      {t('the_following_ingredients_need_refill') || 'The following ingredients need to be refilled:'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-red-700">
                            <th className="py-1 pr-4">{t('ingredient') || 'Ingredient'}</th>
                            <th className="py-1 pr-4">{t('required_qty') || 'Required'}</th>
                            <th className="py-1 pr-4">{t('available_qty') || 'Available'}</th>
                            <th className="py-1">{t('unit') || 'Unit'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {insufficientIngredients.map((ing, idx) => (
                            <tr key={idx} className="bg-red-100/60">
                              <td className="py-1 pr-4 font-medium text-red-800">{ing.name}</td>
                              <td className="py-1 pr-4">{ing.required}</td>
                              <td className="py-1 pr-4">{ing.available}</td>
                              <td className="py-1">{ing.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServeDialogOpen(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={async () => {
                setInsufficientIngredients(null);
                if (!selectedRecipe || !(kitchenId || selectedKitchen)) {
                  toast({
                    title: t('error'),
                    description: t('please_select_kitchen') || 'Please select a kitchen',
                    variant: "destructive",
                  });
                  return;
                }
                const servings = parseInt(servingsCount);
                if (isNaN(servings) || servings <= 0) {
                  toast({
                    title: t('error'),
                    description: t('please_enter_valid_servings') || 'Please enter a valid number of servings',
                    variant: "destructive",
                  });
                  return;
                }
                setIsSubmitting(true);
                try {
                  const response = await fetch('/api/recipes/use', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      recipeId: selectedRecipe.id,
                      kitchenId: kitchenId || selectedKitchen,
                      notes: `Used recipe: ${selectedRecipe.name} (${servings} servings)`,
                      servingsUsed: servings,
                      forceUse: false
                    }),
                  });
                  if (!response.ok) {
                    const errorData = await response.json();
                    if (errorData.insufficientIngredients) {
                      setInsufficientIngredients(errorData.insufficientIngredients);
                    }
                    toast({
                      title: t('error'),
                      description: errorData.error || t('failed_to_use_recipe') || 'Failed to use recipe',
                      variant: "destructive",
                    });
                    return;
                  }
                  toast({
                    title: t('success'),
                    description: t('recipe_used_successfully') || 'Recipe served successfully',
                  });
                  setServeDialogOpen(false);
                  setInsufficientIngredients(null);
                  // Refresh recipes list
                  const url = kitchenId ? `/api/recipes?kitchenId=${kitchenId}` : '/api/recipes';
                  const res = await fetch(url);
                  if (res.ok) {
                    const data = await res.json();
                    setRecipes(data);
                  }
                } catch (error) {
                  toast({
                    title: t('error'),
                    description: t('failed_to_use_recipe') || 'Failed to use recipe',
                    variant: "destructive",
                  });
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Utensils className="h-4 w-4 mr-2" />
              )}
              {t('submit') || 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // --- New: fetch full recipe details with kitchen breakdown ---
  async function handleOpenDetails(recipeId: string) {
    try {
      const res = await fetch(`/api/recipes/${recipeId}`);
      if (!res.ok) throw new Error('Failed to fetch recipe details');
      const data = await res.json();
      setSelectedRecipe(data);
      setDetailsOpen(true);
    } catch (e) {
      // fallback: open with minimal data
      setDetailsOpen(true);
    }
  }
}