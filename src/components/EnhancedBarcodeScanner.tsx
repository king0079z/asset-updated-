// @ts-nocheck
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  Loader2, Check, ScanLine, X, Package, Calendar,
  AlertTriangle, CheckCircle2, Minus, Plus, Search, Camera,
  Keyboard, ArrowLeft, Utensils, Zap, RefreshCcw,
  Clock, MapPin, User, BookOpen
} from "lucide-react";
/* ─────────────────────────── Types ─────────────────────────── */
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

type View = 'camera' | 'manual' | 'search' | 'found-supply' | 'found-recipe' | 'not-found' | 'auto-recording' | 'recorded';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════════ */
export default function EnhancedBarcodeScanner({
  kitchenId, onScanComplete, open: externalOpen, onOpenChange
}: EnhancedBarcodeScannerProps) {

  /* ── Dialog open state ───────────────────────────────── */
  const [internalOpen, setInternalOpen] = useState(false);
  const showScanner = externalOpen !== undefined ? externalOpen : internalOpen;
  const setShowScanner = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };

  /* ── UI state ────────────────────────────────────────── */
  const [view, setView]                     = useState<View>('camera');
  const [manualCode, setManualCode]         = useState('');
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState<FoodSupply[]>([]);
  const [isSearching, setIsSearching]       = useState(false);
  const [foundSupply, setFoundSupply]       = useState<FoodSupply | null>(null);
  const [foundRecipe, setFoundRecipe]       = useState<Recipe | null>(null);
  const [isProcessing, setIsProcessing]     = useState(false);
  const [isLookingUp, setIsLookingUp]       = useState(false);
  const [servingsCount, setServingsCount]   = useState(1);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [camLoading, setCamLoading]         = useState(false);
  const [camError, setCamError]             = useState<string | null>(null);

  /* ── Refs ────────────────────────────────────────────── */
  const qrRef            = useRef<Html5Qrcode | null>(null);
  const scanned          = useRef(false);                  // single-fire guard
  const scanBuffer       = useRef<string[]>([]);           // multi-read confirmation
  const [scanConfidence, setScanConfidence] = useState(0); // 0-100 confidence %
  const searchDebounce   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SCANNER_DIV_ID   = 'food-qr-scanner-div';
  const REQUIRED_MATCHES = 3; // same code must appear this many times in last 7 reads

  /* ── Hooks ───────────────────────────────────────────── */
  const { toast }  = useToast();
  const { t }      = useTranslation();
  const { user }   = useAuth();
  const consumptionForm = useForm<z.infer<typeof consumptionFormSchema>>({
    resolver: zodResolver(consumptionFormSchema),
    defaultValues: { quantity: 1, notes: '' },
  });

  /* ════════════════════════════════════════════════════════
     CAMERA — exact same pattern as working BarcodeScanner2
  ════════════════════════════════════════════════════════ */
  const stopCam = useCallback(async () => {
    if (qrRef.current) {
      try { await qrRef.current.stop(); } catch {}
      qrRef.current = null;
    }
  }, []);

  /* autoRecordSupply — immediately records 1 unit then shows success */
  const autoRecordSupply = useCallback(async (supply: FoodSupply) => {
    setView('auto-recording');
    try {
      const consumeRes = await fetch('/api/food-supply/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplyId: supply.id,
          quantity: 1,
          kitchenId: supply.kitchenId,
          notes: '',
        }),
      });
      if (!consumeRes.ok) {
        const err = await consumeRes.json();
        // Fall back to manual form on error so user can try again
        setFoundSupply(supply);
        setView('found-supply');
        toast({
          title: 'Could not auto-record',
          description: err.error || 'Please confirm manually',
          variant: 'destructive',
        });
      } else {
        setFoundSupply(supply);
        setView('recorded');
        window.dispatchEvent(new CustomEvent('food-consumption-recorded', {
          detail: { supplyId: supply.id, quantity: 1, timestamp: new Date().toISOString() }
        }));
        onScanComplete?.();
      }
    } catch {
      setFoundSupply(supply);
      setView('found-supply');
      toast({ title: 'Error', description: 'Failed to record consumption', variant: 'destructive' });
    }
  }, [onScanComplete, toast]);

  /* lookupBarcode — stable (only depends on kitchenId prop) */
  const lookupBarcode = useCallback(async (code: string, fromCamera = false) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLastScannedCode(trimmed);
    setIsLookingUp(true);
    try {
      // 1. Try in current kitchen first
      let res  = await fetch(`/api/food-supply?barcode=${encodeURIComponent(trimmed)}&kitchenId=${kitchenId}`);
      let data = await res.json();
      if (data.supply) {
        setIsLookingUp(false);
        if (fromCamera) {
          // Camera/barcode scan → auto-record immediately (original behavior)
          await autoRecordSupply(data.supply);
        } else {
          setFoundSupply(data.supply); setView('found-supply');
        }
        return;
      }

      // 2. Cross-kitchen fallback
      res  = await fetch(`/api/food-supply?barcode=${encodeURIComponent(trimmed)}`);
      data = await res.json();
      if (data.supply) {
        setIsLookingUp(false);
        if (fromCamera) {
          await autoRecordSupply(data.supply);
        } else {
          setFoundSupply(data.supply); setView('found-supply');
        }
        return;
      }

      // 3. Recipe fallback
      res = await fetch(`/api/recipes/${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const recipe = await res.json();
        if (recipe?.id) { setFoundRecipe(recipe); setView('found-recipe'); return; }
      }

      // 4. Not found
      setView('not-found');
    } catch { setView('not-found'); }
    finally  { setIsLookingUp(false); }
  }, [kitchenId, autoRecordSupply]);

  /* isValidBarcode — reject garbled reads (special chars, too short) */
  const isValidBarcode = (code: string) => {
    if (!code || code.length < 4) return false;
    // Must be printable ASCII only — no control chars, backslash, backtick, etc.
    if (/[^\x20-\x7E]/.test(code)) return false;
    // Reject strings with characters that never appear in valid barcodes
    if (/[\\`'"<>{}|]/.test(code)) return false;
    return true;
  };

  /* onCode — multi-read confirmation before firing (eliminates misreads) */
  const onCode = useCallback(async (raw: string) => {
    if (!raw || scanned.current) return;

    // 1. Validate — discard garbled reads immediately
    if (!isValidBarcode(raw)) return;

    // 2. Add to rolling buffer (keep last 7 reads)
    scanBuffer.current.push(raw);
    if (scanBuffer.current.length > 7) scanBuffer.current.shift();

    // 3. Count how many of the last 7 match this exact code
    const matches = scanBuffer.current.filter(c => c === raw).length;
    const confidence = Math.round((matches / REQUIRED_MATCHES) * 100);
    setScanConfidence(Math.min(100, confidence));

    // 4. Only fire when we have REQUIRED_MATCHES consistent reads
    if (matches < REQUIRED_MATCHES) return;

    // 5. Lock and process
    scanned.current = true;
    scanBuffer.current = [];
    setScanConfidence(100);
    try { await qrRef.current?.pause(); } catch {}
    await lookupBarcode(raw, true);   // fromCamera=true → auto-record
  }, [lookupBarcode]);

  /* onFrame — discard non-fatal parse errors */
  const onFrame = useCallback((err: any) => {
    const m = typeof err === 'string' ? err : (err?.message || '');
    if (m.includes('No MultiFormat') || m.includes('QR code parse')) return;
  }, []);

  /* startCam — stable, tries multiple start strategies */
  const startCam = useCallback(async () => {
    if (!document.getElementById(SCANNER_DIV_ID)) return;
    setCamLoading(true);
    setCamError(null);
    scanned.current = false;
    await stopCam();

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCamError('Camera not supported on this browser.');
      return setCamLoading(false);
    }
    if (!window.isSecureContext) {
      setCamError('Camera requires a secure (HTTPS) connection.');
      return setCamLoading(false);
    }

    try {
      // Enable native BarcodeDetector for much better Code128/linear barcode reading
      qrRef.current = new Html5Qrcode(SCANNER_DIV_ID, {
        verbose: false,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      } as any);
      let started = false;

      // Wide rectangle qrbox — Code128 barcodes are wide, not square
      const scanConfig = { fps: 20, qrbox: { width: 320, height: 120 } };

      // Strategy 1: enumerate cameras → prefer back camera
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices?.length) {
          const cam = devices.find(d => /back|rear|environment/i.test(d.label || '')) || devices[0];
          try {
            await qrRef.current.start(cam.id, scanConfig, onCode, onFrame);
            started = true;
          } catch {
            await qrRef.current.start(cam.id, { fps: 15, qrbox: { width: 280, height: 100 } }, onCode, onFrame);
            started = true;
          }
        }
      } catch {}

      // Strategy 2: facingMode (works on mobile when enumeration fails)
      if (!started) {
        await qrRef.current.start(
          { facingMode: { ideal: 'environment' } },
          scanConfig,
          onCode, onFrame
        );
      }
    } catch (err: any) {
      await stopCam();
      const n = err?.name || String(err?.message || err || '');
      if (/NotAllowed|PermissionDenied/i.test(n))
        setCamError('Camera access denied. Allow camera in browser settings, then retry.');
      else if (/NotFound|DevicesNotFound/i.test(n))
        setCamError('No camera found on this device. Use the Barcode or Search tabs.');
      else if (/NotReadable/i.test(n))
        setCamError('Camera is in use by another app. Close it and retry.');
      else
        setCamError('Camera failed to start. Use the Barcode or Search tabs below.');
    }
    setCamLoading(false);
  }, [stopCam, onCode, onFrame]);

  /* Effect 1 — start camera when dialog opens */
  useEffect(() => {
    if (!showScanner) return;
    setView('camera');
    setFoundSupply(null);
    setFoundRecipe(null);
    setCamError(null);
    setManualCode('');
    setSearchQuery('');
    setSearchResults([]);
    scanned.current = false;
    consumptionForm.reset();

    scanBuffer.current = [];
    setScanConfidence(0);

    const t = setTimeout(() => {
      if (document.getElementById(SCANNER_DIV_ID)) startCam();
    }, 450); // give Dialog portal time to mount

    return () => { clearTimeout(t); stopCam(); };
  }, [showScanner]); // eslint-disable-line

  /* Effect 2 — restart camera when view switches back to camera tab */
  useEffect(() => {
    if (!showScanner || view !== 'camera') return;
    const t = setTimeout(() => {
      if (document.getElementById(SCANNER_DIV_ID)) startCam();
    }, 300);
    return () => clearTimeout(t);
  }, [view]); // eslint-disable-line

  /* ════════════════════════════════════════════════════════
     NAME SEARCH (debounced)
  ════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!searchQuery.trim() || searchQuery.length < 2) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/food-supply/search?query=${encodeURIComponent(searchQuery)}&kitchenId=${kitchenId}`);
        if (res.ok) { const d = await res.json(); setSearchResults(d.items || []); }
      } catch {}
      setIsSearching(false);
    }, 350);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchQuery, kitchenId]);

  /* ════════════════════════════════════════════════════════
     ACTIONS
  ════════════════════════════════════════════════════════ */
  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await lookupBarcode(manualCode.trim());
  };

  const resetToScanner = useCallback(async () => {
    setFoundSupply(null);
    setFoundRecipe(null);
    setLastScannedCode('');
    setManualCode('');
    setSearchQuery('');
    setSearchResults([]);
    setServingsCount(1);
    consumptionForm.reset();
    scanned.current = false;
    scanBuffer.current = [];
    setScanConfidence(0);
    setView('camera');
  }, [consumptionForm]);

  const handleDialogClose = useCallback(async (open: boolean) => {
    if (!open) {
      await stopCam();
      setShowScanner(false);
      resetToScanner();
    } else {
      setShowScanner(open);
    }
  }, [stopCam, resetToScanner]); // eslint-disable-line

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

  /* ════════════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════════════ */
  const getExpiryInfo = (date?: string | null) => {
    if (!date) return null;
    const d    = new Date(date);
    const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
    if (days < 0)  return { label: `Expired ${Math.abs(days)}d ago`, color: 'text-rose-600',   bg: 'bg-rose-50   border-rose-200'   };
    if (days <= 3) return { label: `Expires in ${days}d`,            color: 'text-amber-600',  bg: 'bg-amber-50  border-amber-200'  };
    if (days <= 7) return { label: `Expires in ${days}d`,            color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' };
    return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
  };

  const qty = consumptionForm.watch('quantity');

  const isFoundView   = view === 'found-supply' || view === 'found-recipe';
  const isRecordedView = view === 'recorded' || view === 'auto-recording';
  const isScannerView = view === 'camera' || view === 'manual' || view === 'search';

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
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

          {/* ── HEADER ── */}
          <div className="relative bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <ScanLine className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-white font-bold text-base leading-tight">
                    {view === 'found-supply'   ? 'Item Found'
                     : view === 'found-recipe' ? 'Recipe Found'
                     : view === 'auto-recording' ? 'Recording…'
                     : view === 'recorded'     ? 'Consumption Recorded!'
                     : 'Food Supply Scanner'}
                  </DialogTitle>
                  <DialogDescription className="text-emerald-100/80 text-xs mt-0.5">
                    {view === 'found-supply'     ? (foundSupply?.kitchenName ?? 'Kitchen Supply')
                     : view === 'found-recipe'   ? `${(foundRecipe?.ingredients ?? []).length} ingredients`
                     : view === 'auto-recording' ? 'Please wait…'
                     : view === 'recorded'       ? `${foundSupply?.name ?? 'Item'} · ${foundSupply?.kitchenName ?? ''}`
                     : 'Scan barcode, enter code, or search by name'}
                  </DialogDescription>
                </div>
              </div>
              {(isFoundView || isRecordedView) && view !== 'auto-recording' && (
                <button onClick={resetToScanner}
                  className="h-8 w-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <ArrowLeft className="h-4 w-4 text-white" />
                </button>
              )}
            </div>
          </div>

          {/* ── LOOKUP / RECORDING SPINNER ── */}
          {(isLookingUp || view === 'auto-recording') && (
            <div className="flex flex-col items-center justify-center py-14 gap-4">
              <div className="h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
              </div>
              <p className="font-semibold text-foreground">
                {view === 'auto-recording' ? 'Recording consumption…' : 'Looking up item…'}
              </p>
              {lastScannedCode && (
                <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-1 rounded-full">{lastScannedCode}</p>
              )}
            </div>
          )}

          {/* ── AUTO-RECORDED SUCCESS ── */}
          {!isLookingUp && view === 'recorded' && foundSupply && (
            <div className="p-6 flex flex-col items-center gap-5 text-center">
              <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-black text-foreground">{foundSupply.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  1 {foundSupply.unit} recorded from <span className="font-semibold text-foreground">{foundSupply.kitchenName}</span>
                </p>
              </div>
              <div className="w-full rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/10 px-5 py-3 flex items-center justify-between">
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Remaining Stock</p>
                  <p className="text-2xl font-black text-emerald-700 tabular-nums">{Math.max(0, foundSupply.quantity - 1)}</p>
                  <p className="text-xs text-muted-foreground">{foundSupply.unit}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-200/60 flex items-center justify-center">
                  <Package className="h-6 w-6 text-emerald-700" />
                </div>
              </div>
              <div className="flex gap-3 w-full">
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-11 font-bold gap-2"
                  onClick={resetToScanner}
                >
                  <ScanLine className="h-4 w-4" />
                  Scan Another
                </Button>
                <Button
                  variant="outline"
                  className="h-11 px-4 gap-2"
                  onClick={() => { setView('found-supply'); consumptionForm.reset({ quantity: 1 }); }}
                >
                  <Plus className="h-4 w-4" />
                  Adjust
                </Button>
              </div>
            </div>
          )}

          {/* ── FOUND: FOOD SUPPLY ── */}
          {!isLookingUp && view === 'found-supply' && foundSupply && (() => {
            const expiryInfo = getExpiryInfo(foundSupply.expirationDate);
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
                    <div className="mt-3 h-1.5 bg-emerald-200 dark:bg-emerald-800/40 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '65%' }} />
                    </div>
                  </div>
                  <div className="border-t border-emerald-200 dark:border-emerald-800/40 grid grid-cols-2 divide-x divide-emerald-200 dark:divide-emerald-800/40">
                    <div className="px-4 py-2.5 flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                      <span className="text-xs font-medium truncate">{foundSupply.kitchenName}</span>
                    </div>
                    {expiryInfo ? (
                      <div className="px-4 py-2.5 flex items-center gap-2">
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
                            Quantity to Consume
                            <span className="ml-1 text-muted-foreground font-normal">({foundSupply.unit})</span>
                          </FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <button type="button"
                                onClick={() => field.onChange(Math.max(0.1, parseFloat((field.value - (field.value >= 10 ? 1 : 0.5)).toFixed(2))))}
                                className="h-10 w-10 rounded-xl border border-border bg-muted hover:bg-muted/80 flex items-center justify-center flex-shrink-0 transition-colors">
                                <Minus className="h-4 w-4" />
                              </button>
                              <Input
                                type="number" step="0.1" min="0.01"
                                className="flex-1 text-center text-lg font-bold h-10"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                              <button type="button"
                                onClick={() => field.onChange(parseFloat((field.value + (field.value >= 10 ? 1 : 0.5)).toFixed(2)))}
                                className="h-10 w-10 rounded-xl border border-border bg-muted hover:bg-muted/80 flex items-center justify-center flex-shrink-0 transition-colors">
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </FormControl>
                          {/* Quick presets */}
                          <div className="flex gap-1.5 flex-wrap mt-1">
                            {[0.5, 1, 2, 5, 10].map(v => (
                              <button key={v} type="button" onClick={() => field.onChange(v)}
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
                            <Input placeholder="e.g. Breakfast service…" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {qty > 0 && foundSupply.pricePerUnit && (
                      <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-2.5 border border-border/50">
                        <span className="text-xs text-muted-foreground">Estimated value consumed</span>
                        <span className="text-sm font-black">QAR {(qty * foundSupply.pricePerUnit).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-11 font-bold" disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        {isProcessing ? 'Recording…' : 'Record Consumption'}
                      </Button>
                      <Button type="button" variant="outline" onClick={resetToScanner} className="h-11 px-4">
                        <RefreshCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            );
          })()}

          {/* ── FOUND: RECIPE ── */}
          {!isLookingUp && view === 'found-recipe' && foundRecipe && (
            <div className="p-5 space-y-4">
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-900/10 overflow-hidden">
                <div className="px-5 py-4 flex items-start gap-3">
                  <div className="h-11 w-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-base">{foundRecipe.name}</h3>
                    {foundRecipe.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{foundRecipe.description}</p>}
                  </div>
                </div>
                <div className="border-t border-indigo-200 dark:border-indigo-800/40 grid grid-cols-2 divide-x divide-indigo-200">
                  <div className="px-4 py-2.5">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Ingredients</p>
                    <p className="text-sm font-bold">{(foundRecipe.ingredients ?? []).length} items</p>
                  </div>
                  <div className="px-4 py-2.5">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Standard Servings</p>
                    <p className="text-sm font-bold">{foundRecipe.servings}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Number of Servings</Label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setServingsCount(Math.max(1, servingsCount - 1))}
                    className="h-11 w-11 rounded-xl border border-border bg-muted hover:bg-muted/80 flex items-center justify-center">
                    <Minus className="h-4 w-4" />
                  </button>
                  <Input type="number" min="1" className="flex-1 text-center text-lg font-bold h-11"
                    value={servingsCount} onChange={e => setServingsCount(Math.max(1, parseInt(e.target.value) || 1))} />
                  <button type="button" onClick={() => setServingsCount(servingsCount + 1)}
                    className="h-11 w-11 rounded-xl border border-border bg-muted hover:bg-muted/80 flex items-center justify-center">
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
                <Button variant="outline" onClick={resetToScanner} className="h-11 px-4"><RefreshCcw className="h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {/* ── NOT FOUND ── */}
          {!isLookingUp && view === 'not-found' && (
            <div className="p-5 flex flex-col items-center gap-4 text-center">
              <div className="h-16 w-16 rounded-2xl bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-rose-500" />
              </div>
              <div>
                <p className="font-bold text-foreground">Item Not Found</p>
                <p className="text-sm text-muted-foreground mt-1">No food supply or recipe matched this code</p>
                {lastScannedCode && (
                  <p className="text-xs font-mono bg-muted px-3 py-1 rounded-full mt-2 inline-block break-all">{lastScannedCode}</p>
                )}
              </div>
              <Button onClick={resetToScanner} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <RefreshCcw className="h-4 w-4" /> Scan Again
              </Button>
            </div>
          )}

          {/* ── SCANNER / SEARCH TABS ── */}
          {!isLookingUp && isScannerView && (
            <Tabs value={view} onValueChange={tab => {
              if (tab !== 'camera') stopCam();
              setView(tab as View);
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

              {/* ─ Camera tab ─ */}
              <TabsContent value="camera" className="mt-0 p-4">
                {camLoading && (
                  <div className="flex flex-col items-center justify-center gap-3 py-10">
                    <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
                    <p className="text-sm text-muted-foreground font-medium">Starting camera…</p>
                  </div>
                )}
                {camError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 p-4 flex items-start gap-3 mb-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{camError}</p>
                      <p className="text-xs text-muted-foreground mt-1">Use the Barcode or Search tabs instead.</p>
                      <button onClick={startCam} className="mt-2 text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1">
                        <RefreshCcw className="h-3 w-3" /> Retry camera
                      </button>
                    </div>
                  </div>
                )}

                {/* Camera feed container */}
                <div className={`relative rounded-2xl overflow-hidden bg-black shadow-xl ${camError ? 'hidden' : ''}`}
                     style={{ minHeight: 270 }}>
                  <div id={SCANNER_DIV_ID} className="w-full" />

                  {/* Overlay: darkened sides + bright center strip for Code128 */}
                  {!camLoading && !camError && (
                    <>
                      {/* Dark vignette on top/bottom */}
                      <div className="absolute inset-0 pointer-events-none"
                           style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 28%, transparent 72%, rgba(0,0,0,0.55) 100%)' }} />

                      {/* Scan target rectangle — wide for Code128 linear barcodes */}
                      <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ height: 100 }}>
                        {/* Bright border */}
                        <div className={`absolute inset-0 rounded-lg border-2 transition-all duration-300 ${
                          scanConfidence >= 100 ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.6)]'
                          : scanConfidence > 0  ? 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.4)]'
                          : 'border-white/70'
                        }`} />

                        {/* Corner accents */}
                        {['top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-lg',
                          'top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-lg',
                          'bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-lg',
                          'bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-lg',
                        ].map((cls, i) => (
                          <div key={i} className={`absolute w-6 h-6 ${cls} transition-colors duration-300 ${
                            scanConfidence >= 100 ? 'border-emerald-400'
                            : scanConfidence > 0  ? 'border-yellow-400'
                            : 'border-white'
                          }`} />
                        ))}

                        {/* Animated scan line */}
                        <div className="absolute inset-x-0 overflow-hidden" style={{ top: 0, bottom: 0 }}>
                          <div className="absolute left-0 right-0 h-0.5 bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                               style={{ animation: 'scanLine 1.8s ease-in-out infinite' }} />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Confidence bar + hint */}
                {!camError && !camLoading && (
                  <div className="mt-3 space-y-2">
                    {scanConfidence > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Scan confidence</span>
                          <span className={`text-xs font-black ${scanConfidence >= 100 ? 'text-emerald-600' : 'text-yellow-600'}`}>
                            {Math.min(100, scanConfidence)}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-200 ${scanConfidence >= 100 ? 'bg-emerald-500' : 'bg-yellow-400'}`}
                            style={{ width: `${Math.min(100, scanConfidence)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                      <Zap className="h-3 w-3 text-emerald-500" />
                      Hold barcode steady inside the frame · auto-records on detection
                    </p>
                  </div>
                )}

                {/* Inline CSS for scan line animation */}
                <style>{`
                  @keyframes scanLine {
                    0%   { top: 8%;  opacity: 0.4; }
                    50%  { top: 88%; opacity: 1;   }
                    100% { top: 8%;  opacity: 0.4; }
                  }
                `}</style>
              </TabsContent>

              {/* ─ Manual barcode tab ─ */}
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
                    <p className="text-xs text-muted-foreground">Type or paste the barcode, or use a handheld USB scanner</p>
                  </div>
                  <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 font-bold gap-2" disabled={!manualCode.trim()}>
                    <Search className="h-4 w-4" /> Look Up Item
                  </Button>
                </form>
              </TabsContent>

              {/* ─ Name search tab ─ */}
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
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {searchResults.map(item => {
                        const expiryInfo = getExpiryInfo(item.expirationDate);
                        return (
                          <button key={item.id} type="button"
                            onClick={() => { setFoundSupply(item); setView('found-supply'); }}
                            className="w-full text-left rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-emerald-300 transition-all p-3.5">
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
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Type at least 2 characters to search</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

        </DialogContent>
      </Dialog>
    </>
  );
}
