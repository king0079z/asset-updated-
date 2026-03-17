// @ts-nocheck
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { 
  ChefHat, 
  Plus, 
  X, 
  Calculator,
  Search, 
  DollarSign, 
  Clock, 
  Users, 
  Copy, 
  Check, 
  AlertCircle,
  ShoppingCart,
  Utensils,
  Filter,
  Scale
} from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FoodSupplyItem {
  id: string;
  name: string;
  unit: string;
  pricePerUnit: number;
  quantity: number;
  category: string;
}

interface RecipeIngredient {
  id: string;
  foodSupplyId: string;
  name: string;
  quantity: number;
  unit: string;
  cost: number;
  available?: number; // Current available quantity in stock
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
  isSubrecipe?: boolean;
}

interface EnhancedRecipeManagementDialogProps {
  kitchenId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  subrecipeMode?: boolean;
  recipe?: Recipe;
  onRecipeUpdated?: () => void;
}

export function EnhancedRecipeManagementDialog({
  kitchenId,
  open: controlledOpen,
  onOpenChange,
  subrecipeMode = false,
  recipe,
  onRecipeUpdated,
}: EnhancedRecipeManagementDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('view');

  // If controlled, use props; otherwise, use internal state
  const isOpen = controlledOpen !== undefined ? controlledOpen : open;
  const setIsOpen = onOpenChange || setOpen;
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [foodSupplies, setFoodSupplies] = useState<FoodSupplyItem[]>([]);
  const [filteredFoodSupplies, setFilteredFoodSupplies] = useState<FoodSupplyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [recipeToUse, setRecipeToUse] = useState<Recipe | null>(null);
  const [insufficientIngredients, setInsufficientIngredients] = useState<RecipeIngredient[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // New recipe form state
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    description: '',
    servings: '4',
    prepTime: '30',
    instructions: '',
    sellingPrice: '',
  });
  // Enhanced: allow ingredient to be either food supply or subrecipe, and include waste percentage
  type IngredientType = 'food' | 'subrecipe';
  interface EnhancedRecipeIngredient extends RecipeIngredient {
    type: IngredientType;
    subRecipeId?: string;
    wastePercentage?: number; // Only for food ingredients
    subRecipeName?: string;   // For display
  }
  const [ingredients, setIngredients] = useState<EnhancedRecipeIngredient[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [ingredientType, setIngredientType] = useState<IngredientType>('food');
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [ingredientQuantity, setIngredientQuantity] = useState('');
  const [ingredientWaste, setIngredientWaste] = useState('');
  const [selectedIngredientCategory, setSelectedIngredientCategory] = useState<string>('all');
  
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
      },
    ];
  };

  const generateMockFoodSupplies = (): FoodSupplyItem[] => {
    return [
      { id: 'fs-1', name: 'Chicken Breast', unit: 'g', pricePerUnit: 0.03, quantity: 2000, category: 'meat' },
      { id: 'fs-2', name: 'Fettuccine Pasta', unit: 'g', pricePerUnit: 0.0125, quantity: 5000, category: 'grains' },
      { id: 'fs-3', name: 'Heavy Cream', unit: 'ml', pricePerUnit: 0.032, quantity: 1000, category: 'dairy' },
      { id: 'fs-4', name: 'Parmesan Cheese', unit: 'g', pricePerUnit: 0.07, quantity: 500, category: 'dairy' },
      { id: 'fs-5', name: 'Mixed Vegetables', unit: 'g', pricePerUnit: 0.02, quantity: 3000, category: 'vegetables' },
      { id: 'fs-6', name: 'Soy Sauce', unit: 'ml', pricePerUnit: 0.04, quantity: 750, category: 'other' },
      { id: 'fs-7', name: 'Sesame Oil', unit: 'ml', pricePerUnit: 0.2, quantity: 250, category: 'other' },
      { id: 'fs-8', name: 'Rice', unit: 'g', pricePerUnit: 0.013, quantity: 10000, category: 'grains' },
      { id: 'fs-9', name: 'Olive Oil', unit: 'ml', pricePerUnit: 0.05, quantity: 1000, category: 'other' },
      { id: 'fs-10', name: 'Salt', unit: 'g', pricePerUnit: 0.002, quantity: 1000, category: 'other' },
    ];
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch real food supplies from the API
        const foodSuppliesResponse = await fetch('/api/food-supply');
        if (!foodSuppliesResponse.ok) {
          throw new Error('Failed to fetch food supplies');
        }
        const foodSuppliesData = await foodSuppliesResponse.json();
        setFoodSupplies(foodSuppliesData);
        setFilteredFoodSupplies(foodSuppliesData);

        // Fetch recipes from the API
        const recipesResponse = await fetch('/api/recipes');
        if (!recipesResponse.ok) {
          // If the endpoint returns 404 (not found), it might be because the table is empty
          // or the endpoint doesn't exist yet. In that case, use mock data.
          if (recipesResponse.status === 404) {
            setRecipes(generateMockRecipes());
            setFilteredRecipes(generateMockRecipes());
          } else {
            throw new Error('Failed to fetch recipes');
          }
        } else {
          const recipesData = await recipesResponse.json();
          // If we got an empty array, use mock data for demonstration
          if (recipesData.length === 0) {
            setRecipes(generateMockRecipes());
            setFilteredRecipes(generateMockRecipes());
          } else {
            setRecipes(recipesData);
            setFilteredRecipes(recipesData);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        // Fallback to mock data if API calls fail
        const mockRecipes = generateMockRecipes();
        setRecipes(mockRecipes);
        setFilteredRecipes(mockRecipes);

        // If food supplies failed to load, use mock data for them too
        if (foodSupplies.length === 0) {
          const mockSupplies = generateMockFoodSupplies();
          setFoodSupplies(mockSupplies);
          setFilteredFoodSupplies(mockSupplies);
        }

        toast({
          title: t('warning'),
          description: t('using_demo_data_due_to_api_error'),
          variant: "warning",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [t, toast]);

  // Populate form state from recipe prop when editing
  useEffect(() => {
    if (recipe && controlledOpen) {
      // Editing mode
      setIsEditMode(true);
      setActiveTab('create');
      setNewRecipe({
        name: recipe.name || '',
        description: recipe.description || '',
        servings: recipe.servings ? String(recipe.servings) : '4',
        prepTime: recipe.prepTime ? String(recipe.prepTime) : '30',
        instructions: recipe.instructions || '',
        sellingPrice: recipe.sellingPrice !== undefined ? String(recipe.sellingPrice) : '',
      });
      // Map ingredients to EnhancedRecipeIngredient
      setIngredients(
        (recipe.ingredients || []).map((ing: any) => {
          if ((ing as any).subRecipeId) {
            return {
              ...ing,
              type: 'subrecipe',
              subRecipeId: (ing as any).subRecipeId,
              subRecipeName: (ing as any).subRecipeName || ing.name,
            };
          } else {
            return {
              ...ing,
              type: 'food',
              wastePercentage: typeof (ing as any).wastePercentage === 'number' ? (ing as any).wastePercentage : 0,
            };
          }
        })
      );
    } else if (!controlledOpen) {
      // Reset to create mode when dialog closes
      setIsEditMode(false);
      setNewRecipe({
        name: '',
        description: '',
        servings: '4',
        prepTime: '30',
        instructions: '',
        sellingPrice: '',
      });
      setIngredients([]);
    }
  }, [recipe, controlledOpen]);

  // Filter recipes when search term changes, and filter by subrecipeMode
  useEffect(() => {
    let baseList = recipes;
    if (subrecipeMode) {
      baseList = recipes.filter(r => r.isSubrecipe);
    }
    if (!searchTerm) {
      setFilteredRecipes(baseList);
    } else {
      const filtered = baseList.filter(recipe => 
        recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipe.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredRecipes(filtered);
    }
  }, [searchTerm, recipes, subrecipeMode]);

  // Filter food supplies when category changes
  useEffect(() => {
    if (selectedIngredientCategory === 'all') {
      setFilteredFoodSupplies(foodSupplies);
    } else {
      const filtered = foodSupplies.filter(item => 
        item.category?.toLowerCase() === selectedIngredientCategory.toLowerCase()
      );
      setFilteredFoodSupplies(filtered);
    }
  }, [selectedIngredientCategory, foodSupplies]);

  // Enhanced: Add either food ingredient (with waste) or subrecipe
  const handleAddIngredient = () => {
    if (!selectedIngredient) {
      toast({
        title: t('error'),
        description: t('please_select_ingredient_and_quantity'),
        variant: "destructive",
      });
      return;
    }

    if (ingredientType === 'food') {
      if (!ingredientQuantity || parseFloat(ingredientQuantity) <= 0) {
        toast({
          title: t('error'),
          description: t('please_select_ingredient_and_quantity'),
          variant: "destructive",
        });
        return;
      }
      const foodSupply = foodSupplies.find(fs => fs.id === selectedIngredient);
      if (!foodSupply) return;

      // Always default waste to 0 if not set or invalid
      let waste = 0;
      if (ingredientWaste !== undefined && ingredientWaste !== null && ingredientWaste !== '') {
        const parsedWaste = parseFloat(ingredientWaste);
        waste = isNaN(parsedWaste) ? 0 : parsedWaste;
      }
      // If still blank or invalid, default to 0
      if (ingredientWaste === '' || ingredientWaste === undefined || ingredientWaste === null) {
        waste = 0;
      }

      // Base cost without waste
      const baseCost = parseFloat(ingredientQuantity) * foodSupply.pricePerUnit;
      // Waste cost: quantity * waste percentage * price per unit
      const wasteCost = parseFloat(ingredientQuantity) * (waste / 100) * foodSupply.pricePerUnit;
      // Total cost includes both base cost and waste cost
      const totalCost = baseCost + wasteCost;

      const newIngredient: EnhancedRecipeIngredient = {
        id: `temp-${Date.now()}`,
        foodSupplyId: foodSupply.id,
        name: foodSupply.name,
        quantity: parseFloat(ingredientQuantity),
        unit: foodSupply.unit,
        cost: parseFloat(totalCost.toFixed(2)),
        type: 'food',
        wastePercentage: waste,
      };

      setIngredients([...ingredients, newIngredient]);
    } else if (ingredientType === 'subrecipe') {
      const subRecipe = recipes.find(r => r.id === selectedIngredient);
      if (!subRecipe) return;

      // Default quantity to 1 if blank, zero, or invalid
      let subQuantity = 1;
      if (ingredientQuantity !== undefined && ingredientQuantity !== null && ingredientQuantity !== '') {
        const parsed = parseInt(ingredientQuantity);
        subQuantity = isNaN(parsed) || parsed <= 0 ? 1 : parsed;
      }

      const newIngredient: EnhancedRecipeIngredient = {
        id: `temp-${Date.now()}`,
        foodSupplyId: '', // Not a food supply
        name: subRecipe.name,
        quantity: subQuantity,
        unit: t('serving'),
        cost: subRecipe.costPerServing * subQuantity,
        type: 'subrecipe',
        subRecipeId: subRecipe.id,
        subRecipeName: subRecipe.name,
      };

      setIngredients([...ingredients, newIngredient]);
    }

    setSelectedIngredient('');
    setIngredientQuantity('');
    setIngredientWaste('');
  };

  const handleRemoveIngredient = (id: string) => {
    setIngredients(ingredients.filter(ing => ing.id !== id));
  };

  // Enhanced: Always calculate cost live for each ingredient (matches per-ingredient display)
  const calculateTotalCost = () => {
    return ingredients.reduce((sum, ing) => {
      if (ing.type === 'food') {
        const foodSupply = foodSupplies.find(fs => fs.id === ing.foodSupplyId);
        const pricePerUnit = foodSupply ? foodSupply.pricePerUnit : 0;
        const waste = typeof ing.wastePercentage === 'number' ? ing.wastePercentage : 0;
        const baseCost = ing.quantity * pricePerUnit;
        const wasteCost = ing.quantity * (waste / 100) * pricePerUnit;
        return sum + baseCost + wasteCost;
      } else if (ing.type === 'subrecipe') {
        const sub = recipes.find(r => r.id === ing.subRecipeId);
        const costPerServing = sub?.costPerServing || 0;
        return sum + (costPerServing * ing.quantity);
      }
      return sum;
    }, 0);
  };

  const calculateCostPerServing = () => {
    const totalCost = calculateTotalCost();
    const servings = parseInt(newRecipe.servings) || 1;
    return totalCost / servings;
  };

  // Unified create/update handler
  const handleSaveRecipe = async () => {
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

    setIsSubmitting(true);
    try {
      let response;
      if (isEditMode && recipe && recipe.id) {
        // Update existing recipe
        response = await fetch(`/api/recipes/${recipe.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: newRecipe.name,
            description: newRecipe.description,
            servings: parseInt(newRecipe.servings),
            prepTime: parseInt(newRecipe.prepTime),
            instructions: newRecipe.instructions,
            sellingPrice: parseFloat(newRecipe.sellingPrice) || 0,
            ingredients: ingredients.map(ing => {
              if (ing.type === 'food') {
                return {
                  foodSupplyId: ing.foodSupplyId,
                  quantity: ing.quantity,
                  wastePercentage: typeof ing.wastePercentage === 'number' && !isNaN(ing.wastePercentage) ? ing.wastePercentage : 0,
                  type: 'food'
                };
              } else if (ing.type === 'subrecipe') {
                return {
                  subRecipeId: ing.subRecipeId,
                  quantity: ing.quantity,
                  type: 'subrecipe'
                };
              }
              return {};
            }),
            totalCost,
            costPerServing,
            kitchenId: kitchenId,
            isSubrecipe: !!subrecipeMode,
          }),
        });
      } else {
        // Create new recipe
        response = await fetch('/api/recipes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: newRecipe.name,
            description: newRecipe.description,
            servings: parseInt(newRecipe.servings),
            prepTime: parseInt(newRecipe.prepTime),
            instructions: newRecipe.instructions,
            sellingPrice: parseFloat(newRecipe.sellingPrice) || 0,
            ingredients: ingredients.map(ing => {
              if (ing.type === 'food') {
                return {
                  foodSupplyId: ing.foodSupplyId,
                  quantity: ing.quantity,
                  wastePercentage: typeof ing.wastePercentage === 'number' && !isNaN(ing.wastePercentage) ? ing.wastePercentage : 0,
                  type: 'food'
                };
              } else if (ing.type === 'subrecipe') {
                return {
                  subRecipeId: ing.subRecipeId,
                  quantity: ing.quantity,
                  type: 'subrecipe'
                };
              }
              return {};
            }),
            totalCost,
            costPerServing,
            kitchenId: kitchenId,
            isSubrecipe: !!subrecipeMode,
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || (isEditMode ? 'Failed to update recipe' : 'Failed to create recipe'));
      }

      const resultRecipe = await response.json();

      if (isEditMode) {
        toast({
          title: t('recipe_updated') || 'Recipe updated',
          description: t('recipe_updated_successfully') || 'Recipe updated successfully',
        });
      } else {
        toast({
          title: t('recipe_created'),
          description: t('recipe_created_successfully'),
        });
      }

      // Reset form and close dialog
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
      setIsEditMode(false);

      // Notify parent to refresh recipes
      if (onRecipeUpdated) onRecipeUpdated();
      setIsOpen(false);
    } catch (error) {
      console.error(isEditMode ? 'Error updating recipe:' : 'Error creating recipe:', error);
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : (isEditMode ? t('failed_to_update_recipe') : t('failed_to_create_recipe')),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
  };

  const handleDuplicateRecipe = (recipe: Recipe) => {
    const duplicatedRecipe: Recipe = {
      ...recipe,
      id: `recipe-${Date.now()}`,
      name: `${recipe.name} (${t('copy')})`,
    };

    setRecipes([...recipes, duplicatedRecipe]);
    setFilteredRecipes([...filteredRecipes, duplicatedRecipe]);
    
    toast({
      title: t('recipe_duplicated'),
      description: t('recipe_duplicated_successfully'),
    });
  };

  const handleUseRecipe = async (recipe: Recipe) => {
    // Check if we have enough ingredients
    const insufficient: RecipeIngredient[] = [];
    
    recipe.ingredients.forEach(ingredient => {
      const foodSupply = foodSupplies.find(fs => fs.id === ingredient.foodSupplyId);
      if (!foodSupply || foodSupply.quantity < ingredient.quantity) {
        insufficient.push({
          ...ingredient,
          available: foodSupply?.quantity || 0
        });
      }
    });
    
    if (insufficient.length > 0) {
      setInsufficientIngredients(insufficient);
      setRecipeToUse(recipe);
      setShowConfirmDialog(true);
    } else {
      // If all ingredients are available, proceed with using the recipe
      await processRecipeUsage(recipe);
    }
  };

  const processRecipeUsage = async (recipe: Recipe) => {
    try {
      // Show processing toast
      toast({
        title: t('processing'),
        description: t('processing_recipe_usage'),
      });
      
      // Use provided kitchenId or get the first kitchen as fallback
      let targetKitchenId = kitchenId;
      if (!targetKitchenId) {
        try {
          const kitchensResponse = await fetch('/api/kitchens');
          if (kitchensResponse.ok) {
            const kitchens = await kitchensResponse.json();
            if (kitchens.length > 0) {
              targetKitchenId = kitchens[0].id;
            }
          }
        } catch (error) {
          console.error('Error fetching kitchens:', error);
          targetKitchenId = 'default-kitchen-id';
        }
      }
      
      // Call the actual API endpoint
      const response = await fetch('/api/recipes/use', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipeId: recipe.id,
          kitchenId: targetKitchenId,
          notes: `Used recipe: ${recipe.name}`,
          forceUse: false
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // If there are insufficient ingredients, handle it
        if (errorData.insufficientIngredients) {
          setInsufficientIngredients(errorData.insufficientIngredients);
          setRecipeToUse(recipe);
          setShowConfirmDialog(true);
          return;
        }
        
        throw new Error(errorData.error || 'Failed to process recipe usage');
      }
      
      const data = await response.json();
      console.log('Recipe usage processed:', data);
      
      // Refresh food supplies to reflect the changes
      const foodSuppliesResponse = await fetch('/api/food-supply');
      if (foodSuppliesResponse.ok) {
        const updatedFoodSupplies = await foodSuppliesResponse.json();
        setFoodSupplies(updatedFoodSupplies);
        setFilteredFoodSupplies(updatedFoodSupplies);
      }
      
      // Always dispatch the event to refresh forecast data, regardless of API response
      console.log('Dispatching food-consumption-recorded event');
      const consumptionEvent = new CustomEvent('food-consumption-recorded', {
        detail: { 
          recipeId: recipe.id,
          recipeName: recipe.name,
          timestamp: new Date().toISOString()
        }
      });
      window.dispatchEvent(consumptionEvent);
      
      toast({
        title: t('recipe_used'),
        description: t('ingredients_deducted_from_inventory'),
      });
    } catch (error) {
      console.error('Error processing recipe usage:', error);
      let errorMessage = t('failed_to_process_recipe_usage');
      if (error instanceof Error && error.message) {
        errorMessage = error.message;
      }
      toast({
        title: t('error'),
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleForceUseRecipe = async () => {
    if (recipeToUse) {
      await processRecipeUsage(recipeToUse);
      setShowConfirmDialog(false);
      setRecipeToUse(null);
      setInsufficientIngredients([]);
    }
  };

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

  // Utility: Recursively calculate total waste amount for a list of ingredients (including subrecipes)
  function calculateTotalWasteAmount(ingredientList: any[], foodSupplyList: FoodSupplyItem[], allRecipes: Recipe[] = recipes) {
    let totalWaste = 0;
    for (const ing of ingredientList) {
      if (ing.type === 'food' && typeof ing.wastePercentage === 'number' && ing.wastePercentage > 0) {
        // Find pricePerUnit from foodSupplies
        const fs = foodSupplyList.find(fs => fs.id === ing.foodSupplyId);
        const pricePerUnit = fs ? fs.pricePerUnit : 0;
        // Calculate waste amount: quantity * waste percentage * price per unit
        const wasteAmount = ing.quantity * ((ing.wastePercentage || 0) / 100) * pricePerUnit;
        totalWaste += wasteAmount;
      } else if (ing.type === 'subrecipe' && ing.subRecipeId) {
        // Find the subrecipe in allRecipes
        const sub = allRecipes.find(r => r.id === ing.subRecipeId);
        if (sub && Array.isArray(sub.ingredients)) {
          // Recursively calculate subrecipe waste and multiply by quantity used
          const subWaste = calculateTotalWasteAmount(sub.ingredients, foodSupplyList, allRecipes);
          totalWaste += subWaste * (ing.quantity || 1);
        }
      }
    }
    return totalWaste;
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-green-600" />
              {isEditMode
                ? (subrecipeMode
                    ? t('edit_subrecipe') || 'Edit Subrecipe'
                    : t('edit_recipe') || 'Edit Recipe')
                : (subrecipeMode
                    ? t('subrecipe_management') || 'Subrecipe Management'
                    : t('recipe_management'))}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? (subrecipeMode
                    ? t('edit_existing_subrecipe') || 'Edit an existing subrecipe'
                    : t('edit_existing_recipe') || 'Edit an existing recipe')
                : (subrecipeMode
                    ? t('create_and_manage_subrecipes') || 'Create and manage subrecipes'
                    : t('create_and_manage_recipes'))}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="view" className="data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-950">
                <Utensils className="h-4 w-4 mr-2" />
                {subrecipeMode ? t('view_subrecipes') || 'View Subrecipes' : t('view_recipes')}
              </TabsTrigger>
              <TabsTrigger value="create" className="data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-950">
                <Plus className="h-4 w-4 mr-2" />
                {subrecipeMode ? t('create_subrecipe') || 'Create Subrecipe' : t('create_recipe')}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="view" className="flex-1 overflow-hidden flex flex-col">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (subrecipeMode ? recipes.filter(r => r.isSubrecipe).length === 0 : recipes.length === 0) ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ChefHat className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p>
                    {subrecipeMode
                      ? (t('no_subrecipes_found') || 'No subrecipes found')
                      : t('no_recipes_found')}
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => setActiveTab('create')}>
                    {subrecipeMode
                      ? (t('create_your_first_subrecipe') || 'Create your first subrecipe')
                      : t('create_your_first_recipe')}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-2">
                    <Label className="block mb-1 text-sm font-medium text-muted-foreground">
                      {subrecipeMode ? (t('search_subrecipes') || 'Search Subrecipes') : t('search_recipes')}
                    </Label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder={subrecipeMode ? (t('search_subrecipes') || 'Search Subrecipes') : t('search_recipes')}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Button variant="outline" size="icon" className="h-10 w-10" aria-label={t('filter')}>
                        <Filter className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <ScrollArea className="flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1 pb-4">
                      {filteredRecipes.length === 0 ? (
                        <div className="col-span-2 text-center py-8 text-muted-foreground">
                          <p>
                            {subrecipeMode
                              ? (t('no_subrecipes_match_search') || 'No subrecipes match your search')
                              : t('no_recipes_match_search')}
                          </p>
                        </div>
                      ) : (
                        filteredRecipes.map(recipe => (
                          <Card
                            key={recipe.id}
                            className={`hover:shadow-md transition-shadow overflow-hidden ${
                              recipe.isSubrecipe
                                ? 'border-t-4 border-purple-600 bg-purple-50 dark:bg-purple-900/10'
                                : ''
                            }`}
                          >
                            <CardHeader className="p-4 pb-2">
                              <div className="flex justify-between items-start">
                                <div
                                  className="cursor-pointer flex items-center gap-2"
                                  onClick={() => handleViewRecipe(recipe)}
                                >
                                  {recipe.isSubrecipe && (
                                    <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 mr-2">
                                      <ChefHat className="h-4 w-4 mr-1 text-purple-600" />
                                      {t('subrecipe')}
                                    </Badge>
                                  )}
                                  <CardTitle className="text-lg">{recipe.name}</CardTitle>
                                  <p className="text-sm text-muted-foreground mt-1">{recipe.description}</p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                >
                                  QAR {recipe.costPerServing.toFixed(2)} / {t('serving')}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-2">
                              {/* Minimal card for subrecipes */}
                              {recipe.isSubrecipe ? (
                                <>
                                  <div className="mb-2 text-xs text-muted-foreground">
                                    {t('subrecipe_card_hint') ||
                                      'Reusable group of ingredients. No selling price or servings.'}
                                  </div>
                                  <div className="flex flex-col gap-1 mb-2">
                                    <span className="font-medium">{t('ingredients')}:</span>
                                    <ul className="list-disc ml-5 text-sm">
                                      {recipe.ingredients.slice(0, 3).map((ing) => (
                                        <li key={ing.id}>
                                          {ing.name} – {ing.quantity} {ing.unit}
                                        </li>
                                      ))}
                                      {recipe.ingredients.length > 3 && (
                                        <li className="text-muted-foreground">
                                          +{recipe.ingredients.length - 3} {t('more')}
                                        </li>
                                      )}
                                    </ul>
                                  </div>
                                  <div className="flex justify-end gap-2 mt-3">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-blue-600 hover:bg-blue-50"
                                      onClick={() => handleDuplicateRecipe(recipe)}
                                    >
                                      <Copy className="h-3.5 w-3.5 mr-1" />
                                      {t('duplicate')}
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex gap-3 mb-3">
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
                                  {recipe.sellingPrice && recipe.sellingPrice > 0 && (
                                    <div className="flex justify-between items-center mb-3">
                                      <span className="text-sm font-medium">{t('selling_price')}:</span>
                                      <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                                        QAR {recipe.sellingPrice.toFixed(2)}
                                      </Badge>
                                    </div>
                                  )}
                                  <div className="flex justify-end gap-2 mt-3">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-blue-600 hover:bg-blue-50"
                                      onClick={() => handleDuplicateRecipe(recipe)}
                                    >
                                      <Copy className="h-3.5 w-3.5 mr-1" />
                                      {t('duplicate')}
                                    </Button>
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={() => handleUseRecipe(recipe)}
                                    >
                                      <Check className="h-3.5 w-3.5 mr-1" />
                                      {t('use_recipe')}
                                    </Button>
                                  </div>
                                </>
                              )}
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </>
              )}
              
              {selectedRecipe && (
                <Dialog open={!!selectedRecipe} onOpenChange={() => setSelectedRecipe(null)}>
                  <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <ChefHat className="h-5 w-5 text-green-600" />
                        {selectedRecipe.name}
                      </DialogTitle>
                      <DialogDescription>{selectedRecipe.description}</DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid grid-cols-3 gap-4 py-4">
                      {/* Only show servings and selling price for main recipes */}
                      {!selectedRecipe.isSubrecipe && (
                        <>
                          <Card className="bg-slate-50 dark:bg-slate-900">
                            <CardContent className="p-3 flex flex-col items-center justify-center">
                              <Users className="h-5 w-5 mb-1 text-slate-600 dark:text-slate-400" />
                              <span className="font-medium">{selectedRecipe.servings}</span>
                              <span className="text-xs text-muted-foreground">{t('servings')}</span>
                            </CardContent>
                          </Card>
                          <Card className="bg-slate-50 dark:bg-slate-900">
                            <CardContent className="p-3 flex flex-col items-center justify-center">
                              <Clock className="h-5 w-5 mb-1 text-slate-600 dark:text-slate-400" />
                              <span className="font-medium">{selectedRecipe.prepTime}</span>
                              <span className="text-xs text-muted-foreground">{t('minutes')}</span>
                            </CardContent>
                          </Card>
                          <Card className="bg-slate-50 dark:bg-slate-900">
                            <CardContent className="p-3 flex flex-col items-center justify-center">
                              <DollarSign className="h-5 w-5 mb-1 text-slate-600 dark:text-slate-400" />
                              <span className="font-medium">QAR {selectedRecipe.costPerServing.toFixed(2)}</span>
                              <span className="text-xs text-muted-foreground">{t('per_serving')}</span>
                            </CardContent>
                          </Card>
                        </>
                      )}
                      {/* For subrecipes, only show cost per serving */}
                      {selectedRecipe.isSubrecipe && (
                        <Card className="bg-slate-50 dark:bg-slate-900 col-span-3">
                          <CardContent className="p-3 flex flex-col items-center justify-center">
                            <DollarSign className="h-5 w-5 mb-1 text-slate-600 dark:text-slate-400" />
                            <span className="font-medium">QAR {selectedRecipe.costPerServing.toFixed(2)}</span>
                            <span className="text-xs text-muted-foreground">{t('per_serving')}</span>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium mb-2 flex items-center gap-2">
                          <Utensils className="h-4 w-4 text-green-600" />
                          {t('ingredients')}
                        </h3>
                        <div className="space-y-2">
                          {selectedRecipe.ingredients.map(ing => {
                            const foodSupply = foodSupplies.find(fs => fs.id === ing.foodSupplyId);
                            const isAvailable = foodSupply && foodSupply.quantity >= ing.quantity;
                            
                            return (
                              <div 
                                key={ing.id} 
                                className={`flex justify-between items-center text-sm p-2 rounded-md ${
                                  isAvailable ? 'bg-slate-50 dark:bg-slate-900' : 'bg-red-50 border border-red-100 dark:bg-red-900/20 dark:border-red-800/30'
                                }`}
                              >
                                <div className="flex items-center">
                                  {!isAvailable && (
                                    <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                                  )}
                                  <span>{ing.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span>{ing.quantity} {ing.unit}</span>
                                  <span className="text-green-700 dark:text-green-400">QAR {ing.cost.toFixed(2)}</span>
                                  {foodSupply && (
                                    <Badge variant="outline" className={isAvailable ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}>
                                      {foodSupply.quantity} {ing.unit} {t('in_stock')}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between items-center font-medium mt-2 p-2 border-t">
                          <span>{t('total_cost')}</span>
                          <span>QAR {selectedRecipe.totalCost.toFixed(2)}</span>
                        </div>
                        {/* Show total waste amount */}
                        <div className="flex justify-between items-center font-medium p-2">
                          <span>{t('total_waste_amount') || 'Total Waste Amount'}</span>
                          <span className="text-amber-700 dark:text-amber-400">
                            QAR {typeof selectedRecipe.totalWasteAmount === 'number'
                              ? selectedRecipe.totalWasteAmount.toFixed(2)
                              : calculateTotalWasteAmount(selectedRecipe.ingredients, foodSupplies).toFixed(2)}
                          </span>
                        </div>
                        {/* Only show selling price, profit, and net after waste for main recipes */}
                        {!selectedRecipe.isSubrecipe && selectedRecipe.sellingPrice && selectedRecipe.sellingPrice > 0 && (
                          <div className="flex justify-between items-center font-medium p-2">
                            <span>{t('selling_price')}</span>
                            <span className="text-blue-700 dark:text-blue-400">QAR {selectedRecipe.sellingPrice.toFixed(2)}</span>
                          </div>
                        )}
                        {!selectedRecipe.isSubrecipe && selectedRecipe.sellingPrice && selectedRecipe.sellingPrice > 0 && (
                          <div className="flex justify-between items-center font-medium p-2">
                            <span>{t('profit')}</span>
                            <span className={selectedRecipe.sellingPrice > selectedRecipe.totalCost ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
                              QAR {(selectedRecipe.sellingPrice - selectedRecipe.totalCost).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {/* Net after waste (selling price - total waste) */}
                        {!selectedRecipe.isSubrecipe && selectedRecipe.sellingPrice && selectedRecipe.sellingPrice > 0 && (
                          <div className="flex justify-between items-center font-medium p-2">
                            <span>{t('net_after_waste') || 'Net After Waste'}</span>
                            <span className="text-amber-700 dark:text-amber-400">
                              QAR {(selectedRecipe.sellingPrice - calculateTotalWasteAmount(selectedRecipe.ingredients, foodSupplies)).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <h3 className="font-medium mb-2 flex items-center gap-2">
                          <ChefHat className="h-4 w-4 text-green-600" />
                          {subrecipeMode || selectedRecipe.isSubrecipe ? (t('subrecipe_instructions') || 'Subrecipe Instructions') : t('instructions')}
                        </h3>
                        <Card className="bg-slate-50 dark:bg-slate-900">
                          <CardContent className="p-3 text-sm whitespace-pre-line">
                            {selectedRecipe.instructions}
                          </CardContent>
                        </Card>
                      </div>
                      
                      <div className="flex justify-end gap-2 pt-2">
                        <Button 
                          variant="outline" 
                          onClick={() => handleDuplicateRecipe(selectedRecipe)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          {t('duplicate')}
                        </Button>
                        {/* Only allow "use" for main recipes */}
                        {!selectedRecipe.isSubrecipe && (
                          <Button 
                            onClick={() => {
                              handleUseRecipe(selectedRecipe);
                              setSelectedRecipe(null);
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4 mr-2" />
                            {t('use_recipe')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>
            
            <TabsContent value="create" className="flex-1 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1">
                <div className="space-y-4 p-1 pb-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ChefHat className="h-5 w-5 text-green-600" />
                        {subrecipeMode ? t('subrecipe_details') || 'Subrecipe Details' : t('recipe_details')}
                      </CardTitle>
                      {subrecipeMode && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {t('subrecipe_details_hint') || 'Subrecipes are reusable ingredient groups. Only ingredient details are required.'}
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
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
                      
                      <div className="grid grid-cols-3 gap-4 mt-4">
                        {!subrecipeMode && (
                          <div className="space-y-2">
                            <Label htmlFor="servings">
                              {t('recipe_yield_servings') || 'Recipe Yield (Servings)'}
                            </Label>
                            <div className="relative">
                              <Users className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="servings"
                                type="number"
                                min="1"
                                value={newRecipe.servings}
                                onChange={(e) => setNewRecipe({ ...newRecipe, servings: e.target.value })}
                                className="pl-9"
                              />
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {t('servings_yield_hint') ||
                                "This is the number of servings this recipe makes. To actually serve the recipe and deduct ingredients, use the 'Serve' action after saving."}
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="prepTime">{t('prep_time')} ({t('minutes')})</Label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="prepTime"
                              type="number"
                              min="1"
                              value={newRecipe.prepTime}
                              onChange={(e) => setNewRecipe({ ...newRecipe, prepTime: e.target.value })}
                              className="pl-9"
                            />
                          </div>
                        </div>
                        {!subrecipeMode && (
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
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Utensils className="h-5 w-5 text-green-600" />
                        {t('ingredients')} *
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4">
                        <Label className="mb-2 block">{t('filter_by_category')}</Label>
                        <div className="flex flex-wrap gap-2">
                          {categories.map((category) => (
                            <Badge 
                              key={category} 
                              variant="outline" 
                              className={`cursor-pointer ${
                                selectedIngredientCategory === category 
                                  ? 'bg-primary text-primary-foreground' 
                                  : categoryColors[category] || 'bg-gray-100 text-gray-800'
                              }`}
                              onClick={() => setSelectedIngredientCategory(category)}
                            >
                              {category === 'all' 
                                ? t('all_categories') 
                                : category.charAt(0).toUpperCase() + category.slice(1)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      {/* Enhanced: Ingredient/Subrecipe selector */}
                      <div className="flex gap-2 mt-4 items-end">
                        <Select
                          value={ingredientType}
                          onValueChange={v => {
                            setIngredientType(v as IngredientType);
                            setSelectedIngredient('');
                            setIngredientWaste('');
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue>
                              {ingredientType === 'food' ? t('ingredient') : t('subrecipe')}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="food">{t('ingredient')}</SelectItem>
                            <SelectItem value="subrecipe">{t('subrecipe')}</SelectItem>
                          </SelectContent>
                        </Select>
                        {ingredientType === 'food' ? (
                          <>
                            <Select
                              value={selectedIngredient}
                              onValueChange={setSelectedIngredient}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder={t('select_ingredient')} />
                              </SelectTrigger>
                              <SelectContent>
                                {filteredFoodSupplies.map(fs => (
                                  <SelectItem key={fs.id} value={fs.id}>
                                    <div className="flex items-center justify-between w-full">
                                      <span>{fs.name}</span>
                                      <Badge variant="outline" className={categoryColors[fs.category?.toLowerCase()] || 'bg-gray-100'}>
                                        {fs.quantity} {fs.unit}
                                      </Badge>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="relative w-28">
                              <Scale className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder={t('quantity')}
                                value={ingredientQuantity}
                                onChange={(e) => setIngredientQuantity(e.target.value)}
                                className="pl-9"
                              />
                            </div>
                            <div className="relative w-28">
                              <Label htmlFor="waste" className="sr-only">{t('waste_percentage')}</Label>
                              <Input
                                id="waste"
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                placeholder={t('waste_percentage')}
                                value={ingredientWaste}
                                onChange={(e) => setIngredientWaste(e.target.value)}
                                className="pl-3"
                              />
                              <span className="absolute right-2 top-2.5 text-muted-foreground text-xs">%</span>
                              <div className="text-xs text-muted-foreground mt-1">
                                {t('waste_percentage_hint') || 'Required. Defaults to 0% if left blank.'}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <Select
                              value={selectedIngredient}
                              onValueChange={setSelectedIngredient}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder={t('select_subrecipe')} />
                              </SelectTrigger>
                              <SelectContent>
                                {recipes
                                  .filter(r => r.isSubrecipe && (!subrecipeMode || r.id !== undefined)) // Only show subrecipes
                                  .map(r => (
                                    <SelectItem key={r.id} value={r.id}>
                                      <span className="flex items-center gap-2">
                                        <ChefHat className="h-4 w-4 text-purple-600" />
                                        <span>{r.name}</span>
                                        <Badge className="ml-2 bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                                          {t('subrecipe')}
                                        </Badge>
                                      </span>
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <div className="relative w-28">
                              <Scale className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                placeholder={t('servings_to_use') || '1'}
                                value={ingredientQuantity}
                                onChange={(e) => setIngredientQuantity(e.target.value)}
                                className="pl-9"
                              />
                              <div className="text-xs text-muted-foreground mt-1">
                                {t('subrecipe_quantity_hint') || 'Number of subrecipe servings to use in this recipe. Usually 1.'}
                              </div>
                            </div>
                          </>
                        )}
                        <Button type="button" onClick={handleAddIngredient} className="bg-green-600 hover:bg-green-700">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="space-y-2 mt-4">
                        {ingredients.length === 0 ? (
                          <Card className="border-dashed">
                            <CardContent className="p-4 text-sm text-muted-foreground text-center">
                              {t('no_ingredients_added')}
                            </CardContent>
                          </Card>
                        ) : (
                          <div className="space-y-2">
                            {ingredients.map(ing => {
                              if (ing.type === 'food') {
                                const foodSupply = foodSupplies.find(fs => fs.id === ing.foodSupplyId);
                                const isAvailable = foodSupply && foodSupply.quantity >= ing.quantity;
                                const category = foodSupply?.category?.toLowerCase() || 'other';
                                return (
                                  <div 
                                    key={ing.id} 
                                    className={`flex justify-between items-center p-2 border rounded-md ${
                                      !isAvailable ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800/30' : ''
                                    }`}
                                  >
                                    <div className="flex items-center">
                                      {!isAvailable && (
                                        <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                                      )}
                                      <span className="font-medium">{ing.name}</span>
                                      <Badge variant="outline" className={`ml-2 ${categoryColors[category] || 'bg-gray-100'}`}>
                                        {category.charAt(0).toUpperCase() + category.slice(1)}
                                      </Badge>
                                      <span className="text-sm text-muted-foreground ml-2">
                                        {ing.quantity} {ing.unit}
                                      </span>
                                      <div className="flex items-center ml-2 gap-1">
                                        <Input
                                          type="number"
                                          min="0"
                                          max="100"
                                          step="0.01"
                                          value={typeof ing.wastePercentage === 'number' ? ing.wastePercentage : 0}
                                          onChange={e => {
                                            const newWaste = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                                            setIngredients(prev =>
                                              prev.map((item, i) =>
                                                item.id === ing.id
                                                  ? { ...item, wastePercentage: newWaste }
                                                  : item
                                              )
                                            );
                                          }}
                                          className="w-16 h-7 px-2 py-1 text-xs"
                                          aria-label={t('waste_percentage')}
                                        />
                                        <span className="ml-1 text-xs text-muted-foreground">%</span>
                                        {/* Show waste amount in QAR */}
                                        {(() => {
                                          const foodSupply = foodSupplies.find(fs => fs.id === ing.foodSupplyId);
                                          const pricePerUnit = foodSupply ? foodSupply.pricePerUnit : (ing.cost && ing.quantity ? ing.cost / ing.quantity : 0);
                                          const wasteAmount = ing.quantity * ((typeof ing.wastePercentage === 'number' ? ing.wastePercentage : 0) / 100) * pricePerUnit;
                                          return (
                                            <span className="ml-2 text-xs text-amber-700 font-semibold">
                                              {t('waste')}: QAR {wasteAmount.toFixed(2)}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {/* Live cost calculation for food and subrecipe */}
                                      <span className="text-sm text-green-700 dark:text-green-400">
                                        QAR {
                                          ing.type === 'food'
                                            ? (() => {
                                                const foodSupply = foodSupplies.find(fs => fs.id === ing.foodSupplyId);
                                                const pricePerUnit = foodSupply ? foodSupply.pricePerUnit : 0;
                                                const waste = typeof ing.wastePercentage === 'number' ? ing.wastePercentage : 0;
                                                const baseCost = ing.quantity * pricePerUnit;
                                                const wasteCost = ing.quantity * (waste / 100) * pricePerUnit;
                                                return (baseCost + wasteCost).toFixed(2);
                                              })()
                                            : ing.type === 'subrecipe'
                                              ? (() => {
                                                  const sub = recipes.find(r => r.id === ing.subRecipeId);
                                                  const costPerServing = sub?.costPerServing || 0;
                                                  return (costPerServing * ing.quantity).toFixed(2);
                                                })()
                                              : (ing.cost || 0).toFixed(2)
                                        }
                                      </span>
                                      {foodSupply && (
                                        <Badge variant="outline" className={isAvailable ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}>
                                          {foodSupply.quantity} {ing.unit} {t('in_stock')}
                                        </Badge>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveIngredient(ing.id)}
                                      >
                                        <X className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              } else if (ing.type === 'subrecipe') {
                                return (
                                  <div
                                    key={ing.id}
                                    className="flex justify-between items-center p-2 border rounded-md bg-purple-50 border-purple-200 dark:bg-purple-900/10 dark:border-purple-800/30"
                                  >
                                    <div className="flex items-center">
                                      <ChefHat className="h-4 w-4 text-purple-600 mr-2" />
                                      <span className="font-medium">{ing.subRecipeName || ing.name}</span>
                                      <span className="text-xs ml-2 text-muted-foreground">{t('subrecipe')}</span>
                                      <span className="text-sm text-muted-foreground ml-2">
                                        {ing.quantity} {t('serving')}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm text-purple-700 dark:text-purple-400">QAR {ing.cost.toFixed(2)}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveIngredient(ing.id)}
                                      >
                                        <X className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })}
                            
                            <div className="flex justify-between items-center p-3 border-t mt-2">
                              <span className="font-medium">{t('total_cost')}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">QAR {calculateTotalCost().toFixed(2)}</span>
                                <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                                  QAR {calculateCostPerServing().toFixed(2)} / {t('serving')}
                                </Badge>
                              </div>
                            </div>
                            {!subrecipeMode && parseFloat(newRecipe.sellingPrice) > 0 && (
                              <div className="flex justify-between items-center p-3">
                                <span className="font-medium">{t('selling_price')}</span>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                                  QAR {parseFloat(newRecipe.sellingPrice).toFixed(2)}
                                </Badge>
                              </div>
                            )}
                            {!subrecipeMode && parseFloat(newRecipe.sellingPrice) > 0 && (
                              <div className="flex justify-between items-center p-3">
                                <span className="font-medium">{t('profit')}</span>
                                <Badge 
                                  variant="outline" 
                                  className={
                                    parseFloat(newRecipe.sellingPrice) > calculateTotalCost() 
                                      ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" 
                                      : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                  }
                                >
                                  QAR {(parseFloat(newRecipe.sellingPrice) - calculateTotalCost()).toFixed(2)}
                                </Badge>
                              </div>
                            )}
                            {/* Show total waste amount in create tab */}
                            <div className="flex justify-between items-center p-3">
                              <span className="font-medium">{t('total_waste_amount') || 'Total Waste Amount'}</span>
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                QAR {calculateTotalWasteAmount(ingredients, foodSupplies, recipes).toFixed(2)}
                              </Badge>
                            </div>
                            {/* Net after waste (selling price - total waste) */}
                            {!subrecipeMode && parseFloat(newRecipe.sellingPrice) > 0 && (
                              <div className="flex justify-between items-center p-3">
                                <span className="font-medium">{t('net_after_waste') || 'Net After Waste'}</span>
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                  QAR {(parseFloat(newRecipe.sellingPrice) - calculateTotalWasteAmount(ingredients, foodSupplies, recipes)).toFixed(2)}
                                </Badge>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ChefHat className="h-5 w-5 text-green-600" />
                        {subrecipeMode ? t('subrecipe_instructions') || 'Subrecipe Instructions' : t('instructions')} *
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        id="instructions"
                        value={newRecipe.instructions}
                        onChange={(e) => setNewRecipe({ ...newRecipe, instructions: e.target.value })}
                        placeholder={t('enter_recipe_instructions')}
                        rows={6}
                      />
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
              
              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <Button variant="outline" onClick={() => setActiveTab('view')}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleSaveRecipe} className="bg-green-600 hover:bg-green-700">
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                      {isEditMode ? t('saving') || 'Saving' : t('saving')}
                    </>
                  ) : (
                    <>
                      <Calculator className="h-4 w-4 mr-2" />
                      {isEditMode ? t('update_recipe') || 'Update Recipe' : t('calculate_and_save')}
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('insufficient_ingredients')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('some_ingredients_are_not_available_in_sufficient_quantity')}:
              <div className="mt-4 space-y-2">
                {insufficientIngredients.map(ing => {
                  const foodSupply = foodSupplies.find(fs => fs.id === ing.foodSupplyId);
                  return (
                    <div key={ing.id} className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/10 rounded-md">
                      <span>{ing.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {t('needed')}: {ing.quantity} {ing.unit}
                        </span>
                        <span className="text-muted-foreground">
                          {t('available')}: {ing.available || foodSupply?.quantity || 0} {ing.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4">{t('would_you_like_to_proceed_anyway')}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceUseRecipe} className="bg-red-600 hover:bg-red-700">
              {t('use_anyway')}
            </AlertDialogAction>
            <Button 
              variant="outline" 
              className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
              onClick={() => {
                setShowConfirmDialog(false);
                toast({
                  title: t('shopping_list_created'),
                  description: t('shopping_list_created_for_missing_ingredients'),
                });
              }}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {t('create_shopping_list')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}