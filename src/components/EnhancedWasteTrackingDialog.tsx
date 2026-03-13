import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Trash2, AlertTriangle, Info, ChefHat, Package, Calendar, Scale, Users } from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface FoodSupplyItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  category: string;
}

interface Recipe {
  id: string;
  name: string;
  servings: number;
  ingredients: {
    id: string;
    foodSupplyId: string;
    quantity: number;
    foodSupply: {
      id: string;
      name: string;
      unit: string;
      quantity: number;
    };
  }[];
}

interface EnhancedWasteTrackingDialogProps {
  foodSupplyId?: string;
  foodSupplyName?: string;
  unit?: string;
  onWasteRecorded?: () => void;
}

type WasteReason = 
  | 'expired'
  | 'damaged'
  | 'quality_issues'
  | 'overproduction'
  | 'other';

type WasteSource = 'direct' | 'recipe';

export function EnhancedWasteTrackingDialog({
  foodSupplyId,
  foodSupplyName,
  unit,
  onWasteRecorded = () => {}
}: EnhancedWasteTrackingDialogProps) {
  const [open, setOpen] = useState(false);
  const [wasteSource, setWasteSource] = useState<WasteSource>('direct');
  
  // Direct waste state
  const [selectedFoodSupply, setSelectedFoodSupply] = useState(foodSupplyId || '');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<WasteReason>('expired');
  const [notes, setNotes] = useState('');
  
  // Recipe waste state
  const [selectedRecipe, setSelectedRecipe] = useState('');
  const [recipeWasteReason, setRecipeWasteReason] = useState<WasteReason>('overproduction');
  const [recipeWasteNotes, setRecipeWasteNotes] = useState('');
  const [servingsWasted, setServingsWasted] = useState('1');
  
  // Shared state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableQuantity, setAvailableQuantity] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [foodSupplies, setFoodSupplies] = useState<FoodSupplyItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeDetails, setSelectedRecipeDetails] = useState<Recipe | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filteredFoodSupplies, setFilteredFoodSupplies] = useState<FoodSupplyItem[]>([]);
  
  const { toast } = useToast();
  const { t } = useTranslation();

  // Fetch food supplies and recipes when the dialog opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      
      Promise.all([
        fetch('/api/food-supply').then(res => {
          if (!res.ok) throw new Error('Failed to fetch food supplies');
          return res.json();
        }),
        fetch('/api/recipes').then(res => {
          if (!res.ok) return [];
          return res.json();
        })
      ])
        .then(([foodSuppliesData, recipesData]) => {
          // Ensure foodSuppliesData is an array
          const supplies = Array.isArray(foodSuppliesData) ? foodSuppliesData : [];
          setFoodSupplies(supplies);
          setFilteredFoodSupplies(supplies);
          
          // Ensure recipesData is an array
          const recipes = Array.isArray(recipesData) ? recipesData : [];
          setRecipes(recipes);
          
          // If a specific food supply was provided, set it as selected
          if (foodSupplyId) {
            setSelectedFoodSupply(foodSupplyId);
            const supply = supplies.find(item => item.id === foodSupplyId);
            if (supply) {
              setAvailableQuantity(supply.quantity);
            }
          } else if (supplies.length > 0) {
            // If no specific food supply was provided, select the first one
            setSelectedFoodSupply(supplies[0].id);
            setAvailableQuantity(supplies[0].quantity);
          }
        })
        .catch(error => {
          console.error('Error fetching data:', error);
          toast({
            title: t('error'),
            description: t('failed_to_fetch_data'),
            variant: "destructive",
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, foodSupplyId, t, toast]);

  // Update available quantity when selected food supply changes
  useEffect(() => {
    if (selectedFoodSupply && open) {
      const supply = foodSupplies.find(item => item.id === selectedFoodSupply);
      if (supply) {
        setAvailableQuantity(supply.quantity);
      }
    }
  }, [selectedFoodSupply, foodSupplies, open]);

  // Update selected recipe details when recipe changes
  useEffect(() => {
    if (selectedRecipe && open) {
      const recipe = recipes.find(item => item.id === selectedRecipe);
      if (recipe) {
        setSelectedRecipeDetails(recipe);
      } else {
        setSelectedRecipeDetails(null);
      }
    } else {
      setSelectedRecipeDetails(null);
    }
  }, [selectedRecipe, recipes, open]);

  // Filter food supplies when category changes
  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredFoodSupplies(foodSupplies);
    } else {
      const filtered = foodSupplies.filter(item => 
        item.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
      setFilteredFoodSupplies(filtered);
    }
  }, [selectedCategory, foodSupplies]);

  const handleDirectWasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFoodSupply) {
      toast({
        title: t('error'),
        description: t('please_select_food_supply'),
        variant: "destructive",
      });
      return;
    }
    
    const quantityValue = parseFloat(quantity);
    
    if (!quantity || quantityValue <= 0) {
      toast({
        title: t('error'),
        description: t('please_enter_valid_quantity'),
        variant: "destructive",
      });
      return;
    }

    if (availableQuantity !== null && quantityValue > availableQuantity) {
      toast({
        title: t('error'),
        description: t('quantity_exceeds_available_amount'),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Call the API endpoint
      const response = await fetch('/api/food-supply/dispose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          foodSupplyId: selectedFoodSupply,
          quantity: quantityValue,
          reason,
          notes,
          source: 'direct'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to record waste');
      }
      
      toast({
        title: t('waste_recorded'),
        description: t('waste_recorded_successfully'),
      });
      
      setOpen(false);
      resetForm();
      onWasteRecorded();
    } catch (error) {
      console.error('Error recording waste:', error);
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_record_waste'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecipeWasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRecipe) {
      toast({
        title: t('error'),
        description: t('please_select_recipe'),
        variant: "destructive",
      });
      return;
    }
    
    const servingsValue = parseInt(servingsWasted);
    
    if (!servingsWasted || servingsValue <= 0) {
      toast({
        title: t('error'),
        description: t('please_enter_valid_servings'),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Call the API endpoint
      const response = await fetch('/api/food-supply/dispose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipeId: selectedRecipe,
          servings: servingsValue,
          reason: recipeWasteReason,
          notes: recipeWasteNotes,
          source: 'recipe'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle insufficient ingredients
        if (errorData.insufficientIngredients) {
          toast({
            title: t('warning'),
            description: t('insufficient_ingredients_for_recipe_waste'),
            variant: "warning",
          });
          // Continue with the submission despite the warning
          // This is because we're recording waste, not actual usage
        } else {
          throw new Error(errorData.error || 'Failed to record waste');
        }
      }
      
      toast({
        title: t('waste_recorded'),
        description: t('recipe_waste_recorded_successfully'),
      });
      
      setOpen(false);
      resetForm();
      onWasteRecorded();
    } catch (error) {
      console.error('Error recording recipe waste:', error);
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_record_waste'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setQuantity('');
    setReason('expired');
    setNotes('');
    setSelectedRecipe('');
    setRecipeWasteReason('overproduction');
    setRecipeWasteNotes('');
    setServingsWasted('1');
    setSelectedCategory('all');
    if (!foodSupplyId) {
      setSelectedFoodSupply('');
    }
  };

  const reasonOptions: { value: WasteReason; label: string }[] = [
    { value: 'expired', label: t('expired') },
    { value: 'damaged', label: t('damaged_during_storage') },
    { value: 'quality_issues', label: t('quality_issues') },
    { value: 'overproduction', label: t('overproduction') },
    { value: 'other', label: t('other') },
  ];

  // Get unique categories from food supplies
  const categories = ['all', ...new Set(foodSupplies.map(item => item.category?.toLowerCase() || 'other'))];

  // Category badge colors
  const categoryColors: Record<string, string> = {
    'vegetables': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    'dairy': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    'meat': 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    'fruits': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    'grains': 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
    'beverages': 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    'other': 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200">
          <Trash2 className="h-4 w-4 mr-2" />
          {t('record_waste')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            {t('record_waste')}
          </DialogTitle>
          <DialogDescription>
            {t('record_waste_from_inventory_or_recipes')}
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Tabs 
            value={wasteSource} 
            onValueChange={(value) => setWasteSource(value as WasteSource)}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="direct" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-950">
                <Package className="h-4 w-4" />
                {t('inventory_item')}
              </TabsTrigger>
              <TabsTrigger value="recipe" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-950">
                <ChefHat className="h-4 w-4" />
                {t('recipe')}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="direct" className="flex-1 overflow-hidden flex flex-col">
              <form onSubmit={handleDirectWasteSubmit} className="flex-1 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1 pr-4">
                  <div className="grid gap-4 py-2">
                    {/* Category filter */}
                    <div className="mb-2">
                      <Label htmlFor="category" className="mb-2 block">
                        {t('filter_by_category')}
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {categories.map((category) => (
                          <Badge 
                            key={category} 
                            variant="outline" 
                            className={`cursor-pointer ${
                              selectedCategory === category 
                                ? 'bg-primary text-primary-foreground' 
                                : categoryColors[category] || 'bg-gray-100 text-gray-800'
                            }`}
                            onClick={() => setSelectedCategory(category)}
                          >
                            {category === 'all' 
                              ? t('all_categories') 
                              : category.charAt(0).toUpperCase() + category.slice(1)}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="foodSupply" className="text-right">
                        {t('food_supply')}
                      </Label>
                      <div className="col-span-3">
                        <Select
                          value={selectedFoodSupply}
                          onValueChange={setSelectedFoodSupply}
                          disabled={!!foodSupplyId}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('select_food_supply')} />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredFoodSupplies.map((supply) => (
                              <SelectItem key={supply.id} value={supply.id}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{supply.name}</span>
                                  <Badge variant="outline" className={categoryColors[supply.category?.toLowerCase()] || 'bg-gray-100'}>
                                    {supply.quantity} {supply.unit}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {availableQuantity !== null && (
                      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800/30">
                        <CardContent className="p-3 text-blue-800 dark:text-blue-300 text-sm flex items-start gap-2">
                          <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">{t('available_quantity')}</p>
                            <p className="mt-1">
                              {availableQuantity} {unit || foodSupplies.find(s => s.id === selectedFoodSupply)?.unit}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="quantity" className="text-right">
                        {t('quantity')}
                      </Label>
                      <div className="col-span-3 flex items-center gap-2">
                        <div className="relative flex-1">
                          <Scale className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="quantity"
                            type="number"
                            step="0.01"
                            min="0"
                            max={availableQuantity !== null ? availableQuantity.toString() : undefined}
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="pl-9"
                            required
                          />
                        </div>
                        <span className="text-sm text-muted-foreground min-w-[40px]">
                          {unit || foodSupplies.find(s => s.id === selectedFoodSupply)?.unit}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="reason" className="text-right">
                        {t('reason')}
                      </Label>
                      <Select
                        value={reason}
                        onValueChange={(value) => setReason(value as WasteReason)}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder={t('select_reason')} />
                        </SelectTrigger>
                        <SelectContent>
                          {reasonOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="notes" className="text-right">
                        {t('notes')}
                      </Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t('additional_details')}
                        className="col-span-3"
                      />
                    </div>
                    
                    <div className="col-span-4">
                      <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/30">
                        <CardContent className="p-3 text-amber-800 dark:text-amber-300 text-sm flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">{t('waste_tracking_important')}</p>
                            <p className="mt-1">{t('waste_tracking_description')}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </ScrollArea>
                
                <DialogFooter className="mt-4 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700">
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                        {t('recording')}
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('record_waste')}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
            
            <TabsContent value="recipe" className="flex-1 overflow-hidden flex flex-col">
              <form onSubmit={handleRecipeWasteSubmit} className="flex-1 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1 pr-4">
                  <div className="grid gap-4 py-2">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="recipe" className="text-right">
                        {t('recipe')}
                      </Label>
                      <div className="col-span-3">
                        <Select
                          value={selectedRecipe}
                          onValueChange={setSelectedRecipe}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('select_recipe')} />
                          </SelectTrigger>
                          <SelectContent>
                            {recipes.map((recipe) => (
                              <SelectItem key={recipe.id} value={recipe.id}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{recipe.name}</span>
                                  <Badge variant="outline" className="bg-green-100 text-green-800">
                                    {recipe.servings} {t('servings')}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {selectedRecipeDetails && (
                      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800/30">
                        <CardContent className="p-3 text-blue-800 dark:text-blue-300 text-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <ChefHat className="h-4 w-4" />
                            <p className="font-medium">{t('recipe_ingredients')}</p>
                          </div>
                          <div className="space-y-2 mt-2">
                            {selectedRecipeDetails.ingredients.map((ingredient) => {
                              const isAvailable = ingredient.foodSupply.quantity >= ingredient.quantity;
                              return (
                                <div key={ingredient.id} className="flex justify-between items-center">
                                  <span>{ingredient.foodSupply.name}</span>
                                  <Badge variant="outline" className={isAvailable ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}>
                                    {ingredient.quantity} {ingredient.foodSupply.unit}
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="servings" className="text-right">
                        {t('servings_wasted')}
                      </Label>
                      <div className="col-span-3 relative">
                        <Users className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="servings"
                          type="number"
                          min="1"
                          value={servingsWasted}
                          onChange={(e) => setServingsWasted(e.target.value)}
                          className="pl-9"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="recipeReason" className="text-right">
                        {t('reason')}
                      </Label>
                      <Select
                        value={recipeWasteReason}
                        onValueChange={(value) => setRecipeWasteReason(value as WasteReason)}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder={t('select_reason')} />
                        </SelectTrigger>
                        <SelectContent>
                          {reasonOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="recipeNotes" className="text-right">
                        {t('notes')}
                      </Label>
                      <Textarea
                        id="recipeNotes"
                        value={recipeWasteNotes}
                        onChange={(e) => setRecipeWasteNotes(e.target.value)}
                        placeholder={t('additional_details')}
                        className="col-span-3"
                      />
                    </div>
                    
                    <div className="col-span-4">
                      <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/30">
                        <CardContent className="p-3 text-amber-800 dark:text-amber-300 text-sm flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">{t('recipe_waste_important')}</p>
                            <p className="mt-1">{t('recipe_waste_description')}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </ScrollArea>
                
                <DialogFooter className="mt-4 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700">
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                        {t('recording')}
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('record_recipe_waste')}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}