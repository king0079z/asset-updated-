import React, { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card } from "@/components/ui/card";
import { Loader2, Search, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { Printer, Plus, Package } from "lucide-react";

const foodSupplySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  quantity: z.string().min(1, "Quantity is required"),
  unit: z.string().min(1, "Unit is required"),
  category: z.string().min(1, "Category is required"),
  expirationDate: z.string().min(1, "Expiration date is required"),
  pricePerUnit: z.string().min(1, "Price per unit is required"),
  vendorId: z.string().optional(),
  notes: z.string().optional(),
});

type Vendor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

interface KitchenFoodSupplyFormProps {
  kitchenId: string;
  kitchenName: string;
  onSuccess?: (newSupply: any) => void;
}

export function KitchenFoodSupplyForm({ kitchenId, kitchenName, onSuccess }: KitchenFoodSupplyFormProps) {
  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [newFoodSupplyId, setNewFoodSupplyId] = useState<string | null>(null);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
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
    },
  });

  useEffect(() => {
    const loadVendors = async () => {
      try {
        const response = await fetch("/api/vendors?type=FOOD_SUPPLY");
        const data = await response.json();
        setVendors(data);
      } catch (error) {
        console.error("Error loading vendors:", error);
      }
    };

    if (open) {
      loadVendors();
    }
  }, [open]);

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
        }),
      });

      if (!response.ok) {
        throw new Error(t("failed_to_create_food_supply"));
      }

      const result = await response.json();
      
      // Reset form
      form.reset();

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
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
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

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
            <Plus className="h-4 w-4 mr-2" />
            {t('add_food_supply')}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('add_food_supply_to_kitchen', { kitchen: kitchenName })}</DialogTitle>
          </DialogHeader>
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
                      <Input placeholder={t("enter_food_supply_name")} {...field} />
                    </FormControl>
                    <FormMessage />
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
                  onClick={() => setOpen(false)}
                >
                  {t("cancel")}
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
                      {t("register_supply")}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Barcode Dialog */}
      <Dialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
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
              <svg id="barcodeDisplay" className="w-full"></svg>
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