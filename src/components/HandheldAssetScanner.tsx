// @ts-nocheck
/**
 * World-class handheld asset scanner: full-screen-friendly, scan-first UI
 * with large touch targets for warehouse/field use. Use on assets page (Handheld mode)
 * or on dedicated route /assets/handheld for "Add to home screen" use.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Scan,
  QrCode,
  MapPin,
  ArrowRightLeft,
  UserCheck,
  RefreshCw,
  Eye,
  Trash2,
  Package,
  Loader2,
  ChevronLeft,
  Keyboard,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { BorrowReturnDialog } from '@/components/BorrowReturnDialog';
import BarcodeScanner from '@/components/BarcodeScanner2';
import { AssignAssetDialog } from '@/components/AssignAssetDialog';
import { AssetDetailsDialog } from '@/components/AssetDetailsDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const transferSchema = z.object({
  floorNumber: z.string().min(1, 'Required'),
  roomNumber: z.string().min(1, 'Required'),
});

const STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'DISPOSED', label: 'Disposed' },
];

type Asset = {
  id: string;
  name: string;
  assetId?: string | null;
  barcode?: string | null;
  status: string;
  floorNumber?: string | null;
  roomNumber?: string | null;
  type?: string | null;
  vendor?: { name: string } | null;
  imageUrl?: string | null;
  assignedToName?: string | null;
};

interface HandheldAssetScannerProps {
  /** When true, show minimal header (for standalone /assets/handheld page) */
  standalone?: boolean;
  /** Called when user selects an asset (e.g. to sync with parent state) */
  onAssetSelected?: (asset: Asset | null) => void;
}

export function HandheldAssetScanner({ standalone, onAssetSelected }: HandheldAssetScannerProps) {
  const { toast } = useToast();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showBorrow, setShowBorrow] = useState(false);
  const [moving, setMoving] = useState(false);
  const [disposing, setDisposing] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [pickedStatus, setPickedStatus] = useState('');
  const [manualCode, setManualCode] = useState('');
  const dialogOpenedAt = useRef<number>(0);

  useEffect(() => {
    if (showMove || showStatus || showAssign || showDetails) {
      dialogOpenedAt.current = Date.now();
    }
  }, [showMove, showStatus, showAssign, showDetails]);

  const preventRecentOutsideClose = useCallback((e: Event) => {
    if (Date.now() - dialogOpenedAt.current < 900) {
      e.preventDefault();
    }
  }, []);

  const openAfterTap = useCallback((open: () => void) => {
    requestAnimationFrame(() => {
      setTimeout(open, 120);
    });
  }, []);

  const transferForm = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: { floorNumber: '', roomNumber: '' },
  });

  const lookup = useCallback(async (code: string) => {
    const q = code.trim();
    if (!q) return;
    setLoading(true);
    setNotFound(null);
    try {
      const res = await fetch(`/api/assets/scan?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.asset) {
          setAsset(data.asset);
          onAssetSelected?.(data.asset);
          return;
        }
      }
      setAsset(null);
      setNotFound(q);
      onAssetSelected?.(null);
    } catch {
      setAsset(null);
      setNotFound(q);
      toast({ title: 'Lookup failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [onAssetSelected, toast]);

  const handleScanResult = useCallback((result: Asset | { barcode: string }) => {
    if ('id' in result && result.id) {
      setAsset(result as Asset);
      onAssetSelected?.(result as Asset);
      setScanDialogOpen(false);
      setNotFound(null);
    } else if ('barcode' in result && result.barcode) {
      lookup(result.barcode);
      setScanDialogOpen(false);
    }
  }, [lookup, onAssetSelected]);

  const scanAgain = useCallback(() => {
    setAsset(null);
    setNotFound(null);
    setManualCode('');
    onAssetSelected?.(null);
  }, [onAssetSelected]);

  const doMove = async (vals: z.infer<typeof transferSchema>) => {
    if (!asset) return;
    setMoving(true);
    try {
      const r = await fetch(`/api/assets/${asset.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vals),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setAsset((prev) => (prev ? { ...prev, ...d.asset, floorNumber: vals.floorNumber, roomNumber: vals.roomNumber } : prev));
      setShowMove(false);
      transferForm.reset();
      toast({ title: 'Asset moved', description: `Floor ${vals.floorNumber}, Room ${vals.roomNumber}` });
    } catch {
      toast({ title: 'Move failed', variant: 'destructive' });
    }
    setMoving(false);
  };

  const doStatus = async () => {
    if (!asset || !pickedStatus) return;
    setSavingStatus(true);
    try {
      const r = await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pickedStatus }),
      });
      if (!r.ok) throw new Error();
      setAsset((prev) => (prev ? { ...prev, status: pickedStatus } : prev));
      setShowStatus(false);
      setPickedStatus('');
      toast({ title: 'Status updated', description: pickedStatus });
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
    setSavingStatus(false);
  };

  const doDispose = async () => {
    if (!asset) return;
    setDisposing(true);
    try {
      const r = await fetch(`/api/assets/${asset.id}/dispose`, { method: 'POST' });
      if (!r.ok) throw new Error();
      toast({ title: 'Asset disposed', description: asset.name });
      scanAgain();
    } catch {
      toast({ title: 'Disposal failed', variant: 'destructive' });
    }
    setDisposing(false);
  };

  const handleAssignClose = (updated?: boolean) => {
    setShowAssign(false);
    if (updated && asset) {
      // Refresh asset to get new assignee
      lookup(asset.barcode || asset.assetId || asset.id);
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 bg-white dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Scan className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Handheld Scanner</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Scan or enter barcode to manage assets</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {!asset ? (
          <>
            {/* Scan / manual entry */}
            <div className="grid gap-4">
              <Button
                size="lg"
                className="h-14 text-base font-semibold gap-3 bg-primary hover:bg-primary/90"
                onClick={() => setScanDialogOpen(true)}
              >
                <QrCode className="h-6 w-6" />
                Scan with camera
              </Button>
              <div className="relative">
                <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  placeholder="Enter barcode or Asset ID"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && lookup(manualCode)}
                  className="pl-10 h-12 text-base"
                />
                <Button
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-9"
                  onClick={() => lookup(manualCode)}
                  disabled={loading || !manualCode.trim()}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Look up'}
                </Button>
              </div>
            </div>

            {notFound && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Not found</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 truncate">Code: {notFound}</p>
                </div>
                <Button variant="outline" size="sm" onClick={scanAgain}>Try again</Button>
              </div>
            )}
          </>
        ) : (
          /* Asset result card — large touch targets */
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="h-14 w-14 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {asset.imageUrl ? (
                  <img src={asset.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-7 w-7 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white truncate">{asset.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{asset.assetId || asset.barcode || asset.id}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 text-xs font-medium">
                    <CheckCircle2 className="h-3 w-3" /> {asset.status}
                  </span>
                  {(asset.floorNumber || asset.roomNumber) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs">
                      <MapPin className="h-3 w-3" /> {[asset.floorNumber, asset.roomNumber].filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button type="button" size="lg" variant="outline" className="h-14 flex flex-col gap-0.5" onClick={() => openAfterTap(() => setShowDetails(true))}>
                <Eye className="h-5 w-5" />
                <span className="text-xs">View details</span>
              </Button>
              <Button type="button" size="lg" variant="outline" className="h-14 flex flex-col gap-0.5" onClick={() => openAfterTap(() => setShowMove(true))}>
                <ArrowRightLeft className="h-5 w-5" />
                <span className="text-xs">Move</span>
              </Button>
              <Button type="button" size="lg" variant="outline" className="h-14 flex flex-col gap-0.5" onClick={() => openAfterTap(() => setShowAssign(true))}>
                <UserCheck className="h-5 w-5" />
                <span className="text-xs">Assign</span>
              </Button>
              <Button type="button" size="lg" variant="outline" className="h-14 flex flex-col gap-0.5" onClick={() => openAfterTap(() => setShowStatus(true))}>
                <RefreshCw className="h-5 w-5" />
                <span className="text-xs">Status</span>
              </Button>
              {/* Borrow / Return */}
              <Button type="button" size="lg"
                variant={asset?.status === 'BORROWED' ? 'default' : 'outline'}
                className={`h-14 flex flex-col gap-0.5 col-span-2 ${asset?.status === 'BORROWED' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}
                onClick={() => openAfterTap(() => setShowBorrow(true))}>
                <Clock className="h-5 w-5" />
                <span className="text-xs font-semibold">{asset?.status === 'BORROWED' ? '↩ Return Asset' : '↗ Borrow Asset'}</span>
              </Button>
            </div>
            <Button
              size="lg"
              variant="destructive"
              className="w-full h-12 gap-2"
              onClick={doDispose}
              disabled={disposing}
            >
              {disposing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Dispose asset
            </Button>
            <Button size="lg" variant="secondary" className="w-full h-12 gap-2" onClick={scanAgain}>
              <Scan className="h-4 w-4" />
              Scan next
            </Button>
          </div>
        )}
      </div>

      {/* Camera scan dialog */}
      <BarcodeScanner
        open={scanDialogOpen}
        onOpenChange={setScanDialogOpen}
        onScan={handleScanResult}
      />

      {/* Borrow / Return dialog */}
      <BorrowReturnDialog
        open={showBorrow}
        onOpenChange={setShowBorrow}
        asset={asset}
        onSuccess={() => { if (asset) lookup(asset.barcode || asset.assetId || asset.id); }}
      />

      {/* View details */}
      {asset && (
        <AssetDetailsDialog
          asset={asset}
          open={showDetails}
          onOpenChange={setShowDetails}
          onAssetUpdated={(a) => { if (a) setAsset((prev) => (prev ? { ...prev, ...a } : prev)); }}
        />
      )}

      {/* Move dialog */}
      <Dialog open={showMove} onOpenChange={setShowMove}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={preventRecentOutsideClose} onInteractOutside={preventRecentOutsideClose}>
          <DialogHeader>
            <DialogTitle>Move asset</DialogTitle>
          </DialogHeader>
          <Form {...transferForm}>
            <form onSubmit={transferForm.handleSubmit(doMove)} className="space-y-4">
              <FormField
                control={transferForm.control}
                name="floorNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Floor</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 2" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={transferForm.control}
                name="roomNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 205" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowMove(false)}>Cancel</Button>
                <Button type="submit" disabled={moving}>{moving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Move'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Status dialog */}
      <Dialog open={showStatus} onOpenChange={setShowStatus}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={preventRecentOutsideClose} onInteractOutside={preventRecentOutsideClose}>
          <DialogHeader>
            <DialogTitle>Update status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <Button
                  key={s.value}
                  type="button"
                  variant={pickedStatus === s.value ? 'default' : 'outline'}
                  onClick={() => setPickedStatus(s.value)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowStatus(false)}>Cancel</Button>
              <Button onClick={doStatus} disabled={!pickedStatus || savingStatus}>
                {savingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      {asset && (
        <AssignAssetDialog
          asset={{ id: asset.id, name: asset.name, assignedToName: asset.assignedToName, assignedToEmail: asset.assignedToEmail ?? undefined }}
          open={showAssign}
          onOpenChange={setShowAssign}
          onAssigned={() => handleAssignClose(true)}
        />
      )}
    </div>
  );
}

export default HandheldAssetScanner;
