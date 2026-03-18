// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Package,
  Calendar,
  DollarSign,
  MapPin,
  History,
  UtensilsCrossed,
  Loader2,
  X,
  Tag,
  Truck,
  BarChart3,
  Barcode as BarcodeIcon,
} from 'lucide-react';
import Barcode from 'react-barcode';

interface FoodSupplyDetailsDialogProps {
  supply: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export function FoodSupplyDetailsDialog({
  supply,
  open,
  onOpenChange,
  onUpdate,
}: FoodSupplyDetailsDialogProps) {
  const [consumptionHistory, setConsumptionHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [displaySupply, setDisplaySupply] = useState<any | null>(null);

  // Fetch full supply when dialog opens so we always have barcode (avoids stale list cache)
  useEffect(() => {
    if (!open || !supply?.id) {
      setDisplaySupply(supply ?? null);
      return;
    }
    setDisplaySupply(supply);
    fetch(`/api/food-supply/${encodeURIComponent(supply.id)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setDisplaySupply(data))
      .catch(() => {});
  }, [open, supply?.id, supply]);

  useEffect(() => {
    if (!open || !supply?.id) return;
    setLoadingHistory(true);
    setConsumptionHistory([]);
    fetch(`/api/food-supply/consumption-history?foodSupplyId=${encodeURIComponent(supply.id)}`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setConsumptionHistory(Array.isArray(data) ? data : []))
      .catch(() => setConsumptionHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [open, supply?.id]);

  const s = displaySupply ?? supply;
  if (!supply) return null;

  const totalConsumed = consumptionHistory.reduce((sum, r) => sum + (r.quantity || 0), 0);
  const totalConsumedValue = consumptionHistory.reduce(
    (sum, r) => sum + (r.quantity || 0) * (r.foodSupply?.pricePerUnit ?? s?.pricePerUnit ?? 0),
    0
  );
  const expDate = s?.expirationDate ? new Date(s.expirationDate) : null;
  const daysLeft = expDate ? Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const isExpired = daysLeft !== null && daysLeft < 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-hidden flex flex-col rounded-2xl p-0 gap-0">
        <div className="flex items-start justify-between gap-2 p-6 pb-4 flex-shrink-0 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 border-b border-orange-100 dark:border-orange-900/40">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-sm">
                <UtensilsCrossed className="h-5 w-5 text-white" />
              </div>
              {s?.name ?? supply.name}
            </DialogTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {s?.category && <span className="capitalize">{s.category}</span>}
              {s?.barcode && (
                <span className="ml-2 font-mono text-xs bg-slate-200/80 dark:bg-slate-700 px-2 py-0.5 rounded">
                  {s.barcode}
                </span>
              )}
            </p>
          </DialogHeader>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overview */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Package className="h-4 w-4" /> Overview
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4 border border-emerald-100 dark:border-emerald-800/40">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Remaining</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {s?.quantity ?? supply.quantity} <span className="text-sm font-medium">{s?.unit ?? supply.unit}</span>
                </p>
              </div>
              <div className={`rounded-xl p-4 border ${
                isExpired ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/40'
              }`}>
                <p className={`text-xs font-semibold uppercase tracking-wide ${isExpired ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                  {isExpired ? 'Expired' : 'Expires'}
                </p>
                <p className={`text-lg font-bold mt-0.5 ${isExpired ? 'text-red-700 dark:text-red-300' : 'text-blue-700 dark:text-blue-300'}`}>
                  {expDate ? expDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </p>
                {daysLeft !== null && !isExpired && daysLeft <= 30 && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-1">
                    {daysLeft === 0 ? 'Today' : `${daysLeft} days left`}
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 p-4 border border-purple-100 dark:border-purple-800/40">
                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Unit price</p>
                <p className="text-lg font-bold text-purple-700 dark:text-purple-300 mt-0.5">
                  QAR {Number(s?.pricePerUnit ?? supply.pricePerUnit ?? 0).toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total value</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  QAR {((s?.quantity ?? supply.quantity ?? 0) * (s?.pricePerUnit ?? supply.pricePerUnit ?? 0)).toFixed(2)}
                </p>
              </div>
            </div>
            {s?.barcode && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <BarcodeIcon className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300">Barcode</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                    {s.barcode}
                  </span>
                </div>
                <div className="flex justify-center rounded-lg bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-700">
                  <Barcode
                    value={s.barcode}
                    width={1.2}
                    height={40}
                    format="CODE128"
                    displayValue={true}
                    margin={0}
                    fontSize={12}
                  />
                </div>
              </div>
            )}
            {s?.vendor && (
              <div className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300">Vendor</span>
                <span className="font-medium text-slate-900 dark:text-white">{s.vendor.name}</span>
              </div>
            )}
            {((s?.kitchenSupplies?.length ?? 0) > 0 || s?.kitchen?.name) && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-600 dark:text-slate-300">Kitchens: </span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {(s?.kitchenSupplies?.length ?? 0) > 0
                      ? (s?.kitchenSupplies ?? []).map((ks: any) => ks.kitchen?.name).filter(Boolean).join(', ')
                      : s?.kitchen?.name ?? '—'}
                  </span>
                </div>
              </div>
            )}
            {(s?.notes ?? supply.notes) && (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 text-sm text-slate-600 dark:text-slate-300">
                {s?.notes ?? supply.notes}
              </div>
            )}
          </section>

          {/* Consumed summary */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Consumed
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4 border border-amber-100 dark:border-amber-800/40">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Quantity consumed</p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                  {totalConsumed.toFixed(1)} <span className="text-sm font-medium">{s?.unit ?? supply.unit}</span>
                </p>
              </div>
              <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-4 border border-indigo-100 dark:border-indigo-800/40">
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Value consumed</p>
                <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
                  QAR {totalConsumedValue.toFixed(2)}
                </p>
              </div>
            </div>
          </section>

          {/* Consumption history */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <History className="h-4 w-4" /> Consumption history
            </h3>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : consumptionHistory.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/50">
                No consumption records yet
              </p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {consumptionHistory.slice(0, 100).map((r: any) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-3 px-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600 transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {r.quantity} {r.foodSupply?.unit ?? s?.unit ?? supply.unit}
                      </span>
                      <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                        r.isWaste ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : r.source === 'recipe' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      }`}>
                        {r.isWaste ? 'Waste' : r.source === 'recipe' ? 'Recipe' : 'Direct'}
                      </span>
                    </div>
                    <div className="text-right text-xs text-slate-500 shrink-0">
                      <div>{r.kitchen?.name ?? '—'}</div>
                      <div>{r.date ? new Date(r.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
