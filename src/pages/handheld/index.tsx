// @ts-nocheck
/**
 * Handheld hub: SimplyRFiD-style field assistant for HANDHELD-role users.
 * Tabs: Scan | Inventory (unified count & audit) | Locate | Work (Tickets + Tasks) | Asset | More.
 * Features: RFID-style scan, ultra-fast count, locate (beep), audit, sync, export, print/encode tag workflow.
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
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
  Sparkles,
  AlertCircle,
  ListChecks,
  List,
  Type,
  Mic,
  Truck,
  Scale,
  ChevronDown,
  ChevronUp,
  Undo2,
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
import {
  handheldInventoryItemsEqual,
  type HandheldCountScanItem,
  type HandheldUnifiedInventoryItem,
} from '@/components/handheld/inventorySessionTypes';
import {
  HandheldInventoryVirtualList,
  useHandheldInventoryVirtualizer,
} from '@/components/handheld/HandheldInventoryVirtualList';

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

/** Persisted handheld inventory session (device-local recovery). */
const INVENTORY_SESSION_KEY = 'handheld_inventory_session_v1';
const INVENTORY_AUDIT_LOG_MAX = 250;
const INVENTORY_PROOF_MAX_IMAGES = 3;

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
  const [moveDestinationRoomTagVerified, setMoveDestinationRoomTagVerified] = useState(false);
  const [showMoveRoomTagScan, setShowMoveRoomTagScan] = useState(false);
  const [moveRoomTagScanning, setMoveRoomTagScanning] = useState(false);
  const [moveRoomTagError, setMoveRoomTagError] = useState<string | null>(null);
  const [moveDestinationFloor, setMoveDestinationFloor] = useState('');
  const [moveDestinationRoom, setMoveDestinationRoom] = useState('');
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

  type CountScanItem = HandheldCountScanItem;
  type UnifiedInventoryItem = HandheldUnifiedInventoryItem;
  const [unifiedInventory, setUnifiedInventory] = useState<HandheldUnifiedInventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryAuditLog, setInventoryAuditLog] = useState<{ at: number; action: string; detail: string }[]>([]);
  const [sessionProofNote, setSessionProofNote] = useState('');
  const [sessionProofImages, setSessionProofImages] = useState<string[]>([]);
  const [inventoryLiveMessage, setInventoryLiveMessage] = useState('');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const inventoryScrollParentRef = useRef<HTMLDivElement | null>(null);
  const inventoryProofFileRef = useRef<HTMLInputElement>(null);
  const unifiedInventoryRef = useRef<HandheldUnifiedInventoryItem[]>([]);
  const inventoryUndoStackRef = useRef<Array<{ kind: 'pending'; localKey: string } | { kind: 'item'; item: HandheldUnifiedInventoryItem }>>([]);
  const inventorySessionRestoreDone = useRef(false);

  useEffect(() => {
    unifiedInventoryRef.current = unifiedInventory;
  }, [unifiedInventory]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const upd = () => setPrefersReducedMotion(mq.matches);
    upd();
    mq.addEventListener('change', upd);
    return () => mq.removeEventListener('change', upd);
  }, []);

  const pushInventoryAudit = useCallback((action: string, detail: string) => {
    const row = { at: Date.now(), action, detail: detail.slice(0, 500) };
    setInventoryAuditLog((prev) => [row, ...prev].slice(0, INVENTORY_AUDIT_LOG_MAX));
  }, []);
  // Audit modals (details, comment, food, ticket, RFID map)
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

  // Count/Inventory session and reconciliation (uses unifiedInventory for assets)
  const [countSessionActive, setCountSessionActive] = useState(false);
  const [countStartTime, setCountStartTime] = useState<number>(0);
  const [countLocationLabel, setCountLocationLabel] = useState(''); // optional: e.g. "Aisle 3", "Store A"
  const [inventorySessionFloor, setInventorySessionFloor] = useState(''); // optional: for location-based reconciliation
  const [inventorySessionRoom, setInventorySessionRoom] = useState(''); // optional: e.g. "101"

  // Normalize location part for comparison (101 === 0101, trim, case-insensitive) — must be after inventorySessionFloor/Room
  const normalizeLoc = useCallback((s: string | null | undefined): string => {
    const t = String(s ?? '').trim().toLowerCase();
    const num = t.replace(/^0+(\d+)$/, '$1');
    return num || t;
  }, []);

  const isWrongRoom = useCallback(
    (assetFloor: string | null | undefined, assetRoom: string | null | undefined) => {
      const hasSession = inventorySessionFloor.trim() !== '' || inventorySessionRoom.trim() !== '';
      if (!hasSession) return false;
      const nF = normalizeLoc(inventorySessionFloor);
      const nR = normalizeLoc(inventorySessionRoom);
      const aF = normalizeLoc(assetFloor);
      const aR = normalizeLoc(assetRoom);
      return (nF && nF !== aF) || (nR && nR !== aR);
    },
    [inventorySessionFloor, inventorySessionRoom, normalizeLoc],
  );
  const [inventoryRoomTagVerified, setInventoryRoomTagVerified] = useState(false); // Room RFID tag verification status
  const [showRoomTagScanDialog, setShowRoomTagScanDialog] = useState(false);
  const [roomTagScanning, setRoomTagScanning] = useState(false);
  const [roomTagError, setRoomTagError] = useState<string | null>(null);
  const [showManualRoomDialog, setShowManualRoomDialog] = useState(false);
  const [manualFloorInput, setManualFloorInput] = useState('');
  const [manualRoomInput, setManualRoomInput] = useState('');
  const [showCountScanner, setShowCountScanner] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState<{
    expectedCount: number;
    actualCount: number;
    scope: 'all' | 'location';
    locationDisplay?: string;
    expectedInLocation?: number;
    actualInLocation?: number;
    difference?: number; // expectedInLocation - actualInLocation (positive = missing from scan)
    missing: { id: string; name: string; barcode?: string; floorNumber?: string | null; roomNumber?: string | null; lastMovedAt?: string | null }[];
    extra: { id: string; name: string; barcode?: string; floorNumber?: string | null; roomNumber?: string | null }[];
    wrongLocation: { id: string; name: string; barcode?: string; systemFloor?: string | null; systemRoom?: string | null }[]; // scanned, exist in system, but at different location
    /** RFID scans whose registered location matches this count room (in system at this location) */
    correctInRoom: { id: string; name: string; barcode?: string; floorNumber?: string | null; roomNumber?: string | null }[];
    submittedForReview: boolean;
    reasonCode?: string;
    note?: string;
    submittedAt?: number;
    locationOverrideApplied?: string; // audit: "From Floor X Room Y → Floor A Room B"
  } | null>(null);
  const [reconcileEditLocationAsset, setReconcileEditLocationAsset] = useState<{ id: string; name: string; floorNumber?: string | null; roomNumber?: string | null } | null>(null);
  const [reconcileEditLocationSaving, setReconcileEditLocationSaving] = useState(false);
  /** Missing-item movement history (reconciliation) */
  const [reconcileMissingMoveDialog, setReconcileMissingMoveDialog] = useState<{ id: string; name: string } | null>(null);
  const [reconcileMoveHistoryLoading, setReconcileMoveHistoryLoading] = useState(false);
  const [reconcileMoveHistoryItems, setReconcileMoveHistoryItems] = useState<
    Array<{
      id: string;
      movedAt: Date | string;
      fromFloor?: string | null;
      toFloor?: string | null;
      fromRoom?: string | null;
      toRoom?: string | null;
      reason?: string | null;
    }>
  >([]);
  /** Full catalogue dialog: all assets registered to current count floor/room */
  const [roomCatalogOpen, setRoomCatalogOpen] = useState(false);
  const [roomCatalogLoading, setRoomCatalogLoading] = useState(false);
  const [roomCatalogRfidMode, setRoomCatalogRfidMode] = useState(false);

  type RosterAsset = {
    id: string;
    name?: string | null;
    barcode?: string | null;
    assetId?: string | null;
    status?: string | null;
    floorNumber?: string | null;
    roomNumber?: string | null;
    imageUrl?: string | null;
    rfidReadThisSession?: boolean;
  };
  const [roomCatalogAssets, setRoomCatalogAssets] = useState<RosterAsset[]>([]);
  /** Snapshot of NOT-read items from last roster load — auto-included in submitted report */
  const [rosterNotReadSnapshot, setRosterNotReadSnapshot] = useState<RosterAsset[]>([]);
  /** Per-session set of asset IDs explicitly reported missing via the roster action dialog */
  const [rosterReportedMissingIds, setRosterReportedMissingIds] = useState<Set<string>>(new Set());
  /** Asset selected from the roster "not-read" row — drives the action sub-dialog */
  const [rosterActionAsset, setRosterActionAsset] = useState<RosterAsset | null>(null);
  const reconcileEditLocationForm = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: { floorNumber: '', roomNumber: '' },
  });
  const COUNT_REVIEW_REASONS = [
    { value: '', label: 'Select reason (optional)' },
    { value: 'NOT_FOUND', label: 'Not found at location' },
    { value: 'DAMAGED', label: 'Damaged' },
    { value: 'WRONG_LOCATION', label: 'Wrong location' },
    { value: 'MISSING', label: 'Missing / unaccounted' },
    { value: 'OTHER', label: 'Other' },
  ];
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [reconcileShowMissing, setReconcileShowMissing] = useState(false);
  const [reconcileShowExtra, setReconcileShowExtra] = useState(false);
  const [showReconcileConfirmDialog, setShowReconcileConfirmDialog] = useState(false);
  const [reconcileConfirmStep, setReconcileConfirmStep] = useState<'confirm' | 'change_location'>('confirm');
  const [inventorySummary, setInventorySummary] = useState<{ suggestedReason: string; summaryLine: string; tips: string[] } | null>(null);
  const [inventorySummaryLoading, setInventorySummaryLoading] = useState(false);
  const [reconcileCorrectFloor, setReconcileCorrectFloor] = useState('');
  const [reconcileCorrectRoom, setReconcileCorrectRoom] = useState('');
  const [reconcileShowMissingByLocation, setReconcileShowMissingByLocation] = useState(false);
  const [showMissingItemsDialog, setShowMissingItemsDialog] = useState(false);
  const [countItemSwipedId, setCountItemSwipedId] = useState<string | null>(null);
  const [countSwipeOffset, setCountSwipeOffset] = useState(0);
  const [countItemWrongRoomExpandedId, setCountItemWrongRoomExpandedId] = useState<string | null>(null);
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

  // Resume inventory session from device (crash / tab close recovery)
  useEffect(() => {
    if (typeof window === 'undefined' || inventorySessionRestoreDone.current) return;
    inventorySessionRestoreDone.current = true;
    try {
      const raw = localStorage.getItem(INVENTORY_SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.v !== 1 || !s.countSessionActive) return;
      setCountSessionActive(true);
      setCountStartTime(typeof s.countStartTime === 'number' ? s.countStartTime : Date.now());
      setCountLocationLabel(typeof s.countLocationLabel === 'string' ? s.countLocationLabel : '');
      setInventorySessionFloor(typeof s.inventorySessionFloor === 'string' ? s.inventorySessionFloor : '');
      setInventorySessionRoom(typeof s.inventorySessionRoom === 'string' ? s.inventorySessionRoom : '');
      setInventoryRoomTagVerified(typeof s.inventoryRoomTagVerified === 'boolean' ? s.inventoryRoomTagVerified : false);
      setUnifiedInventory(Array.isArray(s.unifiedInventory) ? s.unifiedInventory : []);
      if (s.reconciliationResult) setReconciliationResult(s.reconciliationResult);
      if (Array.isArray(s.inventoryAuditLog)) setInventoryAuditLog(s.inventoryAuditLog.slice(0, INVENTORY_AUDIT_LOG_MAX));
      setSessionProofNote(typeof s.sessionProofNote === 'string' ? s.sessionProofNote : '');
      setSessionProofImages(Array.isArray(s.sessionProofImages) ? s.sessionProofImages.slice(0, INVENTORY_PROOF_MAX_IMAGES) : []);
      toast({
        title: 'Session resumed',
        description: 'Inventory session restored from this device.',
      });
    } catch {
      /* ignore corrupt storage */
    }
  }, [toast]);

  // Persist active inventory session (debounced)
  useEffect(() => {
    if (!countSessionActive) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(
          INVENTORY_SESSION_KEY,
          JSON.stringify({
            v: 1,
            countSessionActive: true,
            countStartTime,
            countLocationLabel,
            inventorySessionFloor,
            inventorySessionRoom,
            inventoryRoomTagVerified,
            unifiedInventory,
            reconciliationResult,
            inventoryAuditLog,
            sessionProofNote,
            sessionProofImages,
          }),
        );
      } catch {
        /* quota / private mode */
      }
    }, 450);
    return () => window.clearTimeout(t);
  }, [
    countSessionActive,
    countStartTime,
    countLocationLabel,
    inventorySessionFloor,
    inventorySessionRoom,
    inventoryRoomTagVerified,
    unifiedInventory,
    reconciliationResult,
    inventoryAuditLog,
    sessionProofNote,
    sessionProofImages,
  ]);

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

  /** Resolve barcode / id online (no UI side effects). */
  const performInventoryLookup = useCallback(async (code: string): Promise<UnifiedInventoryItem | null> => {
    const q = code.trim();
    if (!q) return null;
    const res = await fetch(`/api/assets/scan?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.asset?.id) {
        const a = data.asset;
        const item: CountScanItem = {
          id: a.id,
          barcode: a.barcode || q,
          name: a.name || a.assetId || 'Unknown',
          imageUrl: a.imageUrl,
          status: a.status,
          floorNumber: a.floorNumber,
          roomNumber: a.roomNumber,
        };
        return { type: 'asset', data: item };
      }
    }
    const scanRes = await fetch('/api/food-supply/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: q }),
    });
    if (scanRes.ok) {
      const scanData = await scanRes.json();
      if (scanData?.supply?.id) {
        return { type: 'food', supply: scanData.supply };
      }
    }
    const ticketRes = await fetch(`/api/tickets/barcode?barcode=${encodeURIComponent(q)}`, { credentials: 'include' });
    if (ticketRes.ok) {
      const ticketData = await ticketRes.json();
      if (ticketData?.id) {
        return { type: 'ticket', ticket: ticketData };
      }
    }
    return null;
  }, []);

  const flushPendingInventoryScans = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const prev = unifiedInventoryRef.current;
    const pending = prev.filter((x): x is Extract<HandheldUnifiedInventoryItem, { type: 'pending_scan' }> => x.type === 'pending_scan');
    if (pending.length === 0) return;
    let resolvedN = 0;
    for (const p of pending) {
      try {
        const result = await performInventoryLookup(p.code);
        if (result) {
          const now = Date.now();
          const withMeta: HandheldUnifiedInventoryItem =
            result.type === 'asset'
              ? { type: 'asset', data: result.data, meta: { addedAt: now, syncStatus: 'synced' } }
              : result.type === 'food'
                ? { type: 'food', supply: result.supply, meta: { addedAt: now, syncStatus: 'synced' } }
                : { type: 'ticket', ticket: result.ticket, meta: { addedAt: now, syncStatus: 'synced' } };
          setUnifiedInventory((cur) =>
            cur.map((x) => (x.type === 'pending_scan' && x.localKey === p.localKey ? withMeta : x)),
          );
          pushInventoryAudit('offline_scan_resolved', p.code);
          resolvedN += 1;
        } else {
          setUnifiedInventory((cur) =>
            cur.map((x) =>
              x.type === 'pending_scan' && x.localKey === p.localKey ? { ...x, error: 'Not found' } : x,
            ),
          );
          pushInventoryAudit('offline_scan_failed', p.code);
        }
      } catch {
        setUnifiedInventory((cur) =>
          cur.map((x) => (x.type === 'pending_scan' && x.localKey === p.localKey ? { ...x, error: 'Network error' } : x)),
        );
      }
    }
    if (resolvedN > 0) {
      toast({ title: 'Offline queue synced', description: `${resolvedN} scan(s) resolved.` });
      setInventoryLiveMessage(`${resolvedN} offline scan(s) synced`);
    }
  }, [performInventoryLookup, pushInventoryAudit, toast]);

  useEffect(() => {
    if (!countSessionActive) return;
    const handler = () => {
      void flushPendingInventoryScans();
    };
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [countSessionActive, flushPendingInventoryScans]);

  const undoLastInventoryAdd = useCallback(() => {
    const stack = inventoryUndoStackRef.current;
    const last = stack.pop();
    if (!last) {
      toast({ title: 'Nothing to undo', description: 'No recent add in this session.', variant: 'destructive' });
      return;
    }
    if (last.kind === 'pending') {
      setUnifiedInventory((prev) => prev.filter((x) => !(x.type === 'pending_scan' && x.localKey === last.localKey)));
      pushInventoryAudit('undo', `pending:${last.localKey}`);
    } else {
      const label =
        last.item.type === 'asset'
          ? last.item.data.name
          : last.item.type === 'food'
            ? last.item.supply?.name
            : last.item.type === 'ticket'
              ? last.item.ticket?.title
              : '';
      pushInventoryAudit('undo', label || 'item');
      setUnifiedInventory((prev) => {
        const idx = prev.findIndex((x) => handheldInventoryItemsEqual(x, last.item));
        if (idx === -1) return prev;
        return prev.filter((_, i) => i !== idx);
      });
    }
    setSessionScansCount((s) => Math.max(0, s - 1));
    setInventoryLiveMessage('Last add undone');
    toast({ title: 'Undone', description: 'Removed the last scanned item.' });
  }, [pushInventoryAudit, toast]);

  const addToUnifiedInventory = useCallback(
    async (code: string) => {
      const q = code.trim();
      if (!q) return;
      const now = Date.now();
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;

      if (offline) {
        const localKey = `pq_${now}_${Math.random().toString(36).slice(2, 10)}`;
        setUnifiedInventory((prev) => [...prev, { type: 'pending_scan', localKey, code: q, queuedAt: now }]);
        inventoryUndoStackRef.current.push({ kind: 'pending', localKey });
        if (inventoryUndoStackRef.current.length > 50) inventoryUndoStackRef.current.shift();
        setSessionScansCount((s) => s + 1);
        pushInventoryAudit('scan_queued_offline', q);
        setInventoryLiveMessage(`Queued offline: ${q}`);
        toast({ title: 'Offline — queued', description: `${q} will resolve when you are online.` });
        return;
      }

      setInventoryLoading(true);
      setSessionScansCount((s) => s + 1);
      try {
        const resolved = await performInventoryLookup(q);
        if (!resolved) {
          setSessionScansCount((s) => Math.max(0, s - 1));
          pushInventoryAudit('scan_not_found', q);
          setInventoryLiveMessage(`Not found: ${q}`);
          toast({ title: 'Not found', description: q, variant: 'destructive' });
          return;
        }

        const snapshot = unifiedInventoryRef.current;
        const duplicate =
          (resolved.type === 'asset' && snapshot.some((x) => x.type === 'asset' && x.data.id === resolved.data.id)) ||
          (resolved.type === 'food' && snapshot.some((x) => x.type === 'food' && x.supply?.id === resolved.supply?.id)) ||
          (resolved.type === 'ticket' && snapshot.some((x) => x.type === 'ticket' && x.ticket?.id === resolved.ticket?.id));

        if (duplicate) {
          setSessionScansCount((s) => Math.max(0, s - 1));
          setInventoryLiveMessage('Already in list');
          toast({ title: 'Already in list', description: q });
          return;
        }

        const meta = { addedAt: now, syncStatus: 'synced' as const };
        const toAdd: HandheldUnifiedInventoryItem =
          resolved.type === 'asset'
            ? { type: 'asset', data: resolved.data, meta }
            : resolved.type === 'food'
              ? { type: 'food', supply: resolved.supply, meta }
              : { type: 'ticket', ticket: resolved.ticket, meta };

        inventoryUndoStackRef.current.push({ kind: 'item', item: toAdd });
        if (inventoryUndoStackRef.current.length > 50) inventoryUndoStackRef.current.shift();

        setUnifiedInventory((prev) => [...prev, toAdd]);

        const live =
          resolved.type === 'asset'
            ? resolved.data.name
            : resolved.type === 'food'
              ? resolved.supply.name
              : resolved.ticket.title || resolved.ticket.displayId || 'Ticket';
        pushInventoryAudit('scan_added', `${resolved.type}:${q}`);
        setInventoryLiveMessage(`Added: ${live}`);
        if (resolved.type === 'asset') toast({ title: 'Added', description: resolved.data.name });
        else if (resolved.type === 'food')
          toast({ title: 'Food supply added', description: `${resolved.supply.name} — ${resolved.supply.quantity} ${resolved.supply.unit} left` });
        else toast({ title: 'Ticket added', description: resolved.ticket.title || resolved.ticket.displayId || 'Ticket' });
      } catch {
        setSessionScansCount((s) => Math.max(0, s - 1));
        pushInventoryAudit('scan_error', q);
        setInventoryLiveMessage('Lookup failed');
        toast({ title: 'Lookup failed', variant: 'destructive' });
      } finally {
        setInventoryLoading(false);
      }
    },
    [performInventoryLookup, pushInventoryAudit, toast],
  );

  // Verify move destination room tag
  const verifyMoveDestinationRoomTag = useCallback(async (tagId: string) => {
    setMoveRoomTagScanning(true);
    setMoveRoomTagError(null);
    try {
      const res = await fetch('/api/rfid/resolve-room-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify room tag');
      }
      // Set verified destination
      setMoveDestinationFloor(data.floorNumber);
      setMoveDestinationRoom(data.roomNumber);
      setMoveDestinationRoomTagVerified(true);
      setShowMoveRoomTagScan(false);
      // Pre-fill form
      transferForm.setValue('floorNumber', data.floorNumber);
      transferForm.setValue('roomNumber', data.roomNumber);
      toast({
        title: 'Destination room verified',
        description: `Floor ${data.floorNumber}, Room ${data.roomNumber}${data.building ? ` (${data.building})` : ''}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to verify room tag';
      setMoveRoomTagError(msg);
      toast({
        title: 'Room tag verification failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setMoveRoomTagScanning(false);
    }
  }, [transferForm, toast]);

  const doMove = async (vals: z.infer<typeof transferSchema>) => {
    if (!currentAsset) return;
    // Require room tag verification first
    if (!moveDestinationRoomTagVerified || moveDestinationFloor !== vals.floorNumber || moveDestinationRoom !== vals.roomNumber) {
      setShowMoveRoomTagScan(true);
      return;
    }
    const payload = { assetId: currentAsset.id, assetName: currentAsset.name, floorNumber: vals.floorNumber, roomNumber: vals.roomNumber };
    if (!isOnline) {
      setQueue([...getQueue(), { type: 'move', payload }]);
      setShowMove(false);
      transferForm.reset();
      setMoveDestinationRoomTagVerified(false);
      setMoveDestinationFloor('');
      setMoveDestinationRoom('');
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
      setMoveDestinationRoomTagVerified(false);
      setMoveDestinationFloor('');
      setMoveDestinationRoom('');
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
      setUnifiedInventory((prev) => prev.map((x) => (x.type === 'asset' && x.data.id === target.id ? { ...x, data: { ...x.data, status: pickedStatus } } : x)));
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
      setUnifiedInventory((prev) => prev.map((x) => (x.type === 'asset' && x.data.id === countItemMoveAsset.id ? { ...x, data: { ...x.data, floorNumber: vals.floorNumber, roomNumber: vals.roomNumber } } : x)));
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
    if (unifiedInventory.length === 0) {
      toast({ title: 'No items to export', variant: 'destructive' });
      return;
    }
    const metaIso = (item: HandheldUnifiedInventoryItem) =>
      item.type !== 'pending_scan' && item.meta?.addedAt ? new Date(item.meta.addedAt).toISOString() : '—';
    const metaSync = (item: HandheldUnifiedInventoryItem) =>
      item.type === 'pending_scan' ? 'pending_offline' : item.meta?.syncStatus || 'synced';

    const rows = unifiedInventory.map((item, i) => {
      if (item.type === 'pending_scan') {
        return [
          i + 1,
          item.code,
          'Pending offline',
          item.localKey,
          '—',
          '—',
          '—',
          '—',
          new Date(item.queuedAt).toISOString(),
          metaSync(item),
          item.error || '',
        ];
      }
      if (item.type === 'food') {
        const food = item.supply;
        const kitchens = (food.kitchensWithSupply && food.kitchensWithSupply.length)
          ? food.kitchensWithSupply.map((k: { name: string }) => k.name).join('; ')
          : (food.kitchenName || '—');
        return [i + 1, food.name, 'Food supply', food.id, `${food.quantity} ${food.unit}`, kitchens, '—', '—', metaIso(item), metaSync(item), ''];
      }
      if (item.type === 'ticket') {
        const ticket = item.ticket;
        return [i + 1, ticket.title || 'Ticket', 'Ticket', ticket.displayId || ticket.id, (ticket.status || '').toLowerCase(), '—', '—', '—', metaIso(item), metaSync(item), ''];
      }
      const asset = item.data;
      const loc = [asset.floorNumber, asset.roomNumber].filter(Boolean).join(', ') || '—';
      const rfid = (asset as any).rfidTag?.lastZone ? [(asset as any).rfidTag.lastZone.name, (asset as any).rfidTag.lastZone.floorNumber, (asset as any).rfidTag.lastZone.roomNumber].filter(Boolean).join(', ') : '—';
      return [i + 1, asset.name, 'Asset', asset.barcode ?? asset.id ?? '', 'Qty 1', loc, '—', rfid, metaIso(item), metaSync(item), ''];
    });
    const auditExtras =
      inventoryAuditLog.length > 0
        ? [
            [],
            ['SESSION_AUDIT_LOG'],
            ['timestamp_iso', 'action', 'detail'],
            ...inventoryAuditLog.map((e) => [new Date(e.at).toISOString(), e.action, e.detail]),
          ]
        : [];
    const proofRows =
      sessionProofNote.trim() || sessionProofImages.length > 0
        ? [[], ['SESSION_PROOF'], ['note', sessionProofNote.replace(/\r?\n/g, ' ')], ['images_count', String(sessionProofImages.length)]]
        : [];
    const header = ['#', 'Name', 'Type', 'ID/Barcode', 'Qty/Location', 'Kitchens/Location', 'Assigned to', 'RFID location', 'AddedAtISO', 'Sync', 'Extra'];
    const csv = [header, ...rows, ...auditExtras, ...proofRows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Audit exported' });
  }, [unifiedInventory, inventoryAuditLog, sessionProofNote, sessionProofImages, toast]);

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
      if (isOnline) {
        await processOfflineQueue();
        await flushPendingInventoryScans();
      }
      await Promise.all([fetchAssignedTickets(), fetchAssignedTasks()]);
      toast({ title: 'Synced', description: offlineQueueLength > 0 ? 'Queue replayed, tickets and tasks refreshed.' : 'Tickets and tasks refreshed.' });
    } catch {
      toast({ title: 'Sync failed', variant: 'destructive' });
    }
  }, [fetchAssignedTickets, fetchAssignedTasks, toast, isOnline, processOfflineQueue, offlineQueueLength, flushPendingInventoryScans]);

  // Room tag verification handler
  const roomTagChangeOnlyRef = useRef(false);

  const verifyRoomTag = useCallback(async (tagId: string) => {
    setRoomTagScanning(true);
    setRoomTagError(null);
    const changeOnly = roomTagChangeOnlyRef.current;
    try {
      const res = await fetch('/api/rfid/resolve-room-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify room tag');
      }
      // Set verified room context
      setInventorySessionFloor(data.floorNumber);
      setInventorySessionRoom(data.roomNumber);
      setInventoryRoomTagVerified(true);
      setShowRoomTagScanDialog(false);
      roomTagChangeOnlyRef.current = false;
      toast({
        title: changeOnly ? 'Count location updated' : 'Room verified',
        description: `Floor ${data.floorNumber}, Room ${data.roomNumber}${data.building ? ` (${data.building})` : ''}`,
      });
      if (changeOnly) return;
      // Now start the session (first-time verification)
      try {
        localStorage.removeItem(INVENTORY_SESSION_KEY);
      } catch {
        /* ignore */
      }
      inventoryUndoStackRef.current = [];
      setInventorySearch('');
      setInventoryAuditLog([]);
      setSessionProofNote('');
      setSessionProofImages([]);
      setCountSessionActive(true);
      setCountStartTime(Date.now());
      setUnifiedInventory([]);
      setReconciliationResult(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to verify room tag';
      setRoomTagError(msg);
      toast({
        title: 'Room tag verification failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setRoomTagScanning(false);
    }
  }, [toast]);

  const startCountSession = useCallback(() => {
    // Require room tag verification first
    if (!inventoryRoomTagVerified) {
      setShowRoomTagScanDialog(true);
      return;
    }
    // If already verified, proceed
    try {
      localStorage.removeItem(INVENTORY_SESSION_KEY);
    } catch {
      /* ignore */
    }
    inventoryUndoStackRef.current = [];
    setInventorySearch('');
    setInventoryAuditLog([]);
    setSessionProofNote('');
    setSessionProofImages([]);
    setCountSessionActive(true);
    setCountStartTime(Date.now());
    setUnifiedInventory([]);
    setReconciliationResult(null);
  }, [inventoryRoomTagVerified]);

  const startWithManualLocation = useCallback((floor: string, room: string) => {
    const f = floor.trim();
    const r = room.trim();
    setInventorySessionFloor(f);
    setInventorySessionRoom(r);
    setInventoryRoomTagVerified(false); // manual, not RFID-verified
    setShowManualRoomDialog(false);
    setManualFloorInput('');
    setManualRoomInput('');
    // If session already active, just update the location (don't clear inventory)
    if (countSessionActive) {
      pushInventoryAudit('location_changed_manual', `Floor ${f || '—'}, Room ${r || '—'}`);
      toast({ title: 'Location updated', description: f && r ? `Now counting Floor ${f}, Room ${r}` : 'Global count (no location filter)' });
      return;
    }
    try {
      localStorage.removeItem(INVENTORY_SESSION_KEY);
    } catch { /* ignore */ }
    inventoryUndoStackRef.current = [];
    setInventorySearch('');
    setInventoryAuditLog([]);
    setSessionProofNote('');
    setSessionProofImages([]);
    setCountSessionActive(true);
    setCountStartTime(Date.now());
    setUnifiedInventory([]);
    setReconciliationResult(null);
    toast({ title: 'Session started', description: f && r ? `Floor ${f}, Room ${r}` : 'Global count mode' });
  }, [toast, countSessionActive, pushInventoryAudit]);

  const countScansForReconciliation = useMemo(
    () => unifiedInventory.filter((x): x is { type: 'asset'; data: CountScanItem } => x.type === 'asset').map((x) => x.data),
    [unifiedInventory]
  );

  const inventoryPendingCount = useMemo(
    () => unifiedInventory.filter((x) => x.type === 'pending_scan').length,
    [unifiedInventory],
  );

  const inventoryDisplayList = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    const matches = (item: HandheldUnifiedInventoryItem) => {
      if (!q) return true;
      if (item.type === 'pending_scan') {
        return (
          item.code.toLowerCase().includes(q) ||
          'pending'.includes(q) ||
          'offline'.includes(q) ||
          'queued'.includes(q)
        );
      }
      if (item.type === 'asset') {
        const d = item.data;
        return (
          (d.name || '').toLowerCase().includes(q) ||
          (d.barcode || '').toLowerCase().includes(q) ||
          (d.id || '').toLowerCase().includes(q) ||
          [d.floorNumber, d.roomNumber].filter(Boolean).join(' ').toLowerCase().includes(q)
        );
      }
      if (item.type === 'food') {
        const s = item.supply;
        return (s?.name || '').toLowerCase().includes(q) || String(s?.barcode || '').toLowerCase().includes(q);
      }
      const t = item.ticket;
      return (t?.title || '').toLowerCase().includes(q) || String(t?.displayId || t?.id || '').toLowerCase().includes(q);
    };
    const filtered = unifiedInventory.filter(matches);
    if (auditSort === 'scan') return filtered;
    return [...filtered].sort((a, b) => {
      const name = (x: HandheldUnifiedInventoryItem) =>
        x.type === 'food'
          ? x.supply?.name
          : x.type === 'ticket'
            ? x.ticket?.title || x.ticket?.displayId || ''
            : x.type === 'pending_scan'
              ? x.code
              : x.data?.name || '';
      const loc = (x: HandheldUnifiedInventoryItem) =>
        x.type === 'food'
          ? (x.supply?.kitchensWithSupply?.length
              ? x.supply.kitchensWithSupply.map((k: { name: string }) => k.name).join(' ')
              : x.supply?.kitchenName) || ''
          : x.type === 'ticket'
            ? x.ticket?.status || ''
            : x.type === 'pending_scan'
              ? ''
              : [x.data?.floorNumber, x.data?.roomNumber].filter(Boolean).join(' ');
      if (auditSort === 'name') return name(a).localeCompare(name(b));
      return loc(a).localeCompare(loc(b));
    });
  }, [unifiedInventory, inventorySearch, auditSort]);

  const inventoryRowVirtualizer = useHandheldInventoryVirtualizer(inventoryDisplayList.length, inventoryScrollParentRef);

  const runReconciliation = useCallback(async (locationOverride?: { floor: string; room: string }) => {
    setReconciliationLoading(true);
    setReconciliationResult(null);
    setShowMissingItemsDialog(false);
    const sessionFloor = (locationOverride?.floor ?? inventorySessionFloor).trim();
    const sessionRoom = (locationOverride?.room ?? inventorySessionRoom).trim();
    if (locationOverride) {
      setInventorySessionFloor(locationOverride.floor.trim());
      setInventorySessionRoom(locationOverride.room.trim());
      const from = [inventorySessionFloor, inventorySessionRoom].filter(Boolean).join(', ') || '—';
      const to = [locationOverride.floor, locationOverride.room].filter(Boolean).join(', ') || '—';
      pushRecentAction('reconcile_location_override', `Location corrected: ${from} → ${to}`);
    }
    const scopeByLocation = sessionFloor !== '' || sessionRoom !== '';
    let locationOverrideApplied: string | undefined;
    if (locationOverride) {
      const from = [inventorySessionFloor.trim(), inventorySessionRoom.trim()].filter(Boolean).join(', ') || '—';
      const to = [locationOverride.floor.trim(), locationOverride.room.trim()].filter(Boolean).join(', ') || '—';
      if (from !== to) locationOverrideApplied = `Location corrected: ${from} → ${to}`;
    }
    try {
      // Load FULL org catalogue: /api/assets caps limit at 2000 — paginate until exhausted.
      const PAGE = 2000;
      const list: { id: string; name?: string; barcode?: string; assetId?: string; floorNumber?: string | null; roomNumber?: string | null; lastMovedAt?: string | null }[] = [];
      for (let off = 0, guard = 0; guard < 100; guard++) {
        const res = await fetch(`/api/assets?limit=${PAGE}&offset=${off}&refresh=1`, {
          credentials: 'include',
          cache: 'no-store',
          headers: { 'cache-control': 'no-cache' },
        });
        if (!res.ok) break;
        const chunk = await res.json();
        if (!Array.isArray(chunk) || chunk.length === 0) break;
        list.push(...chunk);
        if (chunk.length < PAGE) break;
        off += PAGE;
      }

      const normF = normalizeLoc(sessionFloor || undefined);
      const normR = normalizeLoc(sessionRoom || undefined);
      const inLocation = (f: string | null | undefined, r: string | null | undefined) =>
        (!normF || normalizeLoc(f) === normF) && (!normR || normalizeLoc(r) === normR);

      /**
       * Org-scoped /api/assets list can miss assets that /api/assets/scan still finds
       * (e.g. legacy organizationId null, or visibility mismatch). Merge each session
       * scan by the same APIs used when adding to the list so reconciliation matches the UI.
       */
      const idInCatalog = new Set(list.map((a) => a.id));
      let augmentMerged = 0;
      const mergeAssetIntoCatalog = (raw: {
        id: string;
        name?: string | null;
        barcode?: string | null;
        assetId?: string | null;
        floorNumber?: string | null;
        roomNumber?: string | null;
        lastMovedAt?: string | Date | null;
      }) => {
        if (!raw?.id || idInCatalog.has(raw.id)) return;
        idInCatalog.add(raw.id);
        augmentMerged += 1;
        list.push({
          id: raw.id,
          name: raw.name ?? undefined,
          barcode: raw.barcode ?? undefined,
          assetId: raw.assetId ?? undefined,
          floorNumber: raw.floorNumber,
          roomNumber: raw.roomNumber,
          lastMovedAt: raw.lastMovedAt
            ? typeof raw.lastMovedAt === 'string'
              ? raw.lastMovedAt
              : new Date(raw.lastMovedAt).toISOString()
            : null,
        });
      };

      const AUGMENT_MAX = 120;
      let augmentCalls = 0;
      for (const s of countScansForReconciliation) {
        if (augmentCalls >= AUGMENT_MAX) break;
        try {
          if (s.id.startsWith('raw-')) {
            const term = (s.barcode || s.name || '').trim();
            if (!term) continue;
            augmentCalls += 1;
            const res = await fetch(`/api/assets/scan?q=${encodeURIComponent(term)}`, {
              credentials: 'include',
              cache: 'no-store',
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.asset) mergeAssetIntoCatalog(data.asset);
            }
            continue;
          }
          if (idInCatalog.has(s.id)) continue;
          augmentCalls += 1;
          const res = await fetch(`/api/assets/${encodeURIComponent(s.id)}`, {
            credentials: 'include',
            cache: 'no-store',
          });
          if (res.ok) {
            const data = await res.json();
            const asset = data?.asset ?? data;
            if (asset?.id) mergeAssetIntoCatalog(asset);
          } else {
            const term = (s.barcode || s.name || '').trim();
            if (term) {
              const resScan = await fetch(`/api/assets/scan?q=${encodeURIComponent(term)}`, {
                credentials: 'include',
                cache: 'no-store',
              });
              if (resScan.ok) {
                const data = await resScan.json();
                if (data?.asset) mergeAssetIntoCatalog(data.asset);
              }
            }
          }
        } catch {
          /* best-effort augment */
        }
      }

      let listForScope = list;
      if (scopeByLocation) {
        listForScope = list.filter((a) => inLocation(a.floorNumber, a.roomNumber));
      }
      // Build lookup sets — primary by UUID, secondary by barcode/assetId for legacy/cross-user assets
      const expectedIds = new Set(list.map((a) => a.id));
      const expectedByBarcode = new Map<string, { id: string; name?: string; barcode?: string; assetId?: string; floorNumber?: string | null; roomNumber?: string | null; lastMovedAt?: string | null }>();
      list.forEach((a) => {
        if (a.barcode) expectedByBarcode.set(a.barcode.trim().toLowerCase(), a);
        if (a.assetId) expectedByBarcode.set(a.assetId.trim().toLowerCase(), a);
      });

      const scannedIds = new Set<string>();
      const scannedByKey = new Map<string, CountScanItem>();
      countScansForReconciliation.forEach((s) => {
        // For raw scans: key by barcode/name; for resolved: key by UUID
        const key = s.id.startsWith('raw-') ? (s.barcode || s.name || s.id).toLowerCase() : s.id;
        if (!s.id.startsWith('raw-')) scannedIds.add(s.id);
        if (!scannedByKey.has(key)) scannedByKey.set(key, s);
      });

      // In system: UUID in catalogue, or raw/barcode match, or barcode confirms same asset id
      const barcodeKey = (b?: string | null) => (b || '').trim().toLowerCase();
      const isInSystem = (s: CountScanItem): boolean => {
        if (s.id.startsWith('raw-')) {
          const bk = barcodeKey(s.barcode) || barcodeKey(s.name);
          return bk ? expectedByBarcode.has(bk) : false;
        }
        if (expectedIds.has(s.id)) return true;
        if (s.barcode) {
          const row = expectedByBarcode.get(barcodeKey(s.barcode));
          if (row && row.id === s.id) return true;
        }
        return false;
      };

      /** System row for location checks — always prefer DB row over scan cache */
      const resolveSystemAsset = (s: CountScanItem) => {
        if (s.id.startsWith('raw-')) {
          const bk = barcodeKey(s.barcode) || barcodeKey(s.name);
          return bk ? (expectedByBarcode.get(bk) ?? null) : null;
        }
        const direct = list.find((a) => a.id === s.id);
        if (direct) return direct;
        if (s.barcode) {
          const b = expectedByBarcode.get(barcodeKey(s.barcode));
          if (b && b.id === s.id) return b;
        }
        return null;
      };

      // Count scans whose *registered* system location matches this room (not stale UI cache)
      const actualInLoc = scopeByLocation
        ? Array.from(scannedByKey.values()).filter((s) => {
            if (!isInSystem(s)) return false;
            const sys = resolveSystemAsset(s);
            const fl = sys?.floorNumber ?? s.floorNumber;
            const rm = sys?.roomNumber ?? s.roomNumber;
            return inLocation(fl, rm);
          }).length
        : scannedByKey.size;
      const expectedInLoc = listForScope.length;

      // Missing = expected at location but not in any scanned item
      const missing = listForScope.filter((a) => {
        if (scannedIds.has(a.id)) return false;
        if (a.barcode && scannedByKey.has(a.barcode.toLowerCase())) return false;
        if (a.assetId && scannedByKey.has(a.assetId.toLowerCase())) return false;
        return true;
      });

      // Truly extra = scanned but NOT in system at all (not resolvable by UUID or barcode)
      const trulyExtra = Array.from(scannedByKey.values()).filter((s) => !isInSystem(s));

      // Wrong location = scanned, in system, but registered at a DIFFERENT location than session
      const wrongLocation = scopeByLocation
        ? Array.from(scannedByKey.values()).filter((s) => {
            if (!isInSystem(s)) return false;
            // For raw scans resolved by barcode, use the system asset's location
            const systemAsset = resolveSystemAsset(s);
            const fl = systemAsset ? systemAsset.floorNumber : s.floorNumber;
            const rm = systemAsset ? systemAsset.roomNumber : s.roomNumber;
            return !inLocation(fl, rm);
          })
        : [];

      const locationDisplay = scopeByLocation ? [sessionFloor || null, sessionRoom || null].filter(Boolean).join(', ') || 'This location' : undefined;
      setReconcileShowMissing(false);
      setReconcileShowExtra(false);
      setReconcileShowMissingByLocation(false);
      const missingList = missing.slice(0, 100).map((a) => ({ id: a.id, name: a.name || a.assetId || a.id, barcode: a.barcode, floorNumber: a.floorNumber, roomNumber: a.roomNumber, lastMovedAt: a.lastMovedAt }));

      // Correct in room = scanned, in system, registered at the session location
      const correctInRoomScans = scopeByLocation
        ? Array.from(scannedByKey.values()).filter((s) => {
            if (!isInSystem(s)) return false;
            const systemAsset = resolveSystemAsset(s);
            const fl = systemAsset ? systemAsset.floorNumber : s.floorNumber;
            const rm = systemAsset ? systemAsset.roomNumber : s.roomNumber;
            return inLocation(fl, rm);
          })
        : Array.from(scannedByKey.values()).filter((s) => isInSystem(s));

      const correctInRoomList = correctInRoomScans.slice(0, 200).map((s) => {
        const sysAsset = resolveSystemAsset(s);
        return {
          id: sysAsset?.id || s.id,
          name: s.name || sysAsset?.name || s.barcode || s.id,
          barcode: s.barcode,
          floorNumber: sysAsset?.floorNumber ?? s.floorNumber,
          roomNumber: sysAsset?.roomNumber ?? s.roomNumber,
        };
      });
      setReconciliationResult({
        expectedCount: scopeByLocation ? expectedInLoc : list.length,
        actualCount: scopeByLocation ? actualInLoc : scannedByKey.size,
        scope: scopeByLocation ? 'location' : 'all',
        locationDisplay,
        expectedInLocation: scopeByLocation ? expectedInLoc : undefined,
        actualInLocation: scopeByLocation ? actualInLoc : undefined,
        difference: scopeByLocation ? expectedInLoc - actualInLoc : undefined,
        missing: missingList,
        extra: trulyExtra.slice(0, 100).map((s) => ({ id: s.id, name: s.name, barcode: s.barcode, floorNumber: s.floorNumber, roomNumber: s.roomNumber })),
        wrongLocation: wrongLocation.slice(0, 100).map((s) => {
          const sysAsset = resolveSystemAsset(s);
          return {
            id: sysAsset?.id || s.id,
            name: s.name || sysAsset?.name || s.barcode || s.id,
            barcode: s.barcode,
            systemFloor: sysAsset?.floorNumber ?? s.floorNumber,
            systemRoom: sysAsset?.roomNumber ?? s.roomNumber,
          };
        }),
        correctInRoom: correctInRoomList,
        submittedForReview: false,
        locationOverrideApplied,
      });
      if (missingList.length > 0) setShowMissingItemsDialog(true);
      const diff = scopeByLocation ? expectedInLoc - actualInLoc : list.length - scannedByKey.size;
      pushInventoryAudit(
        'reconciliation',
        scopeByLocation
          ? `loc=${locationDisplay || ''} catalog=${list.length} augment=${augmentMerged} sys=${expectedInLoc} scan=${actualInLoc} missing=${missingList.length} wrong_loc=${wrongLocation.length} unknown=${trulyExtra.length}`
          : `catalog=${list.length} augment=${augmentMerged} all sys=${list.length} scan=${scannedByKey.size} missing=${missing.length} unknown=${trulyExtra.length}`,
      );
      toast({
        title: 'Reconciliation complete',
        description: scopeByLocation
          ? `System: ${expectedInLoc}, scanned here: ${actualInLoc}. ${missingList.length} missing, ${wrongLocation.length} wrong location, ${trulyExtra.length} unknown.`
          : `Expected ${list.length}, counted ${scannedByKey.size}. ${missing.length} missing, ${trulyExtra.length} unknown.`,
      });
    } catch {
      toast({ title: 'Reconciliation failed', variant: 'destructive' });
    } finally {
      setReconciliationLoading(false);
    }
  }, [countScansForReconciliation, inventorySessionFloor, inventorySessionRoom, normalizeLoc, pushRecentAction, pushInventoryAudit, toast]);

  // AI-assisted summary when reconciliation result is set
  useEffect(() => {
    const r = reconciliationResult;
    if (!r || (r.missing.length === 0 && r.extra.length === 0)) {
      setInventorySummary(null);
      return;
    }
    setInventorySummaryLoading(true);
    const sessionLocationDisplay = [inventorySessionFloor.trim(), inventorySessionRoom.trim()].filter(Boolean).join(', ') || undefined;
    const extraLocationList = [...new Set(r.extra.map((e) => [e.floorNumber, e.roomNumber].filter(Boolean).join(', ')).filter(Boolean))];
    const missingRecentMoved = r.missing.filter((m) => {
      const t = m.lastMovedAt ? new Date(m.lastMovedAt).getTime() : 0;
      return Date.now() - t < 7 * 24 * 60 * 60 * 1000;
    }).length;
    fetch('/api/ai-analysis/inventory-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionLocationDisplay,
        missingCount: r.missing.length,
        extraCount: r.extra.length,
        extraFromOtherLocations: r.scope === 'location' && r.extra.length > 0,
        extraLocationList,
        missingRecentMovedCount: missingRecentMoved,
        totalScanned: countScansForReconciliation.length,
        inSystemAtLocation: r.expectedCount,
      }),
    })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        setInventorySummary({
          suggestedReason: data.suggestedReason || '',
          summaryLine: data.summaryLine || '',
          tips: Array.isArray(data.tips) ? data.tips : [],
        });
        if (data.suggestedReason && !countReviewReason) setCountReviewReason(data.suggestedReason);
      })
      .catch(() => setInventorySummary(null))
      .finally(() => setInventorySummaryLoading(false));
  }, [reconciliationResult, inventorySessionFloor, inventorySessionRoom, countScansForReconciliation.length]);

  const submitCountForReview = useCallback(async () => {
    const r = reconciliationResult;
    if (!r) return;
    // Mark locally first for instant feedback
    setReconciliationResult((prev) =>
      prev ? { ...prev, submittedForReview: true, reasonCode: countReviewReason, note: countReviewNote, submittedAt: Date.now() } : null
    );
    pushInventoryAudit(
      'submit_review',
      `reason=${countReviewReason || '—'} note=${(countReviewNote || '').slice(0, 200)} proof_images=${sessionProofImages.length}`,
    );
    // Persist to server so managers can view it
    try {
      await fetch('/api/inventory/submit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          floorNumber: inventorySessionFloor.trim() || null,
          roomNumber: inventorySessionRoom.trim() || null,
          sessionStartTime: countStartTime,
          sessionDurationMs: countStartTime ? Date.now() - countStartTime : null,
          totalScanned: countScansForReconciliation.length,
          totalInSystem: r.expectedCount,
          missingCount: r.missing.length,
          extraCount: r.extra.length,
          wrongLocationCount: (r.wrongLocation || []).length,
          reasonCode: countReviewReason || null,
          note: countReviewNote || null,
          // Merge reconciliation missing list with any not-read roster items not already captured
          missingItems: (() => {
            const base = r.missing.slice(0, 50).map(m => ({ id: m.id, name: m.name, barcode: m.barcode, floorNumber: m.floorNumber, roomNumber: m.roomNumber, source: 'reconciliation' }));
            const baseIds = new Set(base.map(m => m.id));
            const rosterExtra = rosterNotReadSnapshot
              .filter(x => !baseIds.has(x.id))
              .map(x => ({ id: x.id, name: x.name, barcode: x.barcode, floorNumber: x.floorNumber, roomNumber: x.roomNumber, source: 'roster_not_read' }));
            return [...base, ...rosterExtra].slice(0, 100);
          })(),
          rosterNotReadCount: rosterNotReadSnapshot.length,
          wrongLocationItems: (r.wrongLocation || []).slice(0, 50).map(w => ({ id: w.id, name: w.name, systemFloor: w.systemFloor, systemRoom: w.systemRoom })),
          correctInRoomItems: (r.correctInRoom || []).slice(0, 100).map(c => ({ id: c.id, name: c.name, barcode: c.barcode, floorNumber: c.floorNumber, roomNumber: c.roomNumber })),
          extraItems: r.extra.slice(0, 50).map(e => ({ id: e.id, name: e.name, barcode: e.barcode, floorNumber: e.floorNumber, roomNumber: e.roomNumber })),
        }),
      });
    } catch {
      // Server submission is best-effort; local state already updated
    }
    setCountReviewReason('');
    setCountReviewNote('');
    toast({ title: 'Submitted for review', description: 'Manager can review the inventory count and discrepancies.' });
  }, [toast, countReviewReason, countReviewNote, pushInventoryAudit, sessionProofImages.length, reconciliationResult, inventorySessionFloor, inventorySessionRoom, countStartTime, countScansForReconciliation.length, rosterNotReadSnapshot]);

  const saveReconcileEditLocation = useCallback(async () => {
    const asset = reconcileEditLocationAsset;
    if (!asset) return;
    const vals = reconcileEditLocationForm.getValues();
    if (!vals.floorNumber?.trim() || !vals.roomNumber?.trim()) {
      toast({ title: 'Floor and room required', variant: 'destructive' });
      return;
    }
    setReconcileEditLocationSaving(true);
    try {
      const r = await fetch(`/api/assets/${asset.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ floorNumber: vals.floorNumber.trim(), roomNumber: vals.roomNumber.trim() }),
      });
      if (!r.ok) throw new Error();
      toast({ title: 'Location updated', description: `Floor ${vals.floorNumber}, Room ${vals.roomNumber}` });
      setReconcileEditLocationAsset(null);
      setReconciliationResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          missing: prev.missing.map((m) => (m.id === asset.id ? { ...m, floorNumber: vals.floorNumber.trim(), roomNumber: vals.roomNumber.trim() } : m)),
          extra: prev.extra.map((e) => (e.id === asset.id ? { ...e, floorNumber: vals.floorNumber.trim(), roomNumber: vals.roomNumber.trim() } : e)),
        };
      });
      setUnifiedInventory((prev) => prev.map((x) => (x.type === 'asset' && x.data.id === asset.id ? { ...x, data: { ...x.data, floorNumber: vals.floorNumber.trim(), roomNumber: vals.roomNumber.trim() } } : x)));
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' });
    } finally {
      setReconcileEditLocationSaving(false);
    }
  }, [reconcileEditLocationAsset, reconcileEditLocationForm, toast]);

  const openReconcileMissingMoveHistory = useCallback(
    async (asset: { id: string; name: string }) => {
      setReconcileMissingMoveDialog(asset);
      setReconcileMoveHistoryLoading(true);
      setReconcileMoveHistoryItems([]);
      try {
        const res = await fetch(`/api/assets/${encodeURIComponent(asset.id)}/movement-history`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) {
          toast({ title: 'Could not load movement history', variant: 'destructive' });
          return;
        }
        const data = await res.json();
        setReconcileMoveHistoryItems(Array.isArray(data) ? data : []);
      } catch {
        toast({ title: 'Could not load movement history', variant: 'destructive' });
      } finally {
        setReconcileMoveHistoryLoading(false);
      }
    },
    [toast],
  );

  const openRoomCatalog = useCallback(
    async (opts?: { withRfidStatus?: boolean }) => {
      const withRfid = opts?.withRfidStatus === true;
      const f = inventorySessionFloor.trim();
      const r = inventorySessionRoom.trim();
      if (!f || !r) {
        toast({ title: 'Set floor & room', description: 'Set the count location (floor and room) first.', variant: 'destructive' });
        return;
      }
      setRoomCatalogRfidMode(withRfid);
      setRoomCatalogOpen(true);
      setRoomCatalogLoading(true);
      setRoomCatalogAssets([]);

      const scannedIds = new Set<string>();
      const scannedByKey = new Map<string, CountScanItem>();
      countScansForReconciliation.forEach((s) => {
        const key = s.id.startsWith('raw-') ? (s.barcode || s.name || s.id).toLowerCase() : s.id;
        if (!s.id.startsWith('raw-')) scannedIds.add(s.id);
        if (!scannedByKey.has(key)) scannedByKey.set(key, s);
      });
      const isReadThisSession = (a: { id: string; barcode?: string | null; assetId?: string | null }) => {
        if (scannedIds.has(a.id)) return true;
        const bc = (a.barcode || '').trim().toLowerCase();
        if (bc && scannedByKey.has(bc)) return true;
        const aid = (a.assetId || '').trim().toLowerCase();
        if (aid && scannedByKey.has(aid)) return true;
        return false;
      };

      try {
        const res = await fetch(
          `/api/assets/by-room?floorNumber=${encodeURIComponent(f)}&roomNumber=${encodeURIComponent(r)}`,
          { credentials: 'include', cache: 'no-store' },
        );
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        const enriched = arr.map(
          (row: {
            id: string;
            name?: string | null;
            barcode?: string | null;
            assetId?: string | null;
            status?: string | null;
            floorNumber?: string | null;
            roomNumber?: string | null;
            imageUrl?: string | null;
          }) => ({
            ...row,
            ...(withRfid ? { rfidReadThisSession: isReadThisSession(row) } : {}),
          }),
        );
        if (withRfid) {
          enriched.sort((x, y) => Number(x.rfidReadThisSession) - Number(y.rfidReadThisSession));
          // Persist not-read snapshot for auto-inclusion in submitted report
          setRosterNotReadSnapshot(enriched.filter((x) => !x.rfidReadThisSession));
        }
        setRoomCatalogAssets(enriched);
      } catch {
        toast({ title: 'Could not load assets for this room', variant: 'destructive' });
      } finally {
        setRoomCatalogLoading(false);
      }
    },
    [inventorySessionFloor, inventorySessionRoom, toast, countScansForReconciliation],
  );

  const endCountSession = useCallback(() => {
    const total = unifiedInventory.length;
    pushRecentAction('count', `Inventory session: ${total} item${total !== 1 ? 's' : ''} (${countLocationLabel.trim() || 'All'})`);
    try {
      localStorage.removeItem(INVENTORY_SESSION_KEY);
    } catch {
      /* ignore */
    }
    inventoryUndoStackRef.current = [];
    setCountSessionActive(false);
    setInventoryRoomTagVerified(false);
    setInventorySessionFloor('');
    setInventorySessionRoom('');
    toast({ title: 'Session ended', description: `${total} item${total !== 1 ? 's' : ''} in list.` });
  }, [unifiedInventory.length, countLocationLabel, pushRecentAction, toast]);

  const exportCountReport = useCallback(() => {
    const assetItems = unifiedInventory.filter((x): x is { type: 'asset'; data: CountScanItem } => x.type === 'asset').map((x) => x.data);
    if (assetItems.length === 0) {
      toast({ title: 'Nothing to export', description: 'Add assets to inventory first.', variant: 'destructive' });
      return;
    }
    const headers = ['Location', 'Asset ID', 'Barcode', 'Name'];
    const locationLabel = countLocationLabel.trim() || 'All';
    const rows = assetItems.map((s) => [locationLabel, s.id, s.barcode ?? '', s.name ?? '']);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-count-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Count report exported' });
  }, [unifiedInventory, countLocationLabel, toast]);

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
                  <Button type="button" size="lg" variant="outline" className="h-14 flex flex-col gap-0.5" onClick={() => {
                    // Reset move destination verification when opening
                    setMoveDestinationRoomTagVerified(false);
                    setMoveDestinationFloor('');
                    setMoveDestinationRoom('');
                    transferForm.reset();
                    // Pre-fill with current location for reference
                    if (currentAsset?.floorNumber && currentAsset?.roomNumber) {
                      transferForm.setValue('floorNumber', currentAsset.floorNumber);
                      transferForm.setValue('roomNumber', currentAsset.roomNumber);
                    }
                    openHandheldDialogAfterTap(() => setShowMove(true));
                  }}>
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
          <div className={cn('w-full max-w-lg mx-auto px-3 sm:px-4 pb-6', largeTextMode && 'max-w-xl')}>
            {/* Hero: clear hierarchy, responsive */}
            <header className="pt-2 pb-4 sm:pt-4">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20 ring-2 ring-white/50 dark:ring-slate-800/50">
                  <ClipboardList className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className={cn('font-bold text-slate-900 dark:text-white tracking-tight', largeTextMode ? 'text-xl' : 'text-lg')}>
                    Inventory
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                    Scan assets, food, or tickets into one list. Export reports and compare with system.
                  </p>
                </div>
              </div>
            </header>

            {!countSessionActive ? (
              <div className="space-y-4">
                {/* Step indicator */}
                <div className="flex items-center gap-2 px-1">
                  <div className={cn('flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0', inventoryRoomTagVerified || (inventorySessionFloor || inventorySessionRoom) ? 'bg-emerald-500 text-white' : 'bg-violet-600 text-white')}>
                    {inventoryRoomTagVerified || (inventorySessionFloor || inventorySessionRoom) ? <CheckCircle2 className="h-4 w-4" /> : '1'}
                  </div>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  <div className={cn('flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0', inventoryRoomTagVerified || (inventorySessionFloor || inventorySessionRoom) ? 'bg-violet-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400')}>2</div>
                </div>

                {/* Location card */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/95 shadow-lg overflow-hidden">
                  {inventoryRoomTagVerified ? (
                    <div className="p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Step 1 — Room verified via RFID</p>
                          <p className="text-base font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5">
                            Floor {inventorySessionFloor}, Room {inventorySessionRoom}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Reconciliation will compare this exact location. Rescanning corrects the location.
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="rounded-xl text-slate-500 gap-1.5 h-9" onClick={() => setShowRoomTagScanDialog(true)}>
                        <Radio className="h-4 w-4" /> Rescan room tag
                      </Button>
                    </div>
                  ) : (inventorySessionFloor || inventorySessionRoom) ? (
                    <div className="p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                          <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Step 1 — Location set manually</p>
                          <p className="text-base font-semibold text-blue-700 dark:text-blue-300 mt-0.5">
                            Floor {inventorySessionFloor || '—'}, Room {inventorySessionRoom || '—'}
                          </p>
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 shrink-0" /> RFID scan recommended for higher accuracy
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 h-9" onClick={() => { setManualFloorInput(inventorySessionFloor); setManualRoomInput(inventorySessionRoom); setShowManualRoomDialog(true); }}>
                          <MapPin className="h-4 w-4" /> Change
                        </Button>
                        <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 h-9" onClick={() => setShowRoomTagScanDialog(true)}>
                          <Radio className="h-4 w-4" /> Scan RFID instead
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                          <Radio className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Step 1 — Set your location</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Scan room RFID tag for automatic detection, or enter location manually. Location is used for accurate reconciliation.
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button
                          size="lg"
                          className="h-14 rounded-2xl text-sm font-semibold shadow-md shadow-violet-500/20"
                          onClick={() => setShowRoomTagScanDialog(true)}
                        >
                          <Radio className="h-5 w-5 mr-2 shrink-0" />
                          Scan room RFID tag
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          className="h-14 rounded-2xl text-sm font-semibold"
                          onClick={() => { setManualFloorInput(''); setManualRoomInput(''); setShowManualRoomDialog(true); }}
                        >
                          <MapPin className="h-5 w-5 mr-2 shrink-0" />
                          Enter manually
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full rounded-xl text-slate-500 h-9"
                        onClick={() => startWithManualLocation('', '')}
                      >
                        Skip — global count (no location filter)
                      </Button>
                    </div>
                  )}
                </div>

                {/* Step 2 - Start session */}
                {(inventoryRoomTagVerified || inventorySessionFloor || inventorySessionRoom) && (
                  <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/95 shadow-lg p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                        <Hash className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Step 2 — Start scanning</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Scan barcodes, RFID tags, or QR codes into the inventory list</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">Session label (optional)</label>
                      <Input
                        placeholder="e.g. Morning shift, Aisle 3"
                        value={countLocationLabel}
                        onChange={(e) => setCountLocationLabel(e.target.value)}
                        className="rounded-xl h-11 text-base border-slate-200 dark:border-slate-600 focus-visible:ring-violet-500"
                      />
                    </div>
                    <Button
                      size="lg"
                      className="w-full h-14 rounded-2xl text-base font-semibold shadow-lg shadow-violet-500/25"
                      onClick={startCountSession}
                    >
                      <Hash className="h-5 w-5 mr-2 shrink-0" />
                      Start inventory session
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {/* Stats: world-class card, responsive grid */}
                <div className="rounded-2xl border border-violet-200/80 dark:border-violet-800/80 bg-gradient-to-br from-violet-50 via-white to-indigo-50/80 dark:from-violet-950/30 dark:via-slate-800/80 dark:to-indigo-950/20 p-4 sm:p-5 shadow-lg shadow-violet-200/30 dark:shadow-violet-900/20">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div>
                      <p className={cn('font-bold tabular-nums text-violet-700 dark:text-violet-200 leading-none', largeTextMode ? 'text-4xl' : 'text-3xl')}>{unifiedInventory.length}</p>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">items in session</p>
                    </div>
                    {inventoryRoomTagVerified && (
                      <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1.5 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">RFID verified</span>
                      </div>
                    )}
                  </div>
                  {unifiedInventory.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {(() => {
                        const assetCount = unifiedInventory.filter(x => x.type === 'asset').length;
                        const foodCount = unifiedInventory.filter(x => x.type === 'food').length;
                        const ticketCount = unifiedInventory.filter(x => x.type === 'ticket').length;
                        const pending = unifiedInventory.filter(x => x.type === 'pending_scan').length;
                        return (
                          <>
                            <div className="rounded-xl bg-white/70 dark:bg-slate-800/60 px-2 py-1.5 text-center">
                              <p className="text-base font-bold text-slate-800 dark:text-slate-200 tabular-nums">{assetCount}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">assets</p>
                            </div>
                            <div className="rounded-xl bg-white/70 dark:bg-slate-800/60 px-2 py-1.5 text-center">
                              <p className="text-base font-bold text-slate-800 dark:text-slate-200 tabular-nums">{foodCount}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">food</p>
                            </div>
                            <div className="rounded-xl bg-white/70 dark:bg-slate-800/60 px-2 py-1.5 text-center">
                              <p className="text-base font-bold text-slate-800 dark:text-slate-200 tabular-nums">{ticketCount + pending}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{pending > 0 ? `tickets+${pending}q` : 'tickets'}</p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Scan bar: touch-optimized, clear CTAs */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex flex-1 gap-2 min-w-0">
                    <Input
                      ref={countBarcodeInputRef}
                      placeholder="Barcode or Asset ID"
                      className="rounded-xl h-12 sm:h-11 flex-1 min-w-0 text-base border-slate-200 dark:border-slate-600 focus-visible:ring-violet-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = (e.target as HTMLInputElement).value?.trim();
                          if (v) { addToUnifiedInventory(v); (e.target as HTMLInputElement).value = ''; }
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      className="h-12 w-12 sm:h-11 sm:w-11 rounded-xl shrink-0 min-h-[44px] min-w-[44px]"
                      onClick={() => { const el = countBarcodeInputRef.current; if (el?.value?.trim()) { addToUnifiedInventory(el.value.trim()); el.value = ''; } }}
                      disabled={inventoryLoading}
                      aria-label="Add by barcode"
                    >
                      {inventoryLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                    </Button>
                  </div>
                  <div className="flex gap-2 justify-end sm:justify-start">
                    <Button variant="outline" size="icon" className={cn('h-12 w-12 sm:h-11 sm:w-11 rounded-xl shrink-0 min-h-[44px] min-w-[44px]', countVoiceListening && 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700')} onClick={toggleCountVoice} aria-label="Voice input">
                      <Mic className="h-5 w-5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-12 w-12 sm:h-11 sm:w-11 rounded-xl shrink-0 min-h-[44px] min-w-[44px]" onClick={() => setShowCountScanner(true)} aria-label="Open scanner">
                      <Scan className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                <div className="sr-only" aria-live="polite" aria-atomic="true">
                  {inventoryLiveMessage}
                </div>

                {inventoryPendingCount > 0 && (
                  <div className="rounded-xl border border-amber-400/80 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-amber-950 dark:text-amber-100">
                      {inventoryPendingCount} offline · will sync when online
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-lg h-9 border-amber-600 text-amber-900 dark:text-amber-100"
                      disabled={!isOnline}
                      onClick={() => void flushPendingInventoryScans()}
                    >
                      Retry sync
                    </Button>
                  </div>
                )}

                {/* Session proof + audit (optional) */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Session proof & notes (audit export)</p>
                  <Textarea
                    value={sessionProofNote}
                    onChange={(e) => setSessionProofNote(e.target.value)}
                    placeholder="e.g. Supervisor present, sealed room…"
                    className="min-h-[72px] rounded-xl text-sm resize-none"
                    aria-label="Session proof notes for auditors"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={inventoryProofFileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      aria-label="Attach proof photos"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files?.length) return;
                        const cap = INVENTORY_PROOF_MAX_IMAGES - sessionProofImages.length;
                        if (cap <= 0) {
                          toast({ title: 'Photo limit', description: `Maximum ${INVENTORY_PROOF_MAX_IMAGES} images.`, variant: 'destructive' });
                          e.target.value = '';
                          return;
                        }
                        Array.from(files)
                          .slice(0, cap)
                          .forEach((file) => {
                            if (file.size > 450_000) {
                              toast({ title: 'File too large', description: 'Use images under 450 KB each.', variant: 'destructive' });
                              return;
                            }
                            const r = new FileReader();
                            r.onload = () => {
                              if (typeof r.result === 'string') {
                                setSessionProofImages((prev) => [...prev, r.result as string].slice(0, INVENTORY_PROOF_MAX_IMAGES));
                                pushInventoryAudit('proof_image_added', file.name);
                              }
                            };
                            r.readAsDataURL(file);
                          });
                        e.target.value = '';
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" className="rounded-xl h-9 gap-1" onClick={() => inventoryProofFileRef.current?.click()}>
                      <Camera className="h-4 w-4" aria-hidden />
                      Add photo ({sessionProofImages.length}/{INVENTORY_PROOF_MAX_IMAGES})
                    </Button>
                    {sessionProofImages.length > 0 && (
                      <Button type="button" variant="ghost" size="sm" className="h-9 text-red-600" onClick={() => { setSessionProofImages([]); pushInventoryAudit('proof_images_cleared', ''); }}>
                        Remove photos
                      </Button>
                    )}
                  </div>
                  {sessionProofImages.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {sessionProofImages.map((src, idx) => (
                        <img key={idx} src={src} alt="" className="h-14 w-14 rounded-lg object-cover border border-slate-200 dark:border-slate-600" />
                      ))}
                    </div>
                  )}
                </div>

                {/* Toolbar: search + sort + export + undo + clear */}
                {unifiedInventory.length > 0 && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden />
                      <Input
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        placeholder="Search list by name, barcode, location…"
                        className="rounded-xl h-10 pl-9 text-base"
                        aria-label="Filter inventory list"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={auditSort}
                      onChange={(e) => setAuditSort(e.target.value as 'scan' | 'name' | 'location')}
                      className="h-10 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-3 font-medium min-w-[120px]"
                      aria-label="Sort inventory list"
                    >
                      <option value="scan">Scan order</option>
                      <option value="name">Name A–Z</option>
                      <option value="location">Location</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={exportCountReport} disabled={!unifiedInventory.some((x) => x.type === 'asset')} className="rounded-xl gap-1.5 h-10">
                      <Download className="h-4 w-4" /> Count CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportAuditList} className="rounded-xl gap-1.5 h-10">
                      <Download className="h-4 w-4" /> Audit CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={undoLastInventoryAdd} className="rounded-xl gap-1.5 h-10" aria-label="Undo last scan">
                      <Undo2 className="h-4 w-4" /> Undo
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setUnifiedInventory([]); inventoryUndoStackRef.current = []; pushInventoryAudit('clear_all', String(unifiedInventory.length)); toast({ title: 'List cleared' }); }} className="rounded-xl h-10">
                      Clear all
                    </Button>
                    </div>
                  </div>
                )}

                {/* List: sticky header, scroll, empty state */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/95 backdrop-blur-sm shadow-lg overflow-hidden">
                  <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 bg-slate-50/95 dark:bg-slate-800/95 border-b border-slate-200/80 dark:border-slate-700/80 backdrop-blur-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      List{' '}
                      {unifiedInventory.length > 0 && (
                        <span className="text-slate-700 dark:text-slate-300 font-normal tabular-nums">
                          ({inventorySearch.trim() ? `${inventoryDisplayList.length}/` : ''}{unifiedInventory.length})
                        </span>
                      )}
                    </p>
                    {unifiedInventory.some((x) => x.type === 'asset') && !countSwipeHintDismissed && (
                      <span className="handheld-swipe-hint inline-flex items-center gap-1.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                        <ChevronRight className="h-3.5 w-3.5 rotate-180" aria-hidden />
                        Swipe for actions
                      </span>
                    )}
                  </div>
                  <div
                    ref={inventoryScrollParentRef}
                    className="max-h-[min(420px,50vh)] sm:max-h-[440px] overflow-y-auto overscroll-contain px-4 pb-4"
                    role="list"
                    aria-label="Items in this inventory session"
                  >
                  {unifiedInventory.length === 0 ? (
                    <div className="py-12 sm:py-14 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30">
                      <Package className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-500 mb-3" />
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Scan or enter barcode to add items</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Assets, food supply, or tickets</p>
                    </div>
                  ) : inventoryDisplayList.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-600 dark:text-slate-400 px-2">
                      No items match your search.{' '}
                      <button type="button" className="text-violet-600 dark:text-violet-400 font-semibold underline" onClick={() => setInventorySearch('')}>
                        Clear search
                      </button>
                    </div>
                  ) : (
                    <HandheldInventoryVirtualList
                      items={inventoryDisplayList}
                      rowVirtualizer={inventoryRowVirtualizer}
                      prefersReducedMotion={prefersReducedMotion}
                      countSwipeHintDismissed={countSwipeHintDismissed}
                      setCountSwipeHintDismissed={setCountSwipeHintDismissed}
                      countSwipeStartRef={countSwipeStartRef}
                      countSwipeOffsetRef={countSwipeOffsetRef}
                      countItemSwipedId={countItemSwipedId}
                      setCountItemSwipedId={setCountItemSwipedId}
                      countSwipeOffset={countSwipeOffset}
                      setCountSwipeOffset={setCountSwipeOffset}
                      sessionFloor={inventorySessionFloor}
                      sessionRoom={inventorySessionRoom}
                      isWrongRoom={isWrongRoom}
                      wrongRoomExpandedId={countItemWrongRoomExpandedId}
                      setWrongRoomExpandedId={setCountItemWrongRoomExpandedId}
                      openAuditFoodDetails={openAuditFoodDetails}
                      openAuditTicketDetails={openAuditTicketDetails}
                      openCountItemDetails={openCountItemDetails}
                      openCountItemStatus={openCountItemStatus}
                      openCountItemMove={openCountItemMove}
                      setAuditCommentAsset={setAuditCommentAsset}
                      setAuditCommentText={setAuditCommentText}
                      setAuditCommentImagePreview={setAuditCommentImagePreview}
                      auditCommentImageInputRef={auditCommentImageInputRef}
                      onViewRoomCatalog={
                        countSessionActive && inventorySessionFloor.trim() && inventorySessionRoom.trim()
                          ? () => void openRoomCatalog({ withRfidStatus: true })
                          : undefined
                      }
                    />
                  )}
                  </div>

                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-2xl h-12 font-medium" onClick={endCountSession}>
                    End session
                  </Button>
                </div>

                {(inventorySessionFloor.trim() || inventorySessionRoom.trim()) && (
                  <div className="rounded-2xl border border-violet-200/80 dark:border-violet-800/80 bg-violet-50/80 dark:bg-violet-900/20 px-4 py-3">
                    <div className="flex items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-900/60 flex items-center justify-center shrink-0">
                          <MapPin className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-violet-900 dark:text-violet-100">
                              Floor {inventorySessionFloor.trim() || '—'}, Room {inventorySessionRoom.trim() || '—'}
                            </span>
                            {inventoryRoomTagVerified ? (
                              <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">RFID</span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">Manual</span>
                            )}
                          </div>
                          <p className="text-xs text-violet-600/80 dark:text-violet-400/80 mt-0.5">Reconciliation compares this location (101 = 0101)</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-xl h-8 px-2.5 text-violet-700 dark:text-violet-300"
                          onClick={() => { roomTagChangeOnlyRef.current = true; setShowRoomTagScanDialog(true); }}
                        >
                          <Radio className="h-3.5 w-3.5 mr-1" />
                          RFID
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-xl h-8 px-2.5 text-violet-700 dark:text-violet-300"
                          onClick={() => { setManualFloorInput(inventorySessionFloor); setManualRoomInput(inventorySessionRoom); setShowManualRoomDialog(true); }}
                        >
                          <MapPin className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <section className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 overflow-hidden shadow-lg">
                  <div className="p-5 sm:p-6 bg-gradient-to-br from-slate-50 to-slate-100/80 dark:from-slate-800/80 dark:to-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                        <Scale className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">Compare with system</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Run once after scanning the room. You get one clear list: missing, found here, and wrong-room tags — then submit one report.</p>
                      </div>
                    </div>
                    <Button
                      className="w-full mt-5 h-12 rounded-2xl gap-2 font-semibold shadow-md min-h-[48px]"
                      onClick={() => { setReconcileConfirmStep('confirm'); setReconcileCorrectFloor(inventorySessionFloor); setReconcileCorrectRoom(inventorySessionRoom); setShowReconcileConfirmDialog(true); }}
                      disabled={reconciliationLoading || countScansForReconciliation.length === 0}
                    >
                      {reconciliationLoading ? <Loader2 className="h-5 w-5 animate-spin shrink-0" /> : <Scale className="h-5 w-5 shrink-0" />}
                      {reconciliationLoading ? 'Comparing…' : 'Start reconciliation'}
                    </Button>
                  </div>
                  {reconciliationResult && (() => {
                    const hasIssues =
                      reconciliationResult.missing.length > 0 ||
                      (reconciliationResult.wrongLocation || []).length > 0 ||
                      reconciliationResult.extra.length > 0;
                    const wrongLoc = reconciliationResult.wrongLocation || [];
                    const inRoom = reconciliationResult.correctInRoom || [];
                    return (
                    <div className="pt-1 pb-4 px-3 sm:px-4 space-y-3">

                      {/* ── Header strip ─────────────────────────────── */}
                      <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-violet-700 px-4 py-3.5 flex items-center gap-3 shadow-lg shadow-violet-500/25">
                        <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                          <Scale className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white leading-snug">
                            {reconciliationResult.locationDisplay
                              ? `Floor ${reconciliationResult.locationDisplay.split(',')[0]?.trim()}, Room ${reconciliationResult.locationDisplay.split(',')[1]?.trim() || reconciliationResult.locationDisplay}`
                              : 'Full inventory reconciliation'}
                          </p>
                          <p className="text-[11px] text-violet-200 mt-0.5">
                            {countScansForReconciliation.length} scanned · {reconciliationResult.expectedCount} expected in system
                          </p>
                        </div>
                        {/* status pill */}
                        {!hasIssues ? (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-400/25 text-emerald-100 text-[11px] font-bold">
                            <CheckCircle2 className="h-3.5 w-3.5" /> All clear
                          </span>
                        ) : (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-400/25 text-amber-100 text-[11px] font-bold">
                            <AlertCircle className="h-3.5 w-3.5" /> {reconciliationResult.missing.length + wrongLoc.length + reconciliationResult.extra.length} issues
                          </span>
                        )}
                      </div>

                      {/* ── All-clear banner ─────────────────────────── */}
                      {!hasIssues && (
                        <div className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-emerald-50/40 dark:from-emerald-950/40 dark:to-emerald-950/10 px-4 py-3.5 flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-emerald-900 dark:text-emerald-100 text-sm">Perfect — every asset accounted for</p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">No missing items, no wrong-room tags, no unknown scans.</p>
                          </div>
                        </div>
                      )}

                      {/* ── MISSING section ──────────────────────────── */}
                      {reconciliationResult.missing.length > 0 && (
                        <div className="rounded-2xl overflow-hidden border border-amber-200 dark:border-amber-800 shadow-sm">
                          {/* section header */}
                          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-500 dark:bg-amber-600">
                            <AlertCircle className="h-4 w-4 text-white shrink-0" />
                            <p className="text-xs font-bold text-white uppercase tracking-wider flex-1">Missing from this room</p>
                            <span className="h-6 min-w-[1.5rem] px-1.5 rounded-lg bg-white/25 text-white text-xs font-black flex items-center justify-center tabular-nums">
                              {reconciliationResult.missing.length}
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40 px-4 py-2 border-b border-amber-100 dark:border-amber-900">
                            Registered to this room in the system but not picked up by RFID this session — may have moved or been blocked.
                          </p>
                          <ul className="divide-y divide-amber-100 dark:divide-amber-900/40 bg-white dark:bg-slate-900 max-h-72 overflow-y-auto">
                            {reconciliationResult.missing.map((m) => (
                              <li key={m.id} className="flex flex-col gap-2 px-4 py-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                                    <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{m.name || m.barcode || m.id}</p>
                                    {m.barcode && <p className="text-[11px] text-slate-500 font-mono mt-0.5">{m.barcode}</p>}
                                  </div>
                                  <span className="shrink-0 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg px-2 py-0.5 tabular-nums">
                                    Fl {m.floorNumber ?? '—'} · {m.roomNumber ?? '—'}
                                  </span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:pl-11">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 rounded-xl h-9 gap-1.5 border-violet-300 bg-violet-50/80 dark:bg-violet-950/30 text-violet-900 dark:text-violet-100 flex-1 sm:flex-initial font-semibold"
                                    onClick={() => void openRoomCatalog({ withRfidStatus: true })}
                                  >
                                    <List className="h-3.5 w-3.5" />
                                    Room roster
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 rounded-xl h-9 gap-1.5 border-amber-300 text-amber-900 dark:text-amber-100 flex-1 sm:flex-initial"
                                    onClick={() => void openReconcileMissingMoveHistory({ id: m.id, name: m.name || m.barcode || m.id })}
                                  >
                                    <History className="h-3.5 w-3.5" />
                                    Movement history
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* ── CORRECT IN ROOM section ──────────────────── */}
                      {inRoom.length > 0 && (
                        <div className="rounded-2xl overflow-hidden border border-emerald-200 dark:border-emerald-800 shadow-sm">
                          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-emerald-500 dark:bg-emerald-600">
                            <CheckCircle2 className="h-4 w-4 text-white shrink-0" />
                            <p className="text-xs font-bold text-white uppercase tracking-wider flex-1">Scanned &amp; registered here</p>
                            <span className="h-6 min-w-[1.5rem] px-1.5 rounded-lg bg-white/25 text-white text-xs font-black flex items-center justify-center tabular-nums">
                              {inRoom.length}
                            </span>
                          </div>
                          <ul className="divide-y divide-emerald-100 dark:divide-emerald-900/30 bg-white dark:bg-slate-900 max-h-56 overflow-y-auto">
                            {inRoom.map((c) => (
                              <li key={c.id} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{c.name}</p>
                                    {c.barcode && <p className="text-[11px] text-slate-400 font-mono">{c.barcode}</p>}
                                  </div>
                                  <span className="shrink-0 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-full px-2 py-0.5 uppercase tracking-wide">
                                    In room
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="shrink-0 rounded-xl h-8 gap-1 border-violet-300 bg-violet-50/80 dark:bg-violet-950/30 text-violet-900 dark:text-violet-100 text-[11px] font-semibold w-full sm:w-auto"
                                  onClick={() => void openRoomCatalog({ withRfidStatus: true })}
                                >
                                  <List className="h-3.5 w-3.5" />
                                  Room roster
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* ── WRONG LOCATION section ───────────────────── */}
                      {wrongLoc.length > 0 && (
                        <div className="rounded-2xl overflow-hidden border-2 border-orange-300 dark:border-orange-700 shadow-md">
                          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500">
                            <MapPin className="h-4 w-4 text-white shrink-0" />
                            <p className="text-xs font-bold text-white uppercase tracking-wider flex-1">Scanned here — registered elsewhere</p>
                            <span className="h-6 min-w-[1.5rem] px-1.5 rounded-lg bg-white/25 text-white text-xs font-black flex items-center justify-center tabular-nums">
                              {wrongLoc.length}
                            </span>
                          </div>
                          <p className="text-[11px] text-orange-900 dark:text-orange-100 bg-orange-50 dark:bg-orange-950/40 px-4 py-2 border-b border-orange-100 dark:border-orange-900">
                            These tags were read in this room but their registered location in the system is different.
                          </p>
                          <ul className="divide-y divide-orange-100 dark:divide-orange-900/40 bg-white dark:bg-slate-900 max-h-80 overflow-y-auto">
                            {wrongLoc.map((w) => (
                              <li key={w.id} className="px-4 py-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{w.name || w.barcode || w.id}</p>
                                    {w.barcode && <p className="text-[11px] text-slate-400 font-mono mt-0.5">{w.barcode}</p>}
                                  </div>
                                </div>
                                {/* location comparison pill */}
                                <div className="flex items-center gap-2 text-[11px] flex-wrap">
                                  <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-lg px-2 py-1">
                                    <MapPin className="h-3 w-3 text-orange-600 shrink-0" />
                                    <span className="text-orange-900 dark:text-orange-100 font-medium">
                                      Registered: Fl {w.systemFloor ?? '—'}, Rm {w.systemRoom ?? '—'}
                                    </span>
                                  </div>
                                  <span className="text-slate-400">→</span>
                                  <div className="flex items-center gap-1 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 rounded-lg px-2 py-1">
                                    <Radio className="h-3 w-3 text-violet-600 shrink-0" />
                                    <span className="text-violet-900 dark:text-violet-100 font-medium">
                                      Scanned: {reconciliationResult.locationDisplay || [inventorySessionFloor, inventorySessionRoom].filter(Boolean).join(', ') || 'here'}
                                    </span>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="w-full h-8 rounded-xl border-orange-400 text-orange-800 dark:text-orange-200 text-xs font-semibold gap-1.5"
                                  onClick={() => {
                                    setReconcileEditLocationAsset({ id: w.id, name: w.name, floorNumber: w.systemFloor, roomNumber: w.systemRoom });
                                    reconcileEditLocationForm.reset({ floorNumber: w.systemFloor || '', roomNumber: w.systemRoom || '' });
                                  }}
                                >
                                  <MapPin className="h-3.5 w-3.5" /> Update registered room
                                </Button>
                              </li>
                            ))}
                          </ul>
                          {/* bulk move */}
                          {(inventorySessionFloor.trim() || inventorySessionRoom.trim()) && (
                            <div className="bg-orange-50/80 dark:bg-orange-950/20 border-t border-orange-200 dark:border-orange-800 px-4 py-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full rounded-xl border-orange-400 text-orange-900 dark:text-orange-100 font-semibold text-xs h-9 gap-1.5"
                                onClick={async () => {
                                  const sessionFloor = inventorySessionFloor.trim();
                                  const sessionRoom = inventorySessionRoom.trim();
                                  if (!sessionFloor || !sessionRoom) { toast({ title: 'Set count floor & room first', variant: 'destructive' }); return; }
                                  let moved = 0;
                                  for (const e of wrongLoc) {
                                    try {
                                      const r = await fetch(`/api/assets/${e.id}/move`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ floorNumber: sessionFloor, roomNumber: sessionRoom }) });
                                      if (r.ok) moved++;
                                    } catch { /* skip */ }
                                  }
                                  if (moved > 0) {
                                    toast({ title: 'Locations updated', description: `${moved} item(s) now registered to Floor ${sessionFloor}, Room ${sessionRoom}.` });
                                    void runReconciliation();
                                  } else toast({ title: 'Could not move items', variant: 'destructive' });
                                }}
                              >
                                <MapPin className="h-3.5 w-3.5" /> Move all {wrongLoc.length} to this count room
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── NOT IN SYSTEM section ────────────────────── */}
                      {reconciliationResult.extra.length > 0 && (
                        <div className="rounded-2xl overflow-hidden border border-red-200 dark:border-red-900 shadow-sm">
                          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-red-500 dark:bg-red-600">
                            <AlertCircle className="h-4 w-4 text-white shrink-0" />
                            <p className="text-xs font-bold text-white uppercase tracking-wider flex-1">Unknown tags</p>
                            <span className="h-6 min-w-[1.5rem] px-1.5 rounded-lg bg-white/25 text-white text-xs font-black flex items-center justify-center tabular-nums">
                              {reconciliationResult.extra.length}
                            </span>
                          </div>
                          <p className="text-[11px] text-red-900 dark:text-red-100 bg-red-50/80 dark:bg-red-950/30 px-4 py-2 border-b border-red-100 dark:border-red-900">
                            Tag read but no matching asset found — may need to be registered.
                          </p>
                          <ul className="divide-y divide-red-100 dark:divide-red-900/30 bg-white dark:bg-slate-900 max-h-40 overflow-y-auto">
                            {reconciliationResult.extra.map((e) => (
                              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                                <div className="h-7 w-7 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                </div>
                                <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{e.name || e.barcode || e.id}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* ── Submit / Submitted ───────────────────────── */}
                      {!reconciliationResult.submittedForReview ? (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                          <div className="px-4 pt-4 pb-3 space-y-3">
                            <div>
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Note for managers (optional)</label>
                              <Textarea
                                placeholder="e.g. South-west corner not reached; re-count needed for aisle 3"
                                value={countReviewNote}
                                onChange={(e) => setCountReviewNote(e.target.value)}
                                className="mt-1.5 min-h-[64px] rounded-xl resize-none text-sm border-slate-200 dark:border-slate-700"
                              />
                            </div>
                            <Button
                              className="w-full h-12 rounded-xl gap-2.5 font-bold bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 shadow-lg shadow-violet-500/30 text-white text-sm"
                              onClick={submitCountForReview}
                            >
                              <ClipboardList className="h-5 w-5 shrink-0" />
                              Submit inventory report
                            </Button>
                          </div>
                          <div className="px-4 pb-3">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Included in this report</p>
                            <div className="flex gap-2 flex-wrap">
                              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-100 border border-amber-200/80 dark:border-amber-800">
                                {reconciliationResult.missing.length} missing
                              </span>
                              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100 border border-emerald-200/80 dark:border-emerald-800">
                                {inRoom.length} verified in room
                              </span>
                              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-900 dark:text-orange-100 border border-orange-200/80 dark:border-orange-800">
                                {wrongLoc.length} wrong room
                              </span>
                              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950/50 text-red-900 dark:text-red-100 border border-red-200/80 dark:border-red-800">
                                {reconciliationResult.extra.length} unknown tag
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900 px-4 py-4 flex items-start gap-3 shadow-sm">
                          <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Report submitted</p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                              Missing items now appear on the dashboard and manager report page.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })()}
                </section>
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
                  <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{countSessionActive ? unifiedInventory.length : sessionScansCount}</p>
                  <p className="text-xs text-slate-500">Inventory / scans</p>
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
                <Button variant="outline" className="w-full justify-start gap-2 rounded-xl h-12" onClick={exportCountReport} disabled={!unifiedInventory.some((x) => x.type === 'asset')}>
                  <Download className="h-4 w-4" />
                  Export count report {unifiedInventory.some((x) => x.type === 'asset') && `(${unifiedInventory.filter((x) => x.type === 'asset').length})`}
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
          inventory: unifiedInventory.length,
          scan: sessionScansCount,
        }}
      />

      <HandheldFloatingCommandBar
        onScan={() => setTab('scan')}
        onAddAsset={() => setShowAddAssetDialog(true)}
        onGoodsReceiving={() => setShowAddAssetDialog(true)}
        onAudit={() => setTab('inventory')}
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
          if (b) addToUnifiedInventory(b);
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

      {/* Reconcile: Pre-reconciliation location confirmation — world-class workflow */}
      <Dialog open={showReconcileConfirmDialog} onOpenChange={(open) => { if (!open) setShowReconcileConfirmDialog(false); setReconcileConfirmStep('confirm'); }}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl shadow-2xl border-slate-200 dark:border-slate-700" onPointerDownOutside={preventHandheldDialogOutsideClose} onInteractOutside={preventHandheldDialogOutsideClose}>
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
                <Scale className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </span>
              Confirm location
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Make sure the physical room where you are counting matches before comparing with the system.
            </DialogDescription>
          </DialogHeader>
          {reconcileConfirmStep === 'confirm' ? (
            <div className="space-y-5 pt-2">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Current count location</p>
                <p className="text-base font-semibold text-slate-900 dark:text-white">
                  {inventorySessionFloor.trim() || inventorySessionRoom.trim()
                    ? `Floor ${inventorySessionFloor.trim() || '—'}, Room ${inventorySessionRoom.trim() || '—'}`
                    : 'All locations (no filter)'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">System normalizes 101 and 0101 as the same.</p>
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Are you currently counting in this same location?</p>
              {(inventorySessionFloor.trim() || inventorySessionRoom.trim()) && (() => {
                const normF = normalizeLoc(inventorySessionFloor || undefined);
                const normR = normalizeLoc(inventorySessionRoom || undefined);
                const inLoc = (f: string | null | undefined, r: string | null | undefined) => (!normF || normalizeLoc(f) === normF) && (!normR || normalizeLoc(r) === normR);
                const atThisLoc = countScansForReconciliation.filter((s) => inLoc(s.floorNumber, s.roomNumber)).length;
                const fromOther = countScansForReconciliation.length - atThisLoc;
                if (fromOther === 0) return null;
                return (
                  <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-3">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>{fromOther}</strong> item(s) in your list are from other locations. They will show as &quot;Extra&quot; for this room. You can move them to this room after reconciliation or change count location.
                    </p>
                  </div>
                );
              })()}
              <div className="grid grid-cols-2 gap-3">
                <Button className="rounded-2xl h-12 font-semibold shadow-md" onClick={() => { setShowReconcileConfirmDialog(false); runReconciliation(); }}>
                  Yes, run
                </Button>
                <Button variant="outline" className="rounded-2xl h-12 font-semibold border-2" onClick={() => setReconcileConfirmStep('change_location')}>
                  No, change
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5 pt-2">
              <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Session location</p>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Floor {inventorySessionFloor.trim() || '—'}, Room {inventorySessionRoom.trim() || '—'}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-2">Correct physical location</label>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Floor" value={reconcileCorrectFloor} onChange={(e) => setReconcileCorrectFloor(e.target.value)} className="rounded-xl h-11" />
                  <Input placeholder="Room" value={reconcileCorrectRoom} onChange={(e) => setReconcileCorrectRoom(e.target.value)} className="rounded-xl h-11" />
                </div>
              </div>
              <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10 p-4">
                <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">Selected: Floor {reconcileCorrectFloor.trim() || '—'}, Room {reconcileCorrectRoom.trim() || '—'}</p>
                {(normalizeLoc(inventorySessionFloor) !== normalizeLoc(reconcileCorrectFloor) || normalizeLoc(inventorySessionRoom) !== normalizeLoc(reconcileCorrectRoom)) && (inventorySessionFloor.trim() || inventorySessionRoom.trim()) && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1.5 font-medium">Different from session — will update and run.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="rounded-2xl h-12 font-medium" onClick={() => setReconcileConfirmStep('confirm')}>Back</Button>
                <Button className="rounded-2xl h-12 font-semibold shadow-md" onClick={() => { setShowReconcileConfirmDialog(false); runReconciliation({ floor: reconcileCorrectFloor.trim(), room: reconcileCorrectRoom.trim() }); }}>
                  Update & run
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Missing items popup: available vs missing, recently moved — world-class */}
      {reconciliationResult && reconciliationResult.missing.length > 0 && (
        <Dialog open={showMissingItemsDialog} onOpenChange={setShowMissingItemsDialog}>
          <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl border-slate-200 dark:border-slate-700" onPointerDownOutside={preventHandheldDialogOutsideClose} onInteractOutside={preventHandheldDialogOutsideClose}>
            <DialogHeader className="flex-shrink-0 pb-2">
              <DialogTitle className="flex items-center gap-3 text-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </span>
                Missing items at this location
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                Items in system here that were not scanned. Check &quot;Recently moved&quot; — they may be at a different location.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-5 py-2 min-h-0 -mx-1 px-1">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-3 sm:p-4 text-center border border-slate-200/60 dark:border-slate-700">
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{reconciliationResult.expectedCount}</p>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">In system</p>
                </div>
                <div className="rounded-2xl bg-violet-100 dark:bg-violet-900/30 p-3 sm:p-4 text-center border border-violet-200/60 dark:border-violet-800">
                  <p className="text-xl sm:text-2xl font-bold text-violet-700 dark:text-violet-300 tabular-nums">{reconciliationResult.actualCount}</p>
                  <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mt-1">Scanned here</p>
                </div>
                <div className="rounded-2xl bg-amber-100 dark:bg-amber-900/30 p-3 sm:p-4 text-center border border-amber-200/60 dark:border-amber-800">
                  <p className="text-xl sm:text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">{reconciliationResult.missing.length}</p>
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mt-1">Missing</p>
                </div>
                {(reconciliationResult.wrongLocation || []).length > 0 && (
                  <div className="rounded-2xl bg-orange-100 dark:bg-orange-900/30 p-3 sm:p-4 text-center border border-orange-200/60 dark:border-orange-800">
                    <p className="text-xl sm:text-2xl font-bold text-orange-700 dark:text-orange-300 tabular-nums">{(reconciliationResult.wrongLocation || []).length}</p>
                    <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider mt-1">Wrong room</p>
                  </div>
                )}
              </div>
              {reconciliationResult.scope === 'location' && reconciliationResult.locationDisplay && (
                <div className="flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 px-3 py-2">
                  <MapPin className="h-4 w-4 text-slate-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{reconciliationResult.locationDisplay}</span>
                </div>
              )}
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center gap-2">
                  <Package className="h-4 w-4 text-violet-500" />
                  Missing from scan ({reconciliationResult.missing.length})
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">In system at this location but not scanned. &quot;Recently moved&quot; items may have been relocated.</p>
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 overscroll-contain">
                  {(() => {
                    const RECENT_DAYS = 30;
                    const now = Date.now();
                    const isRecent = (d: string | null | undefined) => d && (now - new Date(d).getTime()) < RECENT_DAYS * 24 * 60 * 60 * 1000;
                    const missingRecent = reconciliationResult.missing.filter((m) => isRecent(m.lastMovedAt));
                    const missingOther = reconciliationResult.missing.filter((m) => !isRecent(m.lastMovedAt));
                    return (
                      <>
                        {missingRecent.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                              <RefreshCw className="h-3.5 w-3.5" /> Recently moved ({missingRecent.length}) — may be at different location
                            </p>
                            {missingRecent.map((m) => (
                              <div key={m.id} className="rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 flex flex-col gap-2.5 shadow-sm">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-semibold text-slate-900 dark:text-white text-sm truncate flex-1">{m.name || m.barcode || m.id}</p>
                                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 text-[10px] font-bold px-2.5 py-1">
                                    <RefreshCw className="h-3 w-3" /> Recently moved
                                  </span>
                                </div>
                                {m.lastMovedAt && <p className="text-[10px] text-amber-700 dark:text-amber-300">Moved: {new Date(m.lastMovedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                                <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" /> Floor {m.floorNumber ?? '—'}, Room {m.roomNumber ?? '—'}</p>
                                <Button type="button" size="sm" variant="outline" className="w-fit h-9 text-xs rounded-xl border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-200 font-medium" onClick={() => { setReconcileEditLocationAsset({ id: m.id, name: m.name, floorNumber: m.floorNumber, roomNumber: m.roomNumber }); reconcileEditLocationForm.reset({ floorNumber: m.floorNumber || '', roomNumber: m.roomNumber || '' }); setShowMissingItemsDialog(false); }}><MapPin className="h-3.5 w-3.5 mr-1.5" /> Edit location</Button>
                              </div>
                            ))}
                          </div>
                        )}
                        {missingOther.length > 0 && (
                          <div className="space-y-2">
                            {missingRecent.length > 0 && <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-3">Other missing</p>}
                            {missingOther.map((m) => (
                              <div key={m.id} className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/10 p-4 flex flex-col gap-2.5">
                                <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{m.name || m.barcode || m.id}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" /> Floor {m.floorNumber ?? '—'}, Room {m.roomNumber ?? '—'}</p>
                                <Button type="button" size="sm" variant="outline" className="w-fit h-9 text-xs rounded-xl border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-200 font-medium" onClick={() => { setReconcileEditLocationAsset({ id: m.id, name: m.name, floorNumber: m.floorNumber, roomNumber: m.roomNumber }); reconcileEditLocationForm.reset({ floorNumber: m.floorNumber || '', roomNumber: m.roomNumber || '' }); setShowMissingItemsDialog(false); }}><MapPin className="h-3.5 w-3.5 mr-1.5" /> Edit location</Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            <DialogFooter className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
              <Button variant="outline" className="rounded-2xl h-11 w-full sm:w-auto min-w-[120px]" onClick={() => setShowMissingItemsDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reconcile: Edit asset location (correct wrong system location) */}
      <Dialog open={!!reconcileEditLocationAsset} onOpenChange={(open) => { if (!open) setReconcileEditLocationAsset(null); }}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl shadow-2xl border-slate-200 dark:border-slate-700" onPointerDownOutside={preventHandheldDialogOutsideClose} onInteractOutside={preventHandheldDialogOutsideClose}>
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
                <MapPin className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </span>
              Edit location
            </DialogTitle>
            <DialogDescription className="text-sm">{reconcileEditLocationAsset ? `Update system location for "${reconcileEditLocationAsset.name}". Creates a movement record.` : ''}</DialogDescription>
          </DialogHeader>
          <Form {...reconcileEditLocationForm}>
            <form onSubmit={reconcileEditLocationForm.handleSubmit(saveReconcileEditLocation)} className="space-y-4 pt-2">
              <FormField
                control={reconcileEditLocationForm.control}
                name="floorNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Floor</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 1 or Ground" className="rounded-xl h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={reconcileEditLocationForm.control}
                name="roomNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 101" className="rounded-xl h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-3 pt-2">
                <Button type="button" variant="outline" className="rounded-2xl h-11 flex-1 sm:flex-initial" onClick={() => setReconcileEditLocationAsset(null)}>Cancel</Button>
                <Button type="submit" className="rounded-2xl h-11 flex-1 sm:flex-initial min-w-[140px]" disabled={reconcileEditLocationSaving}>
                  {reconcileEditLocationSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save location'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* All assets registered to current count room (from inventory list “All in room” + reconciliation “Room roster”) */}
      <Dialog
        open={roomCatalogOpen}
        onOpenChange={(open) => {
          setRoomCatalogOpen(open);
          if (!open) {
            setRoomCatalogAssets([]);
            setRoomCatalogRfidMode(false);
          }
        }}
      >
        <DialogContent
          className="max-w-md w-[95vw] max-h-[88vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl border-slate-200 dark:border-slate-700 p-0 gap-0"
          onPointerDownOutside={preventHandheldDialogOutsideClose}
          onInteractOutside={preventHandheldDialogOutsideClose}
        >
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-200 dark:border-slate-700">
            <DialogTitle className="flex items-center gap-2 text-lg pr-8">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  roomCatalogRfidMode
                    ? 'bg-violet-100 dark:bg-violet-900/50'
                    : 'bg-emerald-100 dark:bg-emerald-900/50'
                }`}
              >
                {roomCatalogRfidMode ? (
                  <Radio className="h-5 w-5 text-violet-700 dark:text-violet-300" />
                ) : (
                  <List className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                )}
              </span>
              {roomCatalogRfidMode ? 'Room roster & RFID pass' : 'Registered in this room'}
            </DialogTitle>
            <DialogDescription className="text-sm space-y-2">
              <span>
                Floor <span className="font-semibold text-slate-800 dark:text-slate-200">{inventorySessionFloor.trim() || '—'}</span>
                , Room{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">{inventorySessionRoom.trim() || '—'}</span>
              </span>
              {roomCatalogRfidMode && (
                <span className="block text-xs text-slate-600 dark:text-slate-400 leading-snug">
                  <strong className="text-slate-800 dark:text-slate-200">Read this session</strong> means the asset appeared in your count list (same RFID pass as reconciliation). Not read = registered here but no tag hit in this session yet.
                </span>
              )}
              <span className="block text-xs text-slate-500">
                {roomCatalogLoading
                  ? 'Loading…'
                  : `${roomCatalogAssets.length} asset${roomCatalogAssets.length !== 1 ? 's' : ''} registered in the system at this location`}
              </span>
              {!roomCatalogLoading && roomCatalogRfidMode && roomCatalogAssets.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-[11px] font-bold text-emerald-900 dark:text-emerald-100 tabular-nums">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Read: {roomCatalogAssets.filter((x) => x.rfidReadThisSession).length}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-2.5 py-1 text-[11px] font-bold text-amber-900 dark:text-amber-100 tabular-nums">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Not read: {roomCatalogAssets.filter((x) => !x.rfidReadThisSession).length}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                    Session scans: {countScansForReconciliation.length}
                  </span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4">
            {roomCatalogLoading ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
                <p className="text-sm text-slate-500">Loading room catalogue…</p>
              </div>
            ) : roomCatalogAssets.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center px-2">No assets registered to this floor and room in the system.</p>
            ) : (
              <ul className="space-y-2 pt-2">
                {roomCatalogAssets.map((a) => {
                  const isRead = !!a.rfidReadThisSession;
                  const isReportedMissing = rosterReportedMissingIds.has(a.id);
                  return (
                    <li
                      key={a.id}
                      className={`rounded-xl border overflow-hidden transition-all ${
                        !roomCatalogRfidMode
                          ? 'border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60'
                          : isRead
                            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20'
                            : isReportedMissing
                              ? 'border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/20'
                              : 'border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20'
                      }`}
                    >
                      <button
                        type="button"
                        className="flex items-center gap-3 p-3 min-h-[56px] min-w-0 w-full text-left touch-manipulation hover:bg-black/[0.03] dark:hover:bg-white/[0.03] active:scale-[0.99] transition-all"
                        onClick={async () => {
                          if (!roomCatalogRfidMode || isRead) {
                            // Read item or non-RFID mode → open full asset details
                            const asset = await fetchAssetForCountItem(a.id);
                            if (asset) {
                              setRoomCatalogOpen(false);
                              setCountItemDetailsAsset(asset);
                            } else {
                              toast({ title: 'Could not load asset details', variant: 'destructive' });
                            }
                          } else {
                            // Not-read item → open action dialog
                            setRosterActionAsset(a);
                          }
                        }}
                      >
                        {/* Thumbnail */}
                        <div
                          className={`h-11 w-11 rounded-lg flex items-center justify-center overflow-hidden shrink-0 ring-1 ${
                            !roomCatalogRfidMode
                              ? 'bg-white dark:bg-slate-900 ring-slate-200/80 dark:ring-slate-600'
                              : isRead
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-emerald-200 dark:ring-emerald-700'
                                : 'bg-amber-100 dark:bg-amber-900/40 ring-amber-200 dark:ring-amber-700'
                          }`}
                        >
                          {a.imageUrl ? (
                            <img src={a.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : roomCatalogRfidMode && isRead ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          ) : roomCatalogRfidMode ? (
                            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <Package className="h-5 w-5 text-slate-400" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate leading-snug">{a.name || a.barcode || a.id}</p>
                            {roomCatalogRfidMode && (
                              <span
                                className={`shrink-0 text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 border ${
                                  isRead
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700'
                                    : isReportedMissing
                                      ? 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/60 dark:text-red-200 dark:border-red-700'
                                      : 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-700'
                                }`}
                              >
                                {isRead ? 'Read ✓' : isReportedMissing ? 'Reported missing' : 'Not read'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">{a.barcode || a.assetId || a.id}</p>
                          {a.status && (
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-0.5">{a.status}</p>
                          )}
                          {roomCatalogRfidMode && !isRead && !isReportedMissing && (
                            <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 font-medium">Tap to locate or report →</p>
                          )}
                          {isReportedMissing && (
                            <p className="text-[10px] text-red-700 dark:text-red-400 mt-0.5 font-medium">Will appear in manager report</p>
                          )}
                        </div>

                        {/* Chevron */}
                        <ChevronRight
                          className={`h-5 w-5 shrink-0 ${
                            roomCatalogRfidMode && !isRead && !isReportedMissing
                              ? 'text-amber-500'
                              : 'text-slate-400'
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <DialogFooter className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex flex-col sm:flex-row gap-2">
            {roomCatalogRfidMode && roomCatalogAssets.filter((x) => !x.rfidReadThisSession && !rosterReportedMissingIds.has(x.id)).length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-xl h-9 gap-1.5 border-red-300 text-red-800 dark:text-red-200 bg-red-50/80 dark:bg-red-950/30 font-semibold text-xs"
                onClick={() => {
                  const ids = roomCatalogAssets.filter((x) => !x.rfidReadThisSession).map((x) => x.id);
                  setRosterReportedMissingIds((prev) => new Set([...prev, ...ids]));
                  toast({ title: 'All unread items flagged', description: 'They will appear in the manager report when submitted.' });
                }}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                Report all {roomCatalogAssets.filter((x) => !x.rfidReadThisSession && !rosterReportedMissingIds.has(x.id)).length} unread as missing
              </Button>
            )}
            <Button variant="outline" className="flex-1 sm:flex-initial rounded-xl" onClick={() => setRoomCatalogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roster not-read item action dialog: Locate or Report Missing */}
      <Dialog
        open={!!rosterActionAsset}
        onOpenChange={(open) => {
          if (!open) setRosterActionAsset(null);
        }}
      >
        <DialogContent
          className="max-w-sm w-[95vw] rounded-2xl shadow-2xl border-slate-200 dark:border-slate-700 p-0 gap-0 overflow-hidden"
          onPointerDownOutside={preventHandheldDialogOutsideClose}
          onInteractOutside={preventHandheldDialogOutsideClose}
        >
          <VisuallyHidden><DialogTitle>Asset not detected — take action</DialogTitle></VisuallyHidden>
          {/* Header */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                {rosterActionAsset?.imageUrl ? (
                  <img src={rosterActionAsset.imageUrl} alt="" className="h-full w-full object-cover rounded-xl" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-white" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white/70 uppercase tracking-widest">Not detected this pass</p>
                <p className="text-base font-bold text-white truncate mt-0.5 leading-snug">{rosterActionAsset?.name || rosterActionAsset?.barcode || rosterActionAsset?.id}</p>
                {rosterActionAsset?.barcode && (
                  <p className="text-[11px] text-white/70 font-mono mt-0.5">{rosterActionAsset.barcode}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-white/80 mt-3 leading-relaxed">
              This asset is registered in this room but its RFID tag was not detected in your current pass.
              What would you like to do?
            </p>
          </div>

          {/* Actions */}
          <div className="p-4 space-y-3 bg-white dark:bg-slate-900">
            {/* Option A: Locate */}
            <button
              type="button"
              className="w-full flex items-center gap-4 rounded-2xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-4 py-4 text-left hover:bg-violet-100 dark:hover:bg-violet-900/40 active:scale-[0.98] transition-all group"
              onClick={() => {
                const a = rosterActionAsset;
                if (!a) return;
                // Set as locate target and switch to locate tab
                setLocateTarget({ id: a.id, name: a.name || a.barcode || a.id, barcode: a.barcode, assetId: a.assetId, imageUrl: a.imageUrl, floorNumber: a.floorNumber, roomNumber: a.roomNumber } as any);
                setLocateQuery('');
                setLocateResults([]);
                setLocateActive(false);
                setTab('locate');
                setRosterActionAsset(null);
                setRoomCatalogOpen(false);
                toast({ title: 'Locate mode', description: `Walk around to find "${a.name || a.barcode}". Start Locate when ready.` });
              }}
            >
              <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-900/60 flex items-center justify-center shrink-0 group-hover:bg-violet-200 dark:group-hover:bg-violet-800/60 transition-colors">
                <Crosshair className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 dark:text-white text-sm">Locate this asset</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Switch to Locate mode — walk the room for RFID proximity audio/visual feedback.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-violet-400 shrink-0" />
            </button>

            {/* Option B: Report missing */}
            <button
              type="button"
              className={`w-full flex items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left active:scale-[0.98] transition-all group ${
                rosterReportedMissingIds.has(rosterActionAsset?.id ?? '')
                  ? 'border-red-300 dark:border-red-700 bg-red-100 dark:bg-red-950/40 cursor-default'
                  : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/40'
              }`}
              onClick={() => {
                const a = rosterActionAsset;
                if (!a) return;
                setRosterReportedMissingIds((prev) => new Set([...prev, a.id]));
                pushInventoryAudit('roster_report_missing', `${a.name || a.barcode || a.id} (${a.id})`);
                toast({
                  title: 'Flagged as missing',
                  description: `"${a.name || a.barcode}" will be included in the manager report when you submit.`,
                });
                setRosterActionAsset(null);
              }}
            >
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                rosterReportedMissingIds.has(rosterActionAsset?.id ?? '')
                  ? 'bg-red-200 dark:bg-red-900/60'
                  : 'bg-red-100 dark:bg-red-900/40 group-hover:bg-red-200 dark:group-hover:bg-red-800/60'
              }`}>
                <AlertCircle className="h-6 w-6 text-red-700 dark:text-red-300" />
              </div>
              <div className="min-w-0 flex-1">
                {rosterReportedMissingIds.has(rosterActionAsset?.id ?? '') ? (
                  <>
                    <p className="font-bold text-red-900 dark:text-red-100 text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Reported missing
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">Will appear in manager report on submit.</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">Report as missing</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Flag this item — it will automatically appear in the manager's missing inventory report.
                    </p>
                  </>
                )}
              </div>
              {!rosterReportedMissingIds.has(rosterActionAsset?.id ?? '') && (
                <ChevronRight className="h-5 w-5 text-red-400 shrink-0" />
              )}
            </button>
          </div>

          {/* Info banner */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Auto-included:</span> If you submit the reconciliation report without acting on any unread item, it will still be automatically flagged as missing in the manager report.
            </p>
          </div>

          <div className="px-4 pb-4 pt-2 bg-white dark:bg-slate-900">
            <Button
              variant="ghost"
              className="w-full rounded-xl h-10 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              onClick={() => setRosterActionAsset(null)}
            >
              Skip for now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reconciliation: movement history for a missing (expected) item */}
      <Dialog
        open={!!reconcileMissingMoveDialog}
        onOpenChange={(open) => {
          if (!open) {
            setReconcileMissingMoveDialog(null);
            setReconcileMoveHistoryItems([]);
          }
        }}
      >
        <DialogContent
          className="max-w-md w-[95vw] max-h-[85vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl border-slate-200 dark:border-slate-700"
          onPointerDownOutside={preventHandheldDialogOutsideClose}
          onInteractOutside={preventHandheldDialogOutsideClose}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50">
                <History className="h-5 w-5 text-amber-700 dark:text-amber-300" />
              </span>
              Movement history
            </DialogTitle>
            <DialogDescription className="text-sm line-clamp-2">
              {reconcileMissingMoveDialog ? (
                <>
                  Recent moves for <span className="font-semibold text-slate-800 dark:text-slate-200">{reconcileMissingMoveDialog.name}</span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
            {reconcileMoveHistoryLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
                <p className="text-sm text-slate-500">Loading history…</p>
              </div>
            ) : reconcileMoveHistoryItems.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">No movement records yet for this asset.</p>
            ) : (
              <ul className="space-y-2 pb-2">
                {reconcileMoveHistoryItems.map((mv) => {
                  const when = typeof mv.movedAt === 'string' ? mv.movedAt : new Date(mv.movedAt).toISOString();
                  const pretty = new Date(when).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
                  return (
                    <li
                      key={mv.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 px-3 py-2.5"
                    >
                      <p className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 tabular-nums">{pretty}</p>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        Fl {mv.fromFloor ?? '—'} Rm {mv.fromRoom ?? '—'}
                        <span className="text-slate-400 mx-1">→</span>
                        Fl {mv.toFloor ?? '—'} Rm {mv.toRoom ?? '—'}
                      </p>
                      {mv.reason ? (
                        <p className="text-xs text-slate-500 mt-1">{mv.reason}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => setReconcileMissingMoveDialog(null)}>
              Close
            </Button>
          </DialogFooter>
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

      {/* Room tag scan dialog for inventory start */}
      <Dialog open={showRoomTagScanDialog} onOpenChange={setShowRoomTagScanDialog}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-violet-600" />
              Scan room RFID tag
            </DialogTitle>
            <DialogDescription>
              Scan the room's RFID tag to automatically set the location for this inventory session. This is required before starting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/20 p-6 text-center">
              <ScanLine className="h-12 w-12 mx-auto text-violet-600 dark:text-violet-400 mb-3" />
              <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Ready to scan</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Use your RFID reader to scan the room tag</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Or enter tag ID manually:</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Tag ID (e.g. AA:BB:CC:DD:EE:FF)"
                  className="flex-1 font-mono text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const tagId = (e.target as HTMLInputElement).value.trim();
                      if (tagId) {
                        void verifyRoomTag(tagId);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                  disabled={roomTagScanning}
                />
                <Button
                  type="button"
                  onClick={() => {
                    const input = document.querySelector('input[placeholder*="Tag ID"]') as HTMLInputElement;
                    if (input?.value?.trim()) {
                      void verifyRoomTag(input.value.trim());
                      input.value = '';
                    }
                  }}
                  disabled={roomTagScanning}
                >
                  {roomTagScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                </Button>
              </div>
            </div>
            {roomTagError && (
              <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 p-3">
                <p className="text-sm font-medium text-red-900 dark:text-red-100">{roomTagError}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowRoomTagScanDialog(false)} disabled={roomTagScanning}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual room/floor entry dialog */}
      <Dialog open={showManualRoomDialog} onOpenChange={setShowManualRoomDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Enter location manually
            </DialogTitle>
            <DialogDescription>
              Type your floor and room number. For best accuracy, use RFID room tags instead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-200">RFID scan is recommended for higher accuracy and tamper-proof audit trail.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Floor</label>
                <Input
                  placeholder="e.g. 2"
                  value={manualFloorInput}
                  onChange={(e) => setManualFloorInput(e.target.value)}
                  className="rounded-xl h-11 text-base"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Room</label>
                <Input
                  placeholder="e.g. 101"
                  value={manualRoomInput}
                  onChange={(e) => setManualRoomInput(e.target.value)}
                  className="rounded-xl h-11 text-base"
                  onKeyDown={(e) => { if (e.key === 'Enter') startWithManualLocation(manualFloorInput, manualRoomInput); }}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setShowManualRoomDialog(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => startWithManualLocation(manualFloorInput, manualRoomInput)}
            >
              <Hash className="h-4 w-4 mr-1.5" /> Start session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room tag scan dialog for move destination */}
      <Dialog open={showMoveRoomTagScan} onOpenChange={setShowMoveRoomTagScan}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-violet-600" />
              Scan destination room tag
            </DialogTitle>
            <DialogDescription>
              Scan the destination room's RFID tag to automatically set where this asset is being moved. This is required before moving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/20 p-6 text-center">
              <ScanLine className="h-12 w-12 mx-auto text-violet-600 dark:text-violet-400 mb-3" />
              <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Ready to scan</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Use your RFID reader to scan the destination room tag</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Or enter tag ID manually:</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Tag ID (e.g. AA:BB:CC:DD:EE:FF)"
                  className="flex-1 font-mono text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const tagId = (e.target as HTMLInputElement).value.trim();
                      if (tagId) {
                        void verifyMoveDestinationRoomTag(tagId);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                  disabled={moveRoomTagScanning}
                />
                <Button
                  type="button"
                  onClick={() => {
                    const input = document.querySelector('input[placeholder*="Tag ID"]') as HTMLInputElement;
                    if (input?.value?.trim()) {
                      void verifyMoveDestinationRoomTag(input.value.trim());
                      input.value = '';
                    }
                  }}
                  disabled={moveRoomTagScanning}
                >
                  {moveRoomTagScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                </Button>
              </div>
            </div>
            {moveRoomTagError && (
              <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 p-3">
                <p className="text-sm font-medium text-red-900 dark:text-red-100">{moveRoomTagError}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowMoveRoomTagScan(false)} disabled={moveRoomTagScanning}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMove} onOpenChange={(open) => {
        setShowMove(open);
        if (!open) {
          setMoveDestinationRoomTagVerified(false);
          setMoveDestinationFloor('');
          setMoveDestinationRoom('');
          transferForm.reset();
        }
      }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={preventHandheldDialogOutsideClose} onInteractOutside={preventHandheldDialogOutsideClose}>
          <DialogHeader>
            <DialogTitle>Move asset</DialogTitle>
            <DialogDescription>
              {moveDestinationRoomTagVerified ? (
                <span className="text-green-700 dark:text-green-400 font-medium">✓ Room verified: Floor {moveDestinationFloor}, Room {moveDestinationRoom}</span>
              ) : (
                'Scan the destination room RFID tag first to automatically set the location.'
              )}
            </DialogDescription>
          </DialogHeader>
          <Form {...transferForm}>
            <form onSubmit={transferForm.handleSubmit(doMove)} className="space-y-4">
              {currentAsset && (currentAsset.floorNumber || currentAsset.roomNumber) && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Current location</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Floor {currentAsset.floorNumber || '—'}, Room {currentAsset.roomNumber || '—'}
                  </p>
                </div>
              )}
              {!moveDestinationRoomTagVerified && (
                <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">Room tag verification required</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                    Scanning the destination room tag ensures accurate tracking and automatically marks this asset as moved from its original location.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMoveRoomTagScan(true)}
                    className="w-full"
                  >
                    <Radio className="h-4 w-4 mr-2" />
                    Scan destination room tag
                  </Button>
                </div>
              )}
              <FormField control={transferForm.control} name="floorNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Floor</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. 2" 
                      {...field} 
                      disabled={moveDestinationRoomTagVerified}
                      className={moveDestinationRoomTagVerified ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700' : ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={transferForm.control} name="roomNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Room</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. 205" 
                      {...field} 
                      disabled={moveDestinationRoomTagVerified}
                      className={moveDestinationRoomTagVerified ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700' : ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {moveDestinationRoomTagVerified && currentAsset && 
               moveDestinationFloor === currentAsset.floorNumber && 
               moveDestinationRoom === currentAsset.roomNumber && (
                <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    ⚠️ Same location: Asset is already at this location
                  </p>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setShowMove(false);
                  setMoveDestinationRoomTagVerified(false);
                  setMoveDestinationFloor('');
                  setMoveDestinationRoom('');
                  transferForm.reset();
                }}>Cancel</Button>
                <Button 
                  type="submit" 
                  disabled={moving || !moveDestinationRoomTagVerified || 
                    (currentAsset && moveDestinationFloor === currentAsset.floorNumber && moveDestinationRoom === currentAsset.roomNumber)}
                >
                  {moving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Move'}
                </Button>
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
