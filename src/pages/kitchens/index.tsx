import { DashboardLayout } from "@/components/DashboardLayout";
import { UserKitchenPageSimplified } from "@/components/UserKitchenPageSimplified";
import { KitchenAssignmentManager } from "@/components/KitchenAssignmentManager";
import { KitchenFoodSupplyNavigation } from "@/components/KitchenFoodSupplyNavigation";
import { useAuth } from '@/contexts/AuthContext';
import { usePageAccess } from '@/hooks/usePageAccess';
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/contexts/TranslationContext";
import { Building2, Users, ChefHat, LayoutDashboard } from "lucide-react";
import { fetchWithCache } from '@/lib/api-cache';

export default function KitchensPage() {
  const { user } = useAuth();
  const { isAdmin, isManager, loading } = usePageAccess();
  const [isAdminOrManager, setIsAdminOrManager] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!loading) {
      setIsAdminOrManager(isAdmin || isManager);
    }
  }, [isAdmin, isManager, loading]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('kitchen_management')}</h1>
        <p className="text-muted-foreground mt-1">{t('manage_kitchen_inventory_and_finances')}</p>
      </div>
      
      <div className="mb-6">
        <KitchenFoodSupplyNavigation currentPage="kitchen" />
      </div>
      
      {isAdminOrManager ? (
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
            <CardTitle className="text-xl flex items-center">
              <LayoutDashboard className="h-5 w-5 mr-2 text-primary" />
              {t('kitchen_dashboard')}
            </CardTitle>
            <CardDescription>{t('manage_all_kitchen_operations')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="my-kitchens" className="w-full">
              <TabsList className="w-full grid grid-cols-2 rounded-none border-b">
                <TabsTrigger value="my-kitchens" className="flex items-center gap-2 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  <Building2 className="h-4 w-4" />
                  {t('my_kitchens')}
                </TabsTrigger>
                <TabsTrigger value="assignments" className="flex items-center gap-2 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  <Users className="h-4 w-4" />
                  {t('kitchen_assignments')}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="my-kitchens" className="p-0 pt-4">
                <UserKitchenPageSimplified />
              </TabsContent>
              
              <TabsContent value="assignments" className="p-0 pt-4">
                <KitchenAssignmentManager />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
            <CardTitle className="text-xl flex items-center">
              <ChefHat className="h-5 w-5 mr-2 text-primary" />
              {t('my_kitchen_dashboard')}
            </CardTitle>
            <CardDescription>{t('manage_your_kitchen_inventory_and_finances')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0 pt-4">
            <UserKitchenPageSimplified />
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}