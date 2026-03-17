// @ts-nocheck
/**
 * Handheld hub: single entry point for HANDHELD-role users.
 * Full-screen, no dashboard shell. Tabs: Scan | Asset | Tickets | Tasks | Audit | More.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { HandheldLayout } from '@/components/HandheldLayout';
import { HandheldAssetScanner } from '@/components/HandheldAssetScanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Scan,
  Package,
  Ticket,
  ListTodo,
  ClipboardList,
  MoreHorizontal,
  MapPin,
  ArrowRightLeft,
  UserCheck,
  RefreshCw,
  Eye,
  Trash2,
  Loader2,
  Plus,
  CheckCircle2,
  Wifi,
  WifiOff,
  ChevronRight,
  X,
  MessageSquare,
  UtensilsCrossed,
  ScanLine,
  User,
  Radio,
} from 'lucide-react';
import dynamic from 'next/dynamic';
const TicketBarcodeScanner = dynamic(() => import('@/components/TicketBarcodeScanner').then(m => ({ default: m.default })), { ssr: false });
const EnhancedBarcodeScanner = dynamic(() => import('@/components/EnhancedBarcodeScanner'), { ssr: false });
import { AssignAssetDialog } from '@/components/AssignAssetDialog';
import { AssetDetailsDialog } from '@/components/AssetDetailsDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { cn } from '@/lib/utils';

const transferSchema = z.object({
  floorNumber: z.string().min(1, 'Required'),
  roomNumber: z.string().min(1, 'Required'),
});

const createTicketSchema = z.object({
  title: z.string().min(1, 'Title required'),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
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
  assignedToEmail?: string | null;
};

type TabId = 'scan' | 'asset' | 'tickets' | 'tasks' | 'audit' | 'food' | 'more';

const TABS: { id: TabId; label: string; icon: React.ReactNode; shortLabel?: string }[] = [
  { id: 'scan', label: 'Scan', shortLabel: 'Scan', icon: <Scan className="h-[22px] w-[22px] shrink-0" /> },
  { id: 'asset', label: 'Asset', shortLabel: 'Asset', icon: <Package className="h-[22px] w-[22px] shrink-0" /> },
  { id: 'tickets', label: 'Tickets', shortLabel: 'Tickets', icon: <Ticket className="h-[22px] w-[22px] shrink-0" /> },
  { id: 'tasks', label: 'Tasks', shortLabel: 'Tasks', icon: <ListTodo className="h-[22px] w-[22px] shrink-0" /> },
  { id: 'audit', label: 'Audit', shortLabel: 'Audit', icon: <ClipboardList className="h-[22px] w-[22px] shrink-0" /> },
  { id: 'food', label: 'Food supply', shortLabel: 'Food', icon: <UtensilsCrossed className="h-[22px] w-[22px] shrink-0" aria-hidden="false" /> },
  { id: 'more', label: 'More', shortLabel: 'More', icon: <MoreHorizontal className="h-[22px] w-[22px] shrink-0" /> },
];

export default function HandheldHubPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<TabId>('scan');
  const [currentAsset, setCurrentAsset] = useState<Asset | null>(null);

  // Asset actions state
  const [showDetails, setShowDetails] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [moving, setMoving] = useState(false);
  const [disposing, setDisposing] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [pickedStatus, setPickedStatus] = useState('');
  const transferForm = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: { floorNumber: '', roomNumber: '' },
  });

  // Tickets state
  const [assignedTickets, setAssignedTickets] = useState<any[]>([]);
  const [assetTickets, setAssetTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [createTicketLoading, setCreateTicketLoading] = useState(false);
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<any | null>(null);
  const [ticketDetailLoading, setTicketDetailLoading] = useState(false);
  const [ticketHistory, setTicketHistory] = useState<any[]>([]);
  const [ticketHistoryLoading, setTicketHistoryLoading] = useState(false);
  const [ticketComment, setTicketComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [updatingTicketStatusId, setUpdatingTicketStatusId] = useState<string | null>(null);
  const createTicketForm = useForm<z.infer<typeof createTicketSchema>>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { title: '', description: '', priority: 'medium' },
  });

  // Tasks state
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Audit state — store full asset for world-class cards (image, location, assignee, RFID)
  const [auditScans, setAuditScans] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Food supply state
  const [kitchens, setKitchens] = useState<{ id: string; name: string }[]>([]);
  const [foodKitchenId, setFoodKitchenId] = useState<string>('');
  const [showFoodScanner, setShowFoodScanner] = useState(false);
  const [foodScannerKey, setFoodScannerKey] = useState(0);

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const handheldDialogOpenedAt = useRef(0);
  const preventHandheldDialogOutsideClose = useCallback((e: Event) => {
    if (Date.now() - handheldDialogOpenedAt.current < 900) e.preventDefault();
  }, []);
  const openHandheldDialogAfterTap = useCallback((open: () => void) => {
    requestAnimationFrame(() => setTimeout(open, 120));
  }, []);
  useEffect(() => {
    if (showMove || showDetails || showAssign || showStatus) handheldDialogOpenedAt.current = Date.now();
  }, [showMove, showDetails, showAssign, showStatus]);

  // Fetch assigned tickets
  const fetchAssignedTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const r = await fetch('/api/tickets/assigned', { credentials: 'include', cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        setAssignedTickets(Array.isArray(data) ? data : []);
      } else {
        setAssignedTickets([]);
      }
    } catch {
      toast({ title: 'Failed to load tickets', variant: 'destructive' });
      setAssignedTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  }, [toast]);

  // Fetch tickets for current asset
  const fetchAssetTickets = useCallback(async () => {
    if (!currentAsset?.id) {
      setAssetTickets([]);
      return;
    }
    try {
      const r = await fetch(`/api/assets/${currentAsset.id}/tickets`, { credentials: 'include', cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        setAssetTickets(Array.isArray(data) ? data : []);
      }
    } catch {
      setAssetTickets([]);
    }
  }, [currentAsset?.id]);

  useEffect(() => {
    if (tab === 'tickets') {
      fetchAssignedTickets();
      if (currentAsset?.id) fetchAssetTickets();
    }
  }, [tab, currentAsset?.id, fetchAssignedTickets, fetchAssetTickets]);

  useEffect(() => {
    if (tab === 'food' && kitchens.length === 0) {
      fetch('/api/kitchens', { credentials: 'include', cache: 'no-store' })
        .then((r) => r.ok ? r.json() : [])
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          setKitchens(list);
          if (list.length > 0 && !foodKitchenId) setFoodKitchenId(list[0].id);
        })
        .catch(() => setKitchens([]));
    }
  }, [tab, kitchens.length, foodKitchenId]);

  // Auto-refresh assigned tickets every 15s when on Tickets tab so new assignments appear quickly
  useEffect(() => {
    if (tab !== 'tickets') return;
    const t = setInterval(() => fetchAssignedTickets(), 15_000);
    return () => clearInterval(t);
  }, [tab, fetchAssignedTickets]);

  const fetchTicketDetail = useCallback(async (ticketId: string) => {
    setTicketDetailLoading(true);
    setSelectedTicketDetail(null);
    setTicketHistory([]);
    try {
      const r = await fetch(`/api/tickets/${ticketId}`, { credentials: 'include', cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        setSelectedTicketDetail(data);
      } else {
        toast({ title: 'Could not load ticket', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to load ticket', variant: 'destructive' });
    } finally {
      setTicketDetailLoading(false);
    }
  }, [toast]);

  const fetchTicketHistory = useCallback(async (ticketId: string) => {
    setTicketHistoryLoading(true);
    try {
      const r = await fetch(`/api/tickets/${ticketId}/history`, { credentials: 'include', cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        setTicketHistory(Array.isArray(data) ? data : []);
      } else {
        setTicketHistory([]);
      }
    } catch {
      setTicketHistory([]);
    } finally {
      setTicketHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTicketDetail?.id) fetchTicketHistory(selectedTicketDetail.id);
  }, [selectedTicketDetail?.id, fetchTicketHistory]);

  const postTicketComment = useCallback(async () => {
    const comment = (ticketComment || '').trim();
    if (!comment || !selectedTicketDetail?.id) return;
    setPostingComment(true);
    try {
      const r = await fetch(`/api/tickets/${selectedTicketDetail.id}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ comment }),
      });
      if (r.ok) {
        setTicketComment('');
        fetchTicketHistory(selectedTicketDetail.id);
        toast({ title: 'Comment added' });
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: err?.error || 'Failed to add comment', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to add comment', variant: 'destructive' });
    } finally {
      setPostingComment(false);
    }
  }, [selectedTicketDetail?.id, ticketComment, fetchTicketHistory, toast]);

  const handleTicketScanned = useCallback((ticket: any) => {
    setSelectedTicketDetail(ticket);
    if (ticket?.id) fetchTicketDetail(ticket.id);
  }, [fetchTicketDetail]);

  const updateTicketStatus = useCallback(async (ticketId: string, status: string) => {
    setUpdatingTicketStatusId(ticketId);
    try {
      const r = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: status.toUpperCase().replace(' ', '_') }),
      });
      if (r.ok) {
        const updated = await r.json();
        setSelectedTicketDetail((prev: any) => (prev?.id === ticketId ? updated : prev));
        setAssignedTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: (updated.status || '').toLowerCase().replace('_', ' ') } : t)));
        toast({ title: 'Status updated' });
      } else {
        toast({ title: 'Update failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' });
    } finally {
      setUpdatingTicketStatusId(null);
    }
  }, [toast]);

  // Fetch assigned tasks
  const fetchAssignedTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const r = await fetch('/api/planner/assigned');
      if (r.ok) {
        const data = await r.json();
        setAssignedTasks(Array.isArray(data) ? data : []);
      }
    } catch {
      toast({ title: 'Failed to load tasks', variant: 'destructive' });
    } finally {
      setTasksLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (tab === 'tasks') fetchAssignedTasks();
  }, [tab, fetchAssignedTasks]);

  const lookupAsset = useCallback(async (code: string) => {
    const q = code.trim();
    if (!q) return;
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/assets/scan?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.asset?.id) {
          const asset = data.asset;
          setAuditScans((prev) => {
            const exists = prev.some((a) => (typeof a === 'string' ? a === asset.id : a?.id === asset.id));
            if (exists) return prev;
            return [...prev, asset];
          });
          toast({ title: 'Scanned', description: asset.name });
        } else {
          toast({ title: 'Not found', description: q, variant: 'destructive' });
        }
      }
    } catch {
      toast({ title: 'Lookup failed', variant: 'destructive' });
    } finally {
      setAuditLoading(false);
    }
  }, [toast]);

  const doMove = async (vals: z.infer<typeof transferSchema>) => {
    if (!currentAsset) return;
    setMoving(true);
    try {
      const r = await fetch(`/api/assets/${currentAsset.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vals),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setCurrentAsset((prev) => (prev ? { ...prev, ...d.asset, floorNumber: vals.floorNumber, roomNumber: vals.roomNumber } : prev));
      setShowMove(false);
      transferForm.reset();
      toast({ title: 'Asset moved', description: `Floor ${vals.floorNumber}, Room ${vals.roomNumber}` });
    } catch {
      toast({ title: 'Move failed', variant: 'destructive' });
    }
    setMoving(false);
  };

  const doStatus = async () => {
    if (!currentAsset || !pickedStatus) return;
    setSavingStatus(true);
    try {
      const r = await fetch(`/api/assets/${currentAsset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pickedStatus }),
      });
      if (!r.ok) throw new Error();
      setCurrentAsset((prev) => (prev ? { ...prev, status: pickedStatus } : prev));
      setShowStatus(false);
      setPickedStatus('');
      toast({ title: 'Status updated', description: pickedStatus });
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
    setSavingStatus(false);
  };

  const doDispose = async () => {
    if (!currentAsset) return;
    setDisposing(true);
    try {
      const r = await fetch(`/api/assets/${currentAsset.id}/dispose`, { method: 'POST' });
      if (!r.ok) throw new Error();
      toast({ title: 'Asset disposed', description: currentAsset.name });
      setCurrentAsset(null);
    } catch {
      toast({ title: 'Disposal failed', variant: 'destructive' });
    }
    setDisposing(false);
  };

  const handleCreateTicket = async (vals: z.infer<typeof createTicketSchema>) => {
    setCreateTicketLoading(true);
    try {
      const body: any = { title: vals.title, description: vals.description || '', priority: vals.priority };
      if (currentAsset?.id) body.assetId = currentAsset.id;
      const r = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to create ticket');
      }
      toast({ title: 'Ticket created' });
      setShowCreateTicket(false);
      createTicketForm.reset();
      fetchAssignedTickets();
      if (currentAsset?.id) fetchAssetTickets();
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to create ticket', variant: 'destructive' });
    } finally {
      setCreateTicketLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    setUpdatingTaskId(taskId);
    try {
      const r = await fetch(`/api/planner/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (r.ok) {
        setAssignedTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
        toast({ title: 'Task updated' });
      }
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const priorityClass = (p: string) => {
    const q = (p || '').toLowerCase();
    if (q === 'high') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    if (q === 'medium') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
  };

  return (
    <HandheldLayout title="Field Assistant">
      {/* Tab content — touch-friendly, safe area */}
      <div className="flex-1 overflow-auto p-4 pb-28 min-h-0">
        {tab === 'scan' && (
          <div className="max-w-lg mx-auto">
            <HandheldAssetScanner standalone onAssetSelected={setCurrentAsset} />
          </div>
        )}

        {tab === 'asset' && (
          <div className="max-w-lg mx-auto space-y-4">
            {!currentAsset ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center text-slate-500 dark:text-slate-400">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No asset selected</p>
                <p className="text-sm mt-1">Go to Scan and scan an asset to see it here.</p>
                <Button size="lg" className="mt-4" onClick={() => setTab('scan')}>
                  <Scan className="h-4 w-4 mr-2" />
                  Scan asset
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="h-14 w-14 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {currentAsset.imageUrl ? (
                      <img src={currentAsset.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-7 w-7 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{currentAsset.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{currentAsset.assetId || currentAsset.barcode || currentAsset.id}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 text-xs font-medium">
                        <CheckCircle2 className="h-3 w-3" /> {currentAsset.status}
                      </span>
                      {(currentAsset.floorNumber || currentAsset.roomNumber) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs">
                          <MapPin className="h-3 w-3" /> {[currentAsset.floorNumber, currentAsset.roomNumber].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button type="button" size="lg" variant="outline" className="h-14 flex flex-col gap-0.5" onClick={() => openHandheldDialogAfterTap(() => setShowDetails(true))}>
                    <Eye className="h-5 w-5" />
                    <span className="text-xs">View details</span>
                  </Button>
                  <Button type="button" size="lg" variant="outline" className="h-14 flex flex-col gap-0.5" onClick={() => openHandheldDialogAfterTap(() => setShowMove(true))}>
                    <ArrowRightLeft className="h-5 w-5" />
                    <span className="text-xs">Move</span>
                  </Button>
                  <Button type="button" size="lg" variant="outline" className="h-14 flex flex-col gap-0.5" onClick={() => openHandheldDialogAfterTap(() => setShowAssign(true))}>
                    <UserCheck className="h-5 w-5" />
                    <span className="text-xs">Assign</span>
                  </Button>
                  <Button type="button" size="lg" variant="outline" className="h-14 flex flex-col gap-0.5" onClick={() => openHandheldDialogAfterTap(() => setShowStatus(true))}>
                    <RefreshCw className="h-5 w-5" />
                    <span className="text-xs">Status</span>
                  </Button>
                </div>
                <Button size="lg" variant="outline" className="w-full h-12 gap-2" onClick={() => setShowCreateTicket(true)}>
                  <Ticket className="h-4 w-4" />
                  Create ticket for this asset
                </Button>
                <Button size="lg" variant="destructive" className="w-full h-12 gap-2" onClick={doDispose} disabled={disposing}>
                  {disposing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Dispose asset
                </Button>
                <Button size="lg" variant="secondary" className="w-full h-12 gap-2" onClick={() => setTab('scan')}>
                  <Scan className="h-4 w-4" />
                  Scan next
                </Button>
              </>
            )}
          </div>
        )}

        {tab === 'tickets' && (
          <div className="max-w-lg mx-auto space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">Tickets</h2>
              <div className="flex gap-2 flex-wrap">
                <TicketBarcodeScanner onScan={handleTicketScanned} />
                <Button size="sm" variant="outline" onClick={() => fetchAssignedTickets()} disabled={ticketsLoading}>
                  {ticketsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </Button>
                <Button size="sm" onClick={() => setShowCreateTicket(true)}>
                  <Plus className="h-4 w-4 mr-1" /> New
                </Button>
              </div>
            </div>
            {currentAsset && (
              <p className="text-sm text-slate-500">Open tickets for current asset: {currentAsset.name}</p>
            )}
            {ticketsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
            ) : (
              <div className="space-y-2">
                {currentAsset?.id && assetTickets.length > 0 && (
                  <>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">This asset</p>
                    {assetTickets.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => fetchTicketDetail(t.id)}
                        className="w-full text-left p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 active:scale-[0.99] transition-all flex items-center justify-between gap-3 min-h-[72px] touch-manipulation"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">{t.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-slate-500">{t.displayId || t.id}</span>
                            <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', priorityClass(t.priority))}>{(t.priority || 'medium').toLowerCase()}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                      </button>
                    ))}
                  </>
                )}
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mt-4">Assigned to you</p>
                {assignedTickets.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center">
                    <Ticket className="h-12 w-12 mx-auto text-slate-400 mb-3" />
                    <p className="font-medium text-slate-600 dark:text-slate-400">No tickets assigned</p>
                    <p className="text-sm text-slate-500 mt-1">New assignments will appear here. Pull to refresh.</p>
                  </div>
                ) : (
                  assignedTickets.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => fetchTicketDetail(t.id)}
                      className="w-full text-left p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 active:scale-[0.99] transition-all flex items-center justify-between gap-3 min-h-[72px] touch-manipulation"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{t.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-slate-500">{t.displayId || t.id}</span>
                          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', priorityClass(t.priority))}>{(t.priority || 'medium').toLowerCase()}</span>
                          <span className="text-xs text-slate-400">· {(t.status || '').toLowerCase().replace('_', ' ')}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'tasks' && (
          <div className="max-w-lg mx-auto space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">My tasks</h2>
            {tasksLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-10 w-10 animate-spin text-violet-500" /></div>
            ) : assignedTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center">
                <ListTodo className="h-12 w-12 mx-auto text-slate-400 mb-3" />
                <p className="font-medium text-slate-600 dark:text-slate-400">No tasks assigned</p>
                <p className="text-sm text-slate-500 mt-1">Tasks from your planner will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedTasks.map((t) => (
                  <div key={t.id} className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between gap-3 min-h-[72px]">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{t.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{t.status} · {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : ''}</p>
                    </div>
                    {t.status !== 'completed' && (
                      <Button
                        size="sm"
                        className="min-h-[44px] min-w-[44px] rounded-xl touch-manipulation"
                        disabled={updatingTaskId === t.id}
                        onClick={() => updateTaskStatus(t.id, 'completed')}
                      >
                        {updatingTaskId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Done
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'audit' && (
          <div className="max-w-lg mx-auto space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Inventory audit</h2>
                <p className="text-sm text-slate-500 mt-0.5">Scan assets to verify location &amp; assignment.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30 px-3 py-1.5 text-sm font-semibold text-violet-800 dark:text-violet-200">
                  <ClipboardList className="h-4 w-4" /> {auditScans.length} item{auditScans.length !== 1 ? 's' : ''}
                </span>
                {auditScans.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setAuditScans([])}>Clear all</Button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Barcode or Asset ID"
                className="flex-1 h-12 rounded-xl"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) lookupAsset(v);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <Button size="lg" className="h-12 rounded-xl min-w-[52px]" disabled={auditLoading} onClick={() => { const el = document.querySelector('input[placeholder="Barcode or Asset ID"]') as HTMLInputElement; if (el?.value) { lookupAsset(el.value); el.value = ''; } }}>
                {auditLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Scan className="h-5 w-5" />}
              </Button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pb-2">
              {auditScans.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 p-8 text-center">
                  <ClipboardList className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-500 mb-3" />
                  <p className="font-medium text-slate-600 dark:text-slate-400">No items scanned yet</p>
                  <p className="text-sm text-slate-500 mt-1">Scan or enter a barcode above to add items to this audit.</p>
                </div>
              ) : (
                auditScans.map((item, i) => {
                  const asset = typeof item === 'string' ? null : item;
                  if (!asset?.id) return null;
                  const loc = [asset.floorNumber, asset.roomNumber].filter(Boolean).join(', ') || '—';
                  const rfidZone = asset.rfidTag?.lastZone;
                  const rfidLoc = rfidZone ? [rfidZone.name, rfidZone.floorNumber, rfidZone.roomNumber].filter(Boolean).join(', ') : null;
                  return (
                    <div
                      key={`${asset.id}-${i}`}
                      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden"
                    >
                      <div className="flex gap-4 p-4">
                        <div className="h-20 w-20 rounded-xl bg-slate-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                          {asset.imageUrl ? (
                            <img src={asset.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center"><Package className="h-8 w-8 text-slate-400" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">{asset.name}</p>
                            <span className="rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 px-2 py-0.5 shrink-0">Qty 1</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{asset.assetId || asset.barcode || asset.id}</p>
                          {asset.description && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">{asset.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="px-4 pb-4 grid gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="text-slate-600 dark:text-slate-300">Location: {loc}</span>
                        </div>
                        {asset.assignedToName && (
                          <div className="flex items-center gap-2 text-xs">
                            <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="text-slate-600 dark:text-slate-300">Assigned to: {asset.assignedToName}</span>
                          </div>
                        )}
                        {rfidLoc && (
                          <div className="flex items-center gap-2 text-xs">
                            <Radio className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                            <span className="text-slate-600 dark:text-slate-300">RFID: {rfidLoc}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {tab === 'food' && (
          <div className="max-w-lg mx-auto space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" /> Food supply
            </h2>
            <p className="text-sm text-slate-500">Scan items to look up stock or record consumption.</p>
            {kitchens.length === 0 ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-500">Loading kitchens…</p>
              </div>
            ) : (
              <div className="space-y-4">
                {kitchens.length > 1 && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Kitchen</label>
                    <select
                      value={foodKitchenId}
                      onChange={(e) => setFoodKitchenId(e.target.value)}
                      className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    >
                      {kitchens.map((k) => (
                        <option key={k.id} value={k.id}>{k.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <Button
                  type="button"
                  size="lg"
                  className="w-full h-14 gap-2"
                  onClick={() => { setFoodScannerKey((k) => k + 1); setShowFoodScanner(true); }}
                  disabled={!foodKitchenId}
                >
                  <ScanLine className="h-5 w-5" />
                  Scan food supply / Record consumption
                </Button>
                {foodKitchenId && (
                  <EnhancedBarcodeScanner
                    key={foodScannerKey}
                    kitchenId={foodKitchenId}
                    open={showFoodScanner}
                    onOpenChange={setShowFoodScanner}
                    onScanComplete={() => { setShowFoodScanner(false); }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'more' && (
          <div className="max-w-lg mx-auto space-y-6">
            <h2 className="text-lg font-semibold">More</h2>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
              {isOnline ? <Wifi className="h-8 w-8 text-emerald-500" /> : <WifiOff className="h-8 w-8 text-amber-500" />}
              <div>
                <p className="font-medium">{isOnline ? 'You are online' : 'You are offline'}</p>
                <p className="text-sm text-slate-500">{isOnline ? 'Data syncs automatically.' : 'Changes will sync when back online.'}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">Handheld account — scan, manage assets, tickets & tasks in the field.</p>
          </div>
        )}
      </div>

      {/* Bottom tab bar — world-class: pill active state, safe area, equal touch targets */}
      <nav className="flex-shrink-0 fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around gap-0 min-h-[64px] pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] px-1 bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-700/80 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.3)]">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 min-h-[52px] py-1.5 px-1 rounded-xl transition-all duration-200 touch-manipulation select-none',
                isActive
                  ? 'bg-gradient-to-b from-violet-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-800'
              )}
              aria-current={isActive ? 'page' : undefined}
              aria-label={t.label}
            >
              <span className={cn('flex items-center justify-center', isActive ? 'text-white' : '')}>
                {t.icon}
              </span>
              <span className={cn(
                'text-[10px] font-semibold truncate w-full text-center leading-tight',
                isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'
              )}>
                {t.shortLabel ?? t.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Dialogs */}
      {currentAsset && (
        <>
          <AssetDetailsDialog asset={currentAsset} open={showDetails} onOpenChange={setShowDetails} onAssetUpdated={(a) => a && setCurrentAsset((prev) => prev ? { ...prev, ...a } : prev)} />
          <AssignAssetDialog
            asset={{ id: currentAsset.id, name: currentAsset.name, assignedToName: currentAsset.assignedToName, assignedToEmail: currentAsset.assignedToEmail ?? undefined }}
            open={showAssign}
            onOpenChange={setShowAssign}
            onAssigned={async () => {
              try {
                const r = await fetch(`/api/assets/${currentAsset.id}`);
                if (r.ok) {
                  const d = await r.json();
                  if (d?.asset) setCurrentAsset(d.asset);
                }
              } catch { /* ignore */ }
            }}
          />
        </>
      )}

      <Dialog open={showMove} onOpenChange={setShowMove}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={preventHandheldDialogOutsideClose} onInteractOutside={preventHandheldDialogOutsideClose}>
          <DialogHeader><DialogTitle>Move asset</DialogTitle></DialogHeader>
          <Form {...transferForm}>
            <form onSubmit={transferForm.handleSubmit(doMove)} className="space-y-4">
              <FormField control={transferForm.control} name="floorNumber" render={({ field }) => (
                <FormItem><FormLabel>Floor</FormLabel><FormControl><Input placeholder="e.g. 2" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={transferForm.control} name="roomNumber" render={({ field }) => (
                <FormItem><FormLabel>Room</FormLabel><FormControl><Input placeholder="e.g. 205" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowMove(false)}>Cancel</Button>
                <Button type="submit" disabled={moving}>{moving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Move'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={showStatus} onOpenChange={setShowStatus}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={preventHandheldDialogOutsideClose} onInteractOutside={preventHandheldDialogOutsideClose}>
          <DialogHeader><DialogTitle>Update status</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <Button key={s.value} type="button" variant={pickedStatus === s.value ? 'default' : 'outline'} onClick={() => setPickedStatus(s.value)}>{s.label}</Button>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowStatus(false)}>Cancel</Button>
              <Button onClick={doStatus} disabled={!pickedStatus || savingStatus}>{savingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket detail sheet */}
      <Dialog open={!!selectedTicketDetail || ticketDetailLoading} onOpenChange={(open) => { if (!open) setSelectedTicketDetail(null); }}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl" aria-describedby={undefined}>
          <div className="flex items-start justify-between gap-2">
            <DialogHeader>
              <DialogTitle>
                {ticketDetailLoading ? (
                  'Ticket details'
                ) : selectedTicketDetail ? (
                  <span className="text-lg pr-6 block">{selectedTicketDetail.title || 'Ticket'}</span>
                ) : (
                  <VisuallyHidden>Ticket details</VisuallyHidden>
                )}
              </DialogTitle>
              {selectedTicketDetail && (
                <p className="text-xs text-slate-500 mt-1">{selectedTicketDetail.displayId || selectedTicketDetail.id}</p>
              )}
            </DialogHeader>
            {(ticketDetailLoading || selectedTicketDetail) && (
              <Button variant="ghost" size="icon" className="rounded-xl -mr-2 shrink-0" onClick={() => setSelectedTicketDetail(null)} aria-label="Close">
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
          {ticketDetailLoading ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
              <p className="text-sm text-slate-500">Loading ticket…</p>
            </div>
          ) : selectedTicketDetail ? (
            <div className="space-y-4 pt-2">
                {selectedTicketDetail.description ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{selectedTicketDetail.description}</p>
                ) : (
                  <p className="text-sm text-slate-400 italic">No description</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {(selectedTicketDetail.status || 'open').toLowerCase().replace('_', ' ')}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                    {(selectedTicketDetail.priority || 'medium').toLowerCase()} priority
                  </span>
                  {selectedTicketDetail.asset?.name && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                      <Package className="h-3 w-3" /> {selectedTicketDetail.asset.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Created {selectedTicketDetail.createdAt ? new Date(selectedTicketDetail.createdAt).toLocaleString() : '—'}
                </p>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-medium text-slate-500 mb-2">Update status</p>
                  <div className="flex flex-wrap gap-2">
                    {['OPEN', 'IN_PROGRESS', 'RESOLVED'].map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={((selectedTicketDetail.status || '').toUpperCase().replace(' ', '_') === s) ? 'default' : 'outline'}
                        disabled={updatingTicketStatusId === selectedTicketDetail.id}
                        onClick={() => updateTicketStatus(selectedTicketDetail.id, s)}
                      >
                        {updatingTicketStatusId === selectedTicketDetail.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {s.replace('_', ' ')}
                      </Button>
                    ))}
                  </div>
                </div>
                {/* Timeline */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" /> Timeline
                  </p>
                  {ticketHistoryLoading ? (
                    <div className="flex items-center gap-2 py-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                  ) : ticketHistory.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">No updates yet</p>
                  ) : (
                    <ul className="space-y-3 max-h-48 overflow-y-auto">
                      {ticketHistory.map((h) => (
                        <li key={h.id} className="text-xs border-l-2 border-slate-200 dark:border-slate-600 pl-3 py-1">
                          {h.comment && <p className="text-slate-700 dark:text-slate-300">{h.comment}</p>}
                          {(h.status || h.priority) && (
                            <p className="text-slate-500 mt-0.5">
                              {[h.status, h.priority].filter(Boolean).map((x) => (x || '').toLowerCase().replace('_', ' ')).join(' · ')}
                            </p>
                          )}
                          <p className="text-slate-400 mt-0.5">{h.user?.email || 'System'} · {h.createdAt ? new Date(h.createdAt).toLocaleString() : ''}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {/* Add comment */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-medium text-slate-500 mb-2">Add comment</p>
                  <Textarea
                    placeholder="Type your reply…"
                    value={ticketComment}
                    onChange={(e) => setTicketComment(e.target.value)}
                    className="min-h-[80px] resize-none"
                    disabled={postingComment}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2"
                    onClick={postTicketComment}
                    disabled={!ticketComment.trim() || postingComment}
                  >
                    {postingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                    {postingComment ? ' Posting…' : ' Post comment'}
                  </Button>
                </div>
              </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateTicket} onOpenChange={setShowCreateTicket}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create ticket</DialogTitle></DialogHeader>
          {currentAsset && <p className="text-sm text-slate-500">Linking to asset: {currentAsset.name}</p>}
          <Form {...createTicketForm}>
            <form onSubmit={createTicketForm.handleSubmit(handleCreateTicket)} className="space-y-4">
              <FormField control={createTicketForm.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="Issue summary" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={createTicketForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description (optional)</FormLabel><FormControl><Input placeholder="Details" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={createTicketForm.control} name="priority" render={({ field }) => (
                <FormItem><FormLabel>Priority</FormLabel>
                  <FormControl>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...field}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </FormControl>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateTicket(false)}>Cancel</Button>
                <Button type="submit" disabled={createTicketLoading}>{createTicketLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </HandheldLayout>
  );
}
