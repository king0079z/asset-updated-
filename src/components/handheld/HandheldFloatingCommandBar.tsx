'use client';

import React, { memo, useCallback, useState } from 'react';
import {
  Plus,
  Scan,
  RefreshCw,
  Briefcase,
  Crosshair,
  ClipboardList,
  Ticket,
  Truck,
  X,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HandheldFloatingCommandBarProps {
  onScan: () => void;
  onAddAsset: () => void;
  onGoodsReceiving: () => void;
  onAudit: () => void;
  onLocate: () => void;
  onWork: () => void;
  onSync: () => void;
  onCreateTicket?: () => void;
  canCreateTicket: boolean;
  /** When true, FAB sits higher to clear the tab dock */
  className?: string;
}

function HandheldFloatingCommandBarInner({
  onScan,
  onAddAsset,
  onGoodsReceiving,
  onAudit,
  onLocate,
  onWork,
  onSync,
  onCreateTicket,
  canCreateTicket,
  className,
}: HandheldFloatingCommandBarProps) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  const items = [
    { key: 'scan', label: 'Scan', sub: 'Barcode & lookup', icon: Scan, onClick: () => { onScan(); close(); }, color: 'from-violet-500 to-indigo-600' },
    { key: 'asset', label: 'New asset', sub: 'Register item', icon: Plus, onClick: () => { onAddAsset(); close(); }, color: 'from-emerald-500 to-teal-600' },
    { key: 'recv', label: 'Receiving', sub: 'Goods in', icon: Truck, onClick: () => { onGoodsReceiving(); close(); }, color: 'from-amber-500 to-orange-600' },
    { key: 'audit', label: 'Audit', sub: 'Inventory check', icon: ClipboardList, onClick: () => { onAudit(); close(); }, color: 'from-amber-600 to-rose-600' },
    { key: 'locate', label: 'Locate', sub: 'Find & beep', icon: Crosshair, onClick: () => { onLocate(); close(); }, color: 'from-sky-500 to-blue-600' },
    { key: 'work', label: 'Work', sub: 'Tickets & tasks', icon: Briefcase, onClick: () => { onWork(); close(); }, color: 'from-fuchsia-500 to-purple-600' },
    { key: 'sync', label: 'Sync now', sub: 'Replay queue', icon: RefreshCw, onClick: () => { onSync(); close(); }, color: 'from-slate-600 to-slate-800' },
    ...(canCreateTicket && onCreateTicket
      ? [{ key: 'ticket', label: 'Ticket', sub: 'For current asset', icon: Ticket, onClick: () => { onCreateTicket(); close(); }, color: 'from-rose-500 to-pink-600' } as const]
      : []),
  ];

  return (
    <div className={cn('fixed z-[45] flex flex-col items-end gap-3 right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))]', className)}>
      {/* Expanded actions */}
      <div
        className={cn(
          'flex flex-col gap-2 max-h-[min(70vh,420px)] overflow-y-auto pr-1 transition-all duration-300 origin-bottom',
          open ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 translate-y-4 scale-95 pointer-events-none h-0 overflow-hidden'
        )}
        role="menu"
        aria-hidden={!open}
      >
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              onClick={it.onClick}
              className={cn(
                'flex items-center gap-3 pl-3 pr-4 py-3 rounded-2xl border border-white/50 dark:border-slate-600/50',
                'bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl shadow-lg shadow-black/10 dark:shadow-black/40',
                'text-left min-w-[200px] max-w-[min(calc(100vw-5rem),280px)] active:scale-[0.98] transition-transform touch-manipulation'
              )}
            >
              <span
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white bg-gradient-to-br shadow-md',
                  it.color
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900 dark:text-white text-sm">{it.label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{it.sub}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Main FAB */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-xl',
          'bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600',
          'ring-4 ring-white/40 dark:ring-slate-900/50',
          'active:scale-95 transition-transform touch-manipulation',
          open && 'ring-violet-400/60'
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? 'Close shortcuts menu' : 'Open shortcuts menu'}
      >
        {open ? <X className="h-7 w-7" strokeWidth={2.25} /> : <Sparkles className="h-7 w-7" strokeWidth={2.25} />}
      </button>
    </div>
  );
}

export const HandheldFloatingCommandBar = memo(HandheldFloatingCommandBarInner);
