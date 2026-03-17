// @ts-nocheck
import { DashboardLayout } from "@/components/DashboardLayout";
import { KitchenManagement } from "@/components/KitchenManagement";
import { KitchenConsumptionAnalysisTab } from "@/components/KitchenConsumptionAnalysisTab";
import { MultiLocationInventoryTab } from "@/components/MultiLocationInventoryTab";
import { BarcodeManagementDialog } from "@/components/BarcodeManagementDialog";
import EnhancedBarcodeScanner from "@/components/EnhancedBarcodeScanner";
import { ConsumptionHistoryDialog } from "@/components/ConsumptionHistoryDialog";
import { EditFoodSupplyDialog } from "@/components/EditFoodSupplyDialog";
import { KitchenConsumptionDialog } from "@/components/KitchenConsumptionDialog";
import { FoodSupplyMobileCard } from "@/components/FoodSupplyMobileCard";
import { RecipesTabRebuilt } from "@/components/RecipesTabRebuilt";
import { FoodSupplyNotifications } from "@/components/FoodSupplyNotifications";
import { CategoryDetailsDialog } from "@/components/CategoryDetailsDialog";
import PrintFoodSupplyReportButton from "@/components/PrintFoodSupplyReportButton";
import { RefillFoodSupplyDialog } from "@/components/RefillFoodSupplyDialog";
import { AssetReport } from "@/components/AssetReport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  PlusCircle, UtensilsCrossed, Package, AlertTriangle, History, Search, Barcode, Utensils,
  FileText, ChefHat, BarChart3, Trash2, Brain, MapPin, TrendingUp, Clock, CheckCircle2,
  Building2, Layers, X, ScanLine, ArrowUpDown, Grid3X3, List, RefreshCw, Filter,
  DollarSign, ShoppingCart, Zap, Eye, MoreHorizontal, AlertCircle, Star, Download,
  ChevronDown, ArrowUp, ArrowDown, Flame, Snowflake, Droplets, Leaf,
} from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchWithCache, getFromCache } from "@/lib/api-cache";

const FS_KEY   = "/api/food-supply";
const STATS_KEY = "/api/food-supply/stats";
const CONSUMED_KEY = "/api/food-supply/total-consumed";
const VENDORS_FS_KEY = "/api/vendors?type=FOOD_SUPPLY";
const KITCHENS_KEY  = "/api/kitchens";
const FS_TTL    = 60_000;
const STATS_TTL = 3 * 60_000;
const LONG_TTL  = 5 * 60_000;
import { useRouter } from "next/router";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTranslation } from "@/contexts/TranslationContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

/* ─── Schema ─────────────────────────────────────────────────────────────────── */
const foodSupplySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  quantity: z.string().min(1, "Quantity is required"),
  unit: z.string().min(1, "Unit is required"),
  category: z.string().min(1, "Category is required"),
  expirationDate: z.string().min(1, "Expiration date is required"),
  vendorId: z.string().optional(),
  pricePerUnit: z.string().min(1, "Price per unit is required"),
  notes: z.string().optional(),
});

/* ─── Types ───────────────────────────────────────────────────────────────────── */
type Vendor = { id: string; name: string; email: string | null; phone: string | null; address: string | null };
type DashboardStats = {
  totalSupplies: number; expiringSupplies: number;
  categoryStats: Array<{ category: string; _count: number }>;
  recentSupplies: any[]; totalConsumed?: number;
};

/* ─── Category Config ─────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { value: "dairy",      label: "Dairy",      icon: "🥛", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",      grad: "from-blue-500 to-cyan-500" },
  { value: "meat",       label: "Meat",        icon: "🥩", color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",            grad: "from-red-500 to-rose-500" },
  { value: "vegetables", label: "Vegetables",  icon: "🥬", color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700", grad: "from-green-500 to-emerald-500" },
  { value: "fruits",     label: "Fruits",      icon: "🍎", color: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700", grad: "from-orange-500 to-yellow-500" },
  { value: "grains",     label: "Grains",      icon: "🌾", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",  grad: "from-amber-500 to-orange-500" },
  { value: "beverages",  label: "Beverages",   icon: "🥤", color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700", grad: "from-purple-500 to-violet-500" },
  { value: "spices",     label: "Spices",      icon: "🌶️", color: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700", grad: "from-yellow-500 to-amber-500" },
  { value: "seafood",    label: "Seafood",     icon: "🐟", color: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-700",        grad: "from-cyan-500 to-blue-500" },
  { value: "other",      label: "Other",       icon: "📦", color: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700",         grad: "from-gray-500 to-slate-500" },
];

const getCat = (v: string) => CATEGORIES.find(c => c.value === v);

/* ─── Expiry helpers ────────────────────────────────────────────────────────── */
const getDaysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
const getExpiryStatus = (days: number) => {
  if (days < 0)  return { label: "Expired",  cls: "bg-red-500",    text: "text-red-600 dark:text-red-400",   bg: "bg-red-50 dark:bg-red-900/20",   badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (days <= 7)  return { label: "Critical", cls: "bg-red-500",    text: "text-red-600 dark:text-red-400",   bg: "bg-red-50 dark:bg-red-900/20",   badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (days <= 30) return { label: "Soon",     cls: "bg-amber-500",  text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  return          { label: "Good",     cls: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
};

/* ─── Supply Card ─────────────────────────────────────────────────────────────── */
function SupplyCard({ supply, kitchens, onUpdate }: { supply: any; kitchens: any[]; onUpdate: () => void }) {
  const cat = getCat(supply.category);
  const days = getDaysUntil(supply.expirationDate);
  const exp = getExpiryStatus(days);
  const totalValue = (supply.quantity * supply.pricePerUnit).toFixed(0);
  const kitchenId = supply.kitchenSupplies?.[0]?.kitchenId || supply.kitchenId || kitchens[0]?.id;
  const kitchenName = supply.kitchenSupplies?.[0]?.kitchen?.name || supply.kitchen?.name || kitchens[0]?.name || "Kitchen";

  return (
    <div className={`group relative rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 bg-card ${
      days < 0 ? "border-red-200 dark:border-red-800/40" : days <= 7 ? "border-red-200/70 dark:border-red-800/30" : days <= 30 ? "border-amber-200/70 dark:border-amber-800/30" : "border-border hover:border-orange-200 dark:hover:border-orange-800/30"
    }`}>
      {/* Status accent bar */}
      <div className={`h-1.5 w-full ${exp.cls} ${days >= 0 && days > 30 ? "opacity-0 group-hover:opacity-100 transition-opacity" : ""} bg-gradient-to-r`} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-xl leading-none">{cat?.icon || "📦"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm leading-tight truncate">{supply.name}</h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cat?.color || "bg-muted text-muted-foreground"}`}>
                {cat?.label || supply.category}
              </span>
              {days < 0 && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${exp.badge}`}>Expired</span>}
              {days >= 0 && days <= 7 && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${exp.badge}`}>Critical</span>}
              {days > 7 && days <= 30 && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${exp.badge}`}>Expiring Soon</span>}
              {supply.barcode && (
                <span className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-md font-mono">
                  #{supply.barcode.slice(-6)}
                </span>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted transition-all">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {kitchenId && (
                <DropdownMenuItem asChild>
                  <KitchenConsumptionDialog
                    kitchenId={kitchenId} kitchenName={kitchenName}
                    preselectedFoodSupplyId={supply.id}
                    buttonLabel="Record Consumption" buttonVariant="ghost" buttonSize="sm"
                    onSuccess={onUpdate}
                  />
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-2.5">
            <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Unit Price</p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">QAR {Number(supply.pricePerUnit).toFixed(2)}</p>
          </div>
          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-2.5">
            <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Quantity</p>
            <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{supply.quantity} <span className="text-xs font-medium">{supply.unit}</span></p>
          </div>
          <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 p-2.5">
            <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Total Value</p>
            <p className="text-sm font-bold text-purple-700 dark:text-purple-300">QAR {totalValue}</p>
          </div>
          <div className={`rounded-xl p-2.5 ${exp.bg}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wide ${exp.text}`}>
              {days < 0 ? "Expired" : "Expires in"}
            </p>
            <p className={`text-sm font-bold ${exp.text}`}>
              {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? "Today!" : `${days}d`}
            </p>
          </div>
        </div>

        {/* Expiry progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-muted-foreground">
              Expires: {new Date(supply.expirationDate).toLocaleDateString()}
            </p>
            {supply.totalWasted > 0 && (
              <p className="text-[10px] text-rose-500">
                Wasted: {supply.totalWasted} {supply.unit}
              </p>
            )}
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${exp.cls}`}
              style={{ width: `${Math.max(0, Math.min(100, days < 0 ? 0 : days > 365 ? 100 : (days / 365) * 100))}%` }} />
          </div>
        </div>

        {/* Tags */}
        {(supply.vendor || supply.kitchenSupplies?.length > 0) && (
          <div className="flex flex-wrap gap-1 mb-3">
            {supply.vendor && (
              <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                🏪 {supply.vendor.name}
              </span>
            )}
            {supply.kitchenSupplies?.map((ks: any) => (
              <span key={ks.id} className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                🍳 {ks.kitchen?.name}
              </span>
            ))}
          </div>
        )}

        {/* Action row */}
        <div className="flex gap-1.5 pt-1 border-t border-border/40">
          {kitchenId && (
            <KitchenConsumptionDialog
              kitchenId={kitchenId} kitchenName={kitchenName}
              preselectedFoodSupplyId={supply.id}
              buttonLabel="Consume" buttonVariant="outline" buttonSize="sm"
              onSuccess={onUpdate}
            />
          )}
          <ConsumptionHistoryDialog foodSupplyId={supply.id} foodSupplyName={supply.name} />
          <EditFoodSupplyDialog foodSupplyId={supply.id} currentPrice={supply.pricePerUnit} onUpdate={onUpdate} />
        </div>
      </div>
    </div>
  );
}

/* ─── Supply Table Row ────────────────────────────────────────────────────────── */
function SupplyTableRow({ supply, kitchens, onUpdate }: { supply: any; kitchens: any[]; onUpdate: () => void }) {
  const cat = getCat(supply.category);
  const days = getDaysUntil(supply.expirationDate);
  const exp = getExpiryStatus(days);
  const kitchenId = supply.kitchenSupplies?.[0]?.kitchenId || supply.kitchenId || kitchens[0]?.id;
  const kitchenName = supply.kitchenSupplies?.[0]?.kitchen?.name || supply.kitchen?.name || kitchens[0]?.name || "Kitchen";

  return (
    <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors group">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-sm text-base">
            {cat?.icon || "📦"}
          </div>
          <div>
            <p className="font-semibold text-sm">{supply.name}</p>
            {supply.vendor && <p className="text-[11px] text-muted-foreground">{supply.vendor.name}</p>}
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cat?.color || "bg-muted text-muted-foreground"}`}>
          {cat?.label || supply.category}
        </span>
      </td>
      <td className="py-3 px-4 text-sm font-semibold">
        {supply.quantity} <span className="text-xs text-muted-foreground font-normal">{supply.unit}</span>
      </td>
      <td className="py-3 px-4 text-sm">QAR {Number(supply.pricePerUnit).toFixed(2)}</td>
      <td className="py-3 px-4 text-sm font-semibold text-purple-600 dark:text-purple-400">
        QAR {(supply.quantity * supply.pricePerUnit).toFixed(0)}
      </td>
      <td className="py-3 px-4">
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${exp.badge}`}>
          {days < 0 ? `Expired ${Math.abs(days)}d` : days === 0 ? "Today" : `${days}d`}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {kitchenId && (
            <KitchenConsumptionDialog
              kitchenId={kitchenId} kitchenName={kitchenName}
              preselectedFoodSupplyId={supply.id}
              buttonLabel="Consume" buttonVariant="outline" buttonSize="sm"
              onSuccess={onUpdate}
            />
          )}
          <EditFoodSupplyDialog foodSupplyId={supply.id} currentPrice={supply.pricePerUnit} onUpdate={onUpdate} />
        </div>
      </td>
    </tr>
  );
}

/* ─── Add Supply Dialog ───────────────────────────────────────────────────────── */
function AddSupplyDialog({ open, onOpenChange, vendors, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void; vendors: Vendor[]; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useTranslation();

  const form = useForm<z.infer<typeof foodSupplySchema>>({
    resolver: zodResolver(foodSupplySchema),
    defaultValues: { name: "", quantity: "", unit: "", category: "", expirationDate: "", notes: "", pricePerUnit: "", vendorId: "" },
  });

  const qty = parseFloat(form.watch("quantity") || "0") || 0;
  const price = parseFloat(form.watch("pricePerUnit") || "0") || 0;
  const totalPreview = (qty * price).toFixed(2);

  useEffect(() => { if (!open) form.reset(); }, [open]);

  async function onSubmit(values: z.infer<typeof foodSupplySchema>) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/food-supply/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, vendorId: values.vendorId || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create");
      toast({ title: "Supply registered", description: `${values.name} added to inventory.` });
      onOpenChange(false); onSuccess();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to register", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
              <PlusCircle className="h-5 w-5" />{t("register_new_food_supply")}
            </DialogTitle>
            <DialogDescription className="text-orange-100">
              Add a new food supply item to your inventory
            </DialogDescription>
          </DialogHeader>
          {/* Live total preview */}
          {(qty > 0 && price > 0) && (
            <div className="mt-3 flex items-center gap-2 bg-white/20 rounded-xl px-4 py-2">
              <DollarSign className="h-4 w-4 text-white/80" />
              <span className="text-white text-sm font-semibold">
                Total Value Preview: <span className="font-black">QAR {totalPreview}</span>
              </span>
            </div>
          )}
        </div>

        <div className="px-6 py-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Name */}
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wider">{t("name")}</FormLabel>
                  <FormControl><Input placeholder="e.g. Basmati Rice, Fresh Tomatoes…" className="rounded-xl" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Quantity + Unit */}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider">{t("quantity")}</FormLabel>
                    <FormControl><Input type="number" min="0" step="any" placeholder="0" className="rounded-xl" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="unit" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider">{t("unit")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="rounded-xl"><SelectValue placeholder={t("select_unit")} /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="kg">Kilograms (kg)</SelectItem>
                        <SelectItem value="g">Grams (g)</SelectItem>
                        <SelectItem value="l">Liters (L)</SelectItem>
                        <SelectItem value="ml">Milliliters (mL)</SelectItem>
                        <SelectItem value="units">Units</SelectItem>
                        <SelectItem value="boxes">Boxes</SelectItem>
                        <SelectItem value="cans">Cans</SelectItem>
                        <SelectItem value="bags">Bags</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Category + Price */}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider">{t("category")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="rounded-xl"><SelectValue placeholder={t("select_category")} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="pricePerUnit" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider">Price / Unit (QAR)</FormLabel>
                    <FormControl><Input type="number" min="0" step="0.01" placeholder="0.00" className="rounded-xl" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Expiry + Vendor */}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="expirationDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider">{t("expiration_date")}</FormLabel>
                    <FormControl><Input type="date" className="rounded-xl" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="vendorId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider">{t("vendor")} <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="rounded-xl"><SelectValue placeholder="Select vendor" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="">No vendor</SelectItem>
                        {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Notes */}
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wider">{t("notes")} <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Textarea placeholder="Storage instructions, special notes…" rows={2} className="rounded-xl resize-none" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" type="button" onClick={() => onOpenChange(false)} className="rounded-xl">{t("cancel")}</Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0 gap-2">
                  {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                  {isSubmitting ? "Saving…" : t("register_supply")}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────────── */
export default function FoodSupplyPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [showConsumptionScanner, setShowConsumptionScanner] = useState(false);
  const [scannerKitchenId, setScannerKitchenId] = useState("");
  // Initialize from module-level cache — no loading flash when navigating back
  const [vendors, setVendors] = useState<Vendor[]>(() => getFromCache<Vendor[]>(VENDORS_FS_KEY, LONG_TTL) ?? []);
  const [foodSupplies, setFoodSupplies] = useState<any[]>(() => getFromCache<any[]>(FS_KEY, FS_TTL) ?? []);
  const [stats, setStats] = useState<DashboardStats | null>(() => getFromCache<DashboardStats>(STATS_KEY, STATS_TTL) ?? null);
  const [isLoading, setIsLoading] = useState(() => !getFromCache(FS_KEY, FS_TTL));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refillDialogState, setRefillDialogState] = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "expired" | "critical" | "expiring" | "good">("all");
  const [kitchens, setKitchens] = useState<{ id: string; name: string }[]>(() => getFromCache<any[]>(KITCHENS_KEY, LONG_TTL) ?? []);
  const [consumptionHistory, setConsumptionHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "expiry" | "quantity" | "value" | "created">("expiry");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [activeTab, setActiveTab] = useState("inventory");
  const { toast } = useToast();
  const { t } = useTranslation();
  const isMobile = useMediaQuery("(max-width: 768px)");

  /* ─── Data loading ── */
  const loadConsumptionHistory = async (foodSupplyId?: string) => {
    setIsLoadingHistory(true);
    try {
      const endpoint = foodSupplyId
        ? `/api/food-supply/consumption-history?foodSupplyId=${foodSupplyId}`
        : "/api/food-supply/full-consumption-report";
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("Failed to load");
      const data = await response.json();
      setConsumptionHistory(Array.isArray(data) ? data.map(r => ({
        ...r, quantity: r.quantity || 0, date: r.date || new Date().toISOString(),
        foodSupply: r.foodSupply || { name: "Unknown", unit: "units", pricePerUnit: 0 },
        kitchen: r.kitchen || { name: "Unknown Kitchen", floorNumber: null },
        user: r.user || { email: "Unknown User" },
      })) : []);
    } catch { setConsumptionHistory([]); } finally { setIsLoadingHistory(false); }
  };

  const loadFoodSupplies = useCallback(async (silent = false, background = false) => {
    if (!background) { if (silent) setIsRefreshing(true); else setIsLoading(true); }
    try {
      const data = await fetchWithCache<any[]>(FS_KEY, { maxAge: FS_TTL });
      setFoodSupplies(Array.isArray(data) ? data : []);
      if (!background && router?.query?.highlight) {
        const id = Array.isArray(router.query.highlight) ? router.query.highlight[0] : router.query.highlight;
        const item = (data ?? []).find((fs: any) => fs.id === id);
        if (item) setTimeout(() => setRefillDialogState({ open: true, item: { id: item.id, name: item.name, quantity: item.quantity, unit: item.unit, expirationDate: new Date(item.expirationDate), isExpired: new Date(item.expirationDate) < new Date() } }), 300);
      }
    } catch { if (!background) toast({ title: "Error", description: "Failed to load food supplies", variant: "destructive" }); }
    finally { if (!background) { setIsLoading(false); setIsRefreshing(false); } }
  }, [router, toast]);

  const loadStats = async (background = false) => {
    try {
      const [sd, cd] = await Promise.all([
        fetchWithCache<any>(STATS_KEY, { maxAge: STATS_TTL }),
        fetchWithCache<any>(CONSUMED_KEY, { maxAge: STATS_TTL }),
      ]);
      setStats({ ...sd, totalConsumed: cd?.totalConsumed });
    } catch {}
  };

  useEffect(() => {
    const loadVendors = async (background = false) => {
      try {
        const d = await fetchWithCache<Vendor[]>(VENDORS_FS_KEY, { maxAge: LONG_TTL });
        if (d) setVendors(d);
      } catch {}
    };
    const loadKitchens = async (background = false) => {
      try {
        const d = await fetchWithCache<any[]>(KITCHENS_KEY, { maxAge: LONG_TTL });
        if (d) { setKitchens(d); if (d.length > 0 && !scannerKitchenId) setScannerKitchenId(d[0].id); }
      } catch {}
    };
    const hasCached = !!getFromCache(FS_KEY, FS_TTL);
    if (hasCached) {
      // Data already in state from cache — revalidate everything in background
      setTimeout(() => {
        loadVendors(true); loadFoodSupplies(false, true); loadStats(true); loadKitchens(true);
      }, 300);
    } else {
      loadVendors(); loadFoodSupplies(); loadStats(); loadKitchens();
    }
  }, []);

  /* ─── Derived ── */
  const totalInventoryValue = useMemo(() =>
    foodSupplies.reduce((sum, s) => sum + (s.quantity * s.pricePerUnit), 0), [foodSupplies]);

  const expiredCount = useMemo(() => foodSupplies.filter(s => getDaysUntil(s.expirationDate) < 0).length, [foodSupplies]);
  const criticalCount = useMemo(() => foodSupplies.filter(s => { const d = getDaysUntil(s.expirationDate); return d >= 0 && d <= 7; }).length, [foodSupplies]);
  const expiringCount = useMemo(() => foodSupplies.filter(s => { const d = getDaysUntil(s.expirationDate); return d > 7 && d <= 30; }).length, [foodSupplies]);

  const filteredAndSorted = useMemo(() => {
    let list = foodSupplies.filter(s => {
      const q = searchTerm.toLowerCase();
      const matchSearch = !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.vendor?.name?.toLowerCase().includes(q);
      const matchCat = selectedCategory === "all" || s.category === selectedCategory;
      const days = getDaysUntil(s.expirationDate);
      const matchStatus = statusFilter === "all" ? true
        : statusFilter === "expired" ? days < 0
        : statusFilter === "critical" ? (days >= 0 && days <= 7)
        : statusFilter === "expiring" ? (days > 7 && days <= 30)
        : days > 30;
      return matchSearch && matchCat && matchStatus;
    });

    list.sort((a, b) => {
      let val = 0;
      if (sortBy === "name") val = a.name.localeCompare(b.name);
      else if (sortBy === "expiry") val = getDaysUntil(a.expirationDate) - getDaysUntil(b.expirationDate);
      else if (sortBy === "quantity") val = a.quantity - b.quantity;
      else if (sortBy === "value") val = (a.quantity * a.pricePerUnit) - (b.quantity * b.pricePerUnit);
      else if (sortBy === "created") val = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortDir === "asc" ? val : -val;
    });
    return list;
  }, [foodSupplies, searchTerm, selectedCategory, statusFilter, sortBy, sortDir]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("asc"); }
  };

  const TABS = [
    { key: "inventory", icon: Package, label: t("inventory") },
    { key: "multi-location", icon: MapPin, label: "Multi-Location" },
    { key: "kitchens", icon: Utensils, label: t("kitchens") },
    { key: "recipes", icon: ChefHat, label: t("recipes") },
    { key: "analytics", icon: BarChart3, label: "Analytics" },
  ];

  return (
    <>
      <RefillFoodSupplyDialog
        open={!!refillDialogState.open}
        onOpenChange={open => setRefillDialogState(s => ({ ...s, open }))}
        item={refillDialogState.item || { id: "", name: "", quantity: 0, unit: "", expirationDate: new Date(), isExpired: false }}
        onRefill={async ({ id, newQuantity, newExpirationDate, disposedQuantity }) => {
          try {
            const res = await fetch("/api/food-supply/refill", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ foodSupplyId: id, quantity: newQuantity, expirationDate: newExpirationDate, disposedQuantity }),
            });
            if (!res.ok) throw new Error("Failed");
            await loadFoodSupplies(true);
            setRefillDialogState({ open: false, item: null });
            toast({ title: "Refilled", description: "Food supply updated successfully." });
          } catch { toast({ title: "Error", description: "Failed to refill", variant: "destructive" }); }
        }}
      />
      <AddSupplyDialog open={addOpen} onOpenChange={setAddOpen} vendors={vendors} onSuccess={() => { loadFoodSupplies(true); loadStats(); }} />
      <EnhancedBarcodeScanner
        kitchenId={scannerKitchenId || kitchens[0]?.id || ""}
        open={showConsumptionScanner} onOpenChange={setShowConsumptionScanner} onScanComplete={() => loadFoodSupplies(true)}
      />

      <DashboardLayout>
        <div className="flex flex-col space-y-5">

          {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
          <div className="relative rounded-3xl overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.22),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.10),transparent_60%)]" />
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-52 h-52 rounded-full bg-white/5 blur-3xl" />

            <div className="relative z-10 p-7">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                {/* Title + KPIs */}
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg ring-1 ring-white/30">
                      <UtensilsCrossed className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="text-orange-100/80 text-xs font-semibold uppercase tracking-widest">Inventory Operations</p>
                      <h1 className="text-3xl font-black text-white tracking-tight">{t("food_supply_management")}</h1>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Total Items",     value: stats?.totalSupplies ?? 0,     icon: Package,      warn: false },
                      { label: "Inventory Value", value: `QAR ${totalInventoryValue.toFixed(0)}`, icon: DollarSign, warn: false },
                      { label: "Expiring / Critical", value: (expiringCount + criticalCount), icon: AlertTriangle, warn: (expiringCount + criticalCount) > 0 },
                      { label: "Consumed Value",  value: `QAR ${(stats?.totalConsumed ?? 0).toFixed(0)}`, icon: TrendingUp, warn: false },
                    ].map(({ label, value, icon: Icon, warn }) => (
                      <div key={label} className={`rounded-2xl px-4 py-3.5 border ${warn ? "bg-red-500/25 border-red-300/40" : "bg-white/12 border-white/20"} backdrop-blur-sm`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="h-3.5 w-3.5 text-white/70" />
                          <p className="text-[10px] uppercase tracking-widest text-white/70 font-semibold">{label}</p>
                        </div>
                        <p className={`text-2xl font-black ${warn ? "text-red-100" : "text-white"}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2.5 shrink-0">
                  {/* Scanner CTA */}
                  <div className="flex items-center gap-2">
                    {kitchens.length > 1 && (
                      <select
                        value={scannerKitchenId} onChange={e => setScannerKitchenId(e.target.value)}
                        className="h-9 rounded-lg border border-white/30 bg-white/20 text-white text-xs font-semibold px-2 backdrop-blur-sm focus:outline-none"
                      >
                        {kitchens.map(k => <option key={k.id} value={k.id} className="text-foreground bg-background">{k.name}</option>)}
                      </select>
                    )}
                    <Button onClick={() => setShowConsumptionScanner(true)} disabled={kitchens.length === 0}
                      className="bg-white text-emerald-700 hover:bg-emerald-50 border-0 shadow-lg font-semibold gap-2">
                      <ScanLine className="h-4 w-4" />Record Consumption
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <PrintFoodSupplyReportButton foodSupplies={foodSupplies} stats={stats} categories={CATEGORIES} />
                    <BarcodeManagementDialog />
                    <Button onClick={() => setAddOpen(true)} className="bg-white text-orange-600 hover:bg-amber-50 border-0 shadow-lg font-semibold gap-2 flex-1">
                      <PlusCircle className="h-4 w-4" />{t("register_new_supply")}
                    </Button>
                  </div>
                  <Button variant="outline" size="sm"
                    className="border-white/30 bg-white/10 text-white hover:bg-white/20 gap-2"
                    onClick={() => { loadFoodSupplies(true); loadStats(); }} disabled={isRefreshing}>
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    Refresh Data
                  </Button>
                </div>
              </div>

              {/* Alert ribbon */}
              {(expiredCount > 0 || criticalCount > 0) && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {expiredCount > 0 && (
                    <button onClick={() => { setStatusFilter("expired"); setActiveTab("inventory"); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/30 border border-red-300/40 text-white text-sm font-semibold hover:bg-red-500/40 transition-colors">
                      <AlertCircle className="h-4 w-4 animate-pulse" />
                      {expiredCount} expired item{expiredCount !== 1 ? "s" : ""}
                    </button>
                  )}
                  {criticalCount > 0 && (
                    <button onClick={() => { setStatusFilter("critical"); setActiveTab("inventory"); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/25 border border-orange-300/40 text-white text-sm font-semibold hover:bg-orange-500/35 transition-colors">
                      <AlertTriangle className="h-4 w-4" />
                      {criticalCount} expiring within 7 days
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Bottom feature strip */}
            <div className="relative z-10 border-t border-white/20 grid grid-cols-3 divide-x divide-white/20">
              {[
                { label: "Kitchen Link",  icon: Building2, value: `${kitchens.length} Kitchen${kitchens.length !== 1 ? "s" : ""}` },
                { label: "Categories",    icon: BarChart3, value: `${stats?.categoryStats?.length ?? 0} Active` },
                { label: "AI-Powered",    icon: Brain,     value: "Insights" },
              ].map(({ label, icon: Icon, value }) => (
                <div key={label} className="px-5 py-3 flex items-center gap-3">
                  <Icon className="h-4 w-4 text-amber-200" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-amber-200/70 font-semibold">{label}</p>
                    <p className="text-sm font-bold text-white">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ══ NOTIFICATIONS ══════════════════════════════════════════════════════ */}
          <FoodSupplyNotifications />

          {/* ══ TABS ═══════════════════════════════════════════════════════════════ */}
          <div className="space-y-5">
            {/* Tab bar */}
            <div className="flex overflow-x-auto gap-1 rounded-2xl bg-muted/50 p-1.5 no-scrollbar">
              {TABS.map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 flex-shrink-0 ${
                    activeTab === key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  }`}>
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </div>

            {/* ══ INVENTORY TAB ═══════════════════════════════════════════════════ */}
            {activeTab === "inventory" && (
              <div className="space-y-5">

                {/* Category tiles */}
                <Card className="border-0 ring-1 ring-border/60 shadow-sm">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                            <BarChart3 className="h-3.5 w-3.5 text-white" />
                          </div>
                          {t("category_distribution")}
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">Click a category to filter</CardDescription>
                      </div>
                      {selectedCategory !== "all" && (
                        <button onClick={() => setSelectedCategory("all")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <X className="h-3 w-3" />Clear
                        </button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap gap-2 mb-3">
                      <button onClick={() => setSelectedCategory("all")}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all border ${
                          selectedCategory === "all" ? "bg-foreground text-background border-transparent shadow-sm" : "bg-muted hover:bg-muted/80 text-muted-foreground border-border hover:text-foreground"
                        }`}>
                        <Package className="h-3.5 w-3.5" />All
                        {stats?.totalSupplies ? <span className="text-[10px] rounded-full px-1.5 py-0.5 font-bold bg-current/10">{stats.totalSupplies}</span> : null}
                      </button>
                      {CATEGORIES.map(cat => {
                        const count = stats?.categoryStats?.find(s => s.category === cat.value)?._count;
                        if (!count) return null;
                        return (
                          <CategoryDetailsDialog key={cat.value} category={cat.value} categoryLabel={cat.label} trigger={
                            <button onClick={() => setSelectedCategory(cat.value)}
                              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all border ${
                                selectedCategory === cat.value ? "bg-foreground text-background border-transparent shadow-sm" : `${cat.color} hover:shadow-sm`
                              }`}>
                              <span className="text-base leading-none">{cat.icon}</span>{cat.label}
                              <span className="text-[10px] rounded-full px-1.5 py-0.5 font-bold bg-current/10">{count}</span>
                            </button>
                          } />
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Supply list */}
                <Card className="border-0 ring-1 ring-border/60 shadow-sm">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{t("food_supply_list")}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {filteredAndSorted.length} of {foodSupplies.length} items
                          {(searchTerm || selectedCategory !== "all" || statusFilter !== "all") && " (filtered)"}
                        </p>
                      </div>
                      <Dialog onOpenChange={open => { if (open) loadConsumptionHistory(); }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2 rounded-xl shrink-0">
                            <FileText className="h-4 w-4" />{t("full_consumption_report")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-5xl w-[90vw]">
                          <DialogHeader className="sticky top-0 bg-background z-10 pb-4">
                            <DialogTitle>{t("full_consumption_report")}</DialogTitle>
                            <DialogDescription>{t("complete_history_of_all_food_supply_consumption")}</DialogDescription>
                          </DialogHeader>
                          {isLoadingHistory ? (
                            <div className="flex items-center justify-center p-12">
                              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                          ) : (
                            <div className="overflow-y-auto"><AssetReport consumptionHistory={consumptionHistory} isFullReport /></div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Search + Filter toolbar */}
                    <div className="mt-4 space-y-3">
                      {/* Search + Sort + View */}
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by name, category, vendor…"
                            className="pl-9 rounded-xl h-9 border-border/60 focus-visible:ring-orange-400/40"
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                          />
                          {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
                        </div>

                        {/* Sort */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 rounded-xl h-9 shrink-0">
                              <ArrowUpDown className="h-3.5 w-3.5" />
                              Sort: {sortBy === "expiry" ? "Expiry" : sortBy === "name" ? "Name" : sortBy === "quantity" ? "Qty" : sortBy === "value" ? "Value" : "New"}
                              {sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuLabel className="text-xs">Sort by</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {[
                              { key: "expiry",   label: "Expiry Date" },
                              { key: "name",     label: "Name A–Z" },
                              { key: "quantity", label: "Quantity" },
                              { key: "value",    label: "Total Value" },
                              { key: "created",  label: "Newest First" },
                            ].map(o => (
                              <DropdownMenuItem key={o.key} onClick={() => toggleSort(o.key as any)}
                                className={sortBy === o.key ? "font-semibold text-orange-600" : ""}>
                                {o.label}
                                {sortBy === o.key && (sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-auto" /> : <ArrowDown className="h-3 w-3 ml-auto" />)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* View mode */}
                        <div className="flex rounded-xl border border-border overflow-hidden h-9 shrink-0">
                          <button onClick={() => setViewMode("grid")} className={`px-3 flex items-center gap-1.5 text-xs font-semibold transition-colors ${viewMode === "grid" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                            <Grid3X3 className="h-3.5 w-3.5" />Grid
                          </button>
                          <button onClick={() => setViewMode("table")} className={`px-3 flex items-center gap-1.5 text-xs font-semibold transition-colors border-l border-border ${viewMode === "table" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                            <List className="h-3.5 w-3.5" />Table
                          </button>
                        </div>
                      </div>

                      {/* Status quick-filters */}
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: "all",      label: "All",             count: foodSupplies.length,  cls: "bg-muted text-muted-foreground hover:text-foreground" },
                          { key: "expired",  label: "Expired",         count: expiredCount,          cls: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40" },
                          { key: "critical", label: "Critical (≤7d)",  count: criticalCount,         cls: "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/40" },
                          { key: "expiring", label: "Expiring (≤30d)", count: expiringCount,         cls: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40" },
                          { key: "good",     label: "Good",            count: foodSupplies.filter(s => getDaysUntil(s.expirationDate) > 30).length, cls: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40" },
                        ].map(({ key, label, count, cls }) => (
                          <button key={key} onClick={() => setStatusFilter(key as any)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                              statusFilter === key ? "ring-2 ring-offset-1 ring-orange-400 shadow-sm" : ""
                            } ${cls}`}>
                            {label}
                            <span className="bg-current/15 rounded-full px-1.5 py-0.5 font-bold">{count}</span>
                          </button>
                        ))}
                        {(searchTerm || selectedCategory !== "all" || statusFilter !== "all") && (
                          <button onClick={() => { setSearchTerm(""); setSelectedCategory("all"); setStatusFilter("all"); }}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5">
                            <X className="h-3 w-3" />Clear all
                          </button>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4">
                    {isLoading ? (
                      <div className={`${viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" : "space-y-2"} animate-pulse`}>
                        {[...Array(6)].map((_, i) => (
                          <Skeleton key={i} className="h-52 rounded-2xl" />
                        ))}
                      </div>
                    ) : filteredAndSorted.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-border">
                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold mb-1">{t("no_food_supplies_found")}</h3>
                        <p className="text-sm text-muted-foreground text-center max-w-xs mb-4">
                          {searchTerm || selectedCategory !== "all" || statusFilter !== "all"
                            ? "Try adjusting your search or filters."
                            : "Register your first food supply item to get started."}
                        </p>
                        {!searchTerm && selectedCategory === "all" && statusFilter === "all" && (
                          <Button onClick={() => setAddOpen(true)} className="gap-2">
                            <PlusCircle className="h-4 w-4" />{t("register_new_supply")}
                          </Button>
                        )}
                      </div>
                    ) : isMobile ? (
                      <div className="grid gap-4">
                        {filteredAndSorted.map(supply => (
                          <FoodSupplyMobileCard key={supply.id} supply={supply} categories={CATEGORIES} onUpdate={() => loadFoodSupplies(true)} />
                        ))}
                      </div>
                    ) : viewMode === "grid" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredAndSorted.map(supply => (
                          <SupplyCard key={supply.id} supply={supply} kitchens={kitchens} onUpdate={() => { loadFoodSupplies(true); loadStats(); }} />
                        ))}
                      </div>
                    ) : (
                      /* Table view */
                      <div className="overflow-x-auto rounded-xl border border-border/50">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/40">
                              {[
                                { label: "Name",     field: "name" },
                                { label: "Category", field: null },
                                { label: "Quantity", field: "quantity" },
                                { label: "Price/Unit", field: null },
                                { label: "Total Value", field: "value" },
                                { label: "Expiry",   field: "expiry" },
                                { label: "",         field: null },
                              ].map(({ label, field }) => (
                                <th key={label} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground ${field ? "cursor-pointer hover:text-foreground" : ""}`}
                                  onClick={() => field && toggleSort(field as any)}>
                                  <div className="flex items-center gap-1">
                                    {label}
                                    {field && sortBy === field && (
                                      sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-orange-500" /> : <ArrowDown className="h-3 w-3 text-orange-500" />
                                    )}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAndSorted.map(supply => (
                              <SupplyTableRow key={supply.id} supply={supply} kitchens={kitchens} onUpdate={() => { loadFoodSupplies(true); loadStats(); }} />
                            ))}
                          </tbody>
                        </table>
                        <div className="px-4 py-2.5 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
                          <span>{filteredAndSorted.length} item{filteredAndSorted.length !== 1 ? "s" : ""}</span>
                          <span className="font-semibold">Total: QAR {filteredAndSorted.reduce((s, i) => s + i.quantity * i.pricePerUnit, 0).toFixed(0)}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ══ OTHER TABS ══════════════════════════════════════════════════════ */}
            {activeTab === "multi-location" && <MultiLocationInventoryTab />}

            {activeTab === "kitchens" && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("kitchen_management")}</CardTitle>
                  <CardDescription>{t("manage_kitchen_locations_and_consumption")}</CardDescription>
                </CardHeader>
                <CardContent><KitchenManagement /></CardContent>
              </Card>
            )}

            {activeTab === "recipes" && <RecipesTabRebuilt />}

            {activeTab === "analytics" && <KitchenConsumptionAnalysisTab />}
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}
