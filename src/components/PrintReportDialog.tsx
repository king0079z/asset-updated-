import { useState, useEffect } from "react";
import { useTranslation } from "@/contexts/TranslationContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrintReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportType: "asset" | "food" | "vehicle" | "ai";
  onGenerateReport: (options: ReportOptions) => void;
}

export interface ReportOptions {
  reportType: "asset" | "food" | "vehicle" | "ai";
  itemScope: "all" | "specific";
  specificItemId?: string;
  dateRange: "full" | "custom";
  startDate?: Date;
  endDate?: Date;
}

export function PrintReportDialog({
  open,
  onOpenChange,
  reportType,
  onGenerateReport,
}: PrintReportDialogProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ReportOptions>({
    reportType,
    itemScope: "all",
    dateRange: "full",
  });

  // Fetch items based on report type
  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        let endpoint = "";
        switch (reportType) {
          case "asset":
            endpoint = "/api/assets";
            break;
          case "food":
            endpoint = "/api/food-supply";
            break;
          case "vehicle":
            endpoint = "/api/vehicles";
            break;
          case "ai":
            endpoint = "/api/ai-analysis";
            break;
        }

        const response = await fetch(endpoint);
        if (response.ok) {
          const data = await response.json();
          // APIs return different shapes: array, { vehicles }, { assets }, etc. Normalize to array.
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data?.vehicles)
            ? data.vehicles
            : Array.isArray(data?.assets)
            ? data.assets
            : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.foodSupplies)
            ? data.foodSupplies
            : [];
          setItems(
            list.map((item: any) => ({
              id: item.id,
              name: item.name || item.title || item.model || item.make || item.assetId || item.id,
            }))
          );
        } else {
          setItems([]);
        }
      } catch (error) {
        console.error("Error fetching items:", error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchItems();
    }
  }, [open, reportType]);

  // Reset options when dialog opens
  useEffect(() => {
    if (open) {
      setOptions({
        reportType,
        itemScope: "all",
        dateRange: "full",
      });
    }
  }, [open, reportType]);

  const handleGenerateReport = () => {
    onGenerateReport(options);
    onOpenChange(false);
  };

  const getReportTypeTitle = () => {
    switch (reportType) {
      case "asset":
        return t("asset_reports");
      case "food":
        return t("food_reports");
      case "vehicle":
        return t("vehicle_reports");
      case "ai":
        return t("ai_reports");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" aria-describedby="print-report-dialog-description">
        <DialogHeader>
          <DialogTitle>{getReportTypeTitle()}</DialogTitle>
          <DialogDescription id="print-report-dialog-description">
            {t("print_report")} — {reportType === "asset" ? t("asset_reports") : reportType === "food" ? t("food_reports") : reportType === "vehicle" ? t("vehicle_reports") : t("ai_reports")}. Choose scope and date range, then generate.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Item Scope Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t("print_report")}</h3>
            <RadioGroup
              value={options.itemScope}
              onValueChange={(value) =>
                setOptions({ ...options, itemScope: value as "all" | "specific" })
              }
              className="flex flex-col space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all-items" />
                <Label htmlFor="all-items">{t("all_items")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="specific" id="specific-item" />
                <Label htmlFor="specific-item">{t("specific_item")}</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Specific Item Selection */}
          {options.itemScope === "specific" && (
            <div className="space-y-2">
              <Label htmlFor="item-select">{t("select_item")}</Label>
              <Select
                value={options.specificItemId}
                onValueChange={(value) =>
                  setOptions({ ...options, specificItemId: value })
                }
                disabled={loading}
              >
                <SelectTrigger id="item-select">
                  <SelectValue placeholder={t("select_item")} />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date Range Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t("select_date_range")}</h3>
            <RadioGroup
              value={options.dateRange}
              onValueChange={(value) =>
                setOptions({ ...options, dateRange: value as "full" | "custom" })
              }
              className="flex flex-col space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full" id="full-range" />
                <Label htmlFor="full-range">{t("full_date_range")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom-range" />
                <Label htmlFor="custom-range">{t("custom_date_range")}</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Custom Date Range Selection */}
          {options.dateRange === "custom" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("start_date")}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !options.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {options.startDate ? (
                        format(options.startDate, "PPP")
                      ) : (
                        <span>{t("start_date")}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={options.startDate}
                      onSelect={(date) =>
                        setOptions({ ...options, startDate: date || undefined })
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{t("end_date")}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !options.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {options.endDate ? (
                        format(options.endDate, "PPP")
                      ) : (
                        <span>{t("end_date")}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={options.endDate}
                      onSelect={(date) =>
                        setOptions({ ...options, endDate: date || undefined })
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button 
            onClick={handleGenerateReport}
            disabled={
              options.itemScope === "specific" && !options.specificItemId ||
              options.dateRange === "custom" && (!options.startDate || !options.endDate)
            }
          >
            {t("generate_report")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}