// @ts-nocheck
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/TranslationContext";
import {
  Loader2, Check, ScanLine, X, ChefHat, Package, Calendar,
  AlertTriangle, CheckCircle2, Minus, Plus, Search, Camera,
  Keyboard, ArrowLeft, Utensils, Zap, RefreshCcw, Info,
  Clock, MapPin, User, BookOpen
} from "lucide-react";

interface FoodSupply {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expirationDate?: string | null;
  kitchenId: string;
  kitchenName: string;
  category?: string;
  pricePerUnit?: number;
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  ingredients: any[];
}

const consumptionFormSchema = z.object({
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  notes: z.string().optional(),
});

interface EnhancedBarcodeScannerProps {
  kitchenId: string;
  onScanComplete?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type ScannerState = 'scanning' | 'found-supply' | 'found-recipe' | 'not-found' | 'error';

export default function EnhancedBarcodeScanner({
  kitchenId, onScanComplete, open: externalOpen, onOpenChange
}: EnhancedBarcodeScannerProps) {
  const [internalShowScanner, setInternalShowScanner] = useState(false);
  const showScanner = externalOpen !== undefined ? externalOpen : internalShowScanner;
  const setShowScanner = (value: boolean) => {
    if (onOpenChange) onOpenChange(value);
    else setInternalShowScanner(value);
  };

  const [manualCode, setManualCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodSupply[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [foundSupply, setFoundSupply] = useState<FoodSupply | null>(null);
  const [foundRecipe, setFoundRecipe] = useState<Recipe | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [servingsCount, setServingsCount] = useState(1);
  const [scannerState, setScannerState] = useState<ScannerState>('scanning');
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('camera');
  const { toast } = useToast();
  const { t } = useTranslation();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { user } = useAuth();
  const scannerContainerId = 'enhanced-barcode-scanner-v2';
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const consumptionForm = useForm<z.infer<typeof consumptionFormSchema>>({
    resolver: zodResolver(consumptionFormSchema),
    defaultValues: { quantity: 1, notes: '' },
  });

  // ── Camera initialization ──────────────────────────────────
  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING
          await scannerRef.current.stop();
        }
        scannerRef.current = null;
      } catch (e) {
        scannerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!showScanner || activeTab !== 'camera') return;
    if (foundSupply || foundRecipe) return;

    let cancelled = false;
    const startCamera = async () => {
      try {
        setCameraError(null);
        await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) return;

        if (!document.getElementById(scannerContainerId)) return;
        if (scannerRef.current) return;

        scannerRef.current = new Html5Qrcode(scannerContainerId);
        const devices = await Html5Qrcode.getCameras();
        if (!devices?.length) throw new Error("No cameras found");

        const backCamera = devices.find(d =>
          d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear')
        ) || devices[0];

        if (cancelled) return;
        await scannerRef.current.start(
          backCamera.id,
          { fps: 12, qrbox: { width: 260, height: 180 }, aspectRatio: 1.5 },
          handleScan,
          () => {}
        );
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.name === 'NotAllowedError'
          ? 'Camera access denied. Please allow camera in browser settings.'
          : 'Could not start camera. Use manual entry below.';
        setCameraError(msg);
      }
    };

    const timer = setTimeout(startCamera, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopCamera();
    };
  }, [showScanner, activeTab, foundSupply, foundRecipe]);

  // ── Barcode lookup ─────────────────────────────────────────
  const lookupBarcode = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLastScannedCode(trimmed);
    setIsLookingUp(true);

    try {
      // 1. Try food supply in current kitchen
      let res = await fetch(`/api/food-supply?barcode=${encodeURIComponent(trimmed)}&kitchenId=${kitchenId}`);
      let data = await res.json();

      if (data.supply) {
        setFoundSupply(data.supply);
        setScannerState('found-supply');
        return;
      }

      // 2. Try food supply in any kitchen (cross-kitchen)
      res = await fetch(`/api/food-supply?barcode=${encodeURIComponent(trimmed)}`);
      data = await res.json();

      if (data.supply) {
        setFoundSupply(data.supply);
        setScannerState('found-supply');
        return;
      }

      // 3. Try recipe
      res = await fetch(`/api/recipes/${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const recipe = await res.json();
        if (recipe?.id) {
          setFoundRecipe(recipe);
          setScannerState('found-recipe');
          return;
        }
      }

      // 4. Nothing found
      setScannerState('not-found');
    } catch (err) {
      setScannerState('error');
    } finally {
      setIsLookingUp(false);
    }
  }, [kitchenId]);

  const handleScan = useCallback(async (decodedText: string) => {
    if (isLookingUp) return;
    await stopCamera();
    await lookupBarcode(decodedText);
  }, [isLookingUp, stopCamera, lookupBarcode]);

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await lookupBarcode(manualCode.trim());
  };

  // ── Name search (debounced) ────────────────────────────────
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/food-supply/search?query=${encodeURIComponent(searchQuery)}&kitchenId=${kitchenId}`);
        if (res.ok) {
          const d = await res.json();
          setSearchResults(d.items || []);
        }
      } catch { /* ignore */ }
      setIsSearching(false);
    }, 350);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery, kitchenId]);

  // ── Reset ─────────────────────────────────────────────────
  const resetScanner = useCallback(async () => {
    setFoundSupply(null);
    setFoundRecipe(null);
    setLastScannedCode('');
    setManualCode('');
    setSearchQuery('');
    setSearchResults([]);
    setScannerState('scanning');
    setCameraError(null);
    setServingsCount(1);
    consumptionForm.reset();
  }, [consumptionForm]);

  const handleDialogClose = async (open: boolean) => {
    if (!open) {
      await stopCamera();
      setShowScanner(false);
      resetScanner();
    } else {
      setShowScanner(open);
    }
  };

  // ── Record consumption ─────────────────────────────────────
  const onRecordConsumption = async (values: z.infer<typeof consumptionFormSchema>) => {
    if (!foundSupply) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/food-supply/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplyId: foundSupply.id,
          quantity: values.quantity,
          kitchenId: foundSupply.kitchenId,
          notes: values.notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record consumption');
      }
      toast({ title: 'Consumption Recorded', description: `${values.quantity} ${foundSupply.unit} of ${foundSupply.name}` });
      window.dispatchEvent(new CustomEvent('food-consumption-recorded', {
        detail: { supplyId: foundSupply.id, quantity: values.quantity, timestamp: new Date().toISOString() }
      }));
      handleDialogClose(false);
      onScanComplete?.();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to record', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Use recipe ─────────────────────────────────────────────
  const handleUseRecipe = async () => {
    if (!foundRecipe || servingsCount <= 0) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/recipes/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: foundRecipe.id,
          kitchenId,
          notes: `Used recipe: ${foundRecipe.name} (${servingsCount} servings)`,
          servingsUsed: servingsCount,
          forceUse: false,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        if (errData.insufficientIngredients) {
          toast({ title: 'Insufficient Ingredients', description: 'Not enough stock for this recipe', variant: 'destructive' });
          return;
        }
        throw new Error(errData.error || 'Failed to use recipe');
      }
      toast({ title: 'Recipe Used', description: `${foundRecipe.name} for ${servingsCount} servings` });
      window.dispatchEvent(new CustomEvent('food-consumption-recorded', {
        detail: { recipeId: foundRecipe.id, timestamp: new Date().toISOString() }
      }));
      handleDialogClose(false);
      onScanComplete?.();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to use recipe', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────
  const getExpiryInfo = (date?: string | null) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' };
    if (days <= 3) return { label: `Expires in ${days}d`, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
    if (days <= 7) return { label: `Expires in ${days}d`, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' };
    return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
  };

  const qty = consumptionForm.watch('quantity');

  // ════════════════════════════════════════════════════════════
  return (
    <>
      {externalOpen === undefined && (
        <Button onClick={() => setShowScanner(true)} className="gap-2">
          <ScanLine className="h-4 w-4" />
          {t('scan_item_or_recipe')}
        </Button>
      )}

      <Dialog open={showScanner} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">

          {/* ── DIALOG HEADER ── */}
          <div className="relative bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <ScanLine className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-white font-bold text-base leading-tight">
                    {foundSupply ? 'Item Found' : foundRecipe ? 'Recipe Found' : 'Food Supply Scanner'}
                  </DialogTitle>
                  <p className="text-emerald-100/80 text-xs mt-0.5">
                    {foundSupply ? foundSupply.kitchenName : foundRecipe ? `${foundRecipe.ingredients.length} ingredients` : 'Scan or search to register consumption'}
                  </p>
                </div>
              </div>
              {(foundSupply || foundRecipe || scannerState === 'not-found') && (
                <button onClick={resetScanner}
                  className="h-8 w-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <ArrowLeft className="h-4 w-4 text-white" />
                </button>
              )}
            </div>
          </div>

          {/* ── LOOKUP LOADING ── */}
          {isLookingUp && (
            <div className="flex flex-col items-center justify-center py-14 gap-4">
              <div className="h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
              </div>
              <p className="font-semibold text-foreground">Looking up item…</p>
              <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-1 rounded-full">{lastScannedCode}</p>
            </div>
          )}

          {/* ── FOUND: FOOD SUPPLY ── */}
          {!isLookingUp && foundSupply && (() => {
            const expiryInfo = getExpiryInfo(foundSupply.expirationDate);
            const stockPct = Math.min((foundSupply.quantity / Math.max(foundSupply.quantity * 1.5, 1)) * 100, 100);
            return (
              <div className="p-5 space-y-4">
                {/* Item card */}
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/10 overflow-hidden">
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                          <Utensils className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-foreground leading-tight">{foundSupply.name}</h3>
                          {foundSupply.category && (
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{foundSupply.category}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-2xl font-black text-emerald-700 tabular-nums">{foundSupply.quantity}</p>
                        <p className="text-xs text-muted-foreground">{foundSupply.unit} available</p>
                      </div>
                    </div>

                    {/* Stock bar */}
                    <div className="mt-3">
                      <div className="h-1.5 bg-emerald-200 dark:bg-emerald-800/40 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${stockPct}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="border-t border-emerald-200 dark:border-emerald-800/40 grid grid-cols-2 divide-x divide-emerald-200 dark:divide-emerald-800/40">
                    <div className="px-4 py-2.5 flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                      <span className="text-xs font-medium text-foreground truncate">{foundSupply.kitchenName}</span>
                    </div>
                    {expiryInfo ? (
                      <div className={`px-4 py-2.5 flex items-center gap-2`}>
                        <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        <span className={`text-xs font-medium ${expiryInfo.color}`}>{expiryInfo.label}</span>
                      </div>
                    ) : (
                      <div className="px-4 py-2.5 flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">{user?.email?.split('@')[0]}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Consumption form */}
                <Form {...consumptionForm}>
                  <form onSubmit={consumptionForm.handleSubmit(onRecordConsumption)} className="space-y-4">
                    <FormField
                      control={consumptionForm.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">
                            Consumption Quantity
                            <span className="ml-1 text-muted-foreground font-normal">({foundSupply.unit})</span>
                          </FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <button type="button"
                                onClick={() => field.onChange(Math.max(0.1, parseFloat((field.value - (field.value >= 10 ? 1 : 0.5)).toFixed(2))))}
                                className="h-10 w-10 rounded-xl border border-border bg-muted hover:bg-muted/80 flex items-center justify-center flex-shrink-0 transition-colors">
                                <Minus className="h-4 w-4" />
                              </button>
                              <div className="flex-1 relative">
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0.01"
                                  className="text-center text-lg font-bold h-10"
                                  {...field}
                                  onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </div>
                              <button type="button"
                                onClick={() => field.onChange(parseFloat((field.value + (field.value >= 10 ? 1 : 0.5)).toFixed(2)))}
                                className="h-10 w-10 rounded-xl border border-border bg-muted hover:bg-muted/80 flex items-center justify-center flex-shrink-0 transition-colors">
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </FormControl>
                          {/* Quick presets */}
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {[0.5, 1, 2, 5, 10].map(v => (
                              <button key={v} type="button"
                                onClick={() => field.onChange(v)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${field.value === v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'}`}>
                                {v}
                              </button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={consumptionForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Notes <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Breakfast service, breakfast prep…" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Summary row */}
                    {qty > 0 && foundSupply.pricePerUnit && (
                      <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-2.5 border border-border/50">
                        <span className="text-xs text-muted-foreground">Estimated value consumed</span>
                        <span className="text-sm font-black text-foreground">QAR {(qty * foundSupply.pricePerUnit).toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-11 font-bold" disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        {isProcessing ? 'Recording…' : 'Record Consumption'}
                      </Button>
                      <Button type="button" variant="outline" onClick={resetScanner} className="h-11 px-4">
                        <RefreshCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            );
          })()}

          {/* ── FOUND: RECIPE ── */}
          {!isLookingUp && foundRecipe && (
            <div className="p-5 space-y-4">
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-900/10 overflow-hidden">
                <div className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-base text-foreground">{foundRecipe.name}</h3>
                      {foundRecipe.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{foundRecipe.description}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="border-t border-indigo-200 dark:border-indigo-800/40 grid grid-cols-2 divide-x divide-indigo-200 dark:divide-indigo-800/40">
                  <div className="px-4 py-2.5">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Ingredients</p>
                    <p className="text-sm font-bold">{foundRecipe.ingredients.length} items</p>
                  </div>
                  <div className="px-4 py-2.5">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Standard Servings</p>
                    <p className="text-sm font-bold">{foundRecipe.servings}</p>
                  </div>
                </div>
              </div>

              {/* Servings stepper */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Number of Servings to Use</Label>
                <div className="flex items-center gap-2">
                  <button type="button"
                    onClick={() => setServingsCount(Math.max(1, servingsCount - 1))}
                    className="h-11 w-11 rounded-xl border border-border bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors">
                    <Minus className="h-4 w-4" />
                  </button>
                  <Input
                    type="number" min="1"
                    className="flex-1 text-center text-lg font-bold h-11"
                    value={servingsCount}
                    onChange={e => setServingsCount(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <button type="button"
                    onClick={() => setServingsCount(servingsCount + 1)}
                    className="h-11 w-11 rounded-xl border border-border bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Standard recipe serves {foundRecipe.servings} people</p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleUseRecipe} className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 font-bold" disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  {isProcessing ? 'Processing…' : 'Use Recipe'}
                </Button>
                <Button variant="outline" onClick={resetScanner} className="h-11 px-4">
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── NOT FOUND ── */}
          {!isLookingUp && scannerState === 'not-found' && (
            <div className="p-5 flex flex-col items-center gap-4 text-center">
              <div className="h-16 w-16 rounded-2xl bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-rose-500" />
              </div>
              <div>
                <p className="font-bold text-foreground">Item Not Found</p>
                <p className="text-sm text-muted-foreground mt-1">No food supply or recipe matched</p>
                {lastScannedCode && (
                  <p className="text-xs font-mono bg-muted px-3 py-1 rounded-full mt-2 inline-block">{lastScannedCode}</p>
                )}
              </div>
              <Button onClick={resetScanner} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <RefreshCcw className="h-4 w-4" /> Try Again
              </Button>
            </div>
          )}

          {/* ── SCANNER / SEARCH UI ── */}
          {!isLookingUp && !foundSupply && !foundRecipe && scannerState === 'scanning' && (
            <Tabs value={activeTab} onValueChange={tab => {
              setActiveTab(tab);
              if (tab !== 'camera') stopCamera();
            }} className="w-full">
              <div className="px-5 pt-4">
                <TabsList className="w-full h-auto p-1 bg-muted/60 rounded-xl grid grid-cols-3 gap-1">
                  <TabsTrigger value="camera" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs font-semibold py-2 flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5" /> Camera
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs font-semibold py-2 flex items-center gap-1.5">
                    <Keyboard className="h-3.5 w-3.5" /> Barcode
                  </TabsTrigger>
                  <TabsTrigger value="search" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs font-semibold py-2 flex items-center gap-1.5">
                    <Search className="h-3.5 w-3.5" /> Search
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Camera tab */}
              <TabsContent value="camera" className="mt-0 p-5">
                {cameraError ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{cameraError}</p>
                      <p className="text-xs text-muted-foreground mt-1">Switch to "Barcode" or "Search" tabs to continue.</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden bg-black" style={{ minHeight: 260 }}>
                    <div id={scannerContainerId} className="w-full" />
                    {/* Scan line overlay */}
                    <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 pointer-events-none">
                      <div className="border-2 border-emerald-400/80 rounded-xl" style={{ height: 140 }}>
                        <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />
                      </div>
                    </div>
                  </div>
                )}
                <p className="text-xs text-center text-muted-foreground mt-3 flex items-center justify-center gap-1">
                  <Zap className="h-3 w-3 text-emerald-500" /> Point camera at barcode or QR code
                </p>
              </TabsContent>

              {/* Manual barcode tab */}
              <TabsContent value="manual" className="mt-0 p-5">
                <form onSubmit={handleManualSearch} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Barcode / QR Code</Label>
                    <div className="relative">
                      <ScanLine className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9 h-11 font-mono text-sm"
                        placeholder="e.g. KITCM75SUPCMA01745790647377"
                        value={manualCode}
                        onChange={e => setManualCode(e.target.value)}
                        autoFocus
                      />
                      {manualCode && (
                        <button type="button" onClick={() => setManualCode('')}
                          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Type or paste the barcode code directly, or use a handheld scanner</p>
                  </div>
                  <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 font-bold gap-2" disabled={!manualCode.trim()}>
                    <Search className="h-4 w-4" /> Look Up Item
                  </Button>
                </form>
              </TabsContent>

              {/* Name search tab */}
              <TabsContent value="search" className="mt-0 p-5">
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9 h-11"
                      placeholder="Search by item name…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                    {isSearching && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                    {searchQuery && !isSearching && (
                      <button type="button" onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {searchResults.length > 0 ? (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {searchResults.map(item => {
                        const expiryInfo = getExpiryInfo(item.expirationDate);
                        return (
                          <button key={item.id} type="button"
                            onClick={() => { setFoundSupply(item); setScannerState('found-supply'); }}
                            className="w-full text-left rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-emerald-300 transition-all p-3.5 group">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                                  <Utensils className="h-4 w-4 text-emerald-600" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm truncate">{item.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{item.kitchenName} · {item.category}</p>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-black text-base tabular-nums">{item.quantity}</p>
                                <p className="text-[10px] text-muted-foreground">{item.unit}</p>
                              </div>
                            </div>
                            {expiryInfo && (
                              <div className={`mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 border ${expiryInfo.bg} ${expiryInfo.color}`}>
                                <Clock className="h-2.5 w-2.5" /> {expiryInfo.label}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : searchQuery.length >= 2 && !isSearching ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No items found for "{searchQuery}"</p>
                    </div>
                  ) : searchQuery.length < 2 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Type at least 2 characters to search</p>
                    </div>
                  ) : null}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
