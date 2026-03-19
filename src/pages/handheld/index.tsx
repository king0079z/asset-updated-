// @ts-nocheck
/**
 * Handheld hub: SimplyRFiD-style field assistant for HANDHELD-role users.
 * Tabs: Scan | Inventory (Count + Audit) | Locate | Work (Tickets + Tasks) | Asset | More.
 * Features: RFID-style scan, ultra-fast count, locate (beep), audit, sync, export, print/encode tag workflow.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { HandheldLayout } from '@/components/HandheldLayout';
import {
  HandheldTabNav,
  HandheldFloatingCommandBar,
  HandheldSessionStrip,
  type HandheldTabId,
  RAPID_TAB_IDS,
} from '@/components/handheld';
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
  Download,
  History,
  Calendar,
  DollarSign,
  Hash,
  Crosshair,
  Search,
  Layers,
  Briefcase,
  Printer,
  Camera,
  BarChart3,
  AlertCircle,
  ListChecks,
  Type,
  Mic,
  Truck,
} from 'lucide-react';
import dynamic from 'next/dynamic';
const TicketBarcodeScanner = dynamic(() => import('@/components/TicketBarcodeScanner').then(m => ({ default: m.default })), { ssr: false });
const EnhancedBarcodeScanner = dynamic(() => import('@/components/EnhancedBarcodeScanner'), { ssr: false });
const AuditRfidMapDialog = dynamic(() => import('@/components/AuditRfidMapDialog'), { ssr: false });
const BarcodeScannerCount = dynamic(() => import('@/components/BarcodeScanner2'), { ssr: false });
import { AssignAssetDialog } from '@/components/AssignAssetDialog';
import { AssetDetailsDialog } from '@/components/AssetDetailsDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGeolocation } from '@/hooks/useGeolocation';
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
  missionName: z.string().optional(),
  resolveBy: z.string().optional(),
});

const addAssetSchema = z.object({
  name: z.string().min(1, 'Name required'),
  type: z.string().min(1, 'Type required'),
  description: z.string().optional(),
  vendorId: z.string().optional(),
  floorNumber: z.string().optional(),
  roomNumber: z.string().optional(),
  purchaseAmount: z.string().optional(),
  purchaseDate: z.string().optional(),
  batchNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  donorName: z.string().optional(),
  nextServiceDate: z.string().optional(),
  isProvisional: z.boolean().optional(),
});
const ASSET_TYPES_MAIN = [
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'ELECTRONICS', label: 'Electronics' },
];
const ASSET_TYPES = [
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'IT', label: 'IT / Technology' },
  { value: 'VEHICLE', label: 'Vehicle' },
  { value: 'TOOL', label: 'Tool' },
  { value: 'OTHER', label: 'Other' },
];

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

const TAB_SUBTITLE: Record<HandheldTabId, string> = {
  scan: 'Scan · lookup & capture',
  inventory: 'Inventory · count & audit',
  locate: 'Locate · proximity assist',
  work: 'Work · tickets & tasks',
  asset: 'Asset · actions on hand',
  more: 'More · sync & settings',
};

export default function HandheldHubPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<HandheldTabId>('scan');
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
    defaultValues: { title: '', description: '', priority: 'medium', missionName: '', resolveBy: '' },
  });

  // Tasks state
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Audit state — store full asset for world-class cards (image, location, assignee, RFID)
  const [auditScans, setAuditScans] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [selectedAuditAssetForDetails, setSelectedAuditAssetForDetails] = useState<any | null>(null);
  const [auditDetailsLoading, setAuditDetailsLoading] = useState(false);
  const [auditRfidMapAsset, setAuditRfidMapAsset] = useState<any | null>(null);
  const [auditSort, setAuditSort] = useState<'scan' | 'name' | 'location'>('scan');
  const [auditCommentAsset, setAuditCommentAsset] = useState<{ id: string; name: string } | null>(null);
  const [auditCommentText, setAuditCommentText] = useState('');
  const [auditCommentImagePreview, setAuditCommentImagePreview] = useState<string | null>(null);
  const [auditCommentSubmitting, setAuditCommentSubmitting] = useState(false);
  const auditCommentImageInputRef = useRef<HTMLInputElement>(null);
  const [selectedAuditFoodSupply, setSelectedAuditFoodSupply] = useState<any | null>(null);
  const [auditFoodConsumption, setAuditFoodConsumption] = useState<any[]>([]);
  const [auditFoodConsumptionLoading, setAuditFoodConsumptionLoading] = useState(false);

  // Food supply state
  const [kitchens, setKitchens] = useState<{ id: string; name: string }[]>([]);
  const [foodKitchenId, setFoodKitchenId] = useState<string>('');
  const [showFoodScanner, setShowFoodScanner] = useState(false);
  const [foodScannerKey, setFoodScannerKey] = useState(0);

  // Count/Inventory state — items can have full display (image, status, location)
  type CountScanItem = {
    id: string;
    barcode?: string;
    name: string;
    imageUrl?: string | null;
    status?: string;
    floorNumber?: string | null;
    roomNumber?: string | null;
  };
  const [countScans, setCountScans] = useState<CountScanItem[]>([]);
  const [countSessionActive, setCountSessionActive] = useState(false);
  const [countStartTime, setCountStartTime] = useState<number>(0);
  const [countLocationLabel, setCountLocationLabel] = useState(''); // optional: e.g. "Aisle 3", "Store A"
  const [showCountScanner, setShowCountScanner] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState<{
    expectedCount: number;
    actualCount: number;
    missing: { id: string; name: string; barcode?: string }[];
    extra: { id: string; name: string; barcode?: string }[];
    submittedForReview: boolean;
    reasonCode?: string;
    note?: string;
    submittedAt?: number;
  } | null>(null);
  const COUNT_REVIEW_REASONS = [
    { value: '', label: 'Select reason (optional)' },
    { value: 'NOT_FOUND', label: 'Not found at location' },
    { value: 'DAMAGED', label: 'Damaged' },
    { value: 'WRONG_LOCATION', label: 'Wrong location' },
    { value: 'MISSING', label: 'Missing / unaccounted' },
    { value: 'OTHER', label: 'Other' },
  ];
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [countItemSwipedId, setCountItemSwipedId] = useState<string | null>(null);
  const [countSwipeOffset, setCountSwipeOffset] = useState(0);
  const countSwipeStartRef = useRef<{ x: number; id: string } | null>(null);
  const countSwipeOffsetRef = useRef(0);
  const [countSwipeHintDismissed, setCountSwipeHintDismissed] = useState(false);
  const countBarcodeInputRef = useRef<HTMLInputElement>(null);
  const [countVoiceListening, setCountVoiceListening] = useState(false);
  const countSpeechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const [countItemDetailsAsset, setCountItemDetailsAsset] = useState<Asset | null>(null);
  const [countItemStatusAsset, setCountItemStatusAsset] = useState<Asset | null>(null);
  const [countItemMoveAsset, setCountItemMoveAsset] = useState<Asset | null>(null);
  const [countItemActionLoading, setCountItemActionLoading] = useState(false);
  const countItemMoveForm = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: { floorNumber: '', roomNumber: '' },
  });

  // Add new asset from handheld (full form as main app)
  const [showAddAssetDialog, setShowAddAssetDialog] = useState(false);
  const [addAssetLoading, setAddAssetLoading] = useState(false);
  const [addAssetVendors, setAddAssetVendors] = useState<{ id: string; name: string }[]>([]);
  const [addAssetImagePreview, setAddAssetImagePreview] = useState<string | null>(null);
  const addAssetImageInputRef = useRef<HTMLInputElement>(null);
  const { latitude: geoLat, longitude: geoLng } = useGeolocation();
  const addAssetForm = useForm<z.infer<typeof addAssetSchema>>({
    resolver: zodResolver(addAssetSchema),
    defaultValues: {
      name: '',
      type: 'FURNITURE',
      description: '',
      vendorId: '',
      floorNumber: '',
      roomNumber: '',
      purchaseAmount: '',
      purchaseDate: '',
      batchNumber: '',
      serialNumber: '',
      donorName: '',
      nextServiceDate: '',
      isProvisional: false,
    },
  });

  // Locate state
  const [locateQuery, setLocateQuery] = useState('');
  const [locateResults, setLocateResults] = useState<Asset[]>([]);
  const [locateSearching, setLocateSearching] = useState(false);
  const [locateTarget, setLocateTarget] = useState<Asset | null>(null);
  const [locateActive, setLocateActive] = useState(false);
  const [locateProximity, setLocateProximity] = useState(0); // 0 = far, 100 = found
  const [locateSearchFocused, setLocateSearchFocused] = useState<string | null>(null); // last query we searched, to show "no results"
  const locateAudioContextRef = useRef<AudioContext | null>(null);

  // Sync state (for header and More tab)
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const [inventoryMode, setInventoryMode] = useState<'count' | 'audit'>('count');
  const [workMode, setWorkMode] = useState<'tickets' | 'tasks'>('tickets');
  const [showPrintTagDialog, setShowPrintTagDialog] = useState(false);
  const [printTagAsset, setPrintTagAsset] = useState<Asset | null>(null);

  // Session stats (world-class ops) — state so UI updates
  const [sessionScansCount, setSessionScansCount] = useState(0);
  const [sessionTasksCount, setSessionTasksCount] = useState(0);
  const [sessionStart] = useState(() => Date.now());
  const resetSessionStats = useCallback(() => {
    setSessionScansCount(0);
    setSessionTasksCount(0);
    toast({ title: 'Session reset', description: 'Scans and tasks counters cleared.' });
  }, [toast]);

  // Exception/reason codes for count review
  const [countReviewReason, setCountReviewReason] = useState('');
  const [countReviewNote, setCountReviewNote] = useState('');

  // Recent actions (audit trail)
  const [recentActions, setRecentActions] = useState<{ type: string; label: string; at: number }[]>([]);
  const pushRecentAction = useCallback((type: string, label: string) => {
    setRecentActions((prev) => [{ type, label, at: Date.now() }, ...prev].slice(0, 30));
  }, []);

  // Accessibility: large text
  const [largeTextMode, setLargeTextMode] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('handheld_large_text');
      setLargeTextMode(stored === '1');
    } catch {}
  }, []);
  const toggleLargeText = useCallback(() => {
    setLargeTextMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('handheld_large_text', next ? '1' : '0');
      } catch {}
      return next;
    });
  }, []);

  // Rapid deployment / crisis mode: fewer tabs, faster workflow
  const [rapidMode, setRapidMode] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('handheld_rapid_mode');
      setRapidMode(stored === '1');
    } catch {}
  }, []);
  const toggleRapidMode = useCallback(() => {
    setRapidMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('handheld_rapid_mode', next ? '1' : '0');
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    if (rapidMode && !RAPID_TAB_IDS.includes(tab)) setTab('scan');
  }, [rapidMode, tab]);

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Offline queue (persist and replay on sync)
  const OFFLINE_QUEUE_KEY = 'handheld_offline_queue';
  const [offlineQueueLength, setOfflineQueueLength] = useState(0);
  const getQueue = useCallback((): { type: string; payload: any }[] => {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);
  const setQueue = useCallback((q: { type: string; payload: any }[]) => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
      setOfflineQueueLength(q.length);
    } catch {}
  }, []);
  useEffect(() => {
    setOfflineQueueLength(getQueue().length);
  }, [getQueue]);

  // Batch move
  const [batchMoveIds, setBatchMoveIds] = useState<string[]>([]);
  const [showBatchMoveDialog, setShowBatchMoveDialog] = useState(false);
  const [batchMoveLoading, setBatchMoveLoading] = useState(false);
  const batchMoveForm = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: { floorNumber: '', roomNumber: '' },
  });
  const doBatchMove = useCallback(async (vals: z.infer<typeof transferSchema>) => {
    if (batchMoveIds.length === 0) return;
    setBatchMoveLoading(true);
    let done = 0;
    for (const id of batchMoveIds) {
      try {
        const r = await fetch(`/api/assets/${id}/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vals),
        });
        if (r.ok) done++;
      } catch {}
    }
    setBatchMoveLoading(false);
    setShowBatchMoveDialog(false);
    setBatchMoveIds([]);
    batchMoveForm.reset();
    pushRecentAction('move', `Batch move: ${done}/${batchMoveIds.length} assets to ${vals.floorNumber}, ${vals.roomNumber}`);
    toast({ title: 'Batch move done', description: `${done} of ${batchMoveIds.length} moved to ${vals.floorNumber}, ${vals.roomNumber}.` });
  }, [batchMoveIds, pushRecentAction, toast]);

  // Photo upload
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    if (showAddAssetDialog) {
      fetch('/api/vendors', { credentials: 'include' })
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setAddAssetVendors(Array.isArray(data) ? data : []))
        .catch(() => setAddAssetVendors([]));
    } else {
      setAddAssetImagePreview(null);
      addAssetForm.reset({
        name: '',
        type: 'FURNITURE',
        description: '',
        vendorId: '',
        floorNumber: '',
        roomNumber: '',
        purchaseAmount: '',
        purchaseDate: '',
        batchNumber: '',
        serialNumber: '',
        donorName: '',
        nextServiceDate: '',
        isProvisional: false,
      });
    }
  }, [showAddAssetDialog]);

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

  // So landing page shows "Handheld" CTA instead of "Support tickets" when user returns to home
  useEffect(() => {
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('landing_cta', 'handheld');
    } catch (_) {}
  }, []);

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
    if (tab === 'work') {
      fetchAssignedTickets();
      if (currentAsset?.id) fetchAssetTickets();
    }
  }, [tab, currentAsset?.id, fetchAssignedTickets, fetchAssetTickets]);

  useEffect(() => {
    if ((tab === 'more' || tab === 'inventory') && kitchens.length === 0) {
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
    if (tab === 'work') fetchAssignedTasks();
  }, [tab, fetchAssignedTasks]);

  const lookupAsset = useCallback(async (code: string) => {
    const q = code.trim();
    if (!q) return;
    setAuditLoading(true);
    try {
      // 1) Try asset scan first
      const res = await fetch(`/api/assets/scan?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.asset?.id) {
          const asset = data.asset;
          setAuditScans((prev) => {
            const exists = prev.some((a) => (a && typeof a === 'object' && (a as any).type === 'food')
              ? false
              : (typeof a === 'string' ? a === asset.id : (a as any)?.id === asset.id));
            if (exists) return prev;
            return [...prev, asset];
          });
          toast({ title: 'Scanned', description: asset.name });
          return;
        }
      }
      // 2) If not an asset, try food supply barcode (e.g. KIT...SUP...)
      const scanRes = await fetch('/api/food-supply/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: q }),
      });
      if (scanRes.ok) {
        const scanData = await scanRes.json();
        if (scanData?.supply?.id) {
          const supply = scanData.supply;
          setAuditScans((prev) => {
            const exists = prev.some((a) => a && typeof a === 'object' && (a as any).type === 'food' && (a as any).supply?.id === supply.id);
            if (exists) return prev;
            return [...prev, { type: 'food', supply }];
          });
          toast({ title: 'Food supply scanned', description: `${supply.name} — ${supply.quantity} ${supply.unit} left` });
          return;
        }
      }
      // 3) Try ticket barcode
      const ticketRes = await fetch(`/api/tickets/barcode?barcode=${encodeURIComponent(q)}`, { credentials: 'include' });
      if (ticketRes.ok) {
        const ticketData = await ticketRes.json();
        if (ticketData?.id) {
          setAuditScans((prev) => {
            const exists = prev.some((a) => a && typeof a === 'object' && (a as any).type === 'ticket' && (a as any).ticket?.id === ticketData.id);
            if (exists) return prev;
            return [...prev, { type: 'ticket', ticket: ticketData }];
          });
          toast({ title: 'Ticket scanned', description: ticketData.title || ticketData.displayId || 'Ticket' });
          return;
        }
      }
      toast({ title: 'Not found', description: q, variant: 'destructive' });
    } catch {
      toast({ title: 'Lookup failed', variant: 'destructive' });
    } finally {
      setAuditLoading(false);
    }
  }, [toast]);

  const doMove = async (vals: z.infer<typeof transferSchema>) => {
    if (!currentAsset) return;
    const payload = { assetId: currentAsset.id, assetName: currentAsset.name, floorNumber: vals.floorNumber, roomNumber: vals.roomNumber };
    if (!isOnline) {
      setQueue([...getQueue(), { type: 'move', payload }]);
      setShowMove(false);
      transferForm.reset();
      toast({ title: 'Queued for sync', description: 'Move will sync when back online.' });
      return;
    }
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
      pushRecentAction('move', `Moved ${currentAsset.name} to ${vals.floorNumber}, ${vals.roomNumber}`);
      toast({ title: 'Asset moved', description: `Floor ${vals.floorNumber}, Room ${vals.roomNumber}` });
    } catch {
      toast({ title: 'Move failed', variant: 'destructive' });
    }
    setMoving(false);
  };

  const doStatus = async () => {
    if (!currentAsset && !countItemStatusAsset) return;
    const target = countItemStatusAsset || currentAsset;
    if (!target || !pickedStatus) return;
    setSavingStatus(true);
    try {
      const r = await fetch(`/api/assets/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pickedStatus }),
      });
      if (!r.ok) throw new Error();
      if (currentAsset?.id === target.id) setCurrentAsset((prev) => (prev ? { ...prev, status: pickedStatus } : prev));
      setCountItemStatusAsset(null);
      setShowStatus(false);
      setPickedStatus('');
      setCountScans((prev) => prev.map((s) => (s.id === target.id ? { ...s, status: pickedStatus } : s)));
      toast({ title: 'Status updated', description: pickedStatus });
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
    setSavingStatus(false);
  };

  const doCountItemMove = useCallback(async (vals: z.infer<typeof transferSchema>) => {
    if (!countItemMoveAsset) return;
    try {
      const r = await fetch(`/api/assets/${countItemMoveAsset.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vals),
      });
      if (!r.ok) throw new Error();
      setCountScans((prev) => prev.map((s) => (s.id === countItemMoveAsset.id ? { ...s, floorNumber: vals.floorNumber, roomNumber: vals.roomNumber } : s)));
      setCountItemMoveAsset(null);
      countItemMoveForm.reset();
      toast({ title: 'Location updated', description: `${vals.floorNumber}, ${vals.roomNumber}` });
    } catch {
      toast({ title: 'Move failed', variant: 'destructive' });
    }
  }, [countItemMoveAsset, countItemMoveForm, toast]);

  const fetchAssetForCountItem = useCallback(async (id: string): Promise<Asset | null> => {
    const r = await fetch(`/api/assets/${id}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.asset ?? null;
  }, []);

  const openCountItemDetails = useCallback(async (item: CountScanItem) => {
    if (item.id.startsWith('raw-')) {
      toast({ title: 'No details', description: 'Unscanned barcode has no asset record.', variant: 'destructive' });
      return;
    }
    setCountItemActionLoading(true);
    setCountItemSwipedId(null);
    try {
      const asset = await fetchAssetForCountItem(item.id);
      if (asset) setCountItemDetailsAsset(asset);
      else toast({ title: 'Could not load asset', variant: 'destructive' });
    } finally {
      setCountItemActionLoading(false);
    }
  }, [fetchAssetForCountItem, toast]);

  const openCountItemStatus = useCallback(async (item: CountScanItem) => {
    if (item.id.startsWith('raw-')) {
      toast({ title: 'No status', description: 'Unscanned barcode has no asset record.', variant: 'destructive' });
      return;
    }
    setCountItemActionLoading(true);
    setCountItemSwipedId(null);
    try {
      const asset = await fetchAssetForCountItem(item.id);
      if (asset) {
        setCountItemStatusAsset(asset);
        setPickedStatus(asset.status || '');
        setShowStatus(true);
      } else toast({ title: 'Could not load asset', variant: 'destructive' });
    } finally {
      setCountItemActionLoading(false);
    }
  }, [fetchAssetForCountItem, toast]);

  const openCountItemMove = useCallback(async (item: CountScanItem) => {
    if (item.id.startsWith('raw-')) {
      toast({ title: 'No location', description: 'Unscanned barcode has no asset record.', variant: 'destructive' });
      return;
    }
    setCountItemActionLoading(true);
    setCountItemSwipedId(null);
    try {
      const asset = await fetchAssetForCountItem(item.id);
      if (asset) {
        setCountItemMoveAsset(asset);
        countItemMoveForm.reset({ floorNumber: asset.floorNumber || '', roomNumber: asset.roomNumber || '' });
      } else toast({ title: 'Could not load asset', variant: 'destructive' });
    } finally {
      setCountItemActionLoading(false);
    }
  }, [fetchAssetForCountItem, countItemMoveForm, toast]);

  const submitAddAsset = useCallback(async (vals: z.infer<typeof addAssetSchema>) => {
    setAddAssetLoading(true);
    try {
      let imageUrl: string | null = null;
      const file = addAssetImageInputRef.current?.files?.[0];
      if (file) {
        const formData = new FormData();
        formData.append('image', file);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        if (uploadRes.ok) {
          const up = await uploadRes.json();
          imageUrl = up?.url ?? null;
        }
      }
      const body: Record<string, unknown> = {
        name: vals.name,
        type: vals.type,
        description: vals.description || undefined,
        vendorId: vals.vendorId || undefined,
        floorNumber: vals.floorNumber || undefined,
        roomNumber: vals.roomNumber || undefined,
        purchaseAmount: vals.purchaseAmount || undefined,
        purchaseDate: vals.purchaseDate || undefined,
        imageUrl: imageUrl ?? undefined,
        batchNumber: vals.batchNumber || undefined,
        serialNumber: vals.serialNumber || undefined,
        donorName: vals.donorName || undefined,
        nextServiceDate: vals.nextServiceDate || undefined,
        isProvisional: vals.isProvisional ?? undefined,
      };
      if (geoLat != null && geoLng != null) {
        body.latitude = geoLat;
        body.longitude = geoLng;
      }
      const r = await fetch('/api/assets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Create failed');
      }
      const data = await r.json();
      const created = data?.asset ?? data;
      setCurrentAsset(created);
      setShowAddAssetDialog(false);
      setAddAssetImagePreview(null);
      addAssetForm.reset({
        name: '',
        type: 'FURNITURE',
        description: '',
        vendorId: '',
        floorNumber: '',
        roomNumber: '',
        purchaseAmount: '',
        purchaseDate: '',
        batchNumber: '',
        serialNumber: '',
        donorName: '',
        nextServiceDate: '',
        isProvisional: false,
      });
      if (addAssetImageInputRef.current) addAssetImageInputRef.current.value = '';
      pushRecentAction('create', `Created asset: ${created.name}`);
      toast({ title: 'Asset created', description: created.assetId || created.name });
    } catch (err) {
      toast({ title: 'Create failed', variant: 'destructive', description: err instanceof Error ? err.message : undefined });
    } finally {
      setAddAssetLoading(false);
    }
  }, [addAssetForm, geoLat, geoLng, pushRecentAction, toast]);

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
      const rawDesc = (vals.description || '').trim();
      const description = rawDesc.length >= 10 ? rawDesc : (rawDesc ? `${rawDesc} — reported from handheld` : 'Reported from handheld (no additional details).');
      const body: any = { title: vals.title, description, priority: vals.priority };
      if (vals.missionName?.trim()) body.missionName = vals.missionName.trim();
      if (vals.resolveBy) body.resolveBy = vals.resolveBy;
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
        if (status === 'completed') {
          setSessionTasksCount((s) => s + 1);
          pushRecentAction('task', 'Task completed');
        }
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

  const exportAuditList = useCallback(() => {
    if (auditScans.length === 0) {
      toast({ title: 'No items to export', variant: 'destructive' });
      return;
    }
    const rows = auditScans.map((item, i) => {
      const food = item && typeof item === 'object' && (item as any).type === 'food' ? (item as any).supply : null;
      const ticket = item && typeof item === 'object' && (item as any).type === 'ticket' ? (item as any).ticket : null;
      const asset = !food && !ticket && typeof item === 'object' && item ? (item as any) : null;
      if (food) {
        const kitchens = (food.kitchensWithSupply && food.kitchensWithSupply.length)
          ? food.kitchensWithSupply.map((k: { name: string }) => k.name).join('; ')
          : (food.kitchenName || '—');
        return [i + 1, food.name, 'Food supply', food.id, `${food.quantity} ${food.unit}`, kitchens, '—', '—'];
      }
      if (ticket) {
        return [i + 1, ticket.title || 'Ticket', 'Ticket', ticket.displayId || ticket.id, (ticket.status || '').toLowerCase(), '—', '—', '—'];
      }
      if (!asset?.id) return [];
      const loc = [asset.floorNumber, asset.roomNumber].filter(Boolean).join(', ') || '—';
      const rfid = asset.rfidTag?.lastZone ? [asset.rfidTag.lastZone.name, asset.rfidTag.lastZone.floorNumber, asset.rfidTag.lastZone.roomNumber].filter(Boolean).join(', ') : '—';
      return [i + 1, asset.name, 'Asset', asset.assetId || asset.barcode || '', 'Qty 1', loc, asset.assignedToName || '—', rfid];
    });
    const header = ['#', 'Name', 'Type', 'ID/Barcode', 'Qty/Location', 'Kitchens/Location', 'Assigned to', 'RFID location'];
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Audit exported' });
  }, [auditScans, toast]);

  const openAuditAssetDetails = useCallback(async (assetId: string) => {
    setAuditDetailsLoading(true);
    setSelectedAuditAssetForDetails(null);
    try {
      const r = await fetch(`/api/assets/${assetId}`, { credentials: 'include', cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        setSelectedAuditAssetForDetails(data?.asset ?? data);
      } else {
        toast({ title: 'Could not load asset details', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to load asset', variant: 'destructive' });
    } finally {
      setAuditDetailsLoading(false);
    }
  }, [toast]);

  const openAuditFoodDetails = useCallback((supply: any) => {
    setSelectedAuditFoodSupply(supply);
    setAuditFoodConsumption([]);
    if (supply?.id) {
      setAuditFoodConsumptionLoading(true);
      fetch(`/api/food-supply/consumption-history?foodSupplyId=${encodeURIComponent(supply.id)}`, { credentials: 'include' })
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setAuditFoodConsumption(Array.isArray(data) ? data : []))
        .catch(() => setAuditFoodConsumption([]))
        .finally(() => setAuditFoodConsumptionLoading(false));
    }
  }, []);

  const openAuditTicketDetails = useCallback((ticket: any) => {
    setSelectedTicketDetail(ticket);
    if (ticket?.id) fetchTicketDetail(ticket.id);
  }, [fetchTicketDetail]);

  const submitAuditComment = useCallback(async () => {
    if (!auditCommentAsset || !auditCommentText.trim()) {
      toast({ title: 'Comment required', variant: 'destructive' });
      return;
    }
    setAuditCommentSubmitting(true);
    try {
      let imageUrl: string | null = null;
      const file = auditCommentImageInputRef.current?.files?.[0];
      if (file) {
        const formData = new FormData();
        formData.append('image', file);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        if (uploadRes.ok) {
          const up = await uploadRes.json();
          imageUrl = up?.url ?? null;
        }
      }
      const r = await fetch(`/api/assets/${auditCommentAsset.id}/audit-comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: auditCommentText.trim(), imageUrl: imageUrl ?? undefined }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Failed to add comment');
      }
      toast({ title: 'Comment added', description: 'Saved to asset history and reports.' });
      setAuditCommentAsset(null);
      setAuditCommentText('');
      setAuditCommentImagePreview(null);
      if (auditCommentImageInputRef.current) auditCommentImageInputRef.current.value = '';
    } catch (err) {
      toast({ title: 'Failed to add comment', variant: 'destructive', description: err instanceof Error ? err.message : undefined });
    } finally {
      setAuditCommentSubmitting(false);
    }
  }, [auditCommentAsset, auditCommentText, toast]);

  const processOfflineQueue = useCallback(async () => {
    const q = getQueue();
    if (q.length === 0) return;
    const remaining: { type: string; payload: any }[] = [];
    for (const item of q) {
      if (item.type === 'move' && item.payload?.assetId) {
        try {
          const r = await fetch(`/api/assets/${item.payload.assetId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ floorNumber: item.payload.floorNumber, roomNumber: item.payload.roomNumber }),
          });
          if (r.ok) {
            pushRecentAction('move', `Synced: moved to ${item.payload.floorNumber}, ${item.payload.roomNumber}`);
          } else {
            remaining.push(item);
          }
        } catch {
          remaining.push(item);
        }
      } else {
        remaining.push(item);
      }
    }
    setQueue(remaining);
    if (remaining.length < q.length) toast({ title: 'Offline queue synced', description: `${q.length - remaining.length} action(s) applied.` });
  }, [getQueue, setQueue, pushRecentAction, toast]);

  const handleSyncNow = useCallback(async () => {
    setLastSyncTime(Date.now());
    try {
      if (isOnline) await processOfflineQueue();
      await Promise.all([fetchAssignedTickets(), fetchAssignedTasks()]);
      toast({ title: 'Synced', description: offlineQueueLength > 0 ? 'Queue replayed, tickets and tasks refreshed.' : 'Tickets and tasks refreshed.' });
    } catch {
      toast({ title: 'Sync failed', variant: 'destructive' });
    }
  }, [fetchAssignedTickets, fetchAssignedTasks, toast, isOnline, processOfflineQueue, offlineQueueLength]);

  const startCountSession = useCallback(() => {
    setCountSessionActive(true);
    setCountStartTime(Date.now());
    setCountScans([]);
    setReconciliationResult(null);
  }, []);

  const runReconciliation = useCallback(async () => {
    setReconciliationLoading(true);
    setReconciliationResult(null);
    try {
      const res = await fetch('/api/assets?limit=5000', { credentials: 'include', cache: 'no-store' });
      const list: { id: string; name?: string; barcode?: string; assetId?: string }[] = res.ok ? await res.json() : [];
      const expectedIds = new Set(list.map((a) => a.id));
      const expectedByBarcode = new Map(list.map((a) => [((a.barcode || a.assetId || '') as string).toLowerCase(), a]));
      const scannedIds = new Set<string>();
      const scannedRaw = new Map<string, { id: string; name: string; barcode?: string }>();
      countScans.forEach((s) => {
        const key = s.id.startsWith('raw-') ? (s.barcode || s.name || s.id).toLowerCase() : s.id;
        if (!s.id.startsWith('raw-')) scannedIds.add(s.id);
        if (!scannedRaw.has(key)) scannedRaw.set(key, s);
      });
      const actualUnique = scannedRaw.size;
      const missing = list.filter((a) => !scannedIds.has(a.id) && !scannedRaw.has((a.barcode || a.assetId || '').toLowerCase()));
      const extra = Array.from(scannedRaw.values()).filter((s) => s.id.startsWith('raw-') || !expectedIds.has(s.id));
      setReconciliationResult({
        expectedCount: list.length,
        actualCount: actualUnique,
        missing: missing.slice(0, 50).map((a) => ({ id: a.id, name: a.name || a.assetId || a.id, barcode: a.barcode })),
        extra: extra.slice(0, 50).map((s) => ({ id: s.id, name: s.name, barcode: s.barcode })),
        submittedForReview: false,
      });
      toast({ title: 'Reconciliation complete', description: `Expected ${list.length}, counted ${actualUnique}. ${missing.length} missing, ${extra.length} extra.` });
    } catch {
      toast({ title: 'Reconciliation failed', variant: 'destructive' });
    } finally {
      setReconciliationLoading(false);
    }
  }, [countScans, toast]);

  const submitCountForReview = useCallback(() => {
    setReconciliationResult((prev) =>
      prev ? { ...prev, submittedForReview: true, reasonCode: countReviewReason, note: countReviewNote, submittedAt: Date.now() } : null
    );
    setCountReviewReason('');
    setCountReviewNote('');
    toast({ title: 'Submitted for review', description: 'A manager or admin can review the count and discrepancies.' });
  }, [toast, countReviewReason, countReviewNote]);

  const endCountSession = useCallback(() => {
    const total = countScans.length;
    pushRecentAction('count', `Count session: ${total} item${total !== 1 ? 's' : ''} (${countLocationLabel.trim() || 'All'})`);
    setCountSessionActive(false);
    toast({ title: 'Count ended', description: `${total} item${total !== 1 ? 's' : ''} counted.` });
  }, [countScans.length, countLocationLabel, pushRecentAction, toast]);

  const exportCountReport = useCallback(() => {
    if (countScans.length === 0) {
      toast({ title: 'Nothing to export', description: 'Run a count session first.', variant: 'destructive' });
      return;
    }
    const headers = ['Location', 'Asset ID', 'Barcode', 'Name'];
    const locationLabel = countLocationLabel.trim() || 'All';
    const rows = countScans.map((s) => [locationLabel, s.id, s.barcode ?? '', s.name ?? '']);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-count-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Count report exported' });
  }, [countScans, toast]);

  const toggleCountVoice = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      toast({ title: 'Voice input not supported', variant: 'destructive' });
      return;
    }
    if (countVoiceListening) {
      try {
        countSpeechRecognitionRef.current?.stop();
      } catch {}
      countSpeechRecognitionRef.current = null;
      setCountVoiceListening(false);
      return;
    }
    try {
      const rec = new SpeechRecognitionAPI();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      rec.onresult = (e: SpeechRecognitionEvent) => {
        const t = e.results?.[0]?.[0]?.transcript?.trim();
        if (t && countBarcodeInputRef.current) {
          countBarcodeInputRef.current.value = t;
          countBarcodeInputRef.current.focus();
        }
      };
      rec.onend = () => { setCountVoiceListening(false); countSpeechRecognitionRef.current = null; };
      rec.onerror = () => { setCountVoiceListening(false); countSpeechRecognitionRef.current = null; };
      countSpeechRecognitionRef.current = rec;
      rec.start();
      setCountVoiceListening(true);
    } catch (err) {
      toast({ title: 'Voice start failed', variant: 'destructive' });
      setCountVoiceListening(false);
    }
  }, [countVoiceListening, toast]);

  const addToCount = useCallback(async (code: string) => {
    const q = code.trim();
    if (!q) return;
    setSessionScansCount((s) => s + 1);
    try {
      const res = await fetch(`/api/assets/scan?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.asset?.id) {
          const a = data.asset;
          setCountScans((prev) => [...prev, {
            id: a.id,
            barcode: a.barcode || q,
            name: a.name || a.assetId || 'Unknown',
            imageUrl: a.imageUrl,
            status: a.status,
            floorNumber: a.floorNumber,
            roomNumber: a.roomNumber,
          }]);
          toast({ title: 'Added to count', description: a.name });
          return;
        }
      }
      setCountScans((prev) => [...prev, { id: `raw-${Date.now()}`, barcode: q, name: q }]);
      toast({ title: 'Added to count', description: q });
    } catch {
      setSessionScansCount((s) => Math.max(0, s - 1));
      toast({ title: 'Lookup failed', variant: 'destructive' });
    }
  }, [toast]);

  const searchLocateAssets = useCallback(async () => {
    const q = locateQuery.trim();
    if (!q) {
      setLocateResults([]);
      setLocateSearchFocused(null);
      return;
    }
    setLocateSearching(true);
    setLocateSearchFocused(q);
    try {
      const res = await fetch(`/api/assets/scan?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.asset) {
          setLocateResults([data.asset]);
          setLocateSearchFocused(null);
        } else {
          setLocateResults([]);
        }
      } else {
        setLocateResults([]);
        if (res.status === 404) {
          toast({ title: 'Asset not found', description: `No asset matching "${q}". Try barcode, asset ID, or name.`, variant: 'destructive' });
        } else {
          toast({ title: 'Search failed', variant: 'destructive' });
        }
      }
    } catch {
      setLocateResults([]);
      toast({ title: 'Search failed', variant: 'destructive' });
    } finally {
      setLocateSearching(false);
    }
  }, [locateQuery, toast]);

  const startLocate = useCallback(() => {
    if (!locateTarget) return;
    setLocateActive(true);
    setLocateProximity(0);
  }, [locateTarget]);

  const stopLocate = useCallback(() => {
    setLocateActive(false);
  }, []);

  // Locate beep: faster beep as proximity increases (0–100)
  useEffect(() => {
    if (!locateActive || locateProximity >= 100) return;
    let intervalId: ReturnType<typeof setInterval>;
    const beep = () => {
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        if (!locateAudioContextRef.current) locateAudioContextRef.current = new Ctx();
        const ctx = locateAudioContextRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.value = 0.12;
        osc.frequency.value = 600 + locateProximity * 6;
        osc.start(0);
        osc.stop(ctx.currentTime + 0.08);
      } catch { /* no audio */ }
    };
    const intervalMs = Math.max(100, 900 - locateProximity * 8);
    intervalId = setInterval(beep, intervalMs);
    return () => clearInterval(intervalId);
  }, [locateActive, locateProximity]);

  return (
    <HandheldLayout
      title="Field Assistant"
      subtitle={TAB_SUBTITLE[tab]}
      lastSyncTime={lastSyncTime}
      onSyncNow={handleSyncNow}
    >
      {/* Tab content — extra bottom padding for floating nav + FAB */}
      <div
        className={cn(
          'flex-1 overflow-auto p-4 pb-40 min-h-0 max-w-2xl mx-auto w-full',
          largeTextMode && 'text-base [&_input]:text-base [&_button]:text-base'
        )}
      >
        {tab === 'scan' && (
          <div className="max-w-lg mx-auto space-y-5">
            <HandheldSessionStrip
              scans={sessionScansCount}
              tasks={sessionTasksCount}
              hint={typeof navigator !== 'undefined' && navigator.onLine ? 'Tap + for shortcuts' : 'Offline — actions queue until sync'}
            />
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-md overflow-hidden">
              <HandheldAssetScanner standalone onAssetSelected={setCurrentAsset} />
            </div>
          </div>
        )}

        {tab === 'asset' && (
          <div className="max-w-lg mx-auto space-y-4">
            {!currentAsset ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 p-8 text-center shadow-sm">
                <div className="h-16 w-16 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
                  <Package className="h-8 w-8 text-slate-500 dark:text-slate-400" />
                </div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">No asset selected</p>
                <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">Scan an asset or register a new one.</p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                  <Button size="lg" className="rounded-xl h-12" onClick={() => setTab('scan')}>
                    <Scan className="h-4 w-4 mr-2" />
                    Scan asset
                  </Button>
                  <Button size="lg" variant="outline" className="rounded-xl h-12" onClick={() => setShowAddAssetDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add new asset
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 shadow-md">
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
                <Button size="lg" variant="outline" className="w-full h-12 gap-2" onClick={() => setShowAddAssetDialog(true)}>
                  <Plus className="h-4 w-4" />
                  Add new asset
                </Button>
              </>
            )}
          </div>
        )}

        {tab === 'work' && (
          <div className="max-w-lg mx-auto space-y-4">
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
              <button type="button" onClick={() => setWorkMode('tickets')} className={cn('flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all touch-manipulation', workMode === 'tickets' ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400')}>
                <Ticket className="h-4 w-4 inline mr-1.5 align-middle" /> Tickets
              </button>
              <button type="button" onClick={() => setWorkMode('tasks')} className={cn('flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all touch-manipulation', workMode === 'tasks' ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400')}>
                <ListTodo className="h-4 w-4 inline mr-1.5 align-middle" /> Tasks
              </button>
            </div>
            {workMode === 'tickets' && (
          <div className="space-y-4">
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
            {workMode === 'tasks' && (
          <div className="space-y-4">
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
          </div>
        )}

        {tab === 'inventory' && (
          <div className="max-w-lg mx-auto space-y-4">
            <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button type="button" onClick={() => setInventoryMode('count')} className={cn('flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all', inventoryMode === 'count' ? 'bg-white dark:bg-slate-700 shadow text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400')}>
                <Hash className="h-4 w-4 inline mr-1.5 align-middle" /> Count
              </button>
              <button type="button" onClick={() => setInventoryMode('audit')} className={cn('flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all', inventoryMode === 'audit' ? 'bg-white dark:bg-slate-700 shadow text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400')}>
                <ClipboardList className="h-4 w-4 inline mr-1.5 align-middle" /> Audit
              </button>
            </div>
            {inventoryMode === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Inventory audit</h2>
                <p className="text-sm text-slate-500 mt-0.5">Scan assets to verify location &amp; assignment.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30 px-3 py-1.5 text-sm font-semibold text-violet-800 dark:text-violet-200">
                  <ClipboardList className="h-4 w-4" /> {auditScans.length} item{auditScans.length !== 1 ? 's' : ''}
                </span>
                {auditScans.length > 0 && (
                  <>
                    <select
                      value={auditSort}
                      onChange={(e) => setAuditSort(e.target.value as 'scan' | 'name' | 'location')}
                      className="h-9 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2"
                    >
                      <option value="scan">Scan order</option>
                      <option value="name">Name A–Z</option>
                      <option value="location">Location</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={exportAuditList} className="gap-1">
                      <Download className="h-3.5 w-3.5" /> Export
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setAuditScans([])}>Clear all</Button>
                  </>
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
                [...auditScans]
                  .sort((a, b) => {
                    const foodA = a && typeof a === 'object' && (a as any).type === 'food' ? (a as any).supply : null;
                    const foodB = b && typeof b === 'object' && (b as any).type === 'food' ? (b as any).supply : null;
                    const ticketA = a && typeof a === 'object' && (a as any).type === 'ticket' ? (a as any).ticket : null;
                    const ticketB = b && typeof b === 'object' && (b as any).type === 'ticket' ? (b as any).ticket : null;
                    const ax = foodA || ticketA || (typeof a === 'string' ? null : (a as any));
                    const bx = foodB || ticketB || (typeof b === 'string' ? null : (b as any));
                    if (!ax || !bx) return 0;
                    const nameA = foodA ? foodA.name : (ticketA ? (ticketA.title || ticketA.displayId || '') : (ax.name || ''));
                    const nameB = foodB ? foodB.name : (ticketB ? (ticketB.title || ticketB.displayId || '') : (bx.name || ''));
                    if (auditSort === 'name') return nameA.localeCompare(nameB);
                    if (auditSort === 'location') {
                      const locA = foodA
                        ? ((foodA.kitchensWithSupply && foodA.kitchensWithSupply.length) ? foodA.kitchensWithSupply.map((k: { name: string }) => k.name).join(' ') : foodA.kitchenName || '')
                        : ticketA ? (ticketA.status || '') : [ax.floorNumber, ax.roomNumber].filter(Boolean).join(' ');
                      const locB = foodB
                        ? ((foodB.kitchensWithSupply && foodB.kitchensWithSupply.length) ? foodB.kitchensWithSupply.map((k: { name: string }) => k.name).join(' ') : foodB.kitchenName || '')
                        : ticketB ? (ticketB.status || '') : [bx.floorNumber, bx.roomNumber].filter(Boolean).join(' ');
                      return locA.localeCompare(locB);
                    }
                    return 0;
                  })
                  .map((item, i) => {
                  const isFood = item && typeof item === 'object' && (item as any).type === 'food';
                  const isTicket = item && typeof item === 'object' && (item as any).type === 'ticket';
                  const supply = isFood ? (item as any).supply : null;
                  const ticket = isTicket ? (item as any).ticket : null;
                  const asset = !isFood && !isTicket && typeof item === 'string' ? null : !isFood && !isTicket ? (item as any) : null;

                  if (supply?.id) {
                    const kitchensList = (supply.kitchensWithSupply && supply.kitchensWithSupply.length)
                      ? supply.kitchensWithSupply.map((k: { name: string }) => k.name).join(', ')
                      : supply.kitchenName || '—';
                    const expDate = supply.expirationDate ? new Date(supply.expirationDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                    return (
                      <div
                        key={`food-${supply.id}-${i}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openAuditFoodDetails(supply)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAuditFoodDetails(supply); } }}
                        className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 shadow-sm overflow-hidden cursor-pointer active:scale-[0.99] transition-transform touch-manipulation hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-md"
                      >
                        <div className="flex gap-4 p-4">
                          <div className="h-20 w-20 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex-shrink-0 flex items-center justify-center">
                            <UtensilsCrossed className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">{supply.name}</p>
                              <span className="rounded-lg bg-amber-200/80 dark:bg-amber-800/50 text-xs font-bold text-amber-800 dark:text-amber-200 px-2 py-0.5 shrink-0">
                                {supply.quantity} {supply.unit}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Food supply</p>
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 font-medium">Expires: {expDate}</p>
                          </div>
                        </div>
                        <div className="px-4 pb-4 grid gap-2">
                          <div className="flex items-center gap-2 text-xs">
                            <MapPin className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            <span className="text-slate-600 dark:text-slate-300">Kitchens: {kitchensList}</span>
                          </div>
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Tap for full details</p>
                        </div>
                      </div>
                    );
                  }

                  if (ticket?.id) {
                    const status = (ticket.status || 'open').toLowerCase().replace('_', ' ');
                    return (
                      <div
                        key={`ticket-${ticket.id}-${i}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openAuditTicketDetails(ticket)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAuditTicketDetails(ticket); } }}
                        className="rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-900/10 shadow-sm overflow-hidden cursor-pointer active:scale-[0.99] transition-transform touch-manipulation hover:border-sky-400 dark:hover:border-sky-600 hover:shadow-md"
                      >
                        <div className="flex gap-4 p-4">
                          <div className="h-20 w-20 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex-shrink-0 flex items-center justify-center">
                            <Ticket className="h-8 w-8 text-sky-600 dark:text-sky-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">{ticket.title || 'Ticket'}</p>
                              <span className="rounded-lg bg-sky-200/80 dark:bg-sky-800/50 text-xs font-bold text-sky-800 dark:text-sky-200 px-2 py-0.5 shrink-0 capitalize">
                                {status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ticket.displayId || ticket.id}</p>
                            <p className="text-[10px] text-sky-600 dark:text-sky-400 mt-2 font-medium">Tap for full details</p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (!asset?.id) return null;
                  const loc = [asset.floorNumber, asset.roomNumber].filter(Boolean).join(', ') || '—';
                  const rfidZone = asset.rfidTag?.lastZone;
                  const rfidLoc = rfidZone ? [rfidZone.name, rfidZone.floorNumber, rfidZone.roomNumber].filter(Boolean).join(', ') : null;
                  return (
                    <div
                      key={`${asset.id}-${i}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => !auditDetailsLoading && openAuditAssetDetails(asset.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAuditAssetDetails(asset.id); } }}
                      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden cursor-pointer active:scale-[0.99] transition-transform touch-manipulation hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-md"
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
                          <p className="text-[10px] text-violet-600 dark:text-violet-400 mt-2 font-medium">Tap for full details</p>
                        </div>
                      </div>
                      <div className="px-4 pb-4 grid gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setAuditCommentAsset({ id: asset.id, name: asset.name }); setAuditCommentText(''); setAuditCommentImagePreview(null); if (auditCommentImageInputRef.current) auditCommentImageInputRef.current.value = ''; }}
                          className="flex items-center gap-2 text-xs text-left w-full rounded-lg py-2 px-3 -mx-1 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 active:scale-[0.98] transition-transform touch-manipulation"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          <span>Add comment / photo</span>
                        </button>
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
                        {rfidLoc ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setAuditRfidMapAsset(asset); }}
                            className="flex items-center gap-2 text-xs text-left w-full rounded-lg py-2 px-3 -mx-1 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 active:scale-[0.98] transition-transform touch-manipulation"
                          >
                            <Radio className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                            <span>RFID: {rfidLoc}</span>
                            <span className="ml-auto text-[10px] font-semibold">View on map →</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Radio className="h-3.5 w-3.5 shrink-0" />
                            <span>No RFID location</span>
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
            {inventoryMode === 'count' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Hash className="h-5 w-5" /> Fast count
            </h2>
            {!countSessionActive ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">Start a count session to scan assets. Get running total, scans per minute, and export for multi-location inventory.</p>
                <Input placeholder="Location (optional, e.g. Aisle 3, Store A)" value={countLocationLabel} onChange={(e) => setCountLocationLabel(e.target.value)} className="rounded-xl" />
                <Button size="lg" className="w-full h-12 rounded-xl" onClick={startCountSession}>
                  <Hash className="h-5 w-5 mr-2" /> Start count
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-3xl font-bold text-violet-700 dark:text-violet-200">{countScans.length}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">items counted</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                        {countStartTime ? Math.round(countScans.length / ((Date.now() - countStartTime) / 60000)) : 0}
                      </p>
                      <p className="text-xs text-slate-500">per minute</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 flex gap-2">
                    <Input
                      ref={countBarcodeInputRef}
                      placeholder="Barcode or Asset ID"
                      className="rounded-xl flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = (e.target as HTMLInputElement).value?.trim();
                          if (v) { addToCount(v); (e.target as HTMLInputElement).value = ''; }
                        }
                      }}
                    />
                    <Button size="icon" className="h-11 w-11 rounded-xl shrink-0" onClick={() => { const el = countBarcodeInputRef.current; if (el?.value?.trim()) { addToCount(el.value.trim()); el.value = ''; } }}>
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                  <Button variant="outline" size="icon" className={cn('h-11 w-11 rounded-xl shrink-0', countVoiceListening && 'bg-red-100 dark:bg-red-900/30')} onClick={toggleCountVoice} aria-label="Voice input">
                    <Mic className="h-5 w-5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0" onClick={() => setShowCountScanner(true)} aria-label="Open scanner">
                    <Scan className="h-5 w-5" />
                  </Button>
                </div>
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-lg p-4 max-h-[420px] overflow-y-auto">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Count list</p>
                    {countScans.length > 0 && !countSwipeHintDismissed && (
                      <span className="handheld-swipe-hint inline-flex items-center gap-1.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                        <ChevronRight className="h-3.5 w-3.5 rotate-180" aria-hidden />
                        Swipe left for actions
                      </span>
                    )}
                  </div>
                  {countScans.length === 0 ? (
                    <div className="py-8 text-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600">
                      <Package className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-500 mb-2" />
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Scan or enter barcode to add</p>
                    </div>
                  ) : (
                    <ul className="space-y-2.5">
                      {countScans.slice(-50).reverse().map((s, i) => {
                        const rowId = `${s.id}-${i}`;
                        const isDragging = countSwipeStartRef.current?.id === rowId;
                        const isOpen = countItemSwipedId === rowId;
                        const translateX = isDragging ? countSwipeOffset : isOpen ? -136 : 0;
                        const ACTION_WIDTH = 136;
                        const showSwipeHint = !countSwipeHintDismissed;
                        const statusColor = (st: string) => {
                          const v = (st || '').toUpperCase();
                          if (v === 'ACTIVE') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30';
                          if (v === 'MAINTENANCE') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30';
                          if (v === 'DISPOSED') return 'bg-slate-400/15 text-slate-600 dark:text-slate-400 border-slate-400/30';
                          return 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-400/20';
                        };
                        return (
                          <li
                            key={rowId}
                            className="relative rounded-2xl overflow-hidden touch-manipulation shadow-sm border border-slate-200/80 dark:border-slate-600/80"
                            style={{ minHeight: 80 }}
                          >
                            {/* Action strip: behind the sliding content; subtle fade-in when revealed */}
                            <div className={cn(
                              'absolute right-0 top-0 bottom-0 w-[136px] flex items-center justify-end gap-1.5 pr-3 border-l border-slate-200/60 dark:border-slate-600/60 transition-opacity duration-200',
                              (isOpen || (isDragging && countSwipeOffset < -20)) ? 'opacity-100 bg-gradient-to-l from-violet-50/90 to-slate-50 dark:from-violet-950/50 dark:to-slate-800' : 'opacity-100 bg-gradient-to-l from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800'
                            )}>
                              <Button type="button" size="sm" variant="outline" className="h-9 w-9 p-0 rounded-xl border-slate-300 dark:border-slate-600" onClick={() => { openCountItemDetails(s); setCountItemSwipedId(null); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button type="button" size="sm" variant="outline" className="h-9 w-9 p-0 rounded-xl border-slate-300 dark:border-slate-600" onClick={() => { openCountItemStatus(s); setCountItemSwipedId(null); }}>
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <Button type="button" size="sm" variant="outline" className="h-9 w-9 p-0 rounded-xl border-slate-300 dark:border-slate-600" onClick={() => { openCountItemMove(s); setCountItemSwipedId(null); }}>
                                <MapPin className="h-4 w-4" />
                              </Button>
                            </div>
                            {/* Sliding content: full width, sits on top; user swipes left to reveal actions */}
                            <div
                              className={cn(
                                'absolute inset-0 z-10 flex items-center gap-3 px-4 bg-white dark:bg-slate-800 rounded-2xl will-change-transform',
                                isDragging ? 'transition-none' : 'transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]'
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
                                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border', statusColor(s.status))}>
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
                                  <ChevronRight className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                                )}
                              </div>
                              {showSwipeHint && (
                                <div className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none rounded-r-2xl handheld-swipe-shine" aria-hidden />
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={exportCountReport} disabled={countScans.length === 0}>
                    <Download className="h-4 w-4 mr-1" /> Export
                  </Button>
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={endCountSession}>
                    End count session
                  </Button>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-4">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Compare with system</p>
                  <p className="text-xs text-slate-500">Compare your count to current system data. Managers can review discrepancies.</p>
                  <Button variant="outline" className="w-full rounded-xl gap-2" onClick={runReconciliation} disabled={reconciliationLoading || countScans.length === 0}>
                    {reconciliationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                    {reconciliationLoading ? 'Comparing…' : 'Compare actual vs expected'}
                  </Button>
                  {reconciliationResult && (
                    <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3 text-center">
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">{reconciliationResult.expectedCount}</p>
                          <p className="text-xs text-slate-500">Expected (system)</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3 text-center">
                          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{reconciliationResult.actualCount}</p>
                          <p className="text-xs text-slate-500">Actual (counted)</p>
                        </div>
                      </div>
                      {(reconciliationResult.missing.length > 0 || reconciliationResult.extra.length > 0) && (
                        <div className="text-xs space-y-1">
                          {reconciliationResult.missing.length > 0 && (
                            <p className="text-amber-600 dark:text-amber-400 font-medium">Missing from count: {reconciliationResult.missing.length} (in system but not scanned)</p>
                          )}
                          {reconciliationResult.extra.length > 0 && (
                            <p className="text-blue-600 dark:text-blue-400 font-medium">Extra / unknown: {reconciliationResult.extra.length} (scanned but not in system or duplicate)</p>
                          )}
                        </div>
                      )}
                      {!reconciliationResult.submittedForReview ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Variance reason (optional)</label>
                            <select
                              value={countReviewReason}
                              onChange={(e) => setCountReviewReason(e.target.value)}
                              className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-3"
                            >
                              {COUNT_REVIEW_REASONS.map((r) => (
                                <option key={r.value || 'opt'} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Note for reviewer (optional)</label>
                            <Textarea
                              placeholder="e.g. Aisle 3 was blocked during count"
                              value={countReviewNote}
                              onChange={(e) => setCountReviewNote(e.target.value)}
                              className="min-h-[80px] rounded-xl resize-none"
                            />
                          </div>
                          <Button className="w-full rounded-xl gap-2" onClick={submitCountForReview}>
                            <User className="h-4 w-4" /> Submit for manager review
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-sm">
                            <CheckCircle2 className="h-4 w-4 shrink-0" /> Submitted for review
                          </div>
                          {(reconciliationResult.reasonCode || reconciliationResult.note) && (
                            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                              {reconciliationResult.reasonCode && (
                                <p>Reason: {COUNT_REVIEW_REASONS.find((r) => r.value === reconciliationResult.reasonCode)?.label || reconciliationResult.reasonCode}</p>
                              )}
                              {reconciliationResult.note && <p>Note: {reconciliationResult.note}</p>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
            )}
          </div>
        )}

        {tab === 'locate' && (
          <div className="max-w-lg mx-auto space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Crosshair className="h-5 w-5" /> Locate asset
            </h2>
            {!locateActive ? (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300">Search by name or barcode, then start locate for audio/visual feedback as you get closer.</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search by name or barcode"
                    value={locateQuery}
                    onChange={(e) => { setLocateQuery(e.target.value); setLocateSearchFocused(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') searchLocateAssets(); }}
                    className="rounded-xl flex-1"
                  />
                  <Button size="icon" className="h-11 w-11 rounded-xl shrink-0" onClick={searchLocateAssets} disabled={locateSearching}>
                    {locateSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                  </Button>
                </div>
                {locateSearching && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Searching…</p>
                  </div>
                )}
                {!locateSearching && locateResults.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-4 pt-3 pb-2">Result</p>
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                      {locateResults.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => { setLocateTarget(a); setLocateResults([]); setLocateQuery(''); setLocateSearchFocused(null); }}
                          className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 active:bg-slate-100 dark:active:bg-slate-700 transition-colors"
                        >
                          <div className="h-14 w-14 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                            {a.imageUrl ? <img src={a.imageUrl} alt="" className="h-full w-full object-cover" /> : <Package className="h-7 w-7 text-slate-400" />}
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">{a.name}</p>
                            <p className="text-sm text-slate-500 mt-0.5">{a.assetId || a.barcode || a.id}</p>
                            {(a.floorNumber || a.roomNumber) && (
                              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" /> {[a.floorNumber, a.roomNumber].filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!locateSearching && locateResults.length === 0 && locateSearchFocused !== null && (
                  <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20 p-6 text-center">
                    <Search className="h-12 w-12 mx-auto text-amber-500 dark:text-amber-400 mb-3 opacity-80" />
                    <p className="font-medium text-slate-900 dark:text-white">No asset found</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Try barcode, asset ID, or part of the name.</p>
                    <p className="text-xs text-slate-500 mt-2 font-mono">{locateSearchFocused}</p>
                  </div>
                )}
                {locateTarget && (
                  <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10 p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                        {locateTarget.imageUrl ? <img src={locateTarget.imageUrl} alt="" className="h-full w-full object-cover" /> : <Package className="h-6 w-6 text-violet-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{locateTarget.name}</p>
                        <p className="text-xs text-slate-500">{locateTarget.assetId || locateTarget.barcode}</p>
                      </div>
                    </div>
                    <Button size="lg" className="rounded-xl shrink-0" onClick={startLocate}>
                      <Crosshair className="h-5 w-5 mr-2" /> Locate
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-slate-900 text-white p-6 space-y-6">
                <p className="text-center font-medium">Locating: {locateTarget?.name}</p>
                <p className="text-center text-sm text-slate-300">Beep speeds up as you get closer. Simulate proximity below.</p>
                <div className="flex justify-center">
                  <div
                    className={cn(
                      'rounded-full border-4 border-violet-400 transition-all duration-300',
                      locateProximity >= 100 ? 'bg-emerald-500 border-emerald-400 scale-110' : 'bg-violet-600/50'
                    )}
                    style={{ width: 120 + locateProximity * 1.5, height: 120 + locateProximity * 1.5 }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 block">Proximity (simulated)</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={locateProximity}
                    onChange={(e) => setLocateProximity(Number(e.target.value))}
                    className="w-full h-3 rounded-full accent-violet-500"
                  />
                </div>
                <Button variant="secondary" className="w-full rounded-xl" onClick={stopLocate}>
                  Stop locate
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === 'more' && (
          <div className="max-w-lg mx-auto space-y-6">
            <h2 className="text-lg font-semibold">More</h2>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
              {isOnline ? <Wifi className="h-8 w-8 text-emerald-500" /> : <WifiOff className="h-8 w-8 text-amber-500" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium">{isOnline ? 'You are online' : 'You are offline'}</p>
                <p className="text-sm text-slate-500">{isOnline ? 'Data syncs automatically.' : 'Changes will sync when back online.'}</p>
                {lastSyncTime != null && (
                  <p className="text-xs text-slate-400 mt-1">Last sync: {Math.round((Date.now() - lastSyncTime) / 60000)}m ago</p>
                )}
                {offlineQueueLength > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">{offlineQueueLength} action(s) queued for sync</p>
                )}
              </div>
              <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={handleSyncNow}>
                <RefreshCw className="h-4 w-4 mr-1" /> Sync now
              </Button>
            </div>

            <section className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 p-4">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-violet-500" /> This session
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 p-3 text-center">
                  <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{countSessionActive ? countScans.length : sessionScansCount}</p>
                  <p className="text-xs text-slate-500">Scans (count)</p>
                </div>
                <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 p-3 text-center">
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{sessionTasksCount}</p>
                  <p className="text-xs text-slate-500">Tasks completed</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="w-full rounded-xl text-slate-500" onClick={resetSessionStats}>
                New session (reset counters)
              </Button>
            </section>

            <Button variant="outline" className="w-full h-12 rounded-xl gap-2" onClick={() => setShowAddAssetDialog(true)}>
              <Truck className="h-4 w-4" />
              Goods receiving
            </Button>
            <Button variant="outline" className="w-full h-12 rounded-xl gap-2" onClick={() => setShowAddAssetDialog(true)}>
              <Plus className="h-4 w-4" />
              Add new asset
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 rounded-xl gap-2"
              onClick={() => window.open('/reports/audit-print', '_blank', 'noopener,noreferrer')}
            >
              <Download className="h-4 w-4" />
              Export / Donor report
            </Button>

            <section className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Rapid mode</p>
                  <p className="text-xs text-slate-500">Fewer tabs, crisis-style fast scan</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={rapidMode}
                onClick={toggleRapidMode}
                className={cn(
                  'relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2',
                  rapidMode ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'
                )}
              >
                <span className={cn('pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition', rapidMode ? 'translate-x-5' : 'translate-x-1')} />
              </button>
            </section>

            {recentActions.length > 0 && (
              <section className="space-y-2">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <History className="h-4 w-4" /> Recent actions
                </p>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 max-h-40 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-700">
                  {recentActions.slice(0, 10).map((a, i) => (
                    <div key={`${a.at}-${i}`} className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="truncate flex-1">{a.label}</span>
                      <span className="text-xs text-slate-400 shrink-0">{new Date(a.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-2">
                <Type className="h-5 w-5 text-slate-500" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Large text</p>
                  <p className="text-xs text-slate-500">Easier to read in the field</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={largeTextMode}
                onClick={toggleLargeText}
                className={cn(
                  'relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2',
                  largeTextMode ? 'bg-violet-600' : 'bg-slate-200 dark:bg-slate-700'
                )}
              >
                <span className={cn('pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition', largeTextMode ? 'translate-x-5' : 'translate-x-1')} />
              </button>
            </section>

            <section className="space-y-3">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Food supply</p>
              {kitchens.length === 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400 mb-1" />
                  <p className="text-sm text-slate-500">Loading kitchens…</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {kitchens.length > 1 && (
                    <select
                      value={foodKitchenId}
                      onChange={(e) => setFoodKitchenId(e.target.value)}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    >
                      {kitchens.map((k) => (
                        <option key={k.id} value={k.id}>{k.name}</option>
                      ))}
                    </select>
                  )}
                  <Button
                    type="button"
                    size="lg"
                    className="w-full h-12 gap-2 rounded-xl"
                    onClick={() => { setFoodScannerKey((k) => k + 1); setShowFoodScanner(true); }}
                    disabled={!foodKitchenId}
                  >
                    <ScanLine className="h-5 w-5" />
                    Scan food / Record consumption
                  </Button>
                </div>
              )}
            </section>
            {foodKitchenId && (
              <EnhancedBarcodeScanner
                key={foodScannerKey}
                kitchenId={foodKitchenId}
                open={showFoodScanner}
                onOpenChange={setShowFoodScanner}
                onScanComplete={() => setShowFoodScanner(false)}
              />
            )}

            <section className="space-y-3">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Reports &amp; tags</p>
              <div className="grid gap-2">
                <Button variant="outline" className="w-full justify-start gap-2 rounded-xl h-12" onClick={exportCountReport} disabled={countScans.length === 0}>
                  <Download className="h-4 w-4" />
                  Export count report {countScans.length > 0 && `(${countScans.length})`}
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2 rounded-xl h-12" onClick={() => { setPrintTagAsset(currentAsset); setShowPrintTagDialog(true); }}>
                  <Printer className="h-4 w-4" />
                  Print / encode RFID tag
                </Button>
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Batch move</p>
              <div className="grid gap-2">
                {currentAsset && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 rounded-xl h-12"
                    onClick={() => {
                      if (currentAsset && !batchMoveIds.includes(currentAsset.id)) {
                        setBatchMoveIds((prev) => [...prev, currentAsset.id]);
                        toast({ title: 'Added to batch', description: currentAsset.name });
                      }
                    }}
                    disabled={batchMoveIds.includes(currentAsset.id)}
                  >
                    <Package className="h-4 w-4" />
                    Add current asset to batch {batchMoveIds.length > 0 && `(${batchMoveIds.length})`}
                  </Button>
                )}
                {batchMoveIds.length > 0 && (
                  <>
                    <p className="text-xs text-slate-500">{batchMoveIds.length} asset(s) selected</p>
                    <Button className="w-full rounded-xl gap-2 h-12" onClick={() => setShowBatchMoveDialog(true)}>
                      <MapPin className="h-4 w-4" /> Move all to location
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full rounded-xl" onClick={() => setBatchMoveIds([])}>Clear batch</Button>
                  </>
                )}
              </div>
            </section>

            {currentAsset && (
              <section className="space-y-2">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Current asset</p>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 rounded-xl h-12"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                >
                  {photoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {photoUploading ? 'Uploading…' : 'Add photo / document'}
                </Button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !currentAsset) return;
                    e.target.value = '';
                    setPhotoUploading(true);
                    try {
                      const form = new FormData();
                      form.append('assetId', currentAsset.id);
                      form.append('document', file);
                      const r = await fetch('/api/assets/documents/upload', { method: 'POST', body: form, credentials: 'include' });
                      if (!r.ok) {
                        const err = await r.json().catch(() => ({}));
                        throw new Error(err.message || 'Upload failed');
                      }
                      toast({ title: 'Photo added', description: 'Document attached to asset.' });
                      pushRecentAction('photo', `Added photo to ${currentAsset.name}`);
                    } catch (err) {
                      toast({ title: 'Upload failed', variant: 'destructive', description: err instanceof Error ? err.message : undefined });
                    } finally {
                      setPhotoUploading(false);
                    }
                  }}
                />
              </section>
            )}

            <section className="space-y-3">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Shortcuts</p>
              <div className="grid gap-2">
                <button type="button" onClick={() => { setTab('inventory'); setInventoryMode('count'); }} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-[0.99] transition-all">
                  <div className="h-11 w-11 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0"><Hash className="h-5 w-5 text-violet-600 dark:text-violet-400" /></div>
                  <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900 dark:text-white">Fast count</p><p className="text-xs text-slate-500">Running total &amp; scan rate</p></div>
                  <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                </button>
                <button type="button" onClick={() => { setTab('inventory'); setInventoryMode('audit'); }} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-[0.99] transition-all">
                  <div className="h-11 w-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0"><ClipboardList className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div>
                  <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900 dark:text-white">Inventory audit</p><p className="text-xs text-slate-500">Verify location &amp; export</p></div>
                  <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                </button>
                <button type="button" onClick={() => setTab('locate')} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-[0.99] transition-all">
                  <div className="h-11 w-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0"><Crosshair className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /></div>
                  <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900 dark:text-white">Locate asset</p><p className="text-xs text-slate-500">Beep speeds up as you get closer</p></div>
                  <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                </button>
              </div>
            </section>
            <p className="text-xs text-slate-500">RFID-style handheld: scan, count, locate, audit, sync with backend. Print/encode tags via connected printer.</p>
          </div>
        )}
      </div>

      <HandheldTabNav
        tab={tab}
        onChange={setTab}
        counts={{
          work: assignedTickets.length + assignedTasks.length,
          count: countSessionActive ? countScans.length : 0,
          scan: sessionScansCount,
        }}
      />

      <HandheldFloatingCommandBar
        onScan={() => setTab('scan')}
        onAddAsset={() => setShowAddAssetDialog(true)}
        onGoodsReceiving={() => setShowAddAssetDialog(true)}
        onAudit={() => {
          setTab('inventory');
          setInventoryMode('audit');
        }}
        onLocate={() => setTab('locate')}
        onWork={() => {
          setTab('work');
          setWorkMode('tickets');
        }}
        onSync={() => void handleSyncNow()}
        onCreateTicket={() => setShowCreateTicket(true)}
        canCreateTicket={!!currentAsset}
      />

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

      {/* Print / encode RFID tag: request sent to system; actual printing via external RFID printer */}
      <Dialog open={showPrintTagDialog} onOpenChange={setShowPrintTagDialog}>
        <DialogContent className="max-w-lg rounded-2xl" onPointerDownOutside={preventHandheldDialogOutsideClose} onInteractOutside={preventHandheldDialogOutsideClose}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-violet-500" />
              Print / encode asset tag
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The handheld does not print directly. Add this asset to the print queue; a connected RFID printer (e.g. Zebra) can then print and encode the tag.
            </p>
            {(printTagAsset || currentAsset) ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="h-14 w-14 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                  {(printTagAsset || currentAsset)?.imageUrl ? (
                    <img src={(printTagAsset || currentAsset)!.imageUrl!} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-7 w-7 text-slate-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">{(printTagAsset || currentAsset)!.name}</p>
                  <p className="text-xs text-slate-500">{(printTagAsset || currentAsset)!.assetId || (printTagAsset || currentAsset)!.barcode || (printTagAsset || currentAsset)!.id}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Scan an asset first, or select one from the Asset tab, then open Print tag again.</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPrintTagDialog(false)}>Cancel</Button>
            <Button
              disabled={!printTagAsset && !currentAsset}
              onClick={() => {
                if (printTagAsset || currentAsset) {
                  toast({ title: 'Added to print queue', description: 'Tag will be printed when the RFID printer processes the job.' });
                  setShowPrintTagDialog(false);
                  setPrintTagAsset(null);
                }
              }}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Add to print queue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch move dialog */}
      <Dialog open={showBatchMoveDialog} onOpenChange={setShowBatchMoveDialog}>
        <DialogContent className="max-w-lg rounded-2xl" onPointerDownOutside={preventHandheldDialogOutsideClose} onInteractOutside={preventHandheldDialogOutsideClose}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-violet-500" />
              Move {batchMoveIds.length} asset(s) to location
            </DialogTitle>
          </DialogHeader>
          <Form {...batchMoveForm}>
            <form onSubmit={batchMoveForm.handleSubmit(doBatchMove)} className="space-y-4 py-2">
              <FormField control={batchMoveForm.control} name="floorNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Floor</FormLabel>
                  <FormControl><Input className="rounded-xl" placeholder="e.g. 1" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={batchMoveForm.control} name="roomNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Room / Aisle</FormLabel>
                  <FormControl><Input className="rounded-xl" placeholder="e.g. A-12" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowBatchMoveDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={batchMoveLoading}>
                  {batchMoveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Move all
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Count tab: barcode scanner to add to count (stays in session) */}
      <BarcodeScannerCount
        open={showCountScanner}
        onOpenChange={setShowCountScanner}
        onScan={(payload) => {
          const b = 'barcode' in payload ? payload.barcode : (payload as Asset).barcode ?? (payload as Asset).assetId ?? '';
          if (b) addToCount(b);
        }}
      />

      {/* Audit: full asset details (all tabs) when clicking an audit card */}
      {selectedAuditAssetForDetails && (
        <AssetDetailsDialog
          asset={selectedAuditAssetForDetails}
          open={!!selectedAuditAssetForDetails}
          onOpenChange={(open) => { if (!open) setSelectedAuditAssetForDetails(null); }}
          onAssetUpdated={() => {}}
        />
      )}
      {countItemDetailsAsset && (
        <AssetDetailsDialog
          asset={countItemDetailsAsset}
          open={!!countItemDetailsAsset}
          onOpenChange={(open) => { if (!open) setCountItemDetailsAsset(null); }}
          onAssetUpdated={(a) => a && setCountItemDetailsAsset(a)}
        />
      )}
      {auditDetailsLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 flex flex-col items-center gap-3 shadow-xl">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Loading asset details…</p>
          </div>
        </div>
      )}
      {countItemActionLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 flex flex-col items-center gap-3 shadow-xl">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Loading…</p>
          </div>
        </div>
      )}

      {/* Audit: RFID map (2D / 3D) when clicking RFID on an audit card */}
      <AuditRfidMapDialog
        open={!!auditRfidMapAsset}
        onOpenChange={(open) => { if (!open) setAuditRfidMapAsset(null); }}
        asset={auditRfidMapAsset}
      />

      {/* Audit: Add comment + photo (saved to asset history and reports) */}
      <Dialog open={!!auditCommentAsset} onOpenChange={(open) => { if (!open) { setAuditCommentAsset(null); setAuditCommentText(''); setAuditCommentImagePreview(null); if (auditCommentImageInputRef.current) auditCommentImageInputRef.current.value = ''; } }}>
        <DialogContent className="max-w-md rounded-2xl" onPointerDownOutside={preventHandheldDialogOutsideClose} onInteractOutside={preventHandheldDialogOutsideClose}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-indigo-500" /> Add audit comment</DialogTitle>
            <DialogDescription>{auditCommentAsset ? `Comment and photo will be saved to ${auditCommentAsset.name} history and appear in asset reports.` : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Comment</label>
              <Textarea
                placeholder="e.g. Condition noted, damage, location verified..."
                value={auditCommentText}
                onChange={(e) => setAuditCommentText(e.target.value)}
                className="min-h-[100px] rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Photo (optional)</label>
              <Input
                ref={auditCommentImageInputRef}
                type="file"
                accept="image/*"
                className="rounded-xl"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => setAuditCommentImagePreview(reader.result as string);
                    reader.readAsDataURL(file);
                  } else setAuditCommentImagePreview(null);
                }}
              />
              {auditCommentImagePreview && (
                <div className="mt-2 relative h-32 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                  <img src={auditCommentImagePreview} alt="Preview" className="h-full w-full object-contain" />
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setAuditCommentAsset(null); setAuditCommentText(''); setAuditCommentImagePreview(null); }}>Cancel</Button>
              <Button type="button" className="rounded-xl" disabled={!auditCommentText.trim() || auditCommentSubmitting} onClick={submitAuditComment}>
                {auditCommentSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save comment'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Food Supply Details Dialog (from audit) */}
      <Dialog open={!!selectedAuditFoodSupply} onOpenChange={(open) => { if (!open) setSelectedAuditFoodSupply(null); }}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-hidden flex flex-col rounded-2xl" onPointerDownOutside={preventHandheldDialogOutsideClose} onInteractOutside={preventHandheldDialogOutsideClose}>
          <div className="flex items-start justify-between gap-2 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-amber-600" />
                Food supply details
              </DialogTitle>
              <p className="text-sm text-slate-500 mt-0.5">{selectedAuditFoodSupply?.name}</p>
            </DialogHeader>
            <Button variant="ghost" size="icon" className="rounded-xl -mr-2 shrink-0" onClick={() => setSelectedAuditFoodSupply(null)} aria-label="Close">
              <X className="h-5 w-5" />
            </Button>
          </div>
          {selectedAuditFoodSupply && (
            <div className="flex-1 overflow-y-auto space-y-6 py-2 -mx-1 px-1">
              <section className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Overview</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300">Remaining</span>
                    <span className="font-semibold text-slate-900 dark:text-white ml-auto">{selectedAuditFoodSupply.quantity} {selectedAuditFoodSupply.unit}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300">Expires</span>
                    <span className="font-medium text-slate-900 dark:text-white ml-auto">
                      {selectedAuditFoodSupply.expirationDate ? new Date(selectedAuditFoodSupply.expirationDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                  {(selectedAuditFoodSupply.category || selectedAuditFoodSupply.pricePerUnit != null) && (
                    <>
                      {selectedAuditFoodSupply.category && (
                        <div className="col-span-2 flex items-center gap-2">
                          <span className="text-slate-600 dark:text-slate-300">Category</span>
                          <span className="font-medium capitalize">{selectedAuditFoodSupply.category}</span>
                        </div>
                      )}
                      {selectedAuditFoodSupply.pricePerUnit != null && selectedAuditFoodSupply.pricePerUnit > 0 && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span className="text-slate-600 dark:text-slate-300">Price/unit</span>
                          <span className="font-medium">QAR {Number(selectedAuditFoodSupply.pricePerUnit).toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300">Kitchens</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
                    {(selectedAuditFoodSupply.kitchensWithSupply && selectedAuditFoodSupply.kitchensWithSupply.length)
                      ? selectedAuditFoodSupply.kitchensWithSupply.map((k: { name: string }) => k.name).join(', ')
                      : selectedAuditFoodSupply.kitchenName || '—'}
                  </p>
                </div>
              </section>
              <section className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <History className="h-4 w-4" /> Consumption history
                </h3>
                {auditFoodConsumptionLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Loading…</span>
                  </div>
                ) : auditFoodConsumption.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">No consumption records yet</p>
                ) : (
                  <ul className="space-y-2 max-h-56 overflow-y-auto">
                    {auditFoodConsumption.slice(0, 50).map((r: any) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 text-xs py-2 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                        <div>
                          <span className="font-medium text-slate-900 dark:text-white">{r.quantity} {r.foodSupply?.unit || selectedAuditFoodSupply.unit}</span>
                          <span className={r.isWaste ? ' text-red-600 dark:text-red-400 ml-2' : ' text-slate-500 ml-2'}>
                            {r.isWaste ? 'Waste' : (r.source === 'recipe' ? 'Recipe' : 'Direct')}
                          </span>
                        </div>
                        <div className="text-right text-slate-500">
                          <div>{r.kitchen?.name || '—'}</div>
                          <div>{r.date ? new Date(r.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

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

      <Dialog open={!!countItemMoveAsset} onOpenChange={(open) => { if (!open) { setCountItemMoveAsset(null); countItemMoveForm.reset(); } }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={preventHandheldDialogOutsideClose} onInteractOutside={preventHandheldDialogOutsideClose}>
          <DialogHeader><DialogTitle>Update location</DialogTitle></DialogHeader>
          {countItemMoveAsset && (
            <Form {...countItemMoveForm}>
              <form onSubmit={countItemMoveForm.handleSubmit(doCountItemMove)} className="space-y-4">
                <FormField control={countItemMoveForm.control} name="floorNumber" render={({ field }) => (
                  <FormItem><FormLabel>Floor</FormLabel><FormControl><Input placeholder="e.g. 2" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={countItemMoveForm.control} name="roomNumber" render={({ field }) => (
                  <FormItem><FormLabel>Room</FormLabel><FormControl><Input placeholder="e.g. 205" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setCountItemMoveAsset(null); countItemMoveForm.reset(); }}>Cancel</Button>
                  <Button type="submit">Update location</Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showStatus} onOpenChange={(open) => { if (!open) setCountItemStatusAsset(null); setShowStatus(open); }}>
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

      <Dialog open={showAddAssetDialog} onOpenChange={setShowAddAssetDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl" onPointerDownOutside={preventHandheldDialogOutsideClose} onInteractOutside={preventHandheldDialogOutsideClose}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl"><Plus className="h-5 w-5 text-violet-500" /> Register new asset</DialogTitle>
            <DialogDescription>Enter asset details below. Barcode and QR code are generated automatically after creation.</DialogDescription>
          </DialogHeader>
          <Form {...addAssetForm}>
            <form onSubmit={addAssetForm.handleSubmit(submitAddAsset)} className="space-y-5 pt-2">
              <FormField control={addAssetForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input className="rounded-xl" placeholder="e.g. Laptop A1, Desk 3B" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={addAssetForm.control} name="type" render={({ field }) => (
                <FormItem><FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="rounded-xl"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {ASSET_TYPES_MAIN.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={addAssetForm.control} name="vendorId" render={({ field }) => (
                <FormItem><FormLabel>Vendor <span className="text-muted-foreground font-normal text-xs">(optional)</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl><SelectTrigger className="rounded-xl"><SelectValue placeholder={addAssetVendors.length ? 'Select vendor' : 'No vendors — skip if none'} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {addAssetVendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={addAssetForm.control} name="floorNumber" render={({ field }) => (
                  <FormItem><FormLabel>Floor</FormLabel><FormControl><Input className="rounded-xl" placeholder="e.g. 2" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={addAssetForm.control} name="roomNumber" render={({ field }) => (
                  <FormItem><FormLabel>Room</FormLabel><FormControl><Input className="rounded-xl" placeholder="e.g. 205" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={addAssetForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description <span className="text-muted-foreground font-normal text-xs">(optional)</span></FormLabel><FormControl><Textarea className="rounded-xl min-h-[80px]" placeholder="Notes, serial number, etc." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={addAssetForm.control} name="purchaseAmount" render={({ field }) => (
                  <FormItem><FormLabel>Purchase amount (QAR)</FormLabel><FormControl><Input type="number" step="0.01" min={0} className="rounded-xl" placeholder="0.00" {...field} /></FormControl><FormDescription className="text-xs">Enter amount in QAR</FormDescription><FormMessage /></FormItem>
                )} />
                <FormField control={addAssetForm.control} name="purchaseDate" render={({ field }) => (
                  <FormItem><FormLabel>Purchase date</FormLabel><FormControl><Input type="date" className="rounded-xl" {...field} /></FormControl><FormDescription className="text-xs">When the asset was purchased</FormDescription><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={addAssetForm.control} name="batchNumber" render={({ field }) => (
                  <FormItem><FormLabel>Batch / Lot <span className="text-muted-foreground text-xs">(optional)</span></FormLabel><FormControl><Input className="rounded-xl" placeholder="Batch number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={addAssetForm.control} name="serialNumber" render={({ field }) => (
                  <FormItem><FormLabel>Serial number <span className="text-muted-foreground text-xs">(optional)</span></FormLabel><FormControl><Input className="rounded-xl" placeholder="Serial" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={addAssetForm.control} name="donorName" render={({ field }) => (
                <FormItem><FormLabel>Donor <span className="text-muted-foreground text-xs">(optional)</span></FormLabel><FormControl><Input className="rounded-xl" placeholder="Donated by" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex items-center gap-4">
                <FormField control={addAssetForm.control} name="nextServiceDate" render={({ field }) => (
                  <FormItem><FormLabel>Next service date <span className="text-muted-foreground text-xs">(optional)</span></FormLabel><FormControl><Input type="date" className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={addAssetForm.control} name="isProvisional" render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0 pt-8">
                    <FormControl><input type="checkbox" className="rounded border-input" checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} /></FormControl>
                    <FormLabel className="font-normal">Provisional / temporary asset</FormLabel>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormItem>
                <FormLabel>Location</FormLabel>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {geoLat != null && geoLng != null ? (
                    <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Location detected ({geoLat.toFixed(5)}, {geoLng.toFixed(5)}) — will be saved with asset</span>
                  ) : (
                    <span className="text-sm text-slate-500">Detecting location… (optional)</span>
                  )}
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                </div>
                <FormDescription className="text-xs">Current GPS location is attached when available. You can also set Floor/Room above.</FormDescription>
              </FormItem>
              <FormItem>
                <FormLabel>Image <span className="text-muted-foreground font-normal text-xs">(optional)</span></FormLabel>
                <FormControl>
                  <Input
                    ref={addAssetImageInputRef}
                    type="file"
                    accept="image/*"
                    className="rounded-xl"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setAddAssetImagePreview(reader.result as string);
                        reader.readAsDataURL(file);
                      } else setAddAssetImagePreview(null);
                    }}
                  />
                </FormControl>
                {addAssetImagePreview && (
                  <div className="mt-2 relative h-40 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    <img src={addAssetImagePreview} alt="Preview" className="h-full w-full object-contain" />
                  </div>
                )}
              </FormItem>
              <DialogFooter className="gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setShowAddAssetDialog(false)}>Cancel</Button>
                <Button type="submit" className="rounded-xl min-w-[120px]" disabled={addAssetLoading}>{addAssetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create asset'}</Button>
              </DialogFooter>
            </form>
          </Form>
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
                  {selectedTicketDetail.missionName && <span className="ml-2">· Mission: {selectedTicketDetail.missionName}</span>}
                  {selectedTicketDetail.resolveBy && <span className="ml-2">· Resolve by: {new Date(selectedTicketDetail.resolveBy).toLocaleDateString()}</span>}
                </p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-slate-500">Raised by</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{selectedTicketDetail.user?.email ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-slate-500">Assigned to</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{selectedTicketDetail.assignedTo?.email ?? 'Unassigned'}</span>
                  </div>
                </div>
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
              <FormField control={createTicketForm.control} name="missionName" render={({ field }) => (
                <FormItem><FormLabel>Mission / Campaign <span className="text-muted-foreground text-xs">(optional)</span></FormLabel><FormControl><Input placeholder="e.g. Field deployment, Campaign X" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={createTicketForm.control} name="resolveBy" render={({ field }) => (
                <FormItem><FormLabel>Resolve by (SLA) <span className="text-muted-foreground text-xs">(optional)</span></FormLabel><FormControl><Input type="date" className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
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
