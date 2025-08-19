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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { ChefHat, Plus, X, Calculator, DollarSign, Clock, Users } from "lucide-react";
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

export function RecipeManagementDialog() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('view');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [foodSupplies, setFoodSupplies] = useState<FoodSupplyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  
  // New recipe form state
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    description: '',
    servings: '4',
    prepTime: '30',
    instructions: '',
    sellingPrice: '',
  });
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [ingredientQuantity, setIngredientQuantity] = useState('');
  
  const { toast } = useToast();
  const { t } = useTranslation();

  // Mock data for demonstration
  const generateMockRecipes = (): Recipe[] => {
    return [
      {
        id: 'recipe-1',
        name: 'Chicken Alfredo Pasta',
        description: 'Creamy pasta dish with grilled chicken',
        servings: 4,
        prepTime: 30,
        ingredients: [
          { id: 'ing-1', foodSupplyId: 'fs-1', name: 'Chicken Breast', quantity: 500, unit: 'g', cost: 15 },
          { id: 'ing-2', foodSupplyId: 'fs-2', name: 'Fettuccine Pasta', quantity: 400, unit: 'g', cost: 5 },
          { id: 'ing-3', foodSupplyId: 'fs-3', name: 'Heavy Cream', quantity: 250, unit: 'ml', cost: 8 },
          { id: 'ing-4', foodSupplyId: 'fs-4', name: 'Parmesan Cheese', quantity: 100, unit: 'g', cost: 7 },
        ],
        instructions: '1. Cook pasta according to package instructions.\n2. Season and grill chicken until cooked through.\n3. In a pan, heat cream and add parmesan cheese.\n4. Slice chicken and add to the sauce.\n5. Combine with pasta and serve hot.',
        totalCost: 35,
        costPerServing: 8.75,
        sellingPrice: 60,
      },
      {
        id: 'recipe-2',
        name: 'Vegetable Stir Fry',
        description: 'Healthy vegetable stir fry with soy sauce',
        servings: 3,
        prepTime: 20,
        ingredients: [
          { id: 'ing-5', foodSupplyId: 'fs-5', name: 'Mixed Vegetables', quantity: 600, unit: 'g', cost: 12 },
          { id: 'ing-6', foodSupplyId: 'fs-6', name: 'Soy Sauce', quantity: 50, unit: 'ml', cost: 2 },
          { id: 'ing-7', foodSupplyId: 'fs-7', name: 'Sesame Oil', quantity: 15, unit: 'ml', cost: 3 },
          { id: 'ing-8', foodSupplyId: 'fs-8', name: 'Rice', quantity: 300, unit: 'g', cost: 4 },
        ],
        instructions: '1. Cook rice according to package instructions.\n2. Heat oil in a wok or large pan.\n3. Add vegetables and stir-fry until tender-crisp.\n4. Add soy sauce and continue cooking for 2 minutes.\n5. Serve over rice.',
        totalCost: 21,
        costPerServing: 7,
        sellingPrice: 35,
      },
    ];
  };

  const generateMockFoodSupplies = (): FoodSupplyItem[] => {
    return [
      { id: 'fs-1', name: 'Chicken Breast', unit: 'g', pricePerUnit: 0.03, quantity: 2000 },
      { id: 'fs-2', name: 'Fettuccine Pasta', unit: 'g', pricePerUnit: 0.0125, quantity: 5000 },
      { id: 'fs-3', name: 'Heavy Cream', unit: 'ml', pricePerUnit: 0.032, quantity: 1000 },
      { id: 'fs-4', name: 'Parmesan Cheese', unit: 'g', pricePerUnit: 0.07, quantity: 500 },
      { id: 'fs-5', name: 'Mixed Vegetables', unit: 'g', pricePerUnit: 0.02, quantity: 3000 },
      { id: 'fs-6', name: 'Soy Sauce', unit: 'ml', pricePerUnit: 0.04, quantity: 750 },
      { id: 'fs-7', name: 'Sesame Oil', unit: 'ml', pricePerUnit: 0.2, quantity: 250 },
      { id: 'fs-8', name: 'Rice', unit: 'g', pricePerUnit: 0.013, quantity: 10000 },
      { id: 'fs-9', name: 'Olive Oil', unit: 'ml', pricePerUnit: 0.05, quantity: 1000 },
      { id: 'fs-10', name: 'Salt', unit: 'g', pricePerUnit: 0.002, quantity: 1000 },
    ];
  };

  useEffect(() => {
    // In a real implementation, this would fetch data from an API
    // For now, we'll use mock data
    setIsLoading(true);
    
    // Simulate API call delay
    const timer = setTimeout(() => {
      setRecipes(generateMockRecipes());
      setFoodSupplies(generateMockFoodSupplies());
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

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
    const servings = parseInt(newRecipe.servings) || 1;
    return totalCost / servings;
  };

  const handleCreateRecipe = () => {
    if (!newRecipe.name || !newRecipe.instructions || ingredients.length === 0) {
      toast({
        title: t('error'),
        description: t('please_fill_all_required_fields'),
        variant: "destructive",
      });
      return;
    }

    const totalCost = calculateTotalCost();
    const costPerServing = calculateCostPerServing();
    const sellingPrice = parseFloat(newRecipe.sellingPrice) || 0;

    const recipe: Recipe = {
      id: `recipe-${Date.now()}`,
      name: newRecipe.name,
      description: newRecipe.description,
      servings: parseInt(newRecipe.servings),
      prepTime: parseInt(newRecipe.prepTime),
      ingredients,
      instructions: newRecipe.instructions,
      totalCost,
      costPerServing,
      sellingPrice,
    };

    // In a real implementation, this would call an API endpoint
    setRecipes([...recipes, recipe]);
    
    toast({
      title: t('recipe_created'),
      description: t('recipe_created_successfully'),
    });

    // Reset form
    setNewRecipe({
      name: '',
      description: '',
      servings: '4',
      prepTime: '30',
      instructions: '',
      sellingPrice: '',
    });
    setIngredients([]);
    setActiveTab('view');
  };

  const handleViewRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
          <ChefHat className="h-4 w-4 mr-2" />
          {t('recipe_management')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>{t('recipe_management')}</DialogTitle>
          <DialogDescription>
            {t('create_and_manage_recipes')}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="view">{t('view_recipes')}</TabsTrigger>
            <TabsTrigger value="create">{t('create_recipe')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="view" className="flex-1 overflow-hidden flex flex-col">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : recipes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ChefHat className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p>{t('no_recipes_found')}</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab('create')}>
                  {t('create_your_first_recipe')}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto p-1">
                {recipes.map(recipe => (
                  <Card key={recipe.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleViewRecipe(recipe)}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-lg">{recipe.name}</h3>
                          <p className="text-sm text-muted-foreground">{recipe.description}</p>
                        </div>
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          QAR {recipe.costPerServing.toFixed(2)} / {t('serving')}
                        </Badge>
                      </div>
                      <div className="flex gap-3 mt-3">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Users className="h-4 w-4 mr-1" />
                          {recipe.servings}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 mr-1" />
                          {recipe.prepTime} {t('min')}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <DollarSign className="h-4 w-4 mr-1" />
                          QAR {recipe.totalCost.toFixed(2)}
                        </div>
                      </div>
                      {recipe.sellingPrice && (
                        <div className="mt-2 flex justify-end">
                          <Badge className="bg-blue-50 text-blue-700">
                            {t('selling_price')}: QAR {recipe.sellingPrice.toFixed(2)}
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            
            {selectedRecipe && (
              <Dialog open={!!selectedRecipe} onOpenChange={() => setSelectedRecipe(null)}>
                <DialogContent className="sm:max-w-[700px]">
                  <DialogHeader>
                    <DialogTitle>{selectedRecipe.name}</DialogTitle>
                    <DialogDescription>{selectedRecipe.description}</DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid grid-cols-3 gap-4 py-4">
                    <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-md">
                      <Users className="h-5 w-5 mb-1 text-slate-600" />
                      <span className="font-medium">{selectedRecipe.servings}</span>
                      <span className="text-xs text-muted-foreground">{t('servings')}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-md">
                      <Clock className="h-5 w-5 mb-1 text-slate-600" />
                      <span className="font-medium">{selectedRecipe.prepTime}</span>
                      <span className="text-xs text-muted-foreground">{t('minutes')}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-md">
                      <DollarSign className="h-5 w-5 mb-1 text-slate-600" />
                      <span className="font-medium">QAR {selectedRecipe.costPerServing.toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground">{t('per_serving')}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">{t('ingredients')}</h3>
                      <div className="space-y-2">
                        {selectedRecipe.ingredients.map(ing => (
                          <div key={ing.id} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-md">
                            <span>{ing.name}</span>
                            <div className="flex items-center gap-3">
                              <span>{ing.quantity} {ing.unit}</span>
                              <span className="text-green-700">QAR {ing.cost.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center font-medium mt-2 p-2 border-t">
                        <span>{t('total_cost')}</span>
                        <span>QAR {selectedRecipe.totalCost.toFixed(2)}</span>
                      </div>
                      {selectedRecipe.sellingPrice && (
                        <div className="flex justify-between items-center font-medium p-2">
                          <span>{t('selling_price')}</span>
                          <span className="text-blue-700">QAR {selectedRecipe.sellingPrice.toFixed(2)}</span>
                        </div>
                      )}
                      {selectedRecipe.sellingPrice && (
                        <div className="flex justify-between items-center font-medium p-2">
                          <span>{t('profit')}</span>
                          <span className={selectedRecipe.sellingPrice > selectedRecipe.totalCost ? "text-green-700" : "text-red-700"}>
                            QAR {(selectedRecipe.sellingPrice - selectedRecipe.totalCost).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-2">{t('instructions')}</h3>
                      <div className="p-3 bg-slate-50 rounded-md text-sm whitespace-pre-line">
                        {selectedRecipe.instructions}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </TabsContent>
          
          <TabsContent value="create" className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1">
              <div className="space-y-4 p-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('recipe_name')} *</Label>
                    <Input
                      id="name"
                      value={newRecipe.name}
                      onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                      placeholder={t('enter_recipe_name')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">{t('description')}</Label>
                    <Input
                      id="description"
                      value={newRecipe.description}
                      onChange={(e) => setNewRecipe({ ...newRecipe, description: e.target.value })}
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
                      value={newRecipe.servings}
                      onChange={(e) => setNewRecipe({ ...newRecipe, servings: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prepTime">{t('prep_time')} ({t('minutes')})</Label>
                    <Input
                      id="prepTime"
                      type="number"
                      min="1"
                      value={newRecipe.prepTime}
                      onChange={(e) => setNewRecipe({ ...newRecipe, prepTime: e.target.value })}
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
                        value={newRecipe.sellingPrice}
                        onChange={(e) => setNewRecipe({ ...newRecipe, sellingPrice: e.target.value })}
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
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              QAR {calculateCostPerServing().toFixed(2)} / {t('serving')}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center p-2">
                            <span className="font-medium">{t('selling_price')}</span>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              QAR {newRecipe.sellingPrice || '0.00'}
                            </Badge>
                          </div>
                          {parseFloat(newRecipe.sellingPrice) > 0 && calculateTotalCost() > 0 && (
                            <div className="flex justify-between items-center p-2">
                              <span className="font-medium">{t('profit_per_recipe')}</span>
                              <Badge variant={parseFloat(newRecipe.sellingPrice) > calculateTotalCost() ? "outline" : "destructive"} 
                                className={parseFloat(newRecipe.sellingPrice) > calculateTotalCost() ? 
                                  "bg-green-50 text-green-700" : ""}>
                                QAR {(parseFloat(newRecipe.sellingPrice) - calculateTotalCost()).toFixed(2)}
                              </Badge>
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
                    value={newRecipe.instructions}
                    onChange={(e) => setNewRecipe({ ...newRecipe, instructions: e.target.value })}
                    placeholder={t('enter_recipe_instructions')}
                    rows={6}
                  />
                </div>
              </div>
            </ScrollArea>
            
            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => setActiveTab('view')}>
                {t('cancel')}
              </Button>
              <Button onClick={handleCreateRecipe}>
                <Calculator className="h-4 w-4 mr-2" />
                {t('calculate_and_save')}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}