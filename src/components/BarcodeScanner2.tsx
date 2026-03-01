// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import Image from 'next/image';
import {
  Scan, Camera, QrCode, X, RotateCcw, AlertTriangle, ChevronLeft,
  CheckCircle2, MapPin, Building2, Tag, Package, Loader2, RefreshCcw,
  Trash2, ArrowRightLeft, Eye, PlusCircle, Keyboard, Zap,
  ShieldAlert, Navigation, Activity, FileText, Printer,
} from 'lucide-react';

/* ──────────────────────────────── Scan cache ── */
// Module-level memory cache — survives re-renders, cleared on page unload
const scanCache = new Map<string, { asset: any; ts: number }>();
const CACHE_TTL = 60_000; // 1 minute

/* ──────────────────────────────── Types ── */
interface Asset {
  id: string;
  name: string;
  floorNumber?: string | null;
  roomNumber?: string | null;
  status: string;
  description?: string | null;
  imageUrl?: string | null;
  type?: string | null;
  vendor?: { name: string } | null;
  barcode?: string | null;
  assetId?: string | null;
}

type View =
  | 'camera' | 'manual'
  | 'found'  | 'notFound'
  | 'p-details' | 'p-transfer' | 'p-status' | 'p-dispose';

interface Props {
  onScan?: (payload: Asset | { barcode: string }) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/* ──────────────────────────────── Schemas ── */
const transferSchema = z.object({
  floorNumber: z.string().min(1, 'Required'),
  roomNumber: z.string().min(1, 'Required'),
});

/* ──────────────────────────────── Status palette ── */
const STATUSES = [
  { value: 'ACTIVE',      label: 'Active',      color: 'emerald', dot: 'bg-emerald-400', ring: 'ring-emerald-500/40', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  { value: 'INACTIVE',    label: 'Inactive',    color: 'slate',   dot: 'bg-slate-400',   ring: 'ring-slate-500/40',   badge: 'bg-slate-500/15   text-slate-300   border-slate-500/30'   },
  { value: 'MAINTENANCE', label: 'Maintenance', color: 'amber',   dot: 'bg-amber-400',   ring: 'ring-amber-500/40',   badge: 'bg-amber-500/15   text-amber-300   border-amber-500/30'   },
  { value: 'DISPOSED',    label: 'Disposed',    color: 'red',     dot: 'bg-red-400',     ring: 'ring-red-500/40',     badge: 'bg-red-500/15     text-red-300     border-red-500/30'     },
];
const getStatus = (s: string) => STATUSES.find(x => x.value === s) || STATUSES[1];

/* ══════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════ */
export default function BarcodeScanner({ onScan, open: extOpen, onOpenChange }: Props) {
  const [intOpen, setIntOpen] = useState(false);
  const isOpen = extOpen !== undefined ? extOpen : intOpen;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setIntOpen(v));

  const [view, setView]         = useState<View>('camera');
  const [manualCode, setManual] = useState('');
  const [asset, setAsset]       = useState<Asset | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);

  const [searching, setSearching]   = useState(false);
  const [moving, setMoving]         = useState(false);
  const [disposing, setDisposing]   = useState(false);
  const [savingStatus, setSaving]   = useState(false);
  const [pickedStatus, setPickedStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');

  const [camLoading, setCamLoading]     = useState(false);
  const [camError, setCamError]         = useState<string | null>(null);
  const [printingReport, setPrinting]   = useState(false);

  const { toast } = useToast();
  const qrRef    = useRef<Html5Qrcode | null>(null);
  const scanned  = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const MOUNT_ID = 'qr-scanner-root';

  const transferForm = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: { floorNumber: '', roomNumber: '' },
  });

  /* ── Camera ────────────────────────────────────────── */
  const stopCam = useCallback(async () => {
    if (qrRef.current) {
      try { await qrRef.current.stop(); } catch {}
      qrRef.current = null;
    }
  }, []);

  const startCam = useCallback(async () => {
    if (!document.getElementById(MOUNT_ID)) return;
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
      qrRef.current = new Html5Qrcode(MOUNT_ID, { verbose: false });
      let ok = false;

      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices?.length) {
          const cam = devices.find(d => /back|rear|environment/i.test(d.label || '')) || devices[0];
          try {
            await qrRef.current.start(cam.id, { fps: 15, qrbox: { width: 240, height: 240 } }, onCode, onFrame);
          } catch {
            await qrRef.current.start(cam.id, { fps: 10, qrbox: 220 }, onCode, onFrame);
          }
          ok = true;
        }
      } catch {}

      if (!ok) {
        await qrRef.current.start({ facingMode: { ideal: 'environment' } }, { fps: 15, qrbox: { width: 240, height: 240 } }, onCode, onFrame);
      }
    } catch (err: any) {
      await stopCam();
      const n = err?.name || String(err?.message || err || '');
      if (/NotAllowed|PermissionDenied/i.test(n))  setCamError('Camera access denied. Allow camera in browser settings, then retry.');
      else if (/NotFound|DevicesNotFound/i.test(n)) setCamError('No camera found. Use manual entry below.');
      else if (/NotReadable/i.test(n))              setCamError('Camera is in use by another app. Close it and retry.');
      else                                           setCamError(`Camera failed to start. Try manual entry.`);
    }
    setCamLoading(false);
  }, [stopCam]);

  /* ── Search — single fast endpoint + cache + abort ─── */
  const findAsset = useCallback(async (code: string) => {
    const q = code.trim();
    if (!q) return;

    // 1. Check memory cache first (instant — 0 ms)
    const cached = scanCache.get(q);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setAsset(cached.asset);
      setNotFound(null);
      setView('found');
      return;
    }

    // 2. Cancel any in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setSearching(true);

    try {
      // Single purpose-built endpoint:
      //   • uses getSession() (no Supabase network call)
      //   • one OR query across all identifier fields
      //   • returns only scanner-needed fields
      const res = await fetch(`/api/assets/scan?q=${encodeURIComponent(q)}`, {
        signal: ctrl.signal,
      });

      if (ctrl.signal.aborted) return;

      if (res.ok) {
        const data = await res.json();
        if (data?.asset) {
          // Store in cache
          scanCache.set(q, { asset: data.asset, ts: Date.now() });
          setAsset(data.asset);
          setNotFound(null);
          setView('found');
          return;
        }
      }

      // Fast endpoint missed — fall back to the general assets API
      // (covers edge-cases like org mismatch for admins)
      if (!res.ok && res.status !== 404) {
        const fallback = await fetch(`/api/assets?search=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!ctrl.signal.aborted && fallback.ok) {
          const fd = await fallback.json();
          if (fd?.asset) {
            scanCache.set(q, { asset: fd.asset, ts: Date.now() });
            setAsset(fd.asset);
            setNotFound(null);
            setView('found');
            return;
          }
        }
      }

      setAsset(null);
      setNotFound(q);
      setView('notFound');
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // stale request cancelled
      setAsset(null);
      setNotFound(q);
      setView('notFound');
    } finally {
      if (!ctrl.signal.aborted) setSearching(false);
    }
  }, []);

  const onCode = useCallback(async (raw: string) => {
    if (!raw || scanned.current) return;
    scanned.current = true;
    try { await qrRef.current?.pause(); } catch {}
    await findAsset(raw);
  }, [findAsset]);

  const onFrame = useCallback((err: any) => {
    const m = typeof err === 'string' ? err : (err?.message || '');
    if (m.includes('No MultiFormat') || m.includes('QR code parse')) return;
  }, []);

  /* ── Lifecycle ─────────────────────────────────────── */
  useEffect(() => {
    if (!isOpen) return;
    setView('camera'); setAsset(null); setNotFound(null); setCamError(null); setManual('');
    scanned.current = false;
    const t = setTimeout(() => { if (document.getElementById(MOUNT_ID)) startCam(); }, 420);
    return () => { clearTimeout(t); stopCam(); };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || view !== 'camera') return;
    const t = setTimeout(() => { if (document.getElementById(MOUNT_ID)) startCam(); }, 300);
    return () => clearTimeout(t);
  }, [view]);

  /* ── Close / reset ─────────────────────────────────── */
  const close = useCallback(async () => {
    abortRef.current?.abort();
    await stopCam();
    setOpen(false);
    setView('camera'); setAsset(null); setNotFound(null); setManual(''); setCamError(null);
    scanned.current = false;
  }, [stopCam]);

  const scanAgain = useCallback(() => {
    setAsset(null); setNotFound(null);
    scanned.current = false;
    setView('camera');
  }, []);

  const back = useCallback(() => setView(asset ? 'found' : 'camera'), [asset]);

  /* ── Transfer ──────────────────────────────────────── */
  const doTransfer = async (vals: z.infer<typeof transferSchema>) => {
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
      setAsset(d.asset || { ...asset, ...vals });
      setView('found');
      transferForm.reset();
      toast({ title: 'Asset transferred', description: `Moved → Floor ${vals.floorNumber}, Room ${vals.roomNumber}` });
    } catch {
      toast({ title: 'Transfer failed', variant: 'destructive' });
    }
    setMoving(false);
  };

  /* ── Change status ─────────────────────────────────── */
  const doStatusChange = async () => {
    if (!asset || !pickedStatus) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pickedStatus, comment: statusComment }),
      });
      if (!r.ok) throw new Error();
      setAsset(prev => prev ? { ...prev, status: pickedStatus } : prev);
      setView('found');
      setStatusComment('');
      toast({ title: 'Status updated', description: `Asset is now ${pickedStatus}` });
    } catch {
      toast({ title: 'Status change failed', variant: 'destructive' });
    }
    setSaving(false);
  };

  /* ── Dispose ───────────────────────────────────────── */
  const doDispose = async () => {
    if (!asset) return;
    setDisposing(true);
    try {
      const r = await fetch(`/api/assets/${asset.id}/dispose`, { method: 'POST' });
      if (!r.ok) throw new Error();
      toast({ title: 'Asset disposed', description: `${asset.name} marked as disposed.` });
      close();
    } catch {
      toast({ title: 'Disposal failed', variant: 'destructive' });
    }
    setDisposing(false);
  };

  /* ── Print Report ─────────────────────────────────── */
  const printAssetReport = useCallback(async () => {
    if (!asset) return;
    setPrinting(true);

    try {
      // Fetch history + tickets in parallel
      const [histRes, tickRes] = await Promise.allSettled([
        fetch(`/api/assets/${asset.id}/history`),
        fetch(`/api/assets/${asset.id}/tickets`),
      ]);

      const history: any[] = histRes.status === 'fulfilled' && histRes.value.ok
        ? (await histRes.value.json()).history ?? []
        : [];
      const ticketsRaw = tickRes.status === 'fulfilled' && tickRes.value.ok
        ? await tickRes.value.json()
        : null;
      // API may return { tickets: [...] } or directly an array
      const tickets: any[] = ticketsRaw
        ? (Array.isArray(ticketsRaw) ? ticketsRaw : ticketsRaw.tickets ?? ticketsRaw.data ?? [])
        : [];

      const now = new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' });
      const statusColor: Record<string, string> = {
        ACTIVE: '#059669', INACTIVE: '#6b7280', MAINTENANCE: '#d97706', DISPOSED: '#dc2626',
      };
      const ticketBadge: Record<string, string> = {
        OPEN: '#2563eb', IN_PROGRESS: '#d97706', RESOLVED: '#059669', CLOSED: '#6b7280',
      };
      const priorityBadge: Record<string, string> = {
        LOW: '#6b7280', MEDIUM: '#2563eb', HIGH: '#d97706', CRITICAL: '#dc2626',
      };

      const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
      const fmtFull = (d: string) => d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

      // Fields that are redundant or too technical to display in the Details column
      const SKIP_DETAIL_KEYS = new Set([
        'timestamp','disposedAt','ticketCreatedAt','ticketUpdatedAt','updatedAt','createdAt',
        'latestUpdate','ticketId','vendorId','duplicated','action','ticketDisplayId',
        'ticketDescription','ticketStatus','ticketUpdatedAt','ticketCreatedAt',
      ]);
      const isUUID    = (v: string) => v.length > 20 && /^[a-z0-9]+$/i.test(v) && !/\s/.test(v);
      const isISODate = (v: string) => /^\d{4}-?\d{2}-?\d{2}T\d{2}:\d{2}/.test(v);

      // Safely format a details field that may be a string, object, or null
      const fmtDetails = (raw: any): string => {
        if (raw === null || raw === undefined) return '—';
        // If it's a JSON string, parse it first
        if (typeof raw === 'string') {
          const trimmed = raw.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try { return fmtDetails(JSON.parse(trimmed)); } catch { /* fall through */ }
          }
          return trimmed || '—';
        }
        if (typeof raw === 'object' && !Array.isArray(raw)) {
          const pairs: string[] = [];
          for (const [k, v] of Object.entries(raw)) {
            if (SKIP_DETAIL_KEYS.has(k)) continue;
            if (v === null || v === undefined || v === '') continue;
            if (typeof v === 'object') continue;             // skip nested objects
            const strVal = String(v);
            if (isUUID(strVal)) continue;                    // skip raw UUIDs
            const label = k
              .replace(/([A-Z])/g, ' $1')
              .replace(/_/g, ' ')
              .trim()
              .toLowerCase()
              .replace(/^\w/, c => c.toUpperCase());
            const displayVal = isISODate(strVal) ? fmtFull(strVal) : strVal;
            pairs.push(`<span style="color:#64748b;font-size:11px">${label}:</span> <strong style="color:#1e293b">${displayVal}</strong>`);
          }
          return pairs.length ? pairs.join('<span style="color:#cbd5e1"> &nbsp;·&nbsp; </span>') : '—';
        }
        return String(raw);
      };

      // Color map for every known action type
      const actionStyle: Record<string, [string, string]> = {
        MOVED:          ['#eff6ff', '#1d4ed8'],
        TRANSFERRED:    ['#eff6ff', '#1d4ed8'],
        STATUS_CHANGED: ['#ecfdf5', '#065f46'],
        DISPOSED:       ['#fef2f2', '#b91c1c'],
        REGISTERED:     ['#f0fdf4', '#15803d'],
        CREATED:        ['#f0fdf4', '#15803d'],
        TICKET_CREATED: ['#faf5ff', '#6d28d9'],
        UPDATED:        ['#fffbeb', '#92400e'],
        ASSIGNED:       ['#fff7ed', '#c2410c'],
        MAINTENANCE:    ['#fffbeb', '#b45309'],
      };

      const historyRows = history.slice(0, 50).map((h: any) => {
        const actionKey = (h.action || h.type || '').toUpperCase();
        const [bg, fg] = actionStyle[actionKey] ?? ['#f5f3ff', '#6d28d9'];
        const detailRaw = h.details ?? h.description ?? h.note ?? h.metadata ?? h.changes ?? null;
        return `
        <tr>
          <td style="white-space:nowrap">${fmtFull(h.createdAt || h.date || h.timestamp)}</td>
          <td><span class="pill" style="background:${bg};color:${fg}">${actionKey.replace(/_/g, ' ') || '—'}</span></td>
          <td style="font-size:11.5px;line-height:1.7;max-width:280px">${fmtDetails(detailRaw)}</td>
          <td style="font-size:11px;color:#64748b">${h.user?.email || h.performedBy || h.userId || '—'}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="4" class="empty">No history records found</td></tr>';

      const ticketCards = tickets.slice(0, 20).map((t: any) => {
        const tStatus = (t.status || '').toUpperCase();
        const tPriority = (t.priority || '').toUpperCase();
        const tBg = (ticketBadge[tStatus] || '#6b7280') + '18';
        const tFg = ticketBadge[tStatus] || '#6b7280';
        const pBg = (priorityBadge[tPriority] || '#6b7280') + '18';
        const pFg = priorityBadge[tPriority] || '#6b7280';
        return `
        <div class="ticket-card">
          <div class="ticket-header">
            <span class="ticket-id">#${t.id?.slice(-6) || t.ticketNumber || '—'}</span>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <span class="badge" style="background:${tBg};color:${tFg}">${tStatus || '—'}</span>
              <span class="badge" style="background:${pBg};color:${pFg}">${tPriority || '—'}</span>
            </div>
          </div>
          <p class="ticket-title">${t.title || t.subject || '(No title)'}</p>
          ${t.description ? `<p class="ticket-desc">${t.description}</p>` : ''}
          <div class="ticket-meta">
            <span>📅 Created ${fmt(t.createdAt)}</span>
            ${t.assignedTo?.email || t.assignee ? `<span>👤 ${t.assignedTo?.email || t.assignee}</span>` : ''}
            ${t.resolvedAt ? `<span>✅ Resolved ${fmt(t.resolvedAt)}</span>` : ''}
          </div>
        </div>`;
      }).join('') || '<p class="empty-state">No tickets found for this asset</p>';

      const html = `
        <style>
          /* system fonts — no external requests, CSP-safe */
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Inter', system-ui, sans-serif; background: #fff; color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          /* ── COVER HEADER ── */
          .cover {
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%);
            padding: 40px 48px 36px;
            display: flex; align-items: flex-start; gap: 28px;
            page-break-inside: avoid;
          }
          .cover-img {
            width: 100px; height: 100px; border-radius: 16px;
            border: 2px solid rgba(255,255,255,0.15);
            object-fit: cover; flex-shrink: 0; background: rgba(255,255,255,0.08);
            display:flex; align-items:center; justify-content:center;
          }
          .cover-img img { width:100%; height:100%; border-radius:14px; object-fit:cover; }
          .cover-img-placeholder { font-size:40px; color:rgba(255,255,255,0.3); }
          .cover-info { flex: 1; }
          .cover-label { font-size:10px; font-weight:600; letter-spacing:2px; color:rgba(255,255,255,0.45); text-transform:uppercase; margin-bottom:6px; }
          .cover-name { font-size:28px; font-weight:800; color:#fff; line-height:1.2; margin-bottom:8px; }
          .cover-type { font-size:13px; color:rgba(255,255,255,0.55); margin-bottom:12px; }
          .cover-status {
            display:inline-flex; align-items:center; gap:6px;
            padding:4px 12px; border-radius:999px;
            font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase;
          }
          .cover-status-dot { width:6px; height:6px; border-radius:50%; background:currentColor; }
          .cover-right { text-align:right; flex-shrink:0; }
          .cover-date { font-size:11px; color:rgba(255,255,255,0.4); margin-bottom:6px; }
          .cover-id { font-size:10px; font-family:monospace; color:rgba(255,255,255,0.3); }

          /* ── BODY ── */
          .body { padding: 36px 48px 48px; }

          /* ── SECTION ── */
          .section { margin-bottom: 36px; page-break-inside: avoid; }
          .section-title {
            font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
            color: #6366f1; margin-bottom: 14px;
            display:flex; align-items:center; gap:8px;
          }
          .section-title::after { content:''; flex:1; height:1px; background:#e5e7eb; }

          /* ── INFO GRID ── */
          .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
          .info-grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
          .info-cell {
            background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;
            padding:12px 14px;
          }
          .info-cell-label { font-size:10px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
          .info-cell-value { font-size:14px; font-weight:600; color:#0f172a; }

          /* ── TABLE ── */
          .data-table { width:100%; border-collapse:collapse; font-size:12.5px; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; }
          .data-table thead th {
            background:#f1f5f9; color:#475569; font-weight:700; font-size:10.5px;
            letter-spacing:0.8px; text-transform:uppercase; padding:11px 14px;
            border-bottom:2px solid #e2e8f0; text-align:left;
          }
          .data-table tbody tr { transition:background 0.1s; }
          .data-table tbody tr:nth-child(even) { background:#f8fafc; }
          .data-table tbody tr:hover { background:#f0f9ff; }
          .data-table tbody td { padding:11px 14px; border-bottom:1px solid #f1f5f9; color:#374151; vertical-align:top; }
          .data-table tbody tr:last-child td { border-bottom:none; }
          .pill {
            display:inline-block; padding:3px 9px; border-radius:999px;
            font-size:10px; font-weight:700; letter-spacing:0.5px; white-space:nowrap;
          }
          .empty { text-align:center; color:#94a3b8; font-style:italic; padding:24px; }

          /* ── TICKET CARDS ── */
          .tickets-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:14px; }
          .ticket-card { border:1px solid #e2e8f0; border-radius:12px; padding:16px; background:#fafafa; page-break-inside:avoid; }
          .ticket-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; gap:8px; }
          .ticket-id { font-size:11px; font-weight:700; color:#94a3b8; font-family:monospace; flex-shrink:0; margin-top:2px; }
          .ticket-title { font-size:13px; font-weight:700; color:#0f172a; margin-bottom:6px; line-height:1.4; }
          .ticket-desc { font-size:12px; color:#64748b; margin-bottom:10px; line-height:1.6; }
          .ticket-meta { display:flex; gap:10px; flex-wrap:wrap; font-size:11px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:10px; margin-top:10px; }
          .badge { padding:3px 9px; border-radius:999px; font-size:10px; font-weight:700; letter-spacing:0.5px; }
          .empty-state { color:#94a3b8; font-style:italic; font-size:13px; text-align:center; padding:30px 0; }

          /* ── SUMMARY STRIP ── */
          .summary-strip { display:grid; grid-template-columns:repeat(4,1fr); gap:0; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; margin-bottom:32px; }
          .summary-cell { padding:16px; text-align:center; border-right:1px solid #e2e8f0; }
          .summary-cell:last-child { border-right:none; }
          .summary-value { font-size:24px; font-weight:800; color:#0f172a; }
          .summary-label { font-size:10px; color:#94a3b8; font-weight:600; text-transform:uppercase; letter-spacing:1px; margin-top:2px; }

          /* ── FOOTER ── */
          .footer {
            border-top:2px solid #f1f5f9; padding-top:20px; margin-top:8px;
            display:flex; justify-content:space-between; align-items:center;
          }
          .footer-brand { font-size:12px; font-weight:700; color:#6366f1; }
          .footer-meta { font-size:11px; color:#94a3b8; text-align:right; }

          @media print {
            body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
            .section { page-break-inside: avoid; }
            .ticket-card { page-break-inside: avoid; }
          }
        </style>

        <!-- COVER -->
        <div class="cover">
          <div class="cover-img">
            ${asset.imageUrl
              ? `<img src="${asset.imageUrl}" alt="${asset.name}" />`
              : `<div class="cover-img-placeholder">📦</div>`}
          </div>
          <div class="cover-info">
            <div class="cover-label">Asset Report</div>
            <div class="cover-name">${asset.name}</div>
            <div class="cover-type">${asset.type || 'General Asset'}${asset.vendor?.name ? ` · ${asset.vendor.name}` : ''}</div>
            <div class="cover-status" style="background:${(statusColor[asset.status] || '#6b7280') + '25'};color:${statusColor[asset.status] || '#6b7280'}">
              <span class="cover-status-dot"></span>
              ${asset.status}
            </div>
          </div>
          <div class="cover-right">
            <div class="cover-date">${now}</div>
            <div class="cover-id">ID: ${asset.assetId || asset.id?.slice(-8) || '—'}</div>
            ${asset.barcode ? `<div class="cover-id">BC: ${asset.barcode}</div>` : ''}
          </div>
        </div>

        <div class="body">

          <!-- SUMMARY STRIP -->
          <div class="summary-strip">
            <div class="summary-cell">
              <div class="summary-value">${history.length}</div>
              <div class="summary-label">History Events</div>
            </div>
            <div class="summary-cell">
              <div class="summary-value">${tickets.length}</div>
              <div class="summary-label">Total Tickets</div>
            </div>
            <div class="summary-cell">
              <div class="summary-value">${tickets.filter((t: any) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length}</div>
              <div class="summary-label">Open Tickets</div>
            </div>
            <div class="summary-cell">
              <div class="summary-value" style="color:${statusColor[asset.status] || '#6b7280'}">${asset.status}</div>
              <div class="summary-label">Current Status</div>
            </div>
          </div>

          <!-- ASSET INFORMATION -->
          <div class="section">
            <div class="section-title">Asset Information</div>
            <div class="info-grid" style="margin-bottom:10px">
              <div class="info-cell"><div class="info-cell-label">Name</div><div class="info-cell-value">${asset.name}</div></div>
              <div class="info-cell"><div class="info-cell-label">Type</div><div class="info-cell-value">${asset.type || '—'}</div></div>
              <div class="info-cell"><div class="info-cell-label">Floor</div><div class="info-cell-value">${asset.floorNumber || '—'}</div></div>
              <div class="info-cell"><div class="info-cell-label">Room</div><div class="info-cell-value">${asset.roomNumber || '—'}</div></div>
            </div>
            <div class="info-grid-3">
              <div class="info-cell"><div class="info-cell-label">Barcode</div><div class="info-cell-value" style="font-family:monospace;font-size:12px">${asset.barcode || '—'}</div></div>
              <div class="info-cell"><div class="info-cell-label">Asset ID</div><div class="info-cell-value" style="font-family:monospace;font-size:12px">${asset.assetId || '—'}</div></div>
              <div class="info-cell"><div class="info-cell-label">Vendor</div><div class="info-cell-value">${asset.vendor?.name || '—'}</div></div>
            </div>
            ${asset.description ? `<div class="info-cell" style="margin-top:10px"><div class="info-cell-label">Description</div><div class="info-cell-value" style="font-weight:400;font-size:13px;color:#374151;line-height:1.6">${asset.description}</div></div>` : ''}
          </div>

          <!-- ASSET HISTORY -->
          <div class="section">
            <div class="section-title">Movement & Activity History (${history.length} events)</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:22%">Date & Time</th>
                  <th style="width:18%">Action</th>
                  <th>Details</th>
                  <th style="width:20%">Performed By</th>
                </tr>
              </thead>
              <tbody>${historyRows}</tbody>
            </table>
          </div>

          <!-- TICKETS -->
          <div class="section">
            <div class="section-title">Support Tickets (${tickets.length} total)</div>
            <div class="tickets-grid">${ticketCards}</div>
          </div>

          <!-- FOOTER -->
          <div class="footer">
            <div class="footer-brand">⚡ AssetAI Platform</div>
            <div class="footer-meta">
              <div>Generated on ${now}</div>
              <div>Asset ID: ${asset.id}</div>
            </div>
          </div>
        </div>`;

      // Use iframe-based print (never blocked by popup blockers)
      const { printContentWithIframe } = await import('@/util/print');
      await printContentWithIframe(html, `Asset Report — ${asset.name}`);
    } catch (err) {
      console.error('Print error:', err);
      toast({ title: 'Print failed', description: 'Could not generate report. Please try again.', variant: 'destructive' });
    }
    setPrinting(false);
  }, [asset, toast]);

  /* ── Header title ──────────────────────────────────── */
  const headerTitle: Record<View, string> = {
    camera: 'Asset Scanner', manual: 'Manual Entry',
    found: 'Asset Found',   notFound: 'Not Found',
    'p-details': 'Details', 'p-transfer': 'Transfer',
    'p-status': 'Status',   'p-dispose': 'Dispose',
  };
  const isPanel = view.startsWith('p-');

  /* ══════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════ */
  return (
    <>
      {extOpen === undefined && (
        <Button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-primary hover:bg-primary/90" size="lg">
          <Scan className="h-5 w-5" /> Scan Asset
        </Button>
      )}

      <DialogPrimitive.Root open={isOpen} onOpenChange={o => !o && close()}>
        <DialogPrimitive.Portal>
          {/* backdrop */}
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

          {/* raw content — no extra wrappers, full control */}
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-[400px] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            style={{ height: '85vh', maxHeight: '680px' }}
          >
          {/* Accessible title (visually hidden) */}
          <DialogPrimitive.Title className="sr-only">Asset Scanner</DialogPrimitive.Title>
          {/* ── Shell ── */}
          <div className="relative w-full h-full rounded-[28px] overflow-hidden bg-[#09090f]"
            style={{ boxShadow: '0 40px 120px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06)' }}>

            {/* ══ TOP BAR ══ */}
            <div className="absolute top-0 inset-x-0 z-50 flex items-center justify-between px-4 py-4">
              {isPanel || view === 'found' || view === 'notFound' ? (
                <button onClick={isPanel ? back : scanAgain}
                  className="w-9 h-9 rounded-full bg-white/8 backdrop-blur-md flex items-center justify-center text-white/70 hover:bg-white/15 active:scale-90 transition-all">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-white/80 text-[13px] font-semibold tracking-tight">Asset Scanner</span>
                </div>
              )}

              {(isPanel || view === 'found') && (
                <span className="absolute left-1/2 -translate-x-1/2 text-white/80 text-[13px] font-semibold">
                  {headerTitle[view]}
                </span>
              )}

              <button onClick={close}
                className="w-9 h-9 rounded-full bg-white/8 backdrop-blur-md flex items-center justify-center text-white/50 hover:bg-white/15 active:scale-90 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ══ CAMERA ══ */}
            {(view === 'camera' || view === 'manual') && (
              <div className="absolute inset-0">
                {/* camera mount — always present so html5-qrcode can attach */}
                <div id={MOUNT_ID}
                  className={`absolute inset-0 w-full h-full ${view !== 'camera' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                  style={{ zIndex: 1 }} />

                {/* viewfinder overlay */}
                {view === 'camera' && (
                  <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
                    {/* SVG mask: dark surround, clear center box */}
                    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
                      <defs>
                        <mask id="scan-mask">
                          <rect width="100%" height="100%" fill="white" />
                          <rect x="50%" y="40%" width="220" height="220"
                            transform="translate(-110,-110)" rx="18" fill="black" />
                        </mask>
                      </defs>
                      <rect width="100%" height="100%" fill="rgba(0,0,0,0.68)" mask="url(#scan-mask)" />
                    </svg>

                    {/* corner brackets positioned at the viewfinder */}
                    <div className="absolute inset-0 flex items-start justify-center" style={{ paddingTop: 'calc(40% - 110px)' }}>
                      <div className="relative" style={{ width: 220, height: 220 }}>
                        {[
                          'top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-[18px]',
                          'top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-[18px]',
                          'bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-[18px]',
                          'bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-[18px]',
                        ].map((cls, i) => (
                          <div key={i} className={`absolute w-9 h-9 border-primary ${cls}`} />
                        ))}

                        {/* glowing scan line */}
                        <div className="absolute inset-x-4 h-[2px] rounded-full"
                          style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)', animation: 'scan 2s ease-in-out infinite', top: 0 }} />

                        {/* corner dots */}
                        {['top-0 left-0','top-0 right-0','bottom-0 left-0','bottom-0 right-0'].map((p, i) => (
                          <div key={i} className={`absolute ${p} -translate-x-0.5 -translate-y-0.5 w-2 h-2 rounded-full bg-primary`}
                            style={{ boxShadow: '0 0 10px 3px hsl(var(--primary)/0.7)' }} />
                        ))}
                      </div>
                    </div>

                    {/* bottom fade */}
                    <div className="absolute bottom-0 inset-x-0 h-2/5 bg-gradient-to-t from-[#09090f] via-[#09090f]/60 to-transparent" />
                  </div>
                )}

                {/* cam loading / error */}
                {view === 'camera' && (camLoading || camError) && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#09090f]/90 backdrop-blur-sm">
                    {camLoading && !camError && (
                      <>
                        <div className="relative w-16 h-16 mb-5">
                          <div className="absolute inset-0 rounded-full border-[2px] border-primary/15 border-t-primary animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Camera className="h-6 w-6 text-primary/50" />
                          </div>
                        </div>
                        <p className="text-white/40 text-sm">Activating camera…</p>
                      </>
                    )}
                    {camError && (
                      <div className="text-center px-8 max-w-[280px]">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                          <Camera className="h-6 w-6 text-red-400" />
                        </div>
                        <p className="text-white font-semibold text-[15px] mb-2">Camera Unavailable</p>
                        <p className="text-white/40 text-sm leading-relaxed mb-6">{camError}</p>
                        <div className="space-y-2">
                          <Button size="sm" onClick={startCam} className="w-full h-10 rounded-xl bg-primary hover:bg-primary/90">
                            <RefreshCcw className="h-4 w-4 mr-2" /> Retry
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { stopCam(); setView('manual'); }}
                            className="w-full h-10 rounded-xl text-white/50 hover:text-white hover:bg-white/8">
                            <Keyboard className="h-4 w-4 mr-2" /> Manual Entry
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* camera bottom hint */}
                {view === 'camera' && !camLoading && !camError && (
                  <div className="absolute bottom-0 inset-x-0 z-10 pb-7 px-6 flex flex-col items-center gap-4">
                    <p className="text-white/30 text-[12px] tracking-wide">Align barcode or QR code within the frame</p>
                    <button onClick={() => { stopCam(); setView('manual'); }}
                      className="flex items-center gap-2 text-white/35 hover:text-white/70 text-sm transition-colors py-1">
                      <Keyboard className="h-3.5 w-3.5" /> Enter code manually
                    </button>
                  </div>
                )}

                {/* manual entry */}
                {view === 'manual' && (
                  <div className="absolute inset-0 z-10 flex flex-col justify-center px-6 pt-16 pb-8 bg-[#09090f]">
                    <div className="text-center mb-8">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4"
                        style={{ boxShadow: '0 0 40px hsl(var(--primary)/0.12)' }}>
                        <QrCode className="h-8 w-8 text-primary" />
                      </div>
                      <h2 className="text-white font-bold text-[17px]">Manual Entry</h2>
                      <p className="text-white/35 text-sm mt-1">Enter barcode, asset ID, or name</p>
                    </div>
                    <div className="space-y-3">
                      <Input autoFocus value={manualCode}
                        onChange={e => setManual(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && manualCode.trim() && findAsset(manualCode)}
                        placeholder="e.g. ASSET-001"
                        className="h-13 bg-white/5 border-white/10 text-white text-center text-[15px] placeholder:text-white/25 rounded-2xl focus-visible:ring-primary/40 focus-visible:border-primary/50" />
                      <Button onClick={() => findAsset(manualCode)} disabled={!manualCode.trim() || searching}
                        className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 font-semibold text-[15px]">
                        {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Scan className="h-5 w-5 mr-2" /> Find Asset</>}
                      </Button>
                      <button onClick={() => setView('camera')}
                        className="w-full flex items-center justify-center gap-2 text-white/30 hover:text-white/60 text-sm py-2 transition-colors">
                        <Camera className="h-4 w-4" /> Back to camera
                      </button>
                    </div>
                  </div>
                )}

                {/* searching overlay */}
                {searching && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#09090f]/80 backdrop-blur-sm">
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 rounded-full border-[2px] border-primary/15 border-t-primary animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Scan className="h-6 w-6 text-primary/50" />
                      </div>
                    </div>
                    <p className="text-white/60 text-[15px] font-medium">Searching…</p>
                    <p className="text-white/25 text-xs mt-1">Looking up in database</p>
                  </div>
                )}
              </div>
            )}

            {/* ══ ASSET FOUND ══ */}
            {view === 'found' && asset && (
              <div className="absolute inset-0 overflow-y-auto">
                <div className="min-h-full flex flex-col pt-16 pb-5 px-4">

                  {/* ── Hero ── */}
                  <div className="mb-4">
                    {/* success pill */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-400 text-[11px] font-bold tracking-widest">LOCATED</span>
                      </div>
                    </div>

                    {/* asset card */}
                    <div className="rounded-2xl overflow-hidden border border-white/8"
                      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)' }}>

                      <div className="flex items-center gap-3.5 p-4">
                        {/* image */}
                        <div className="w-[56px] h-[56px] rounded-xl bg-white/5 border border-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {asset.imageUrl
                            ? <Image src={asset.imageUrl} alt={asset.name} width={56} height={56} className="object-cover w-full h-full" unoptimized />
                            : <Package className="h-6 w-6 text-white/15" />}
                        </div>
                        {/* text */}
                        <div className="flex-1 min-w-0">
                          <h2 className="text-white font-bold text-[16px] leading-tight truncate">{asset.name}</h2>
                          {asset.type && <p className="text-white/35 text-xs mt-0.5">{asset.type}</p>}
                          <div className="mt-1.5">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getStatus(asset.status).badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${getStatus(asset.status).dot}`} />
                              {asset.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* location strip */}
                      <div className="grid grid-cols-3 border-t border-white/6">
                        {[
                          { icon: MapPin, label: 'Floor', val: asset.floorNumber || '—' },
                          { icon: Building2, label: 'Room', val: asset.roomNumber || '—' },
                          { icon: Tag, label: 'Code', val: asset.barcode || asset.assetId || '—', mono: true },
                        ].map(({ icon: Icon, label, val, mono }) => (
                          <div key={label} className="flex flex-col items-center py-2.5 px-2">
                            <Icon className="h-3 w-3 text-white/20 mb-0.5" />
                            <p className="text-white/20 text-[9px] uppercase tracking-wider">{label}</p>
                            <p className={`text-white/75 text-[11px] font-semibold truncate max-w-full mt-0.5 ${mono ? 'font-mono' : ''}`}>{val}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── Actions ── */}
                  <p className="text-white/20 text-[10px] uppercase tracking-[0.15em] font-bold mb-2.5 px-0.5">Quick Actions</p>

                  <div className="grid grid-cols-2 gap-2.5 mb-3">
                    <ActionCard
                      onClick={() => setView('p-details')}
                      gradient="from-sky-600/20 to-sky-500/10"
                      border="border-sky-500/20"
                      iconBg="bg-sky-500/20"
                      icon={<Eye className="h-5 w-5 text-sky-300" />}
                      label="View Details"
                      sub="Full information"
                      glow="0 8px 32px rgba(14,165,233,0.15)"
                    />
                    <ActionCard
                      onClick={() => { transferForm.reset({ floorNumber: asset.floorNumber || '', roomNumber: asset.roomNumber || '' }); setView('p-transfer'); }}
                      gradient="from-violet-600/20 to-violet-500/10"
                      border="border-violet-500/20"
                      iconBg="bg-violet-500/20"
                      icon={<ArrowRightLeft className="h-5 w-5 text-violet-300" />}
                      label="Transfer"
                      sub="Move location"
                      glow="0 8px 32px rgba(139,92,246,0.15)"
                    />
                    <ActionCard
                      onClick={() => { setPickedStatus(asset.status); setStatusComment(''); setView('p-status'); }}
                      gradient="from-amber-600/20 to-amber-500/10"
                      border="border-amber-500/20"
                      iconBg="bg-amber-500/20"
                      icon={<Activity className="h-5 w-5 text-amber-300" />}
                      label="Change Status"
                      sub="Update condition"
                      glow="0 8px 32px rgba(245,158,11,0.15)"
                    />
                    <ActionCard
                      onClick={() => setView('p-dispose')}
                      gradient="from-red-600/20 to-red-500/10"
                      border="border-red-500/20"
                      iconBg="bg-red-500/20"
                      icon={<Trash2 className="h-5 w-5 text-red-300" />}
                      label="Dispose"
                      sub="Retire asset"
                      glow="0 8px 32px rgba(239,68,68,0.15)"
                    />
                  </div>

                  {/* Print Report — full-width */}
                  <button
                    onClick={printAssetReport}
                    disabled={printingReport}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border border-white/8 bg-gradient-to-r from-slate-700/30 to-slate-600/20 hover:from-slate-700/50 hover:to-slate-600/35 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mb-1"
                    style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0">
                      {printingReport
                        ? <Loader2 className="h-5 w-5 text-white/60 animate-spin" />
                        : <Printer className="h-5 w-5 text-white/60" />}
                    </div>
                    <div className="text-left">
                      <p className="text-white/80 text-[13px] font-bold leading-tight">
                        {printingReport ? 'Generating Report…' : 'Print Asset Report'}
                      </p>
                      <p className="text-white/30 text-[11px] mt-0.5">Full history, tickets & details</p>
                    </div>
                    {!printingReport && <FileText className="h-4 w-4 text-white/20 ml-auto" />}
                  </button>

                  <button onClick={scanAgain}
                    className="w-full flex items-center justify-center gap-2 text-white/25 hover:text-white/55 text-[13px] py-2.5 transition-colors">
                    <RotateCcw className="h-3.5 w-3.5" /> Scan another asset
                  </button>
                </div>
              </div>
            )}

            {/* ══ NOT FOUND ══ */}
            {view === 'notFound' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 pt-16 pb-8">
                <div className="text-center mb-8">
                  <div className="relative w-20 h-20 mx-auto mb-5">
                    <div className="absolute inset-0 rounded-full border border-red-500/15 animate-ping" style={{ animationDuration: '2s' }} />
                    <div className="absolute inset-0 rounded-full bg-red-500/8 border border-red-500/15" />
                    <div className="absolute inset-3 rounded-full bg-red-500/12 border border-red-500/20 flex items-center justify-center">
                      <AlertTriangle className="h-8 w-8 text-red-400" />
                    </div>
                  </div>
                  <h2 className="text-white font-bold text-xl mb-2">Not Found</h2>
                  <p className="text-white/35 text-sm mb-3">No asset matched this code</p>
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10">
                    <Tag className="h-3 w-3 text-white/25" />
                    <span className="text-white/45 text-[12px] font-mono">{notFound}</span>
                  </div>
                </div>
                <div className="w-full space-y-2.5">
                  {onScan && (
                    <Button onClick={() => { onScan({ barcode: notFound! }); close(); }}
                      className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 font-semibold">
                      <PlusCircle className="h-5 w-5 mr-2" /> Register New Asset
                    </Button>
                  )}
                  <Button variant="outline" onClick={scanAgain}
                    className="w-full h-12 rounded-2xl border-white/10 bg-white/4 text-white hover:bg-white/8">
                    <RotateCcw className="h-4 w-4 mr-2" /> Scan Again
                  </Button>
                  <button onClick={() => { stopCam(); setView('manual'); }}
                    className="w-full text-white/25 hover:text-white/55 text-sm py-2 transition-colors">
                    Try manual entry
                  </button>
                </div>
              </div>
            )}

            {/* ══ PANEL: DETAILS ══ */}
            {view === 'p-details' && asset && (
              <div className="absolute inset-0 overflow-y-auto pt-16 pb-5 px-4 space-y-3">
                {asset.imageUrl && (
                  <div className="relative h-40 rounded-2xl overflow-hidden bg-white/5 border border-white/8">
                    <Image src={asset.imageUrl} alt={asset.name} fill className="object-contain p-3" unoptimized />
                  </div>
                )}

                <DetailSection title="Asset">
                  <DetailRow label="Name"   value={asset.name} />
                  <DetailRow label="Type"   value={asset.type || '—'} />
                  <DetailRow label="Status" value={asset.status}
                    valueClass={`font-semibold ${getStatus(asset.status).badge.split(' ').find(c => c.startsWith('text-')) || 'text-white/80'}`} />
                  {asset.vendor?.name && <DetailRow label="Vendor" value={asset.vendor.name} />}
                </DetailSection>

                <DetailSection title="Location">
                  <DetailRow label="Floor" value={asset.floorNumber || '—'} />
                  <DetailRow label="Room"  value={asset.roomNumber  || '—'} />
                </DetailSection>

                <DetailSection title="Identifiers">
                  <DetailRow label="Barcode"  value={asset.barcode  || '—'} mono />
                  <DetailRow label="Asset ID" value={asset.assetId  || '—'} mono />
                </DetailSection>

                {asset.description && (
                  <DetailSection title="Description">
                    <p className="px-4 py-3 text-white/60 text-sm leading-relaxed">{asset.description}</p>
                  </DetailSection>
                )}
              </div>
            )}

            {/* ══ PANEL: TRANSFER ══ */}
            {view === 'p-transfer' && asset && (
              <div className="absolute inset-0 flex flex-col pt-16 pb-5 px-4">
                <div className="flex-1 flex flex-col justify-center">
                  {/* from */}
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 mb-5">
                    <p className="text-white/25 text-[10px] uppercase tracking-widest mb-2.5 font-bold">From</p>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <Navigation className="h-4 w-4 text-white/40" />
                      </div>
                      <div>
                        <p className="text-white/80 font-semibold text-sm">Floor {asset.floorNumber || '?'} · Room {asset.roomNumber || '?'}</p>
                        <p className="text-white/30 text-xs">{asset.name}</p>
                      </div>
                    </div>
                  </div>

                  {/* divider */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex-1 h-px bg-white/6" />
                    <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                      <ArrowRightLeft className="h-3.5 w-3.5 text-violet-400" />
                    </div>
                    <div className="flex-1 h-px bg-white/6" />
                  </div>

                  {/* to */}
                  <p className="text-white/25 text-[10px] uppercase tracking-widest mb-3 font-bold">To</p>
                  <Form {...transferForm}>
                    <form onSubmit={transferForm.handleSubmit(doTransfer)} className="space-y-3">
                      {(['floorNumber', 'roomNumber'] as const).map(f => (
                        <FormField key={f} control={transferForm.control} name={f}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input {...field}
                                  placeholder={f === 'floorNumber' ? 'New Floor (e.g. 3)' : 'New Room (e.g. 201)'}
                                  className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-2xl focus-visible:ring-violet-500/30 focus-visible:border-violet-500/40 text-[15px]" />
                              </FormControl>
                              <FormMessage className="text-red-400 text-xs px-1" />
                            </FormItem>
                          )} />
                      ))}
                      <div className="flex gap-2.5 pt-2">
                        <Button type="button" variant="ghost" onClick={back}
                          className="flex-1 h-12 rounded-2xl text-white/40 hover:text-white hover:bg-white/8">
                          Cancel
                        </Button>
                        <Button type="submit" disabled={moving}
                          className="flex-1 h-12 rounded-2xl font-semibold"
                          style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 8px 24px rgba(124,58,237,0.35)' }}>
                          {moving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer</>}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              </div>
            )}

            {/* ══ PANEL: STATUS ══ */}
            {view === 'p-status' && asset && (
              <div className="absolute inset-0 flex flex-col pt-16 pb-5 px-4">
                <div className="flex-1 flex flex-col">
                  <p className="text-white/25 text-[10px] uppercase tracking-widest mb-3 font-bold">Select New Status</p>

                  <div className="space-y-2 mb-4">
                    {STATUSES.map(s => (
                      <button key={s.value} onClick={() => setPickedStatus(s.value)}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all active:scale-[0.98] ${
                          pickedStatus === s.value
                            ? `${s.badge} border-opacity-40 ring-2 ${s.ring}`
                            : 'bg-white/[0.03] border-white/8 hover:bg-white/6'
                        }`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${pickedStatus === s.value ? 'bg-white/20' : 'bg-white/5'}`}>
                          <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                        </div>
                        <span className={`font-semibold text-sm ${pickedStatus === s.value ? '' : 'text-white/70'}`}>{s.label}</span>
                        {pickedStatus === s.value && (
                          <CheckCircle2 className="h-4 w-4 ml-auto opacity-80" />
                        )}
                      </button>
                    ))}
                  </div>

                  <Textarea
                    value={statusComment}
                    onChange={e => setStatusComment(e.target.value)}
                    placeholder="Optional note (reason for status change)"
                    rows={2}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-2xl resize-none text-sm focus-visible:ring-primary/30 mb-4" />

                  <div className="flex gap-2.5 mt-auto">
                    <Button variant="ghost" onClick={back}
                      className="flex-1 h-12 rounded-2xl text-white/40 hover:text-white hover:bg-white/8">
                      Cancel
                    </Button>
                    <Button onClick={doStatusChange} disabled={savingStatus || !pickedStatus}
                      className="flex-1 h-12 rounded-2xl font-semibold bg-primary hover:bg-primary/90">
                      {savingStatus ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Activity className="h-4 w-4 mr-2" /> Save Status</>}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ══ PANEL: DISPOSE ══ */}
            {view === 'p-dispose' && asset && (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 pt-16 pb-8">
                <div className="text-center mb-8">
                  <div className="relative w-20 h-20 mx-auto mb-5">
                    <div className="absolute inset-0 rounded-full bg-red-500/8 border border-red-500/10" />
                    <div className="absolute inset-[5px] rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                      <ShieldAlert className="h-8 w-8 text-red-400" />
                    </div>
                  </div>
                  <h2 className="text-white font-bold text-[19px] mb-2">Confirm Disposal</h2>
                  <p className="text-white/40 text-sm leading-relaxed max-w-[240px] mx-auto">
                    This will permanently mark{' '}
                    <span className="text-white/70 font-semibold">"{asset.name}"</span>{' '}
                    as disposed. This cannot be undone.
                  </p>
                </div>
                <div className="w-full space-y-2.5">
                  <Button onClick={doDispose} disabled={disposing}
                    className="w-full h-12 rounded-2xl font-semibold"
                    style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 8px 24px rgba(220,38,38,0.35)' }}>
                    {disposing ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Trash2 className="h-4 w-4 mr-2" /> Dispose Asset</>}
                  </Button>
                  <Button variant="ghost" onClick={back}
                    className="w-full h-12 rounded-2xl text-white/40 hover:text-white hover:bg-white/8">
                    Cancel, Go Back
                  </Button>
                </div>
              </div>
            )}
          </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <style jsx global>{`
        @keyframes scan {
          0%   { top: 4px;   opacity: 0.3; }
          50%  { top: calc(100% - 4px); opacity: 1; }
          100% { top: 4px;   opacity: 0.3; }
        }
      `}</style>
    </>
  );
}

/* ─── Sub-components ─── */
function ActionCard({ onClick, gradient, border, iconBg, icon, label, sub, glow }: {
  onClick: () => void;
  gradient: string;
  border: string;
  iconBg: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  glow: string;
}) {
  return (
    <button onClick={onClick}
      className={`group flex flex-col gap-3 p-4 rounded-2xl border bg-gradient-to-br ${gradient} ${border} active:scale-[0.96] transition-all duration-150`}
      style={{ boxShadow: 'none' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = glow)}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
        {icon}
      </div>
      <div className="text-left">
        <p className="text-white/90 text-[13px] font-bold leading-tight">{label}</p>
        <p className="text-white/35 text-[11px] mt-0.5">{sub}</p>
      </div>
    </button>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-white/20 text-[10px] uppercase tracking-widest mb-1.5 font-bold px-0.5">{title}</p>
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden divide-y divide-white/5">
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <span className="text-white/30 text-xs flex-shrink-0">{label}</span>
      <span className={`text-sm text-right truncate ${mono ? 'font-mono' : 'font-medium'} ${valueClass || 'text-white/75'}`}>{value}</span>
    </div>
  );
}
