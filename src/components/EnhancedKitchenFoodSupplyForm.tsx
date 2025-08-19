import React, { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";
import { Card } from "@/components/ui/card";
import { Loader2, Search, Check, Package, Plus, Printer, AlertCircle, Link2, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const foodSupplySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  quantity: z.string().min(1, "Quantity is required"),
  unit: z.string().min(1, "Unit is required"),
  category: z.string().min(1, "Category is required"),
  expirationDate: z.string().min(1, "Expiration date is required"),
  pricePerUnit: z.string().min(1, "Price per unit is required"),
  vendorId: z.string().optional(),
  notes: z.string().optional(),
  linkedFoodSupplyId: z.string().optional(), // New field for linking to existing food supply
});

type Vendor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type FoodSupplySearchResult = {
  id: string;
  name: string;
  unit: string;
  category: string;
  pricePerUnit?: number;
  similarityScore: number;
};

interface EnhancedKitchenFoodSupplyFormProps {
  kitchenId: string;
  kitchenName: string;
  onSuccess?: (newSupply: any) => void;
}

export function EnhancedKitchenFoodSupplyForm({ kitchenId, kitchenName, onSuccess }: EnhancedKitchenFoodSupplyFormProps) {
  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [newFoodSupplyId, setNewFoodSupplyId] = useState<string | null>(null);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FoodSupplySearchResult[]>([]);
  const [selectedFoodSupply, setSelectedFoodSupply] = useState<FoodSupplySearchResult | null>(null);
  const [activeTab, setActiveTab] = useState<"search" | "create">("search");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  const categories = [
    { value: "dairy", label: "Dairy" },
    { value: "meat", label: "Meat" },
    { value: "vegetables", label: "Vegetables" },
    { value: "fruits", label: "Fruits" },
    { value: "grains", label: "Grains" },
    { value: "beverages", label: "Beverages" },
    { value: "other", label: "Other" },
  ];

  const form = useForm<z.infer<typeof foodSupplySchema>>({
    resolver: zodResolver(foodSupplySchema),
    defaultValues: {
      name: "",
      quantity: "",
      unit: "",
      category: "",
      expirationDate: "",
      pricePerUnit: "",
      vendorId: "",
      notes: "",
      linkedFoodSupplyId: "",
    },
  });

  // Reset form when dialog is opened
  useEffect(() => {
    if (open) {
      form.reset({
        name: "",
        quantity: "",
        unit: "",
        category: "",
        expirationDate: "",
        pricePerUnit: "",
        vendorId: "",
        notes: "",
        linkedFoodSupplyId: "",
      });
      setSelectedFoodSupply(null);
      setSearchQuery("");
      setSearchResults([]);
      setActiveTab("search");
      loadVendors();
    }
  }, [open, form]);

  const loadVendors = async () => {
    try {
      const response = await fetch("/api/vendors?type=FOOD_SUPPLY");
      const data = await response.json();
      setVendors(data);
    } catch (error) {
      console.error("Error loading vendors:", error);
    }
  };

  // Handle search input changes with debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/food-supply/search?query=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.items || []);
        } else {
          console.error("Search failed:", await response.text());
          setSearchResults([]);
        }
      } catch (error) {
        console.error("Error searching food supplies:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // Reduced timeout for more responsive search

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSelectFoodSupply = (item: FoodSupplySearchResult) => {
    setSelectedFoodSupply(item);
    
    // Update form fields with selected food supply data
    form.setValue("name", item.name);
    form.setValue("unit", item.unit);
    form.setValue("category", item.category);
    if (item.pricePerUnit) {
      form.setValue("pricePerUnit", item.pricePerUnit.toString());
    }
    form.setValue("linkedFoodSupplyId", item.id);
    
    // Switch to the create tab to complete the form
    setActiveTab("create");
    
    toast({
      title: t("food_supply_linked"),
      description: t("food_supply_linked_description", { name: item.name }),
    });
  };

  const onSubmit = async (values: z.infer<typeof foodSupplySchema>) => {
    try {
      setIsSubmitting(true);
      
      const response = await fetch("/api/food-supply/create-from-kitchen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          kitchenId,
          linkedFoodSupplyId: values.linkedFoodSupplyId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(t("failed_to_create_food_supply"));
      }

      const result = await response.json();
      
      // Reset form and search state
      form.reset();
      setSelectedFoodSupply(null);
      setSearchQuery("");
      setSearchResults([]);
      setActiveTab("search");

      toast({
        title: t("success"),
        description: t("food_supply_registered_successfully"),
      });

      // Set barcode and food supply ID for printing
      setBarcode(result.kitchenBarcode.barcode);
      setNewFoodSupplyId(result.foodSupply.id);
      setShowBarcodeDialog(true);

      // Call the onSuccess callback if provided
      if (onSuccess) {
        // Add a small delay to ensure the database has time to update
        setTimeout(() => {
          onSuccess(result.foodSupply);
        }, 500);
      }
    } catch (error) {
      console.error('Food supply creation error:', error);
      toast({
        title: t("error"),
        description: error instanceof Error 
          ? error.message 
          : t("failed_to_register_food_supply"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const printBarcode = () => {
    if (!barcode) return;

    // Create a print window
    const printWindow = window.open('', `barcode_print_${Date.now()}`, 'width=400,height=300');
    
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Kitchen Barcode</title>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarCode.all.min.js"></script>
            <style>
              @media print {
                @page { margin: 0; }
                body { margin: 1cm; }
              }
              .barcode-container {
                text-align: center;
                margin: 20px;
                padding: 10px;
              }
              .kitchen-name {
                font-size: 14px;
                margin-bottom: 5px;
              }
              .barcode-text {
                font-family: monospace;
                font-size: 16px;
                margin: 10px 0;
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
              <h1>Kitchen Barcode</h1>
              <p>Click the button below if printing doesn't start automatically:</p>
              <button onclick="window.print()" style="padding: 10px 20px; background: #4F46E5; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Print Barcode
              </button>
            </div>
            <div class="barcode-container">
              <div class="kitchen-name">
                ${kitchenName}
              </div>
              <div class="barcode-text">
                ${barcode}
              </div>
              <svg id="barcode"></svg>
            </div>
            <script>
              JsBarcode("#barcode", "${barcode}", {
                format: "CODE128",
                width: 2,
                height: 100,
                displayValue: true
              });
              
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
    } else {
      toast({
        title: t('error'),
        description: t('failed_to_open_print_window'),
        variant: 'destructive',
      });
    }
  };

  // Function to initialize JsBarcode in the barcode dialog
  useEffect(() => {
    if (showBarcodeDialog && barcode) {
      // Use setTimeout to ensure the DOM is ready
      const timer = setTimeout(() => {
        try {
          // Check if JsBarcode is available globally
          if (typeof window !== 'undefined' && window.JsBarcode && document.getElementById('barcodeDisplay')) {
            window.JsBarcode("#barcodeDisplay", barcode, {
              format: "CODE128",
              width: 2,
              height: 50,
              displayValue: true
            });
          } else {
            console.warn('JsBarcode not available or barcode element not found');
          }
        } catch (error) {
          console.error('Error initializing barcode:', error);
        }
      }, 300); // Increased timeout to ensure DOM is fully ready
      
      return () => clearTimeout(timer);
    }
  }, [showBarcodeDialog, barcode]);

  return (
    <>
      <Dialog 
        open={open} 
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          // Reset form state when dialog is opened
          if (isOpen) {
            setActiveTab("search");
            setSearchQuery("");
            setSearchResults([]);
            setSelectedFoodSupply(null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
            <Plus className="h-4 w-4 mr-2" />
            {t('add_food_supply')}
          </Button>
        </DialogTrigger>
        <DialogContent 
          className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col w-full"
          ref={dialogRef}
        >
          <DialogHeader>
            <DialogTitle>{t('add_food_supply_to_kitchen', { kitchen: kitchenName })}</DialogTitle>
          </DialogHeader>
          
          <Tabs 
            value={activeTab} 
            onValueChange={(value) => setActiveTab(value as "search" | "create")} 
            className="mt-2 w-full"
          >
            <TabsList className="grid grid-cols-2 mb-4 w-full">
              <TabsTrigger value="search" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                {t('search_existing')}
              </TabsTrigger>
              <TabsTrigger value="create" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {t('create_new')}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="search" className="mt-0">
              <div className="border rounded-md p-4 bg-blue-50 border-blue-200">
                <h3 className="text-base font-medium mb-2 flex items-center text-blue-800">
                  <Link2 className="h-4 w-4 mr-2" />
                  {t('link_to_existing_food_supply')}
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  {t('search_first_to_link_existing_items')}
                </p>
                
                <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between border-blue-300 focus:ring-blue-500 bg-white"
                  >
                    {searchQuery || t('search_existing_food_supplies')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command className="w-full">
                    <CommandInput 
                      placeholder={t('type_to_search_existing_items')} 
                      value={searchQuery}
                      onValueChange={(value) => {
                        setSearchQuery(value);
                        if (value.length >= 2) {
                          setIsSearching(true);
                        }
                      }}
                    />
                    <CommandList>
                      {isSearching && (
                        <div className="p-4 text-center">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-500" />
                          <p className="text-sm text-gray-500">{t('searching')}</p>
                        </div>
                      )}
                      
                      {!isSearching && searchQuery.length >= 2 && (
                        <>
                          <CommandEmpty>
                            <div className="p-4 text-center">
                              <p className="text-sm text-gray-500">{t('no_matching_items_found')}</p>
                              <p className="text-xs text-gray-400 mt-1">{t('continue_to_create_new')}</p>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="mt-3"
                                onClick={() => setActiveTab("create")}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                {t('create_new_item')}
                              </Button>
                            </div>
                          </CommandEmpty>
                          
                          <CommandGroup>
                            {searchResults.map((item) => (
                              <CommandItem
                                key={item.id}
                                value={item.name}
                                onSelect={() => {
                                  handleSelectFoodSupply(item);
                                }}
                                className="flex items-center justify-between p-2 cursor-pointer"
                              >
                                <div>
                                  <div className="font-medium">{item.name}</div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {item.category} • {item.unit}
                                    {item.pricePerUnit && ` • QAR ${item.pricePerUnit}`}
                                  </div>
                                </div>
                                <Check
                                  className={`h-4 w-4 text-blue-600 ${
                                    selectedFoodSupply?.id === item.id ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </>
                      )}
                      
                      {!searchQuery && (
                        <div className="flex flex-col items-center justify-center py-6 text-blue-600">
                          <Search className="h-10 w-10 mb-2 opacity-50" />
                          <p className="text-center text-sm">{t('type_to_search_food_supplies')}</p>
                        </div>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-blue-700">
                  <Link2 className="h-4 w-4 inline mr-1" />
                  {t('search_first_to_link_existing_items')}
                </p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setActiveTab("create")}
                  className="text-sm"
                >
                  {t('or_create_new')}
                </Button>
              </div>
              </div>
              
              <div className="mt-4 flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab("create")}
                  className="mr-2"
                >
                  {t('skip_to_create_new')}
                </Button>
                <Button 
                  variant="default" 
                  onClick={() => setOpen(false)}
                >
                  {t('cancel')}
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="create" className="mt-0">
              {selectedFoodSupply && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-green-800">{t('linked_to_existing_item')}</div>
                      <div className="text-base font-semibold mt-1">{selectedFoodSupply.name}</div>
                      <div className="text-xs text-green-700 mt-1">
                        {t('category')}: {selectedFoodSupply.category} • {t('unit')}: {selectedFoodSupply.unit}
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                      {t('linked')}
                    </Badge>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-2 text-red-600 hover:text-red-700 hover:bg-red-50 p-0 h-auto"
                    onClick={() => {
                      setSelectedFoodSupply(null);
                      form.setValue("linkedFoodSupplyId", "");
                      form.setValue("name", "");
                      form.setValue("unit", "");
                      form.setValue("category", "");
                      form.setValue("pricePerUnit", "");
                    }}
                  >
                    {t('remove_link')}
                  </Button>
                </div>
              )}
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 overflow-hidden flex flex-col">
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-4 pb-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("name")}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  placeholder={t("enter_food_supply_name")} 
                                  {...field} 
                                  className={selectedFoodSupply ? "bg-green-50 border-green-300" : ""}
                                />
                                {selectedFoodSupply && (
                                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                      <Link2 className="h-3 w-3 mr-1" />
                                      {t('linked')}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                            {!selectedFoodSupply && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="mt-1 h-auto py-1 px-2 text-blue-600"
                                onClick={() => setActiveTab("search")}
                              >
                                <Search className="h-3 w-3 mr-1" />
                                {t('search_existing_items')}
                              </Button>
                            )}
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="quantity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("quantity")}</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder={t("enter_quantity")} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="unit"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("unit")}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t("select_unit")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="kg">{t("kilograms")} (kg)</SelectItem>
                                  <SelectItem value="g">{t("grams")} (g)</SelectItem>
                                  <SelectItem value="l">{t("liters")} (L)</SelectItem>
                                  <SelectItem value="ml">{t("milliliters")} (mL)</SelectItem>
                                  <SelectItem value="units">{t("units")}</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("category")}</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t("select_category")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {categories.map((category) => (
                                  <SelectItem key={category.value} value={category.value}>
                                    {t(category.label)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="expirationDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("expiration_date")}</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="pricePerUnit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("price_per_unit")}</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder={t("enter_price_per_unit")} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="vendorId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("vendor")}</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t("select_vendor")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">{t("no_vendor")}</SelectItem>
                                {vendors.map((vendor) => (
                                  <SelectItem key={vendor.id} value={vendor.id}>
                                    {vendor.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("notes")}</FormLabel>
                            <FormControl>
                              <Textarea placeholder={t("add_any_additional_notes")} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </ScrollArea>
                  
                  <DialogFooter className="pt-4 border-t mt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        if (selectedFoodSupply) {
                          setActiveTab("search");
                        } else {
                          setOpen(false);
                        }
                      }}
                    >
                      {selectedFoodSupply ? t("back_to_search") : t("cancel")}
                    </Button>
                    <Button 
                      type="submit" 
                      className="ml-2" 
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {t("registering")}
                        </>
                      ) : (
                        <>
                          <Package className="h-4 w-4 mr-2" />
                          {selectedFoodSupply ? t("add_to_kitchen") : t("register_supply")}
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Barcode Dialog */}
      <Dialog 
        open={showBarcodeDialog} 
        onOpenChange={(isOpen) => {
          setShowBarcodeDialog(isOpen);
          // When barcode dialog is closed, also close the main dialog
          if (!isOpen) {
            setTimeout(() => setOpen(false), 300);
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('barcode_generated')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4">
            <div className="text-center mb-4">
              <p className="text-sm text-muted-foreground mb-2">
                {t('food_supply_added_successfully')}
              </p>
              <p className="font-mono text-sm">{barcode}</p>
            </div>
            <div className="w-full max-w-[250px] h-[100px] bg-gray-100 flex items-center justify-center rounded-md mb-4">
              <svg id="barcodeDisplay" className="w-full h-full"></svg>
            </div>
            <Button onClick={printBarcode} className="w-full">
              <Printer className="h-4 w-4 mr-2" />
              {t('print_barcode')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}