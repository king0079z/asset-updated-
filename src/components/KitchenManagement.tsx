import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { KitchenConsumptionDialog } from './KitchenConsumptionDialog';
import { KitchenConsumptionTab } from './KitchenConsumptionTab';
import { KitchenAnalyticsTab } from './KitchenAnalyticsTab';
import { Plus, Building2, Hash, FileText, Barcode, Utensils, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from "@/contexts/TranslationContext";

interface Kitchen {
  id: string;
  name: string;
  floorNumber: string;
  description?: string;
  barcodes: any[];
}

export function KitchenManagement() {
  const [selectedKitchenId, setSelectedKitchenId] = useState<string | null>(null);
  const [selectedKitchenName, setSelectedKitchenName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('kitchens');
  const [selectedTab, setSelectedTab] = useState<string>('consumption');
  const { user } = useAuth();
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [newKitchen, setNewKitchen] = useState({
    name: '',
    floorNumber: '',
    description: '',
  });
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  const fetchKitchens = async () => {
    try {
      const response = await fetch('/api/kitchens');
      if (response.ok) {
        const data = await response.json();
        setKitchens(data);
      }
    } catch (error) {
      console.error('Error fetching kitchens:', error);
      toast({
        title: t('error'),
        description: t('failed_to_fetch_kitchens'),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchKitchens();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/kitchens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newKitchen),
      });

      if (response.ok) {
        toast({
          title: t('success'),
          description: t('kitchen_created_successfully'),
        });
        setIsOpen(false);
        setNewKitchen({ name: '', floorNumber: '', description: '' });
        fetchKitchens();
      }
    } catch (error) {
      console.error('Error creating kitchen:', error);
      toast({
        title: t('error'),
        description: t('failed_to_create_kitchen'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('kitchen_management')}</h2>
          <p className="text-muted-foreground mt-2">
            {t('manage_kitchen_locations')}
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="h-5 w-5 mr-2" />
              {t('add_kitchen')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('add_new_kitchen')}</DialogTitle>
              <DialogDescription>
                {t('create_new_kitchen_location')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('kitchen_name')}</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    id="name"
                    className="pl-10"
                    placeholder={t('enter_kitchen_name')}
                    value={newKitchen.name}
                    onChange={(e) =>
                      setNewKitchen({ ...newKitchen, name: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="floorNumber">{t('floor_number')}</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    id="floorNumber"
                    className="pl-10"
                    placeholder={t('enter_floor_number')}
                    value={newKitchen.floorNumber}
                    onChange={(e) =>
                      setNewKitchen({ ...newKitchen, floorNumber: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t('description')}</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    id="description"
                    className="pl-10"
                    placeholder={t('enter_kitchen_description')}
                    value={newKitchen.description}
                    onChange={(e) =>
                      setNewKitchen({ ...newKitchen, description: e.target.value })
                    }
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">{t('create_kitchen')}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Separator />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">
            {selectedKitchenId && activeTab === 'kitchen-details' ? `${selectedKitchenName} ${t('details')}` : t('kitchen_list')}
          </h2>
          <TabsList>
            <TabsTrigger value="kitchens">
              {t('kitchens')}
            </TabsTrigger>
            <TabsTrigger value="kitchen-details" disabled={!selectedKitchenId}>
              {selectedKitchenName || t('kitchen_details')}
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="kitchens" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {kitchens.map((kitchen) => (
              <Card key={kitchen.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{kitchen.name}</CardTitle>
                    <Badge variant="secondary">Floor {kitchen.floorNumber}</Badge>
                  </div>
                  {kitchen.description && (
                    <CardDescription className="mt-2">{kitchen.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2 text-sm">
                    <Barcode className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {kitchen.barcodes.length} {t('active_barcodes')}
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedKitchenId(kitchen.id);
                      setSelectedKitchenName(kitchen.name);
                      setActiveTab('kitchen-details');
                      setSelectedTab('consumption');
                    }}
                  >
                    <Utensils className="h-4 w-4 mr-2" />
                    {t('view_details')}
                  </Button>
                  <KitchenConsumptionDialog 
                    kitchenId={kitchen.id} 
                    kitchenName={kitchen.name} 
                  />
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="kitchen-details" className="mt-0">
          {selectedKitchenId ? (
            <div className="space-y-6">
              <div className="border-b">
                <div className="flex">
                  <button 
                    className={`px-4 py-2 text-sm font-medium ${selectedTab === 'consumption' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                    onClick={() => setSelectedTab('consumption')}
                  >
                    <Utensils className="h-4 w-4 inline mr-2" />
                    {t('consumption')}
                  </button>
                  <button 
                    className={`px-4 py-2 text-sm font-medium ${selectedTab === 'analytics' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                    onClick={() => setSelectedTab('analytics')}
                  >
                    <BarChart3 className="h-4 w-4 inline mr-2" />
                    {t('analytics')}
                  </button>
                </div>
              </div>
              
              {selectedTab === 'consumption' ? (
                <KitchenConsumptionTab 
                  kitchenId={selectedKitchenId} 
                  kitchenName={selectedKitchenName} 
                />
              ) : (
                <KitchenAnalyticsTab 
                  kitchenId={selectedKitchenId} 
                  kitchenName={selectedKitchenName} 
                />
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>{t('select_kitchen_to_view_details')}</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}