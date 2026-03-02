import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Printer, Download, ShoppingCart, Filter, ChevronDown, Search, AlertCircle, CheckCircle, Package, Plus } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useTranslation } from "@/contexts/TranslationContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchWithErrorHandling } from '@/util/apiErrorHandler';

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

interface Vendor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  type: string[];
}

interface OrderFoodSuppliesDialogProps {
  kitchenId: string;
  kitchenName: string;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | null | undefined;
  buttonSize?: "default" | "sm" | "lg" | "icon" | null | undefined;
  buttonClassName?: string;
  buttonIcon?: React.ReactNode;
  buttonLabel?: string;
  onOrderComplete?: () => void;
}

export function OrderFoodSuppliesDialog({
  kitchenId,
  kitchenName,
  buttonVariant = "default",
  buttonSize = "default",
  buttonClassName = "",
  buttonIcon,
  buttonLabel,
  onOrderComplete
}: OrderFoodSuppliesDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [foodSupplyItems, setFoodSupplyItems] = useState<FoodSupplyItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<FoodSupplyItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastOrderDate, setLastOrderDate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<string>('inventory');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    name: '',
    quantity: '',
    unit: 'kg',
    category: '',
    pricePerUnit: '',
    vendorId: '',
    expirationDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]
  });

  useEffect(() => {
    // Only fetch data when the dialog is opened
    if (open) {
      fetchFoodSupplyItems();
      fetchVendors();
    }
  }, [open]);

  useEffect(() => {
    // Filter items when category, vendor, or search term changes
    let filtered = foodSupplyItems;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => 
        item.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    
    if (selectedVendor !== 'all') {
      filtered = filtered.filter(item => 
        item.supplier === 'Unknown Supplier' || 
        item.supplier.toLowerCase().includes(selectedVendor.toLowerCase())
      );
    }
    
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredItems(filtered);
  }, [selectedCategory, selectedVendor, searchTerm, foodSupplyItems]);

  const fetchVendors = async () => {
    try {
      const data = await fetchWithErrorHandling('/api/vendors?type=FOOD_SUPPLY', {}, []);
      if (data) {
        setVendors(data);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast({
        title: t('error'),
        description: t('failed_to_fetch_vendors'),
        variant: 'destructive',
      });
    }
  };

  const fetchFoodSupplyItems = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch all food supplies for the kitchen
      const data = await fetchWithErrorHandling(`/api/food-supply?kitchenId=${kitchenId}`, {}, []);
      
      if (!data || !Array.isArray(data)) {
        throw new Error('Failed to fetch food supply items');
      }
      
      // Transform data to match our interface
      const formattedItems: FoodSupplyItem[] = data.map((item: any) => {
        // Calculate recommended order based on current stock
        // If stock is below 5, recommend ordering enough to reach 20
        // Otherwise, recommend ordering 10 units
        const currentStock = item.kitchenSupplies && item.kitchenSupplies.length > 0 
          ? item.kitchenSupplies[0].quantity 
          : item.quantity;
          
        const recommendedOrder = currentStock < 5 ? 20 - currentStock : 10;
        
        return {
          id: item.id,
          name: item.name,
          currentStock: currentStock,
          unit: item.unit,
          recommendedOrder: recommendedOrder,
          pricePerUnit: item.pricePerUnit,
          supplier: item.vendor?.name || 'Unknown Supplier',
          lastOrderDate: new Date(item.createdAt).toISOString().split('T')[0],
          expirationDate: item.kitchenSupplies && item.kitchenSupplies.length > 0 
            ? new Date(item.kitchenSupplies[0].expirationDate).toISOString().split('T')[0]
            : new Date(item.expirationDate).toISOString().split('T')[0],
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
    
    // Create a print window
    const printWindow = window.open('', `order_print_${Date.now()}`, 'width=800,height=600');
    
    if (printWindow) {
      const selectedItemsList = getSelectedItems();
      
      printWindow.document.write(`
        <html>
          <head>
            <title>Food Supply Order Report</title>
            <style>
              @media print {
                @page { margin: 1cm; }
              }
              body { 
                font-family: Arial, sans-serif;
                line-height: 1.5;
                margin: 20px;
              }
              h1 { 
                font-size: 24px;
                margin-bottom: 10px;
              }
              h2 { 
                font-size: 18px;
                margin-bottom: 10px;
                color: #555;
              }
              .header {
                margin-bottom: 20px;
                padding-bottom: 20px;
                border-bottom: 1px solid #ddd;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
              }
              th, td {
                border: 1px solid #ddd;
                padding: 8px 12px;
                text-align: left;
              }
              th {
                background-color: #f5f5f5;
              }
              .category {
                display: inline-block;
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 12px;
                background-color: #f0f0f0;
                margin-left: 5px;
              }
              .total-row {
                font-weight: bold;
              }
              .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                font-size: 12px;
                color: #666;
              }
              .no-print {
                display: none;
              }
              @media print {
                .no-print {
                  display: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="no-print" style="text-align: center; margin-bottom: 20px;">
              <h1>Food Supply Order Report</h1>
              <p>Click the button below if printing doesn't start automatically:</p>
              <button onclick="window.print()" style="padding: 10px 20px; background: #4F46E5; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Print Report
              </button>
            </div>
            
            <div class="header">
              <h1>Food Supply Order Report</h1>
              <h2>Kitchen: ${kitchenName}</h2>
              <p>Date: ${new Date().toLocaleDateString()}</p>
              <p>Total Items: ${selectedItemsList.length}</p>
              <p>Total Order Value: QAR ${getTotalOrderValue().toFixed(2)}</p>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Order Quantity</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${selectedItemsList.map(item => `
                  <tr>
                    <td>
                      ${item.name}
                      <div style="font-size: 12px; color: #666;">${item.supplier}</div>
                    </td>
                    <td><span class="category">${item.category}</span></td>
                    <td>${item.currentStock} ${item.unit}</td>
                    <td>${orderQuantities[item.id]} ${item.unit}</td>
                    <td>QAR ${item.pricePerUnit.toFixed(2)}</td>
                    <td>QAR ${(orderQuantities[item.id] * item.pricePerUnit).toFixed(2)}</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td colspan="5" style="text-align: right;">Total Order Value:</td>
                  <td>QAR ${getTotalOrderValue().toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            
            <div class="footer">
              <p>Generated on: ${new Date().toLocaleString()}</p>
              <p>This is an automatically generated report for kitchen inventory management.</p>
            </div>
            
            <script>
              // Print and close
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  window.onafterprint = () => window.close();
                }, 1000);
              }
            </script>
          </body>
        </html>
      `);
      
      printWindow.document.close();
      setIsLoading(false);
      
      toast({
        title: t('report_printed'),
        description: t('order_report_printed_successfully'),
      });
    } else {
      setIsLoading(false);
      toast({
        title: t('error'),
        description: t('failed_to_open_print_window'),
        variant: 'destructive',
      });
    }
  };

  const handlePlaceOrder = async () => {
    const selectedCount = Object.values(selectedItems).filter(Boolean).length;
    
    if (selectedCount === 0) {
      toast({
        title: t('no_items_selected'),
        description: t('please_select_at_least_one_item_to_order'),
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Prepare order data
      const orderItems = filteredItems
        .filter(item => selectedItems[item.id])
        .map(item => ({
          foodSupplyId: item.id,
          quantity: orderQuantities[item.id],
          pricePerUnit: item.pricePerUnit
        }));
      
      // Create order in the database
      const response = await fetch('/api/food-supply/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kitchenId,
          orderItems
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to place order');
      }
      
      setOpen(false);
      toast({
        title: t('order_placed'),
        description: t('food_supplies_order_placed_successfully'),
      });
      
      // Call the onOrderComplete callback if provided
      if (onOrderComplete) {
        onOrderComplete();
      }
    } catch (error) {
      console.error('Error placing order:', error);
      toast({
        title: t('error'),
        description: t('failed_to_place_order'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNewItem = async () => {
    // Validate form
    if (!newItemForm.name || !newItemForm.quantity || !newItemForm.category || !newItemForm.pricePerUnit) {
      toast({
        title: t('validation_error'),
        description: t('please_fill_all_required_fields'),
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Create new food supply
      const response = await fetch('/api/food-supply/create-from-kitchen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newItemForm,
          kitchenId
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to add new food supply');
      }
      
      const result = await response.json();
      
      // Reset form
      setNewItemForm({
        name: '',
        quantity: '',
        unit: 'kg',
        category: '',
        pricePerUnit: '',
        vendorId: '',
        expirationDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]
      });
      
      // Refresh food supply items
      fetchFoodSupplyItems();
      
      // Switch to inventory tab
      setActiveTab('inventory');
      
      toast({
        title: t('success'),
        description: t('new_food_supply_added_successfully'),
      });
    } catch (error) {
      console.error('Error adding new food supply:', error);
      toast({
        title: t('error'),
        description: t('failed_to_add_new_food_supply'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
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
          variant={buttonVariant} 
          size={buttonSize}
          className={buttonClassName}
        >
          {buttonIcon || <ShoppingCart className="h-4 w-4 mr-2" />}
          {buttonLabel || t('order_food_supplies')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            {t('order_food_supplies')} - {kitchenName}
          </DialogTitle>
          <DialogDescription>
            {t('review_and_order_food_supplies_for_your_kitchen')}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="inventory">
              <Package className="h-4 w-4 mr-2" />
              {t('inventory')}
            </TabsTrigger>
            <TabsTrigger value="new_item">
              <Plus className="h-4 w-4 mr-2" />
              {t('add_new_item')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="inventory" className="flex-1 overflow-hidden flex flex-col">
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
                      <Button 
                        variant="link" 
                        className="p-0 h-auto text-amber-700 dark:text-amber-400 mt-2"
                        onClick={() => setActiveTab('new_item')}
                      >
                        {t('add_new_food_supply')}
                      </Button>
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
                  
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
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
                    
                    <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder={t('select_vendor')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('all_vendors')}</SelectItem>
                        {vendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.name}>
                            {vendor.name}
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
                                  onChange={(e) => handleUpdateQuantity(product.id,  parseInt(e.target.value) || 0)}
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
                    <span className="font-medium">{t('delivery_estimate')}: </span>
                    <span>2-3 {t('days')}</span>
                  </div>
                </div>
              </>
            )}
          </TabsContent>
          
          <TabsContent value="new_item" className="flex-1 overflow-hidden flex flex-col">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">{t('add_new_food_supply')}</h3>
                  <p className="text-sm text-muted-foreground">{t('add_new_food_supply_to_kitchen')}</p>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium mb-1">
                          {t('name')} *
                        </label>
                        <Input
                          id="name"
                          placeholder={t('enter_food_supply_name')}
                          value={newItemForm.name}
                          onChange={(e) => setNewItemForm({...newItemForm, name: e.target.value})}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="quantity" className="block text-sm font-medium mb-1">
                            {t('quantity')} *
                          </label>
                          <Input
                            id="quantity"
                            type="number"
                            placeholder={t('enter_quantity')}
                            value={newItemForm.quantity}
                            onChange={(e) => setNewItemForm({...newItemForm, quantity: e.target.value})}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="unit" className="block text-sm font-medium mb-1">
                            {t('unit')} *
                          </label>
                          <Select 
                            value={newItemForm.unit} 
                            onValueChange={(value) => setNewItemForm({...newItemForm, unit: value})}
                          >
                            <SelectTrigger id="unit">
                              <SelectValue placeholder={t('select_unit')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kg">{t('kilograms')} (kg)</SelectItem>
                              <SelectItem value="g">{t('grams')} (g)</SelectItem>
                              <SelectItem value="l">{t('liters')} (L)</SelectItem>
                              <SelectItem value="ml">{t('milliliters')} (mL)</SelectItem>
                              <SelectItem value="units">{t('units')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="category" className="block text-sm font-medium mb-1">
                          {t('category')} *
                        </label>
                        <Select 
                          value={newItemForm.category} 
                          onValueChange={(value) => setNewItemForm({...newItemForm, category: value})}
                        >
                          <SelectTrigger id="category">
                            <SelectValue placeholder={t('select_category')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dairy">{t('dairy')}</SelectItem>
                            <SelectItem value="meat">{t('meat')}</SelectItem>
                            <SelectItem value="vegetables">{t('vegetables')}</SelectItem>
                            <SelectItem value="fruits">{t('fruits')}</SelectItem>
                            <SelectItem value="grains">{t('grains')}</SelectItem>
                            <SelectItem value="beverages">{t('beverages')}</SelectItem>
                            <SelectItem value="other">{t('other')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label htmlFor="pricePerUnit" className="block text-sm font-medium mb-1">
                          {t('price_per_unit')} *
                        </label>
                        <Input
                          id="pricePerUnit"
                          type="number"
                          step="0.01"
                          placeholder={t('enter_price_per_unit')}
                          value={newItemForm.pricePerUnit}
                          onChange={(e) => setNewItemForm({...newItemForm, pricePerUnit: e.target.value})}
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="vendorId" className="block text-sm font-medium mb-1">
                          {t('vendor')}
                        </label>
                        <Select 
                          value={newItemForm.vendorId} 
                          onValueChange={(value) => setNewItemForm({...newItemForm, vendorId: value})}
                        >
                          <SelectTrigger id="vendorId">
                            <SelectValue placeholder={t('select_vendor')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t('no_vendor')}</SelectItem>
                            {vendors.map((vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label htmlFor="expirationDate" className="block text-sm font-medium mb-1">
                          {t('expiration_date')} *
                        </label>
                        <Input
                          id="expirationDate"
                          type="date"
                          value={newItemForm.expirationDate}
                          onChange={(e) => setNewItemForm({...newItemForm, expirationDate: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <Button 
                        variant="outline" 
                        className="mr-2"
                        onClick={() => setActiveTab('inventory')}
                      >
                        {t('cancel')}
                      </Button>
                      <Button 
                        onClick={handleAddNewItem}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                            {t('adding')}
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            {t('add_item')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t">
          <Button 
            variant="outline" 
            className="sm:mr-auto"
            onClick={handlePrintReport}
            disabled={isLoading || isSubmitting}
          >
            <Printer className="h-4 w-4 mr-2" />
            {t('print_order_report')}
          </Button>
          <Button 
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading || isSubmitting}
          >
            {t('cancel')}
          </Button>
          <Button 
            onClick={handlePlaceOrder}
            disabled={isLoading || isSubmitting || activeTab !== 'inventory'}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? (
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