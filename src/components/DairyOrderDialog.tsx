import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Printer, Download, ShoppingCart, Filter, ChevronDown, Search, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useTranslation } from "@/contexts/TranslationContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

interface FoodSupplyItem {
  id: string;
  name: string;
  currentStock: number;
  unit: string;
  recommendedOrder: number;
  pricePerUnit: number;
  supplier: string;
  lastOrderDate: string;
  expirationDate: string;
  category: string;
}

export function DairyOrderDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [foodSupplyItems, setFoodSupplyItems] = useState<FoodSupplyItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<FoodSupplyItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastOrderDate, setLastOrderDate] = useState<string>('');
  const [mainSupplier, setMainSupplier] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    // Only fetch data when the dialog is opened
    if (open) {
      fetchFoodSupplyItems();
    }
  }, [open]);

  useEffect(() => {
    // Filter items when category or search term changes
    let filtered = foodSupplyItems;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => 
        item.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredItems(filtered);
  }, [selectedCategory, searchTerm, foodSupplyItems]);

  const fetchFoodSupplyItems = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch all food supplies
      const response = await fetch('/api/food-supply');
      
      if (!response.ok) {
        throw new Error('Failed to fetch food supply items');
      }
      
      const data = await response.json();
      
      // Transform data to match our interface
      const formattedItems: FoodSupplyItem[] = data.map((item: any) => {
        // Calculate recommended order based on current stock
        // If stock is below 5, recommend ordering enough to reach 20
        // Otherwise, recommend ordering 10 units
        const recommendedOrder = item.quantity < 5 ? 20 - item.quantity : 10;
        
        return {
          id: item.id,
          name: item.name,
          currentStock: item.quantity,
          unit: item.unit,
          recommendedOrder: recommendedOrder,
          pricePerUnit: item.pricePerUnit,
          supplier: item.vendor?.name || 'Unknown Supplier',
          lastOrderDate: new Date(item.createdAt).toISOString().split('T')[0],
          expirationDate: new Date(item.expirationDate).toISOString().split('T')[0],
          category: item.category || 'other'
        };
      });
      
      // Sort by current stock (ascending) so lowest stock items appear first
      formattedItems.sort((a, b) => a.currentStock - b.currentStock);
      
      setFoodSupplyItems(formattedItems);
      setFilteredItems(formattedItems);
      
      // Initialize order quantities with recommended values
      const initialOrderQuantities: Record<string, number> = {};
      formattedItems.forEach(item => {
        initialOrderQuantities[item.id] = item.recommendedOrder;
      });
      setOrderQuantities(initialOrderQuantities);
      
      // Extract unique categories
      const categories = ['all', ...new Set(formattedItems.map(item => item.category.toLowerCase()))];
      setAvailableCategories(categories);
      
      // Find the most recent order date
      if (formattedItems.length > 0) {
        const mostRecentDate = formattedItems.reduce((latest, product) => {
          return new Date(product.lastOrderDate) > new Date(latest) ? product.lastOrderDate : latest;
        }, formattedItems[0].lastOrderDate);
        
        setLastOrderDate(mostRecentDate);
      }
      
      // Find the most common supplier
      if (formattedItems.length > 0) {
        const supplierCounts = formattedItems.reduce((counts: Record<string, number>, product) => {
          counts[product.supplier] = (counts[product.supplier] || 0) + 1;
          return counts;
        }, {});
        
        const mainSupplier = Object.entries(supplierCounts)
          .sort((a, b) => b[1] - a[1])[0][0];
          
        setMainSupplier(mainSupplier);
      }
      
    } catch (err) {
      console.error('Error fetching food supply items:', err);
      setError('Failed to load food supply items. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleItem = (itemId: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    setOrderQuantities(prev => ({
      ...prev,
      [itemId]: quantity
    }));
  };

  const getSelectedItems = () => {
    return filteredItems.filter(item => selectedItems[item.id]);
  };

  const getTotalOrderValue = () => {
    return filteredItems.reduce((sum, item) => {
      if (selectedItems[item.id]) {
        return sum + (orderQuantities[item.id] * item.pricePerUnit);
      }
      return sum;
    }, 0);
  };

  const handlePrintReport = () => {
    setIsLoading(true);
    
    // Simulate printing delay
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: t('report_printed'),
        description: t('order_report_printed_successfully'),
      });
    }, 1500);
  };

  const handlePlaceOrder = () => {
    const selectedCount = Object.values(selectedItems).filter(Boolean).length;
    
    if (selectedCount === 0) {
      toast({
        title: t('no_items_selected'),
        description: t('please_select_at_least_one_item_to_order'),
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    // Simulate order processing delay
    setTimeout(() => {
      setIsLoading(false);
      setOpen(false);
      toast({
        title: t('order_placed'),
        description: t('food_supplies_order_placed_successfully'),
      });
    }, 1500);
  };

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
        <Button 
          size="sm" 
          variant="outline" 
          className="h-7 text-xs"
        >
          {t('action')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            {t('order_food_supplies')}
          </DialogTitle>
          <DialogDescription>
            {t('review_and_order_food_supplies_that_are_running_low')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <Card className="border-red-200 dark:border-red-800/30">
              <CardContent className="p-4 text-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800 dark:text-red-300 mb-1">{t('error')}</p>
                    <p className="text-red-700 dark:text-red-400">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : filteredItems.length === 0 && selectedCategory !== 'all' ? (
            <Card className="border-amber-200 dark:border-amber-800/30">
              <CardContent className="p-4 text-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">{t('no_products_in_category')}</p>
                    <p className="text-amber-700 dark:text-amber-400">
                      {t('no_products_in_selected_category')}
                    </p>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto text-amber-700 dark:text-amber-400 mt-2"
                      onClick={() => setSelectedCategory('all')}
                    >
                      {t('view_all_categories')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : foodSupplyItems.length === 0 ? (
            <Card className="border-amber-200 dark:border-amber-800/30">
              <CardContent className="p-4 text-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">{t('no_food_supplies')}</p>
                    <p className="text-amber-700 dark:text-amber-400">
                      {t('no_food_supplies_in_inventory')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
                <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30 w-full md:w-auto">
                  <CardContent className="p-3 text-sm flex items-start gap-2">
                    <div>
                      <p className="font-medium text-blue-800 dark:text-blue-300">{t('recommendation')}</p>
                      <p className="text-blue-700 dark:text-blue-400 text-sm">
                        {filteredItems.filter(p => p.currentStock < 5).length > 0 
                          ? t('items_running_low_order_soon')
                          : t('stock_levels_good')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:flex-none md:w-[200px]">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder={t('search_items')} 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder={t('select_category')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category === 'all' 
                            ? t('all_categories') 
                            : category.charAt(0).toUpperCase() + category.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex-1 overflow-hidden border rounded-md">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>{t('product')}</TableHead>
                        <TableHead className="text-right">{t('current_stock')}</TableHead>
                        <TableHead className="text-right">{t('order_quantity')}</TableHead>
                        <TableHead className="text-right">{t('price')}</TableHead>
                        <TableHead className="text-right">{t('total')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((product) => (
                        <TableRow key={product.id} className={selectedItems[product.id] ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}>
                          <TableCell>
                            <input 
                              type="checkbox" 
                              checked={!!selectedItems[product.id]} 
                              onChange={() => handleToggleItem(product.id)}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{product.name}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">{product.supplier}</span>
                                <Badge variant="outline" className={categoryColors[product.category.toLowerCase()] || 'bg-gray-100'}>
                                  {product.category.charAt(0).toUpperCase() + product.category.slice(1)}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={product.currentStock < 5 ? "destructive" : "outline"}>
                              {product.currentStock} {product.unit}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end">
                              <input 
                                type="number" 
                                min="1" 
                                value={orderQuantities[product.id] || product.recommendedOrder} 
                                onChange={(e) => handleUpdateQuantity(product.id, parseInt(e.target.value) || 0)}
                                className="w-16 h-8 rounded-md border border-input bg-background px-2 py-1 text-sm text-right ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                disabled={!selectedItems[product.id]}
                              />
                              <span className="ml-2 text-sm text-muted-foreground">{product.unit}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">QAR {product.pricePerUnit.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {selectedItems[product.id] ? (
                              <span className="text-green-700 dark:text-green-400">
                                QAR {(orderQuantities[product.id] * product.pricePerUnit).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {filteredItems.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            {searchTerm ? t('no_matching_items') : t('no_items_found')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
              
              <div className="mt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium">{t('selected_items')}:</span>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                    {Object.values(selectedItems).filter(Boolean).length} {t('items')}
                  </Badge>
                </div>
                
                <Card className="bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30 w-full md:w-auto">
                  <CardContent className="p-3 flex justify-between items-center gap-4">
                    <span className="font-medium text-green-800 dark:text-green-300">{t('total_order_value')}:</span>
                    <span className="text-xl font-bold text-green-700 dark:text-green-400">
                      QAR {getTotalOrderValue().toFixed(2)}
                    </span>
                  </CardContent>
                </Card>
              </div>
              
              <div className="flex justify-between items-center text-sm bg-muted/30 p-3 rounded-md mt-4">
                <div>
                  <span className="font-medium">{t('last_order')}: </span>
                  <span>{lastOrderDate ? new Date(lastOrderDate).toLocaleDateString() : t('no_recent_orders')}</span>
                </div>
                <div>
                  <span className="font-medium">{t('supplier')}: </span>
                  <span>{mainSupplier || t('various_suppliers')}</span>
                </div>
                <div>
                  <span className="font-medium">{t('delivery_estimate')}: </span>
                  <span>2-3 {t('days')}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t">
          <Button 
            variant="outline" 
            className="sm:mr-auto"
            onClick={handlePrintReport}
            disabled={isLoading}
          >
            <Printer className="h-4 w-4 mr-2" />
            {t('print_order_report')}
          </Button>
          <Button 
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            {t('cancel')}
          </Button>
          <Button 
            onClick={handlePlaceOrder}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                {t('processing')}
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                {t('place_order')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}