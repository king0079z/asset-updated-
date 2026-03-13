import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/router';
import { useTranslation } from '@/contexts/TranslationContext';
import { Building2, Package, ArrowRight } from 'lucide-react';

interface KitchenFoodSupplyNavigationProps {
  currentPage: 'kitchen' | 'foodSupply';
  kitchenId?: string;
  kitchenName?: string;
}

/**
 * A navigation component that links between the Kitchen Management page
 * and the Food Supply Management page, providing context-aware navigation
 */
export function KitchenFoodSupplyNavigation({ 
  currentPage, 
  kitchenId, 
  kitchenName 
}: KitchenFoodSupplyNavigationProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const navigateToKitchens = () => {
    router.push('/kitchens');
  };

  const navigateToFoodSupply = () => {
    router.push('/food-supply');
  };

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100 dark:border-blue-800/30 shadow-sm">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <div>
            <h3 className="font-medium text-blue-800 dark:text-blue-300 flex items-center">
              {currentPage === 'kitchen' ? (
                <>
                  <Package className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                  {t('food_supply_management')}
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                  {t('kitchen_management')}
                </>
              )}
            </h3>
            <p className="text-sm text-blue-700/70 dark:text-blue-400/70 mt-1">
              {currentPage === 'kitchen' 
                ? t('manage_food_inventory_and_supplies') 
                : t('manage_kitchen_locations_and_assignments')}
            </p>
          </div>
          <Button 
            variant="outline" 
            className="bg-white dark:bg-blue-900/30 border-blue-200 dark:border-blue-700/30 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-800/30"
            onClick={currentPage === 'kitchen' ? navigateToFoodSupply : navigateToKitchens}
          >
            {currentPage === 'kitchen' 
              ? t('go_to_food_supply') 
              : t('go_to_kitchens')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}