import React, { useState } from 'react';
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
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Leaf, Save, Info, BarChart3 } from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";

interface NutritionalInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  allergens: string[];
}

interface NutritionalInfoDialogProps {
  foodSupplyId: string;
  foodSupplyName: string;
  onUpdate: () => void;
  initialData?: Partial<NutritionalInfo>;
}

export function NutritionalInfoDialog({
  foodSupplyId,
  foodSupplyName,
  onUpdate,
  initialData
}: NutritionalInfoDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  
  // Form state
  const [nutritionalInfo, setNutritionalInfo] = useState<Partial<NutritionalInfo>>(
    initialData || {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      allergens: [],
    }
  );
  
  const [allergenInput, setAllergenInput] = useState('');

  const handleInputChange = (field: keyof NutritionalInfo, value: string) => {
    const numValue = parseFloat(value) || 0;
    setNutritionalInfo({
      ...nutritionalInfo,
      [field]: numValue
    });
  };

  const handleAddAllergen = () => {
    if (!allergenInput.trim()) return;
    
    const allergens = nutritionalInfo.allergens || [];
    if (!allergens.includes(allergenInput.trim())) {
      setNutritionalInfo({
        ...nutritionalInfo,
        allergens: [...allergens, allergenInput.trim()]
      });
    }
    setAllergenInput('');
  };

  const handleRemoveAllergen = (allergen: string) => {
    const allergens = nutritionalInfo.allergens || [];
    setNutritionalInfo({
      ...nutritionalInfo,
      allergens: allergens.filter(a => a !== allergen)
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // In a real implementation, this would call an API endpoint
      // For now, we'll just simulate a successful API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: t('nutritional_info_updated'),
        description: t('nutritional_info_updated_successfully'),
      });
      
      setOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating nutritional info:', error);
      toast({
        title: t('error'),
        description: t('failed_to_update_nutritional_info'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate macronutrient percentages
  const calculateMacroPercentages = () => {
    const { protein = 0, carbs = 0, fat = 0 } = nutritionalInfo;
    const total = protein + carbs + fat;
    
    if (total === 0) return { protein: 0, carbs: 0, fat: 0 };
    
    return {
      protein: Math.round((protein / total) * 100),
      carbs: Math.round((carbs / total) * 100),
      fat: Math.round((fat / total) * 100),
    };
  };

  const macroPercentages = calculateMacroPercentages();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
          <Leaf className="h-4 w-4 mr-2" />
          {t('nutritional_info')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('nutritional_information')}</DialogTitle>
          <DialogDescription>
            {t('manage_nutritional_info_for')} {foodSupplyName}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="edit">
              <Info className="h-4 w-4 mr-2" />
              {t('edit_info')}
            </TabsTrigger>
            <TabsTrigger value="view">
              <BarChart3 className="h-4 w-4 mr-2" />
              {t('view_summary')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="edit" className="flex-1 overflow-hidden">
            <div className="space-y-4 py-4 overflow-y-auto pr-1 h-full">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="calories">{t('calories')} (kcal)</Label>
                <Input
                  id="calories"
                  type="number"
                  min="0"
                  step="0.1"
                  value={nutritionalInfo.calories || ''}
                  onChange={(e) => handleInputChange('calories', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="protein">{t('protein')} (g)</Label>
                <Input
                  id="protein"
                  type="number"
                  min="0"
                  step="0.1"
                  value={nutritionalInfo.protein || ''}
                  onChange={(e) => handleInputChange('protein', e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="carbs">{t('carbohydrates')} (g)</Label>
                <Input
                  id="carbs"
                  type="number"
                  min="0"
                  step="0.1"
                  value={nutritionalInfo.carbs || ''}
                  onChange={(e) => handleInputChange('carbs', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fat">{t('fat')} (g)</Label>
                <Input
                  id="fat"
                  type="number"
                  min="0"
                  step="0.1"
                  value={nutritionalInfo.fat || ''}
                  onChange={(e) => handleInputChange('fat', e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fiber">{t('fiber')} (g)</Label>
                <Input
                  id="fiber"
                  type="number"
                  min="0"
                  step="0.1"
                  value={nutritionalInfo.fiber || ''}
                  onChange={(e) => handleInputChange('fiber', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sugar">{t('sugar')} (g)</Label>
                <Input
                  id="sugar"
                  type="number"
                  min="0"
                  step="0.1"
                  value={nutritionalInfo.sugar || ''}
                  onChange={(e) => handleInputChange('sugar', e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sodium">{t('sodium')} (mg)</Label>
              <Input
                id="sodium"
                type="number"
                min="0"
                step="1"
                value={nutritionalInfo.sodium || ''}
                onChange={(e) => handleInputChange('sodium', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('allergens')}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={t('add_allergen')}
                  value={allergenInput}
                  onChange={(e) => setAllergenInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAllergen();
                    }
                  }}
                />
                <Button type="button" onClick={handleAddAllergen}>
                  {t('add')}
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-2">
                {(nutritionalInfo.allergens || []).map(allergen => (
                  <div
                    key={allergen}
                    className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-sm flex items-center gap-1"
                  >
                    {allergen}
                    <button
                      type="button"
                      onClick={() => handleRemoveAllergen(allergen)}
                      className="ml-1 h-4 w-4 rounded-full bg-red-200 text-red-700 flex items-center justify-center hover:bg-red-300"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {(nutritionalInfo.allergens || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">{t('no_allergens_added')}</p>
                )}
              </div>
            </div>
            </div>
          </TabsContent>
          
          <TabsContent value="view" className="flex-1 overflow-y-auto py-4 pr-1">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-medium">{t('nutritional_value')}</h3>
                    <p className="text-3xl font-bold mt-2">{nutritionalInfo.calories || 0} kcal</p>
                    <p className="text-sm text-muted-foreground">{t('per_100g_serving')}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">{t('macronutrients')}</h4>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-blue-50 p-3 rounded-md">
                        <p className="text-sm text-blue-700">{t('protein')}</p>
                        <p className="font-bold">{nutritionalInfo.protein || 0}g</p>
                        <p className="text-xs text-muted-foreground">{macroPercentages.protein}%</p>
                      </div>
                      <div className="bg-amber-50 p-3 rounded-md">
                        <p className="text-sm text-amber-700">{t('carbs')}</p>
                        <p className="font-bold">{nutritionalInfo.carbs || 0}g</p>
                        <p className="text-xs text-muted-foreground">{macroPercentages.carbs}%</p>
                      </div>
                      <div className="bg-rose-50 p-3 rounded-md">
                        <p className="text-sm text-rose-700">{t('fat')}</p>
                        <p className="font-bold">{nutritionalInfo.fat || 0}g</p>
                        <p className="text-xs text-muted-foreground">{macroPercentages.fat}%</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">{t('additional_nutrients')}</h4>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="border p-2 rounded-md">
                        <p className="text-sm text-muted-foreground">{t('fiber')}</p>
                        <p className="font-medium">{nutritionalInfo.fiber || 0}g</p>
                      </div>
                      <div className="border p-2 rounded-md">
                        <p className="text-sm text-muted-foreground">{t('sugar')}</p>
                        <p className="font-medium">{nutritionalInfo.sugar || 0}g</p>
                      </div>
                      <div className="border p-2 rounded-md">
                        <p className="text-sm text-muted-foreground">{t('sodium')}</p>
                        <p className="font-medium">{nutritionalInfo.sodium || 0}mg</p>
                      </div>
                    </div>
                  </div>
                  
                  {(nutritionalInfo.allergens || []).length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">{t('allergens')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {(nutritionalInfo.allergens || []).map(allergen => (
                          <div
                            key={allergen}
                            className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-sm"
                          >
                            {allergen}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? t('saving') : t('save_changes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}