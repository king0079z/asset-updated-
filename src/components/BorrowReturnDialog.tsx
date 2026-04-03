// @ts-nocheck
/**
 * World-class Borrow / Return dialog.
 * Handles both borrowing an asset and returning it in a single component.
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeftRight, User, Calendar, Clock, CheckCircle2, AlertTriangle,
  Package, Loader2, Search, RotateCcw, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Asset {
  id: string;
  name: string;
  assetId?: string;
  status?: string;
  type?: string;
}

interface BorrowReturnDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset: Asset | null;
  onSuccess?: () => void;
}

const QUICK_DURATIONS = [
  { label: '1 Day', days: 1 },
  { label: '3 Days', days: 3 },
  { label: '1 Week', days: 7 },
  { label: '2 Weeks', days: 14 },
  { label: '1 Month', days: 30 },
];

function getRemainingInfo(expectedReturnAt: string | null) {
  if (!expectedReturnAt) return null;
  const diff = new Date(expectedReturnAt).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  const isOverdue = days < 0;
  const isUrgent = days >= 0 && days <= 2;
  return { days, isOverdue, isUrgent };
}

export function BorrowReturnDialog({ open, onOpenChange, asset, onSuccess }: BorrowReturnDialogProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'choose' | 'borrow' | 'return'>('choose');
  const [loading, setLoading] = useState(false);
  const [borrow, setBorrow] = useState<any>(null);
  const [borrowLoading, setBorrowLoading] = useState(false);

  // Borrow form state
  const [borrowerEmail, setBorrowerEmail] = useState('');
  const [borrowerSearch, setBorrowerSearch] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [customDays, setCustomDays] = useState<number>(7);
  const [selectedQuick, setSelectedQuick] = useState<number>(7);
  const [notes, setNotes] = useState('');
  const [returnNotes, setReturnNotes] = useState('');

  const isBorrowed = asset?.status === 'BORROWED';

  // Fetch current borrow record when asset is borrowed
  useEffect(() => {
    if (!open || !asset?.id) { setMode('choose'); setBorrow(null); return; }
    if (isBorrowed) {
      setBorrowLoading(true);
      fetch(`/api/borrowing?assetId=${asset.id}`).then(r => r.json())
        .then(data => {
          const list = Array.isArray(data) ? data : [];
          const active = list.find((b: any) => b.status === 'BORROWED' || b.status === 'OVERDUE');
          setBorrow(active || null);
        })
        .catch(() => {})
        .finally(() => setBorrowLoading(false));
    }
  }, [open, asset?.id, isBorrowed]);

  // User search
  useEffect(() => {
    if (!borrowerSearch.trim() || borrowerSearch.length < 2) { setUserResults([]); return; }
    const t = setTimeout(async () => {
      setUserSearching(true);
      try {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(borrowerSearch)}&limit=8`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setUserResults(data.users || data || []);
        }
      } catch {}
      setUserSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [borrowerSearch]);

  const handleBorrow = async () => {
    if (!asset?.id) return;
    if (!selectedUser) { toast({ variant: 'destructive', title: 'Please select a borrower' }); return; }
    const days = customDays || selectedQuick || 7;
    const expectedReturnAt = new Date(Date.now() + days * 86_400_000).toISOString();
    setLoading(true);
    try {
      const res = await fetch('/api/borrowing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          borrowedById: selectedUser.id,
          expectedReturnAt,
          notes,
          borrowLocation: 'Field',
          custodianName: selectedUser.email,
        }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: '✓ Asset borrowed', description: `${asset.name} borrowed to ${selectedUser.email} for ${days} day${days !== 1 ? 's' : ''}` });
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to borrow', description: e.message });
    } finally { setLoading(false); }
  };

  const handleReturn = async () => {
    if (!borrow?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/borrowing/${borrow.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: returnNotes }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: '✓ Asset returned', description: `${asset?.name} has been successfully returned` });
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to return', description: e.message });
    } finally { setLoading(false); }
  };

  const remaining = borrow ? getRemainingInfo(borrow.expectedReturnAt) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl border-0">
        {/* Header */}
        <div className={cn('p-6 pb-5 text-white',
          mode === 'return' ? 'bg-gradient-to-br from-emerald-600 to-teal-600'
            : mode === 'borrow' ? 'bg-gradient-to-br from-blue-600 to-indigo-700'
            : isBorrowed ? 'bg-gradient-to-br from-amber-500 to-orange-600'
            : 'bg-gradient-to-br from-indigo-600 to-purple-700')}>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg font-bold">
                {mode === 'choose' ? 'Borrow / Return' : mode === 'borrow' ? 'Borrow Asset' : 'Return Asset'}
              </DialogTitle>
              <DialogDescription className="text-white/70 text-sm">{asset?.name}</DialogDescription>
            </div>
          </div>
          {/* Asset chip */}
          <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2">
            <Package className="h-4 w-4 text-white/70" />
            <span className="text-sm font-medium">{asset?.name}</span>
            {asset?.assetId && <span className="text-xs text-white/60 font-mono ml-auto">{asset.assetId}</span>}
            {isBorrowed && (
              <Badge className="ml-auto bg-amber-400/30 text-amber-100 border-amber-300/30 text-xs">
                Currently Borrowed
              </Badge>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* ── CHOOSE MODE ── */}
          {mode === 'choose' && (
            <div className="space-y-3">
              {!isBorrowed && (
                <button onClick={() => { setMode('borrow'); setSelectedUser(null); setBorrowerSearch(''); setNotes(''); setCustomDays(7); setSelectedQuick(7); }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-100 group-hover:bg-blue-200">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-blue-800">Borrow Asset</p>
                      <p className="text-xs text-blue-500">Assign to a user for a defined period</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-blue-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </button>
              )}
              {isBorrowed && (
                <button onClick={() => setMode('return')}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-100 group-hover:bg-emerald-200">
                      <RotateCcw className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-emerald-800">Return Asset</p>
                      {remaining && (
                        <p className={cn('text-xs font-semibold', remaining.isOverdue ? 'text-red-600' : remaining.isUrgent ? 'text-amber-600' : 'text-emerald-500')}>
                          {remaining.isOverdue ? `${Math.abs(remaining.days)} day(s) overdue` : `${remaining.days} day(s) remaining`}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-emerald-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                </button>
              )}
              {isBorrowed && borrow && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Current borrow details</p>
                  <div className="text-xs text-amber-600 space-y-0.5">
                    <p>Borrower: <strong>{borrow.borrowedBy?.email || borrow.custodianName || '—'}</strong></p>
                    <p>Due: <strong>{borrow.expectedReturnAt ? new Date(borrow.expectedReturnAt).toLocaleDateString() : '—'}</strong></p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── BORROW FORM ── */}
          {mode === 'borrow' && (
            <div className="space-y-4">
              {/* Duration */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Borrowing Duration</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {QUICK_DURATIONS.map(({ label, days }) => (
                    <button key={days} onClick={() => { setSelectedQuick(days); setCustomDays(days); }}
                      className={cn('px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all',
                        selectedQuick === days ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-200 text-slate-600 hover:border-blue-300')}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input type="number" min="1" max="365" value={customDays}
                    onChange={e => { setCustomDays(Number(e.target.value)); setSelectedQuick(0); }}
                    className="w-24 h-9 text-sm" placeholder="Days" />
                  <span className="text-sm text-slate-500">days</span>
                  <span className="text-xs text-slate-400 ml-1">→ Due: {new Date(Date.now() + (customDays || 7) * 86_400_000).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Borrower search */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Borrower</label>
                {selectedUser ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border-2 border-blue-200">
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                      {selectedUser.email[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-blue-800 truncate">{selectedUser.email}</p>
                      {selectedUser.role && <p className="text-xs text-blue-500">{selectedUser.role}</p>}
                    </div>
                    <button onClick={() => setSelectedUser(null)} className="text-blue-400 hover:text-blue-600">
                      <AlertTriangle className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input value={borrowerSearch} onChange={e => setBorrowerSearch(e.target.value)}
                      placeholder="Search by email or name…" className="pl-9 h-10" />
                    {userSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}
                    {userResults.length > 0 && !selectedUser && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                        {userResults.map(u => (
                          <button key={u.id} onClick={() => { setSelectedUser(u); setBorrowerSearch(''); setUserResults([]); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 text-left transition-colors">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {u.email[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{u.email}</p>
                              {u.role && <p className="text-xs text-slate-400">{u.role}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Notes (optional)</label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Purpose, location, instructions…" className="h-10 text-sm" />
              </div>
            </div>
          )}

          {/* ── RETURN FORM ── */}
          {mode === 'return' && (
            <div className="space-y-4">
              {borrow && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  {[
                    ['Borrower', borrow.borrowedBy?.email || borrow.custodianName || '—'],
                    ['Borrowed On', borrow.borrowedAt ? new Date(borrow.borrowedAt).toLocaleDateString() : '—'],
                    ['Due Date', borrow.expectedReturnAt ? new Date(borrow.expectedReturnAt).toLocaleDateString() : '—'],
                    ['Status', borrow.status],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">{k}</span>
                      <span className="font-semibold text-slate-800">{String(v)}</span>
                    </div>
                  ))}
                  {remaining && (
                    <div className={cn('mt-2 p-2.5 rounded-xl text-sm font-semibold text-center',
                      remaining.isOverdue ? 'bg-red-100 text-red-700' : remaining.isUrgent ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
                      {remaining.isOverdue ? `⚠ ${Math.abs(remaining.days)} day(s) overdue` : `✓ ${remaining.days} day(s) remaining`}
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Return Notes (optional)</label>
                <Input value={returnNotes} onChange={e => setReturnNotes(e.target.value)} placeholder="Condition on return, notes…" className="h-10 text-sm" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <Button variant="outline" onClick={() => mode === 'choose' ? onOpenChange(false) : setMode('choose')} className="flex-1">
            {mode === 'choose' ? 'Cancel' : '← Back'}
          </Button>
          {mode === 'borrow' && (
            <Button onClick={handleBorrow} disabled={loading || !selectedUser}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowLeftRight className="h-4 w-4 mr-2" />}
              {loading ? 'Processing…' : 'Confirm Borrow'}
            </Button>
          )}
          {mode === 'return' && (
            <Button onClick={handleReturn} disabled={loading}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {loading ? 'Processing…' : 'Confirm Return'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
