import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";
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

const foodSupplySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  quantity: z.string().min(1, "Quantity is required"),
  unit: z.string().min(1, "Unit is required"),
  category: z.string().min(1, "Category is required"),
  expirationDate: z.string().min(1, "Expiration date is required"),
  vendorId: z.string().min(1, "Vendor is required"),
  pricePerUnit: z.string().min(1, "Price per unit is required"),
  notes: z.string().optional(),
});

type Vendor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

interface RegisterFoodSupplyFormProps {
  onSuccess?: (newSupply: any) => void;
  onCancel?: () => void;
}

export function RegisterFoodSupplyForm({ onSuccess, onCancel }: RegisterFoodSupplyFormProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      vendorId: "",
      pricePerUnit: "",
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
        toast({
          title: t("error"),
          description: t("failed_to_load_vendors"),
          variant: "destructive",
        });
      }
    };

    loadVendors();
  }, [t, toast]);

  const onSubmit = async (values: z.infer<typeof foodSupplySchema>) => {
    try {
      setIsSubmitting(true);
      
      const response = await fetch("/api/food-supply/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error(t("failed_to_create_food_supply"));
      }

      const newSupply = await response.json();
      
      // Reset form and update UI
      form.reset();

      toast({
        title: t("success"),
        description: t("food_supply_registered_successfully"),
      });

      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess(newSupply);
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <h2 className="text-xl font-semibold mb-4">{t("register_new_food_supply")}</h2>
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
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
            >
              {t("cancel")}
            </Button>
          )}
          <Button 
            type="submit" 
            className="flex-1" 
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
              t("register_supply")
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}