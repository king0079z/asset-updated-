import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { Calculator, DollarSign, Plus, X } from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";

interface FoodSupplyItem {
  id: string;
  name: string;
  unit: string;
  pricePerUnit: number;
  quantity: number;
}

interface RecipeIngredient {
  id: string;
  foodSupplyId: string;
  name: string;
  quantity: number;
  unit: string;
  cost: number;
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
}

interface EditRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: Recipe | null;
  onRecipeUpdated: () => void;
}

export function EditRecipeDialog({
  open,
  onOpenChange,
  recipe,
  onRecipeUpdated
}: EditRecipeDialogProps) {
  const [foodSupplies, setFoodSupplies] = useState<FoodSupplyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Recipe form state
  const [editedRecipe, setEditedRecipe] = useState({
    name: '',
    description: '',
    servings: '',
    prepTime: '',
    instructions: '',
    sellingPrice: '',
  });
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [ingredientQuantity, setIngredientQuantity] = useState('');
  
  const { toast } = useToast();
  const { t } = useTranslation();

  // Load food supplies
  useEffect(() => {
    const fetchFoodSupplies = async () => {
      try {
        const response = await fetch('/api/food-supply');
        if (response.ok) {
          const data = await response.json();
          setFoodSupplies(data);
        } else {
          console.error('Failed to fetch food supplies');
        }
      } catch (error) {
        console.error('Error fetching food supplies:', error);
      }
    };

    if (open) {
      fetchFoodSupplies();
    }
  }, [open]);

  // Initialize form with recipe data when it changes
  useEffect(() => {
    if (recipe) {
      setEditedRecipe({
        name: recipe.name,
        description: recipe.description || '',
        servings: recipe.servings.toString(),
        prepTime: recipe.prepTime.toString(),
        instructions: recipe.instructions,
        sellingPrice: recipe.sellingPrice?.toString() || '',
      });
      setIngredients(recipe.ingredients);
    }
  }, [recipe]);

  const handleAddIngredient = () => {
    if (!selectedIngredient || !ingredientQuantity || parseFloat(ingredientQuantity) <= 0) {
      toast({
        title: t('error'),
        description: t('please_select_ingredient_and_quantity'),
        variant: "destructive",
      });
      return;
    }

    const foodSupply = foodSupplies.find(fs => fs.id === selectedIngredient);
    if (!foodSupply) return;

    const cost = parseFloat(ingredientQuantity) * foodSupply.pricePerUnit;
    
    const newIngredient: RecipeIngredient = {
      id: `temp-${Date.now()}`,
      foodSupplyId: foodSupply.id,
      name: foodSupply.name,
      quantity: parseFloat(ingredientQuantity),
      unit: foodSupply.unit,
      cost: parseFloat(cost.toFixed(2)),
    };

    setIngredients([...ingredients, newIngredient]);
    setSelectedIngredient('');
    setIngredientQuantity('');
  };

  const handleRemoveIngredient = (id: string) => {
    setIngredients(ingredients.filter(ing => ing.id !== id));
  };

  const calculateTotalCost = () => {
    return ingredients.reduce((sum, ing) => sum + ing.cost, 0);
  };

  const calculateCostPerServing = () => {
    const totalCost = calculateTotalCost();
    const servings = parseInt(editedRecipe.servings) || 1;
    return totalCost / servings;
  };

  const handleUpdateRecipe = async () => {
    if (!recipe) return;
    
    if (!editedRecipe.name || !editedRecipe.instructions || ingredients.length === 0) {
      toast({
        title: t('error'),
        description: t('please_fill_all_required_fields'),
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    
    try {
      const totalCost = calculateTotalCost();
      const costPerServing = calculateCostPerServing();
      const sellingPrice = parseFloat(editedRecipe.sellingPrice) || 0;

      const updatedRecipeData = {
        id: recipe.id,
        name: editedRecipe.name,
        description: editedRecipe.description,
        servings: parseInt(editedRecipe.servings),
        prepTime: parseInt(editedRecipe.prepTime),
        instructions: editedRecipe.instructions,
        totalCost,
        costPerServing,
        sellingPrice,
        ingredients: ingredients.map(ing => ({
          id: ing.id.startsWith('temp-') ? undefined : ing.id,
          foodSupplyId: ing.foodSupplyId,
          quantity: ing.quantity,
          cost: ing.cost
        }))
      };

      const response = await fetch(`/api/recipes/${recipe.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedRecipeData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update recipe');
      }

      toast({
        title: t('recipe_updated'),
        description: t('recipe_updated_successfully'),
      });

      // Dispatch custom event to notify other components about the recipe update
      window.dispatchEvent(new Event('recipe-updated'));

      onRecipeUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating recipe:', error);
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_update_recipe'),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!recipe) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('edit_recipe')}</DialogTitle>
          <DialogDescription>
            {t('update_recipe_details_and_ingredients')}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('recipe_name')} *</Label>
                <Input
                  id="name"
                  value={editedRecipe.name}
                  onChange={(e) => setEditedRecipe({ ...editedRecipe, name: e.target.value })}
                  placeholder={t('enter_recipe_name')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t('description')}</Label>
                <Input
                  id="description"
                  value={editedRecipe.description}
                  onChange={(e) => setEditedRecipe({ ...editedRecipe, description: e.target.value })}
                  placeholder={t('enter_recipe_description')}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="servings">{t('servings')}</Label>
                <Input
                  id="servings"
                  type="number"
                  min="1"
                  value={editedRecipe.servings}
                  onChange={(e) => setEditedRecipe({ ...editedRecipe, servings: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prepTime">{t('prep_time')} ({t('minutes')})</Label>
                <Input
                  id="prepTime"
                  type="number"
                  min="1"
                  value={editedRecipe.prepTime}
                  onChange={(e) => setEditedRecipe({ ...editedRecipe, prepTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellingPrice">{t('selling_price')} (QAR)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="sellingPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editedRecipe.sellingPrice}
                    onChange={(e) => setEditedRecipe({ ...editedRecipe, sellingPrice: e.target.value })}
                    className="pl-9"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>{t('ingredients')} *</Label>
              <div className="flex gap-2">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={selectedIngredient}
                  onChange={(e) => setSelectedIngredient(e.target.value)}
                >
                  <option value="">{t('select_ingredient')}</option>
                  {foodSupplies.map(fs => (
                    <option key={fs.id} value={fs.id}>{fs.name}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder={t('quantity')}
                  value={ingredientQuantity}
                  onChange={(e) => setIngredientQuantity(e.target.value)}
                  className="w-32"
                />
                <Button type="button" onClick={handleAddIngredient}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2 mt-2">
                {ingredients.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2 border rounded-md">
                    {t('no_ingredients_added')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ingredients.map(ing => (
                      <div key={ing.id} className="flex justify-between items-center p-2 border rounded-md">
                        <div>
                          <span className="font-medium">{ing.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {ing.quantity} {ing.unit}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-green-700">QAR {ing.cost.toFixed(2)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveIngredient(ing.id)}
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    <div className="space-y-2 border-t pt-2">
                      <div className="flex justify-between items-center p-2">
                        <span className="font-medium">{t('total_cost')}</span>
                        <span className="font-medium">QAR {calculateTotalCost().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center p-2">
                        <span className="font-medium">{t('cost_per_serving')}</span>
                        <span className="font-medium">QAR {calculateCostPerServing().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center p-2">
                        <span className="font-medium">{t('selling_price')}</span>
                        <span className="font-medium">QAR {editedRecipe.sellingPrice || '0.00'}</span>
                      </div>
                      {parseFloat(editedRecipe.sellingPrice) > 0 && calculateTotalCost() > 0 && (
                        <div className="flex justify-between items-center p-2">
                          <span className="font-medium">{t('profit_per_recipe')}</span>
                          <span className={parseFloat(editedRecipe.sellingPrice) > calculateTotalCost() ? 
                            "font-medium text-green-700" : "font-medium text-red-700"}>
                            QAR {(parseFloat(editedRecipe.sellingPrice) - calculateTotalCost()).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="instructions">{t('instructions')} *</Label>
              <Textarea
                id="instructions"
                value={editedRecipe.instructions}
                onChange={(e) => setEditedRecipe({ ...editedRecipe, instructions: e.target.value })}
                placeholder={t('enter_recipe_instructions')}
                rows={6}
              />
            </div>
          </div>
        </ScrollArea>
        
        <DialogFooter className="pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleUpdateRecipe} disabled={isSaving}>
            {isSaving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Calculator className="h-4 w-4 mr-2" />
            )}
            {t('update_recipe')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}