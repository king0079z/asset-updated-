import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, List, BarChart as BarChartIcon, Utensils } from "lucide-react";
import { format } from 'date-fns';
import { useTranslation } from "@/contexts/TranslationContext";
import { BarChart } from "@/components/ui/chart";
import { ChartData, ChartOptions } from 'chart.js';
import { PrintKitchenConsumptionReportButton } from "@/components/PrintKitchenConsumptionReportButton";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "@/components/ui/use-toast";

type KitchenConsumptionProps = {
  kitchenId: string;
  kitchenName: string;
  preselectedFoodSupplyId?: string;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  buttonLabel?: string;
  onSuccess?: () => void;
};

type ConsumptionDetail = {
  name: string;
  unit: string;
  totalQuantity: number;
  consumptions: {
    id: string;
    quantity: number;
    date: string;
    user: string;
    notes?: string;
  }[];
  monthlyConsumption?: Record<string, number>;
};

type FoodTypeMonthlyData = {
  name: string;
  unit: string;
  data: number[];
};

type ConsumptionResponse = {
  items: ConsumptionDetail[];
  monthlyConsumption: {
    labels: string[];
    totalData: number[];
    byFoodType: FoodTypeMonthlyData[];
  };
};

// Generate a unique color for each food type
const generateColor = (index: number, alpha: number = 0.6): string => {
  const colors = [
    `rgba(75, 192, 192, ${alpha})`,   // Teal
    `rgba(255, 99, 132, ${alpha})`,   // Red
    `rgba(54, 162, 235, ${alpha})`,   // Blue
    `rgba(255, 206, 86, ${alpha})`,   // Yellow
    `rgba(153, 102, 255, ${alpha})`,  // Purple
    `rgba(255, 159, 64, ${alpha})`,   // Orange
    `rgba(46, 204, 113, ${alpha})`,   // Green
    `rgba(231, 76, 60, ${alpha})`,    // Dark Red
    `rgba(52, 152, 219, ${alpha})`,   // Light Blue
    `rgba(241, 196, 15, ${alpha})`,   // Light Yellow
  ];
  
  return colors[index % colors.length];
};

const consumptionSchema = z.object({
  foodSupplyId: z.string().min(1, "Food supply is required"),
  quantity: z.string().min(1, "Quantity is required"),
  notes: z.string().optional(),
});

export function KitchenConsumptionDialog({ 
  kitchenId, 
  kitchenName, 
  preselectedFoodSupplyId,
  buttonVariant = "outline",
  buttonSize = "sm",
  buttonLabel,
  onSuccess
}: KitchenConsumptionProps) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<ConsumptionDetail[]>([]);
  const [monthlyData, setMonthlyData] = useState<{
    labels: string[],
    totalData: number[],
    byFoodType: FoodTypeMonthlyData[]
  }>({
    labels: [],
    totalData: [],
    byFoodType: []
  });
  const [loading, setLoading] = useState(false);
  const [foodSupplies, setFoodSupplies] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("consume");
  const { t } = useTranslation();
  
  const form = useForm<z.infer<typeof consumptionSchema>>({
    resolver: zodResolver(consumptionSchema),
    defaultValues: {
      foodSupplyId: preselectedFoodSupplyId || "",
      quantity: "",
      notes: "",
    },
  });

  const loadDetails = async () => {
    if (!open || !kitchenId || kitchenId === 'undefined') return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/kitchens/consumption-details?kitchenId=${encodeURIComponent(kitchenId)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      const data: ConsumptionResponse = await response.json();
      setDetails(data.items || []);
      setMonthlyData(data.monthlyConsumption || { labels: [], totalData: [], byFoodType: [] });
    } catch (error) {
      console.error('Error loading kitchen consumption details:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load consumption details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadDetails();
    }
  }, [open]);

  // Create datasets for each food type
  const chartData: ChartData<'bar'> = {
    labels: monthlyData.labels,
    datasets: monthlyData.byFoodType.map((foodType, index) => ({
      label: foodType.name,
      data: foodType.data,
      backgroundColor: generateColor(index),
      borderColor: generateColor(index, 1.0),
      borderWidth: 1,
    })),
  };

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        display: true,
      },
      title: {
        display: true,
        text: t('monthly_consumption_by_food_type'),
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const datasetLabel = context.dataset.label || '';
            const value = context.parsed.y;
            const foodType = monthlyData.byFoodType.find(ft => ft.name === datasetLabel);
            const unit = foodType ? foodType.unit : '';
            return `${datasetLabel}: ${value} ${unit}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        stacked: true,
        title: {
          display: true,
          text: t('quantity_consumed'),
        },
      },
      x: {
        stacked: true,
        title: {
          display: true,
          text: t('month'),
        },
      },
    },
  };

  // Load food supplies when dialog opens
  const loadFoodSupplies = async () => {
    try {
      const response = await fetch(`/api/food-supply?kitchenId=${kitchenId}`);
      if (response.ok) {
        const data = await response.json();
        setFoodSupplies(data);
      }
    } catch (error) {
      console.error('Error loading food supplies:', error);
    }
  };
  
  useEffect(() => {
    if (open) {
      loadFoodSupplies();
      
      // Set the active tab based on whether a food supply is preselected
      if (preselectedFoodSupplyId) {
        setActiveTab("consume");
        form.setValue("foodSupplyId", preselectedFoodSupplyId);
      } else {
        setActiveTab("monthly");
      }
    }
  }, [open, preselectedFoodSupplyId]);
  
  const onSubmit = async (values: z.infer<typeof consumptionSchema>) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/food-supply/consume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supplyId: values.foodSupplyId,
          quantity: parseFloat(values.quantity),
          kitchenId,
          notes: values.notes,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to record consumption');
      }
      
      toast({
        title: t('success'),
        description: t('consumption_recorded_successfully'),
      });
      
      // Reset form
      form.reset();
      
      // Refresh data
      loadDetails();
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Switch to monthly tab to show updated data
      setActiveTab("monthly");
      
    } catch (error) {
      console.error('Error recording consumption:', error);
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_record_consumption'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize}>
          <Utensils className="h-4 w-4 mr-2" />
          {buttonLabel || t('consumption_details')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>{t('consumption_details')} - {kitchenName}</DialogTitle>
            <PrintKitchenConsumptionReportButton 
              kitchenId={kitchenId}
              kitchenName={kitchenName}
              details={details}
              monthlyData={monthlyData}
            />
          </div>
          <DialogDescription>{t('record_and_view_consumption_history_for_this_kitchen')}</DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {loading && activeTab !== "consume" ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="consume">
                  <Utensils className="h-4 w-4 mr-2" />
                  {t('consume')}
                </TabsTrigger>
                <TabsTrigger value="monthly">
                  <BarChartIcon className="h-4 w-4 mr-2" />
                  {t('monthly_trend')}
                </TabsTrigger>
                <TabsTrigger value="summary">
                  <PieChart className="h-4 w-4 mr-2" />
                  {t('summary')}
                </TabsTrigger>
                <TabsTrigger value="details">
                  <List className="h-4 w-4 mr-2" />
                  {t('detailed_history')}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="consume" className="space-y-4 py-4">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="foodSupplyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('food_supply')}</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            disabled={!!preselectedFoodSupplyId}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('select_food_supply')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {foodSupplies.map((supply) => (
                                <SelectItem key={supply.id} value={supply.id}>
                                  {supply.name} ({supply.quantity} {supply.unit})
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
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('quantity')}</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder={t('enter_quantity')} 
                              {...field} 
                            />
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
                          <FormLabel>{t('notes')} ({t('optional')})</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder={t('add_notes_about_consumption')} 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent rounded-full"></div>
                          {t('recording')}
                        </>
                      ) : (
                        <>
                          <Utensils className="h-4 w-4 mr-2" />
                          {t('record_consumption')}
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
              
              <TabsContent value="monthly">
                <div className="rounded-md border p-4">
                  <div className="h-[350px]">
                    {monthlyData.labels.length > 0 ? (
                      <BarChart data={chartData} options={chartOptions} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        {t('no_monthly_data_available')}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="summary">
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  <div className="space-y-4">
                    {details.map((item) => (
                      <div
                        key={item.name}
                        className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-right">
                            <span className="font-semibold">
                              {item.totalQuantity} {item.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="details">
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  <div className="space-y-6">
                    {details.map((item) => (
                      <div key={item.name} className="space-y-3">
                        <h3 className="font-semibold border-b pb-2">{item.name}</h3>
                        <div className="space-y-2 pl-4">
                          {item.consumptions.map((consumption) => (
                            <div
                              key={consumption.id}
                              className="text-sm border-l-2 border-muted pl-3 py-1"
                            >
                              <div className="flex justify-between">
                                <span>{consumption.quantity} {item.unit}</span>
                                <span className="text-muted-foreground">
                                  {format(new Date(consumption.date), 'PPp')}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t('by')} {consumption.user}
                                {consumption.notes && ` - ${consumption.notes}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}