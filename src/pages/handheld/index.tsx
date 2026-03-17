// @ts-nocheck
/**
 * Handheld hub: single entry point for HANDHELD-role users.
 * Full-screen, no dashboard shell. Tabs: Scan | Asset | Tickets | Tasks | Audit | More.
 */
import React, { useState, useCallback, useEffect } from 'react';
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
} from 'lucide-react';
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

type TabId = 'scan' | 'asset' | 'tickets' | 'tasks' | 'audit' | 'more';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'scan', label: 'Scan', icon: <Scan className="h-5 w-5" /> },
  { id: 'asset', label: 'Asset', icon: <Package className="h-5 w-5" /> },
  { id: 'tickets', label: 'Tickets', icon: <Ticket className="h-5 w-5" /> },
  { id: 'tasks', label: 'Tasks', icon: <ListTodo className="h-5 w-5" /> },
  { id: 'audit', label: 'Audit', icon: <ClipboardList className="h-5 w-5" /> },
  { id: 'more', label: 'More', icon: <MoreHorizontal className="h-5 w-5" /> },
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
  const createTicketForm = useForm<z.infer<typeof createTicketSchema>>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { title: '', description: '', priority: 'medium' },
  });

  // Tasks state
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Audit state
  const [auditScans, setAuditScans] = useState<string[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Fetch assigned tickets
  const fetchAssignedTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const r = await fetch('/api/tickets/assigned');
      if (r.ok) {
        const data = await r.json();
        setAssignedTickets(Array.isArray(data) ? data : []);
      }
    } catch {
      toast({ title: 'Failed to load tickets', variant: 'destructive' });
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
    setTicketsLoading(true);
    try {
      const r = await fetch(`/api/assets/${currentAsset.id}/tickets`);
      if (r.ok) {
        const data = await r.json();
        setAssetTickets(Array.isArray(data) ? data : []);
      }
    } catch {
      setAssetTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  }, [currentAsset?.id]);

  useEffect(() => {
    if (tab === 'tickets') {
      fetchAssignedTickets();
      if (currentAsset?.id) fetchAssetTickets();
    }
  }, [tab, currentAsset?.id, fetchAssignedTickets, fetchAssetTickets]);

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
          setAuditScans((prev) => (prev.includes(data.asset.id) ? prev : [...prev, data.asset.id]));
          toast({ title: 'Scanned', description: data.asset.name });
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

  return (
    <HandheldLayout title="Asset Handheld">
      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4 pb-24">
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
                  <Button size="lg" variant="outline" className="h-14 flex flex-col gap-0.5" onClick={() => setShowDetails(true)}>
                    <Eye className="h-5 w-5" />
                    <span className="text-xs">View details</span>
                  </Button>
                  <Button size="lg" variant="outline" className="h-14 flex flex-col gap-0.5" onClick={() => setShowMove(true)}>
                    <ArrowRightLeft className="h-5 w-5" />
                    <span className="text-xs">Move</span>
                  </Button>
                  <Button size="lg" variant="outline" className="h-14 flex flex-col gap-0.5" onClick={() => setShowAssign(true)}>
                    <UserCheck className="h-5 w-5" />
                    <span className="text-xs">Assign</span>
                  </Button>
                  <Button size="lg" variant="outline" className="h-14 flex flex-col gap-0.5" onClick={() => setShowStatus(true)}>
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
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Tickets</h2>
              <Button size="sm" onClick={() => setShowCreateTicket(true)}>
                <Plus className="h-4 w-4 mr-1" /> New
              </Button>
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
                      <div key={t.id} className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <p className="font-medium truncate">{t.title}</p>
                        <p className="text-xs text-slate-500">{t.displayId || t.id} · {t.status}</p>
                      </div>
                    ))}
                  </>
                )}
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mt-4">Assigned to you</p>
                {assignedTickets.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4">No tickets assigned to you.</p>
                ) : (
                  assignedTickets.map((t) => (
                    <div key={t.id} className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <p className="font-medium truncate">{t.title}</p>
                      <p className="text-xs text-slate-500">{t.displayId || t.id} · {t.status}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'tasks' && (
          <div className="max-w-lg mx-auto space-y-4">
            <h2 className="text-lg font-semibold">My tasks</h2>
            {tasksLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
            ) : assignedTasks.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No tasks assigned to you.</p>
            ) : (
              <div className="space-y-2">
                {assignedTasks.map((t) => (
                  <div key={t.id} className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{t.title}</p>
                      <p className="text-xs text-slate-500">{t.status} · {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : ''}</p>
                    </div>
                    {t.status !== 'completed' && (
                      <Button
                        size="sm"
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
            <h2 className="text-lg font-semibold">Inventory audit</h2>
            <p className="text-sm text-slate-500">Scan assets to build a list. Use manual entry or go to Scan tab for camera.</p>
            <div className="flex gap-2">
              <Input
                placeholder="Barcode or Asset ID"
                className="flex-1 h-12"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) lookupAsset(v);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <Button size="lg" className="h-12" disabled={auditLoading} onClick={() => { const el = document.querySelector('input[placeholder="Barcode or Asset ID"]') as HTMLInputElement; if (el?.value) { lookupAsset(el.value); el.value = ''; } }}>
                {auditLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Add'}
              </Button>
            </div>
            <p className="text-sm font-medium">Count: {auditScans.length}</p>
            {auditScans.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setAuditScans([])}>Clear list</Button>
            )}
            <ul className="space-y-1 max-h-48 overflow-auto">
              {auditScans.map((id, i) => (
                <li key={id} className="text-sm text-slate-600 dark:text-slate-300 truncate">#{i + 1} {id}</li>
              ))}
            </ul>
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

      {/* Bottom tab bar */}
      <nav className="flex-shrink-0 fixed bottom-0 left-0 right-0 flex items-center justify-around gap-1 py-2 px-2 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 safe-area-pb">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 min-w-[56px] py-2 px-2 rounded-xl transition-colors',
              tab === t.id
                ? 'bg-primary text-primary-foreground'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
            )}
          >
            {t.icon}
            <span className="text-[10px] font-medium truncate max-w-full">{t.label}</span>
          </button>
        ))}
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
        <DialogContent className="sm:max-w-md">
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
        <DialogContent className="sm:max-w-md">
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
