// @ts-nocheck
/**
 * World-class Borrow / Return dialog with digital signature for borrowing.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeftRight, User, Calendar, Clock, CheckCircle2, AlertTriangle,
  Package, Loader2, Search, RotateCcw, ChevronRight, PenLine,
  Shield, FileSignature, X, AlertCircle, CheckCircle, Sparkles,
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
  return { days, isOverdue: days < 0, isUrgent: days >= 0 && days <= 2 };
}

async function generateBorrowFormPng(
  signatureDataUrl: string,
  asset: Asset,
  borrower: { name: string; email: string },
  days: number,
  notes: string,
): Promise<string> {
  const W = 794, H = 720, dpr = 1;
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#2563eb'); g.addColorStop(1, '#7c3aed');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 80);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui,sans-serif';
  ctx.fillText('ASSET BORROWING AGREEMENT', 40, 30);
  ctx.font = '11px system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('AssetXAI — Official Signed Document', 40, 50);
  ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 40, 68);

  const drawSec = (t: string, y: number) => { ctx.fillStyle = '#eff6ff'; ctx.fillRect(40, y, W - 80, 26); ctx.fillStyle = '#1d4ed8'; ctx.font = 'bold 10px system-ui,sans-serif'; ctx.fillText(t, 52, y + 18); return y + 26; };
  const drawF = (l: string, v: string, x: number, y: number) => { ctx.fillStyle = '#64748b'; ctx.font = '9px system-ui,sans-serif'; ctx.fillText(l.toUpperCase(), x, y); ctx.fillStyle = '#0f172a'; ctx.font = '12px system-ui,sans-serif'; ctx.fillText((v || '—').slice(0, 50), x, y + 14); };
  const div = (y: number) => { ctx.fillStyle = '#e2e8f0'; ctx.fillRect(40, y, W - 80, 1); };

  let y = 100; y = drawSec('ASSET', y); y += 10;
  drawF('Name', asset.name, 52, y); drawF('Type', asset.type || '—', 300, y); drawF('Asset ID', asset.assetId || '—', 560, y); y += 36; div(y); y += 10;
  y = drawSec('BORROWER', y); y += 10;
  drawF('Name / Email', borrower.email || borrower.name, 52, y);
  drawF('Borrow Duration', `${days} day${days !== 1 ? 's' : ''}`, 360, y);
  drawF('Due Date', new Date(Date.now() + days * 86_400_000).toLocaleDateString(), 560, y); y += 36; div(y); y += 10;
  drawF('Borrow Date', new Date().toLocaleDateString(), 52, y);
  if (notes) drawF('Notes', notes, 300, y); y += 36; div(y); y += 10;

  y = drawSec('TERMS & CONDITIONS', y); y += 10;
  const terms = [
    '1. The borrower acknowledges receipt of the asset in satisfactory condition.',
    '2. Asset must be returned by the agreed due date.',
    '3. Any damage or loss must be reported immediately.',
    '4. Unauthorized use or transfer of this asset is prohibited.',
  ];
  ctx.fillStyle = '#374151'; ctx.font = '11px system-ui,sans-serif';
  terms.forEach((t, i) => ctx.fillText(t, 52, y + i * 20)); y += terms.length * 20 + 16; div(y); y += 10;

  y = drawSec('DIGITAL SIGNATURE', y); y += 10;
  ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
  ctx.strokeRect(52, y, 280, 110); ctx.setLineDash([]);
  await new Promise<void>(r => { const img = new Image(); img.onload = () => { ctx.drawImage(img, 52, y, 280, 110); r(); }; img.onerror = r; img.src = signatureDataUrl; });
  ctx.fillStyle = '#94a3b8'; ctx.font = '9px system-ui,sans-serif';
  ctx.fillText('Borrower Signature', 52, y + 122); ctx.fillText(borrower.name || borrower.email, 52, y + 136);
  ctx.fillText(new Date().toISOString(), 52, y + 150);
  ctx.fillStyle = 'rgba(16,185,129,0.1)'; ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1.5;
  const bx = 400; const bw = 340; const bh = 110;
  ctx.fillRect(bx, y, bw, bh); ctx.strokeRect(bx, y, bw, bh);
  ctx.fillStyle = '#065f46'; ctx.font = 'bold 12px system-ui,sans-serif';
  ctx.fillText('✓ DIGITALLY SIGNED', bx + 16, y + 28);
  ctx.fillStyle = '#047857'; ctx.font = '10px system-ui,sans-serif';
  ctx.fillText(new Date().toISOString(), bx + 16, y + 48);
  ctx.fillText('Platform: AssetXAI', bx + 16, y + 66);
  ctx.fillText(`Borrower: ${borrower.email || borrower.name}`, bx + 16, y + 84);
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, H - 36, W, 36);
  ctx.fillStyle = '#94a3b8'; ctx.font = '9px system-ui,sans-serif';
  ctx.fillText('Electronically generated by AssetXAI. Legally binding upon signature.', 40, H - 14);
  return canvas.toDataURL('image/jpeg', 0.8);
}

type Mode = 'choose' | 'borrow' | 'sign-borrow' | 'return';

export function BorrowReturnDialog({ open, onOpenChange, asset, onSuccess }: BorrowReturnDialogProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>('choose');
  const [loading, setLoading] = useState(false);
  const [borrow, setBorrow] = useState<any>(null);
  const [borrowLoading, setBorrowLoading] = useState(false);

  // Borrow form state
  const [borrowerSearch, setBorrowerSearch] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [customDays, setCustomDays] = useState<number>(7);
  const [selectedQuick, setSelectedQuick] = useState<number>(7);
  const [notes, setNotes] = useState('');
  const [returnNotes, setReturnNotes] = useState('');

  // Signature state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hasSig, setHasSig] = useState(false);

  const isBorrowed = asset?.status === 'BORROWED';

  useEffect(() => {
    if (!open || !asset?.id) { setMode('choose'); setBorrow(null); return; }
    if (isBorrowed) {
      setBorrowLoading(true);
      fetch(`/api/borrowing?assetId=${asset.id}`).then(r => r.json())
        .then(data => {
          const list = Array.isArray(data) ? data : [];
          setBorrow(list.find((b: any) => b.status === 'BORROWED' || b.status === 'OVERDUE') || null);
        })
        .catch(() => {})
        .finally(() => setBorrowLoading(false));
    }
  }, [open, asset?.id, isBorrowed]);

  useEffect(() => {
    if (!open) {
      setMode('choose'); setBorrow(null); setBorrowerSearch(''); setUserResults([]);
      setSelectedUser(null); setCustomDays(7); setSelectedQuick(7); setNotes('');
      setReturnNotes(''); setHasSig(false);
    }
  }, [open]);

  // User search
  useEffect(() => {
    if (!borrowerSearch.trim() || borrowerSearch.length < 2) { setUserResults([]); return; }
    const t = setTimeout(async () => {
      setUserSearching(true);
      try {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(borrowerSearch)}&limit=8`, { credentials: 'include' });
        if (res.ok) { const data = await res.json(); setUserResults(data.users || data || []); }
      } catch {}
      setUserSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [borrowerSearch]);

  // Init canvas when entering sign-borrow mode
  useEffect(() => {
    if (mode !== 'sign-borrow' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    setHasSig(false);
  }, [mode]);

  const getPos = (e: any) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if (e.touches) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const startDraw = (e: any) => { e.preventDefault(); isDrawing.current = true; const p = getPos(e); const ctx = canvasRef.current!.getContext('2d')!; ctx.beginPath(); ctx.moveTo(p.x, p.y); lastPos.current = p; };
  const draw = (e: any) => { e.preventDefault(); if (!isDrawing.current) return; const p = getPos(e); const ctx = canvasRef.current!.getContext('2d')!; if (lastPos.current) { const mx = (lastPos.current.x + p.x) / 2, my = (lastPos.current.y + p.y) / 2; ctx.quadraticCurveTo(lastPos.current.x, lastPos.current.y, mx, my); } ctx.lineTo(p.x, p.y); ctx.stroke(); lastPos.current = p; setHasSig(true); };
  const stopDraw = () => { isDrawing.current = false; lastPos.current = null; };
  const clearSig = () => { canvasRef.current!.getContext('2d')!.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); setHasSig(false); };

  const handleBorrow = async () => {
    if (!asset?.id) return;
    if (!selectedUser) { toast({ variant: 'destructive', title: 'Please select a borrower' }); return; }
    if (!hasSig) { toast({ variant: 'destructive', title: 'Signature required', description: 'Please draw your signature to confirm.' }); return; }
    const days = customDays || selectedQuick || 7;
    const expectedReturnAt = new Date(Date.now() + days * 86_400_000).toISOString();
    const signatureDataUrl = canvasRef.current!.toDataURL('image/png');
    const pdfDataUrl = await generateBorrowFormPng(signatureDataUrl, asset, { name: selectedUser.name || selectedUser.email, email: selectedUser.email }, days, notes);
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
          signatureDataUrl,
          pdfDataUrl,
          signedAt: new Date().toISOString(),
        }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: '✓ Asset borrowed & signed', description: `${asset.name} borrowed to ${selectedUser.email} for ${days} day${days !== 1 ? 's' : ''}. Signed agreement recorded.` });
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
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl border-0 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className={cn('p-6 pb-5 text-white',
          mode === 'return' ? 'bg-gradient-to-br from-emerald-600 to-teal-600'
            : mode === 'sign-borrow' ? 'bg-gradient-to-br from-violet-600 to-indigo-700'
            : mode === 'borrow' ? 'bg-gradient-to-br from-blue-600 to-indigo-700'
            : isBorrowed ? 'bg-gradient-to-br from-amber-500 to-orange-600'
            : 'bg-gradient-to-br from-indigo-600 to-purple-700')}>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-white/20 rounded-xl">
              {mode === 'sign-borrow' ? <PenLine className="h-5 w-5" /> : <ArrowLeftRight className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="text-white text-lg font-bold">
                {mode === 'choose' ? 'Borrow / Return'
                  : mode === 'borrow' ? 'Borrow Asset'
                  : mode === 'sign-borrow' ? 'Sign Borrowing Agreement'
                  : 'Return Asset'}
              </DialogTitle>
              <DialogDescription className="text-white/70 text-sm">{asset?.name}</DialogDescription>
            </div>
          </div>
          {/* Asset chip */}
          <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2">
            <Package className="h-4 w-4 text-white/70" />
            <span className="text-sm font-medium">{asset?.name}</span>
            {asset?.assetId && <span className="text-xs text-white/60 font-mono ml-auto">{asset.assetId}</span>}
            {isBorrowed && <Badge className="ml-auto bg-amber-400/30 text-amber-100 border-amber-300/30 text-xs">Currently Borrowed</Badge>}
          </div>

          {/* Step indicator for borrow flow */}
          {(mode === 'borrow' || mode === 'sign-borrow') && (
            <div className="flex items-center gap-2 mt-3">
              {[{ key: 'borrow', label: 'Borrow Details' }, { key: 'sign-borrow', label: 'Sign Agreement' }].map((s, i) => {
                const active = mode === s.key;
                const done = mode === 'sign-borrow' && i === 0;
                return (
                  <div key={s.key} className="flex items-center gap-1.5">
                    {i > 0 && <div className={`w-6 h-0.5 rounded-full ${done || active ? 'bg-white/60' : 'bg-white/20'}`} />}
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${active ? 'bg-white/25 text-white' : done ? 'bg-white/15 text-white/70' : 'bg-white/10 text-white/40'}`}>
                      {done ? <CheckCircle className="w-2.5 h-2.5" /> : <span>{i + 1}</span>}{s.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-5 space-y-4 bg-white dark:bg-slate-950">

          {/* ── CHOOSE MODE ── */}
          {mode === 'choose' && (
            <div className="space-y-3">
              {!isBorrowed && (
                <button onClick={() => { setMode('borrow'); setSelectedUser(null); setBorrowerSearch(''); setNotes(''); setCustomDays(7); setSelectedQuick(7); }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-100 group-hover:bg-blue-200"><User className="h-5 w-5 text-blue-600" /></div>
                    <div className="text-left">
                      <p className="font-bold text-blue-800">Borrow Asset</p>
                      <p className="text-xs text-blue-500">Assign to a user for a defined period — digital signature required</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-blue-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </button>
              )}
              {isBorrowed && (
                <button onClick={() => setMode('return')}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-100 group-hover:bg-emerald-200"><RotateCcw className="h-5 w-5 text-emerald-600" /></div>
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
                      <X className="h-4 w-4" />
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

              {/* Signature notice */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-700 text-xs text-violet-700 dark:text-violet-300">
                <FileSignature className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>A digital signature from the borrower will be required in the next step before completing the borrowing.</span>
              </div>
            </div>
          )}

          {/* ── SIGN BORROW ── */}
          {mode === 'sign-borrow' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="rounded-xl border overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2.5 text-white text-sm font-bold flex items-center gap-2">
                  <FileSignature className="w-4 h-4" />Asset Borrowing Agreement
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 text-sm bg-slate-50 dark:bg-slate-900">
                  <div><p className="text-[10px] uppercase font-semibold text-slate-400">Asset</p><p className="font-semibold text-slate-900 dark:text-white">{asset?.name}</p><p className="text-xs text-slate-500">{asset?.type}</p></div>
                  <div><p className="text-[10px] uppercase font-semibold text-slate-400">Borrower</p><p className="font-semibold text-slate-900 dark:text-white truncate">{selectedUser?.email}</p></div>
                  <div><p className="text-[10px] uppercase font-semibold text-slate-400">Duration</p><p className="font-semibold text-slate-900 dark:text-white">{customDays} day{customDays !== 1 ? 's' : ''}</p></div>
                  <div><p className="text-[10px] uppercase font-semibold text-slate-400">Due Date</p><p className="font-semibold text-slate-900 dark:text-white">{new Date(Date.now() + (customDays || 7) * 86_400_000).toLocaleDateString()}</p></div>
                </div>
              </div>

              {/* Signature canvas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5"><PenLine className="w-4 h-4 text-violet-600" /><span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Borrower's Signature</span></div>
                  <button onClick={clearSig} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"><X className="w-3 h-3" />Clear</button>
                </div>
                <div className={`relative rounded-xl border-2 overflow-hidden transition-colors ${hasSig ? 'border-violet-400' : 'border-dashed border-slate-300 dark:border-slate-600'} bg-white dark:bg-slate-900`} style={{ height: '130px' }}>
                  {!hasSig && <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-300 dark:text-slate-600"><PenLine className="w-7 h-7 mb-1" /><span className="text-xs">Borrower signs here</span></div>}
                  <canvas ref={canvasRef} style={{ width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
                </div>
                {!hasSig && <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Signature is required to complete borrowing</p>}
              </div>

              {/* Shield notice */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
                <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>The signed borrowing agreement will be stored in the asset's history and documents. A confirmation email will be sent to the borrower.</span>
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
        <div className="px-5 pb-5 flex gap-2 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-700 pt-3">
          <Button variant="outline" onClick={() => {
            if (mode === 'choose') onOpenChange(false);
            else if (mode === 'sign-borrow') setMode('borrow');
            else setMode('choose');
          }} className="flex-1">
            {mode === 'choose' ? 'Cancel' : '← Back'}
          </Button>

          {mode === 'borrow' && (
            <Button onClick={() => setMode('sign-borrow')} disabled={!selectedUser}
              className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 text-white">
              <FileSignature className="h-4 w-4 mr-2" />Continue to Sign
            </Button>
          )}

          {mode === 'sign-borrow' && (
            <Button onClick={handleBorrow} disabled={loading || !hasSig}
              className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {loading ? 'Processing…' : 'Sign & Confirm Borrow'}
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
