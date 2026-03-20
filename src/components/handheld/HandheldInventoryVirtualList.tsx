'use client';

import React, { type RefObject } from 'react';
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/ui/button';
import {
  ChevronRight,
  Eye,
  MapPin,
  MessageSquare,
  Package,
  RefreshCw,
  Ticket,
  UtensilsCrossed,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HandheldUnifiedInventoryItem } from './inventorySessionTypes';

export type HandheldInventoryVirtualListProps = {
  items: HandheldUnifiedInventoryItem[];
  prefersReducedMotion: boolean;
  countSwipeHintDismissed: boolean;
  setCountSwipeHintDismissed: (v: boolean | ((p: boolean) => boolean)) => void;
  countSwipeStartRef: React.MutableRefObject<{ x: number; id: string } | null>;
  countSwipeOffsetRef: React.MutableRefObject<number>;
  countItemSwipedId: string | null;
  setCountItemSwipedId: (id: string | null) => void;
  countSwipeOffset: number;
  setCountSwipeOffset: (n: number) => void;
  openAuditFoodDetails: (supply: any) => void;
  openAuditTicketDetails: (ticket: any) => void;
  openCountItemDetails: (item: import('./inventorySessionTypes').HandheldCountScanItem) => void;
  openCountItemStatus: (item: import('./inventorySessionTypes').HandheldCountScanItem) => void;
  openCountItemMove: (item: import('./inventorySessionTypes').HandheldCountScanItem) => void;
  setAuditCommentAsset: (v: { id: string; name: string } | null) => void;
  setAuditCommentText: (s: string) => void;
  setAuditCommentImagePreview: (s: string | null) => void;
  auditCommentImageInputRef: RefObject<HTMLInputElement | null>;
};

function InventoryRow({
  item,
  listIndex,
  prefersReducedMotion,
  countSwipeHintDismissed,
  setCountSwipeHintDismissed,
  countSwipeStartRef,
  countSwipeOffsetRef,
  countItemSwipedId,
  setCountItemSwipedId,
  countSwipeOffset,
  setCountSwipeOffset,
  openAuditFoodDetails,
  openAuditTicketDetails,
  openCountItemDetails,
  openCountItemStatus,
  openCountItemMove,
  setAuditCommentAsset,
  setAuditCommentText,
  setAuditCommentImagePreview,
  auditCommentImageInputRef,
}: HandheldInventoryVirtualListProps & { item: HandheldUnifiedInventoryItem; listIndex: number }) {
  if (item.type === 'pending_scan') {
    return (
      <div className="rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">Offline · pending sync</p>
        <p className="font-mono text-sm font-medium text-slate-900 dark:text-white mt-1 break-all">{item.code}</p>
        {item.error ? (
          <p className="text-xs text-red-600 dark:text-red-400 mt-2">{item.error} — go online and tap Sync or Retry</p>
        ) : (
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Resolves when you are online</p>
        )}
      </div>
    );
  }

  if (item.type === 'food') {
    const supply = item.supply;
    const kitchensList =
      supply.kitchensWithSupply && supply.kitchensWithSupply.length
        ? supply.kitchensWithSupply.map((k: { name: string }) => k.name).join(', ')
        : supply.kitchenName || '—';
    const expDate = supply.expirationDate
      ? new Date(supply.expirationDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => openAuditFoodDetails(supply)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openAuditFoodDetails(supply);
          }
        }}
        className={cn(
          'rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 shadow-sm overflow-hidden cursor-pointer touch-manipulation hover:border-amber-400 dark:hover:border-amber-600 p-4 flex gap-4',
          !prefersReducedMotion && 'active:scale-[0.99] transition-transform',
        )}
      >
        <div className="h-14 w-14 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex-shrink-0 flex items-center justify-center">
          <UtensilsCrossed className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 dark:text-white truncate">{supply.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Food · {supply.quantity} {supply.unit} · Expires {expDate}
          </p>
          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">Kitchens: {kitchensList}</p>
        </div>
      </div>
    );
  }

  if (item.type === 'ticket') {
    const ticket = item.ticket;
    const status = (ticket.status || 'open').toLowerCase().replace('_', ' ');
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => openAuditTicketDetails(ticket)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openAuditTicketDetails(ticket);
          }
        }}
        className={cn(
          'rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-900/10 shadow-sm overflow-hidden cursor-pointer touch-manipulation hover:border-sky-400 dark:hover:border-sky-600 p-4 flex gap-4',
          !prefersReducedMotion && 'active:scale-[0.99] transition-transform',
        )}
      >
        <div className="h-14 w-14 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex-shrink-0 flex items-center justify-center">
          <Ticket className="h-7 w-7 text-sky-600 dark:text-sky-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 dark:text-white truncate">{ticket.title || 'Ticket'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {ticket.displayId || ticket.id} · {status}
          </p>
        </div>
      </div>
    );
  }

  const s = item.data;
  const rowId = `${s.id}-${listIndex}`;
  const isDragging = countSwipeStartRef.current?.id === rowId;
  const isOpen = countItemSwipedId === rowId;
  const ACTION_WIDTH = 170;
  const translateX = isDragging ? countSwipeOffset : isOpen ? -ACTION_WIDTH : 0;
  const showSwipeHint = !countSwipeHintDismissed;
  const statusColor = (st: string) => {
    const v = (st || '').toUpperCase();
    if (v === 'ACTIVE') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30';
    if (v === 'MAINTENANCE') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30';
    if (v === 'DISPOSED') return 'bg-slate-400/15 text-slate-600 dark:text-slate-400 border-slate-400/30';
    return 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-400/20';
  };

  return (
    <div className="relative rounded-2xl overflow-hidden touch-manipulation shadow-sm border border-slate-200/80 dark:border-slate-600/80" style={{ minHeight: 80 }}>
      <div
        className={cn(
          'absolute right-0 top-0 bottom-0 w-[170px] flex items-center justify-end gap-1 pr-2 border-l border-slate-200/60 dark:border-slate-600/60',
          isOpen || (isDragging && countSwipeOffset < -20)
            ? 'opacity-100 bg-gradient-to-l from-violet-50/90 to-slate-50 dark:from-violet-950/50 dark:to-slate-800'
            : 'opacity-100 bg-gradient-to-l from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800',
        )}
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 rounded-lg border-slate-300 dark:border-slate-600"
          aria-label="Details"
          onClick={() => {
            openCountItemDetails(s);
            setCountItemSwipedId(null);
          }}
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 rounded-lg border-slate-300 dark:border-slate-600"
          aria-label="Change status"
          onClick={() => {
            openCountItemStatus(s);
            setCountItemSwipedId(null);
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 rounded-lg border-slate-300 dark:border-slate-600"
          aria-label="Move location"
          onClick={() => {
            openCountItemMove(s);
            setCountItemSwipedId(null);
          }}
        >
          <MapPin className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 rounded-lg border-slate-300 dark:border-slate-600"
          aria-label="Add comment"
          onClick={() => {
            setAuditCommentAsset({ id: s.id, name: s.name });
            setAuditCommentText('');
            setAuditCommentImagePreview(null);
            if (auditCommentImageInputRef.current) auditCommentImageInputRef.current.value = '';
            setCountItemSwipedId(null);
          }}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        className={cn(
          'absolute inset-0 z-10 flex items-center gap-3 px-4 bg-white dark:bg-slate-800 rounded-2xl will-change-transform',
          isDragging ? 'transition-none' : 'handheld-swipe-spring',
        )}
        style={{
          transform: `translateX(${translateX}px)`,
          ...(isDragging && Math.abs(translateX) > 10 ? { boxShadow: '4px 0 20px rgba(0,0,0,0.08)' } : {}),
        }}
        onTouchStart={(e) => {
          countSwipeStartRef.current = { x: e.touches[0].clientX, id: rowId };
          setCountSwipeOffset(0);
          setCountSwipeHintDismissed((prev) => prev || true);
        }}
        onTouchMove={(e) => {
          if (!countSwipeStartRef.current || countSwipeStartRef.current.id !== rowId) return;
          const dx = e.touches[0].clientX - countSwipeStartRef.current.x;
          const offset = Math.min(0, Math.max(-ACTION_WIDTH, dx));
          countSwipeOffsetRef.current = offset;
          setCountSwipeOffset(offset);
        }}
        onTouchEnd={() => {
          if (!countSwipeStartRef.current || countSwipeStartRef.current.id !== rowId) return;
          const finalOffset = countSwipeOffsetRef.current;
          countSwipeStartRef.current = null;
          setCountSwipeOffset(0);
          setCountItemSwipedId(finalOffset < -50 ? rowId : null);
        }}
      >
        <div className="h-14 w-14 rounded-xl bg-slate-100 dark:bg-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-slate-200/50 dark:ring-slate-600/50">
          {s.imageUrl ? (
            <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Package className="h-7 w-7 text-slate-500 dark:text-slate-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 dark:text-white truncate text-[15px] leading-tight">{s.name}</p>
          {s.barcode && s.barcode !== s.name && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono">{s.barcode}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {s.status && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border',
                  statusColor(s.status),
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                {s.status}
              </span>
            )}
            {(s.floorNumber != null || s.roomNumber != null) && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{[s.floorNumber, s.roomNumber].filter(Boolean).join(', ')}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center shrink-0 pr-1">
          {showSwipeHint ? (
            <span className="handheld-row-swipe-hint flex flex-col items-center gap-0.5">
              <ChevronRight className="h-5 w-5 text-violet-500 dark:text-violet-400" aria-hidden />
              <span className="text-[9px] font-bold text-violet-500/80 dark:text-violet-400/80 uppercase tracking-wider">Swipe</span>
            </span>
          ) : (
            <ChevronRight className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden />
          )}
        </div>
        {showSwipeHint && (
          <div className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none rounded-r-2xl handheld-swipe-shine" aria-hidden />
        )}
      </div>
    </div>
  );
}

export function useHandheldInventoryVirtualizer(count: number, scrollParentRef: RefObject<HTMLDivElement | null>) {
  return useVirtualizer({
    count,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 96,
    overscan: 8,
  });
}

export function HandheldInventoryVirtualList({
  rowVirtualizer,
  ...rowProps
}: HandheldInventoryVirtualListProps & { rowVirtualizer: Virtualizer<HTMLDivElement, Element> }) {
  const { items } = rowProps;
  return (
    <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const item = items[virtualRow.index];
        if (!item) return null;
        return (
          <div
            key={virtualRow.key}
            role="listitem"
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            className="absolute left-0 top-0 w-full pb-2.5"
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          >
            <InventoryRow item={item} listIndex={virtualRow.index} {...rowProps} />
          </div>
        );
      })}
    </div>
  );
}
