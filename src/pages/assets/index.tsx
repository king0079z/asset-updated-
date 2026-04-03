// @ts-nocheck
import React from 'react';
import { DashboardLayout } from "@/components/DashboardLayout";
import { EditAssetDialog } from "@/components/EditAssetDialog";
import BarcodeScanner from "@/components/BarcodeScanner2";
import { UserAssetsPanel } from "@/components/UserAssetsPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslation } from "@/contexts/TranslationContext";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  BarChart3, 
  Box, 
  ClipboardList,
  Computer,
  Edit,
  Filter,
  History,
  Info,
  LayoutDashboard,
  MapPin,
  Package,
  PlusCircle, 
  Printer, 
  QrCode,
  Search,
  Settings,
  Sofa,
  Tag,
  Trash2, 
  Truck,
  User,
  Users,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Grid3X3,
  List,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  Layers,
  ShieldCheck,
  Download,
  Smartphone,
  Link2,
  Ticket,
  UserCheck,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useGeolocation } from "@/hooks/useGeolocation";
import { fetchWithCache, getFromCache } from "@/lib/api-cache";

const ASSETS_KEY = "/api/assets";
const VENDORS_KEY = "/api/vendors";
const ASSETS_TTL = 60_000;   // 1 min
const VENDORS_TTL = 5 * 60_000; // 5 min
import { exportToExcel } from "@/util/excel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AssetDetailsDialog } from "@/components/AssetDetailsDialog";
import { AssetMobileCard } from "@/components/AssetMobileCard";
import { AssetDisposalDialog } from "@/components/AssetDisposalDialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PrintAssetReportButton } from "@/components/PrintAssetReportButton";
import AssetDuplicateButton from "@/components/AssetDuplicateButton";
import HandheldAssetScanner from "@/components/HandheldAssetScanner";
import { BorrowReturnDialog } from "@/components/BorrowReturnDialog";
import { ArrowLeftRight, Wrench } from "lucide-react";

const assetFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  type: z.enum(["FURNITURE", "EQUIPMENT", "ELECTRONICS", "SPARE_PART", "IT", "MEDICAL_EQUIPMENT", "TOOL", "OTHER"]),
  vendorId: z.string().optional(),
  departmentId: z.string().optional(),
  floorNumber: z.string().optional(),
  roomNumber: z.string().optional(),
  imageUrl: z.string().optional(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  purchaseAmount: z.string().optional(),
  purchaseDate: z.string().optional(),
});

type Vendor = {
  id: string;
  name: string;
};

type Asset = {
  id: string;
  assetId: string;
  name: string;
  description?: string;
  barcode: string;
  type: string;
  imageUrl?: string;
  floorNumber?: string;
  roomNumber?: string;
  status: 'ACTIVE' | 'IN_TRANSIT' | 'DISPOSED';
  vendor?: { name: string };
  purchaseAmount?: number;
};

// Custom loading skeleton component
const TableSkeleton = () => (
  <div className="space-y-3">
    <div className="h-10 bg-muted animate-pulse rounded-md" />
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
    ))}
  </div>
);

/** Returns true only if the URL is a well-formed http/https URL with no control characters */
function isValidImageUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || /[\r\n\t]/.test(trimmed) || /%0[DA]/i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function AssetsPage() {
  const [isOpen, setIsOpen] = useState(false);

  // ── Assign-to-user state (asset registration) ──────────────────────────────
  const [orgUsers, setOrgUsers] = useState<any[]>([]);
  const [assignToUserId, setAssignToUserId] = useState("");
  const [assignToUserEmail, setAssignToUserEmail] = useState("");
  const [assignToUserName, setAssignToUserName] = useState("");
  const [userTickets, setUserTickets] = useState<any[]>([]);
  const [linkedTicketId, setLinkedTicketId] = useState("");
  const [loadingUserTickets, setLoadingUserTickets] = useState(false);

  // Initialize from module-level cache → no loading flash when navigating back
  const [vendors, setVendors] = useState<Vendor[]>(() => getFromCache<Vendor[]>(VENDORS_KEY, VENDORS_TTL) ?? []);
  const [departments, setDepartments] = useState<any[]>([]);
  const [assets, setAssets] = useState<Asset[]>(() => getFromCache<Asset[]>(ASSETS_KEY, ASSETS_TTL) ?? []);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [borrowAsset, setBorrowAsset] = useState<Asset | null>(null);
  const [showBorrowDialog, setShowBorrowDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [handheldMode, setHandheldMode] = useState(false);

  const { toast } = useToast();
  const { latitude, longitude } = useGeolocation();

  const form = useForm<z.infer<typeof assetFormSchema>>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "FURNITURE",
      vendorId: "",
      departmentId: "",
      floorNumber: "",
      roomNumber: "",
      imageUrl: "",
      latitude: null,
      longitude: null,
    },
  });

  // Load departments for spare parts (on mount)
  useEffect(() => {
    fetch('/api/departments', { credentials: 'include' }).then(r => r.json()).then(d => setDepartments(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const loadVendors = async (background = false) => {
    try {
      const data = await fetchWithCache<Vendor[]>(VENDORS_KEY, { maxAge: VENDORS_TTL });
      if (data) setVendors(data);
    } catch (error) {
      if (!background) {
        toast({ title: "Error", description: "Failed to load vendors", variant: "destructive" });
      }
    }
  };

  // ── Load organisation users for the "assign to user" dropdown ────────────
  const loadOrgUsers = async () => {
    try {
      const r = await fetch('/api/admin/users');
      if (r.ok) {
        const d = await r.json();
        setOrgUsers(d.users || d || []);
      }
    } catch { }
  };

  // ── When admin selects a user, fetch their raised tickets ─────────────────
  const handleAssignUserSelect = async (userId: string) => {
    const u = orgUsers.find((x: any) => x.id === userId);
    setAssignToUserId(userId);
    setAssignToUserEmail(u?.email || "");
    setAssignToUserName(u?.email?.split("@")[0]?.replace(/[._]/g, " ")?.replace(/\b\w/g, (c: string) => c.toUpperCase()) || "");
    setLinkedTicketId("");
    setUserTickets([]);
    if (!userId) return;
    setLoadingUserTickets(true);
    try {
      const r = await fetch("/api/tickets", { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        const all: any[] = data.tickets || data || [];
        setUserTickets(all.filter((t: any) => t.userId === userId || t.user?.id === userId));
      }
    } catch { }
    finally { setLoadingUserTickets(false); }
  };

  // ── Reset assign fields when dialog closes ────────────────────────────────
  const resetAssignFields = () => {
    setAssignToUserId(""); setAssignToUserEmail(""); setAssignToUserName("");
    setLinkedTicketId(""); setUserTickets([]);
  };

  const loadAssets = async (bypassCache = false) => {
    if (!bypassCache && !isLoadingAssets) {
      // Silently revalidate in background
      fetchWithCache<Asset[]>(ASSETS_KEY, { maxAge: ASSETS_TTL }).then(d => { if (d) setAssets(d); }).catch(() => {});
      return;
    }
    setIsLoadingAssets(true);
    try {
      const url = bypassCache ? "/api/assets?refresh=1" : ASSETS_KEY;
      // Bypass client cache when explicitly refreshing
      const data = bypassCache
        ? await fetch(url, { headers: { 'Cache-Control': 'no-cache' } }).then(r => r.json())
        : await fetchWithCache<Asset[]>(ASSETS_KEY, { maxAge: ASSETS_TTL });
      setAssets(data ?? []);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load assets", variant: "destructive" });
    } finally {
      setIsLoadingAssets(false);
    }
  };

  useEffect(() => {
    const hasAssets = !!getFromCache(ASSETS_KEY, ASSETS_TTL);
    const hasVendors = !!getFromCache(VENDORS_KEY, VENDORS_TTL);
    // If cache is warm, show instantly and revalidate silently in background
    if (hasAssets && hasVendors) {
      setTimeout(() => { loadVendors(true); fetchWithCache(ASSETS_KEY, { maxAge: ASSETS_TTL }).then(d => { if (d) setAssets(d as Asset[]); }).catch(() => {}); }, 200);
    } else {
      Promise.all([loadVendors(), loadAssets(), loadOrgUsers()]);
    }

    // Add event listener for dispose asset button
    const handleDisposeAsset = (event: Event) => {
      const asset = (event as CustomEvent).detail;
      if (asset) {
        setSelectedAsset(asset);
        setShowDisposalDialog(true);
      }
    };

    window.addEventListener('dispose-asset', handleDisposeAsset);

    // Clean up event listener
    return () => {
      window.removeEventListener('dispose-asset', handleDisposeAsset);
    };
  }, []);

  const fetchHistory = async (assetId: string) => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/assets/${assetId}/history`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('History API error response:', errorData);
        throw new Error(`Failed to fetch history: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch asset history",
        variant: "destructive",
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch history when asset is selected and history tab is active
  useEffect(() => {
    if (selectedAsset) {
      fetchHistory(selectedAsset.id);
    }
  }, [selectedAsset]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isDisposing, setIsDisposing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  // No spinner if data already in cache
  const [isLoadingAssets, setIsLoadingAssets] = useState(() => !getFromCache(ASSETS_KEY, ASSETS_TTL));
  // Search / filter / view state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [borrowFilter, setBorrowFilter] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const moveFormSchema = z.object({
    floorNumber: z.string().min(1, "Floor number is required"),
    roomNumber: z.string().min(1, "Room number is required"),
  });

  const moveForm = useForm<z.infer<typeof moveFormSchema>>({
    resolver: zodResolver(moveFormSchema),
    defaultValues: {
      floorNumber: "",
      roomNumber: "",
    },
  });

  const onMoveAsset = async (values: z.infer<typeof moveFormSchema>) => {
    if (!selectedAsset) return;

    try {
      setIsMoving(true);
      const response = await fetch(`/api/assets/${selectedAsset.id}/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Move asset API error response:', errorData);
        throw new Error(`Failed to move asset: ${response.status} ${response.statusText}`);
      }

      const updatedAsset = await response.json();
      setSelectedAsset(updatedAsset.asset);
      loadAssets();
      fetchHistory(selectedAsset.id);
      toast({
        title: "Success",
        description: "Asset has been moved successfully.",
      });
      moveForm.reset();
    } catch (error) {
      console.error("Error moving asset:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to move asset",
        variant: "destructive",
      });
    } finally {
      setIsMoving(false);
    }
  };

  const [showDisposalDialog, setShowDisposalDialog] = useState(false);
  const [showUserAssetsPanel, setShowUserAssetsPanel] = useState(false);

  const handleAssetDisposed = () => {
    loadAssets();
    if (selectedAsset) {
      fetchHistory(selectedAsset.id);
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewImage(null);
    }
  };

  const onSubmit = async (values: z.infer<typeof assetFormSchema>) => {
    try {
      setIsSubmitting(true);
      
      // Handle image upload first
      let imageUrl = "";
      const imageInput = document.querySelector<HTMLInputElement>('#image-upload');
      if (imageInput?.files?.[0]) {
        const formData = new FormData();
        formData.append('image', imageInput.files[0]);
        
        try {
          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('Image upload error response:', errorText);
            throw new Error(errorText || 'Failed to upload image');
          }
          const { url } = await uploadResponse.json();
          imageUrl = url;
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          toast({
            title: "Warning",
            description: uploadError instanceof Error 
              ? uploadError.message 
              : "Failed to upload image, but continuing with asset creation",
            variant: "default",
          });
        }
      }

      // Prepare the asset data
      const isSparePart = values.type === 'SPARE_PART';
      const assetData = {
        ...values,
        imageUrl: imageUrl || null,
        latitude: latitude || null,
        longitude: longitude || null,
        isSparePart,
        departmentId: values.departmentId || null,
        // Spare parts: no person assignment, use SPARE/PARTS as placeholder location
        assignedToId: isSparePart ? null : (assignToUserId || null),
        assignedToEmail: isSparePart ? null : (assignToUserEmail || null),
        assignedToName: isSparePart ? null : (assignToUserName || null),
        floorNumber: values.floorNumber || (isSparePart ? 'SPARE' : ''),
        roomNumber: values.roomNumber || (isSparePart ? 'PARTS' : ''),
        linkedTicketId: linkedTicketId || null,
      };

      // Create the asset
      const response = await fetch("/api/assets/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(assetData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Create asset API error response:', errorData);
        throw new Error(
          errorData?.message || 
          errorData?.error || 
          `Failed to create asset: ${response.status} ${response.statusText}`
        );
      }

      const newAsset = await response.json();
      
      // Reset form and update UI
      setSelectedAsset(newAsset);
      setShowBarcodeDialog(true);
      setIsOpen(false);
      form.reset();
      setPreviewImage(null);
      resetAssignFields();
      loadAssets(true); // bypass cache so new asset appears immediately

      toast({
        title: "Success",
        description: "Asset has been created successfully.",
      });
    } catch (error) {
      console.error('Asset creation error:', error);
      toast({
        title: "Error",
        description: error instanceof Error 
          ? error.message 
          : "Failed to create asset. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReport = async (assetToPrint?: Asset) => {
    const targetAsset = assetToPrint || selectedAsset;
    if (!targetAsset) return;

    try {
      toast({ title: "Generating report", description: "Please wait while we prepare your report..." });

      // Fetch history + tickets in parallel
      const [historyRes, ticketsRes] = await Promise.allSettled([
        fetch(`/api/assets/${targetAsset.id}/history`, { headers: { 'Cache-Control': 'no-cache' } }),
        fetch(`/api/assets/${targetAsset.id}/tickets`,  { headers: { 'Cache-Control': 'no-cache' } }),
      ]);

      const historyData = historyRes.status === 'fulfilled' && historyRes.value.ok
        ? await historyRes.value.json() : {};
      const ticketsData = ticketsRes.status === 'fulfilled' && ticketsRes.value.ok
        ? await ticketsRes.value.json() : [];

      const asset = { ...targetAsset, history: historyData?.history ?? [], tickets: ticketsData };

      // ── Build the printable HTML ───────────────────────────────────────────
      const fmt = (d: string | null | undefined) => {
        if (!d) return '—';
        try { return new Date(d).toLocaleDateString(); } catch { return '—'; }
      };
      const statusClass: Record<string, string> = {
        ACTIVE: 'background:#d1fae5;color:#065f46',
        DISPOSED: 'background:#fee2e2;color:#991b1b',
        MAINTENANCE: 'background:#fef3c7;color:#92400e',
        IN_TRANSIT: 'background:#ede9fe;color:#5b21b6',
        DAMAGED: 'background:#ffedd5;color:#9a3412',
        CRITICAL: 'background:#fee2e2;color:#7f1d1d',
        LIKE_NEW: 'background:#ecfdf5;color:#064e3b',
      };
      const sc = statusClass[asset.status] ?? 'background:#f3f4f6;color:#374151';

      const historyRows = (asset.history as any[]).slice(0, 15).map(h => `
        <tr>
          <td style="padding:6px 8px;font-size:12px;font-weight:600;color:#374151;">${(h.action || '').replace(/_/g,' ')}</td>
          <td style="padding:6px 8px;font-size:11px;color:#6b7280;">${h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'}</td>
        </tr>`).join('');

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Asset Report – ${asset.name}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;background:#fff;padding:24px}
  @page{size:A4;margin:15mm}
  @media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
  h2{font-size:18px;font-weight:700}
  .hdr{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:20px 24px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
  .badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  .card{border:1px solid #e5e7eb;border-radius:8px;margin-bottom:14px;overflow:hidden}
  .card-hdr{background:#f9fafb;padding:10px 16px;border-bottom:1px solid #e5e7eb;font-weight:600;font-size:13px;color:#374151}
  .card-body{padding:14px 16px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .lbl{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
  .val{font-size:13px;font-weight:500;color:#111827}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;padding:6px 8px;border-bottom:1px solid #e5e7eb}
  tr:nth-child(even){background:#f9fafb}
  .footer{margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center}
</style></head>
<body>
  <div class="hdr">
    <div>
      <div style="font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Asset Report</div>
      <h2>${asset.name}</h2>
      <div style="font-size:12px;opacity:.8;margin-top:4px">ID: ${asset.assetId} &nbsp;·&nbsp; Generated: ${new Date().toLocaleString()}</div>
    </div>
    <span class="badge" style="${sc}">${asset.status}</span>
  </div>

  <div style="display:grid;grid-template-columns:${isValidImageUrl(asset.imageUrl) ? '180px 1fr' : '1fr'};gap:14px;margin-bottom:14px">
    ${isValidImageUrl(asset.imageUrl) ? `<img src="${asset.imageUrl}" style="width:180px;height:180px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb" alt="">` : ''}
    <div class="card" style="margin-bottom:0">
      <div class="card-hdr">Asset Information</div>
      <div class="card-body">
        <div class="grid">
          <div><div class="lbl">Type</div><div class="val">${asset.type || '—'}</div></div>
          <div><div class="lbl">Asset ID</div><div class="val" style="font-family:monospace">${asset.assetId}</div></div>
          <div><div class="lbl">Purchase Amount</div><div class="val">${asset.purchaseAmount ? `QAR ${Number(asset.purchaseAmount).toLocaleString()}` : '—'}</div></div>
          <div><div class="lbl">Purchase Date</div><div class="val">${fmt(asset.purchaseDate)}</div></div>
          <div><div class="lbl">Floor</div><div class="val">${asset.floorNumber || '—'}</div></div>
          <div><div class="lbl">Room</div><div class="val">${asset.roomNumber || '—'}</div></div>
          ${asset.vendor ? `<div style="grid-column:span 2"><div class="lbl">Vendor</div><div class="val">${(asset.vendor as any).name}</div></div>` : ''}
        </div>
        ${asset.description ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #f3f4f6"><div class="lbl">Description</div><div style="font-size:12px;color:#374151;margin-top:2px">${asset.description}</div></div>` : ''}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-hdr">Assignment</div>
    <div class="card-body">
      ${asset.assignedToName
        ? `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:10px">
             <div style="font-weight:600;color:#065f46">${asset.assignedToName}</div>
             ${asset.assignedToEmail ? `<div style="font-size:12px;color:#047857;margin-top:2px">${asset.assignedToEmail}</div>` : ''}
             ${asset.assignedAt ? `<div style="font-size:11px;color:#6b7280;margin-top:4px">Since ${fmt(asset.assignedAt)}</div>` : ''}
           </div>`
        : `<div style="background:#f9fafb;border:1px dashed #d1d5db;border-radius:6px;padding:10px;color:#9ca3af;font-size:13px">Not assigned to anyone</div>`
      }
    </div>
  </div>

  ${(asset.history as any[]).length > 0 ? `
  <div class="card">
    <div class="card-hdr">Activity History (${(asset.history as any[]).length} events)</div>
    <div class="card-body" style="padding:0">
      <table>
        <thead><tr><th>Action</th><th>Date</th></tr></thead>
        <tbody>${historyRows}</tbody>
      </table>
      ${(asset.history as any[]).length > 15 ? `<div style="padding:8px 16px;font-size:11px;color:#9ca3af">+ ${(asset.history as any[]).length - 15} more events</div>` : ''}
    </div>
  </div>` : ''}

  <div class="footer">Asset Management System &nbsp;·&nbsp; ${new Date().toLocaleString()} &nbsp;·&nbsp; ${asset.assetId}</div>
</body></html>`;

      // ── Print via hidden iframe (no popup, not blocked by popup blockers) ──
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error('Could not initialize print frame');

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Small delay so the iframe renders, then print
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 2000);
        toast({ title: "Report generated", description: "Your asset report has been sent to the printer." });
      }, 500);

    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate asset report",
        variant: "destructive",
      });
    }
  };

  const handlePrintBarcode = () => {
    if (!selectedAsset) return;
    const barcodeVal = selectedAsset.barcode || selectedAsset.assetId;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Barcode – ${selectedAsset.name}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;text-align:center;padding:30px}h2{font-size:16px;margin-bottom:4px}p{font-size:12px;color:#555;margin-bottom:20px}img{max-width:300px}@page{size:A6;margin:10mm}</style>
      </head><body>
      <h2>${selectedAsset.name}</h2>
      <p>Asset ID: ${selectedAsset.assetId}</p>
      <img src="https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(barcodeVal)}&scale=3&includetext&textxalign=center" alt="barcode" />
      </body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 2000);
    }, 600);
  };

  const getAssetsByType = () => {
    const counts = {
      FURNITURE: 0,
      EQUIPMENT: 0,
      ELECTRONICS: 0,
    };
    assets.forEach(asset => {
      counts[asset.type]++;
    });
    return counts;
  };

  const assetCounts = getAssetsByType();
  const activeAssets = assets.filter(a => a.status === 'ACTIVE').length;
  const transitAssets = assets.filter(a => a.status === 'IN_TRANSIT').length;
  const totalValue = assets.reduce((sum, a) => sum + (a.purchaseAmount || 0), 0);

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = !searchQuery ||
      (asset.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (asset.assetId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (asset.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (asset.vendor?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || asset.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
    const matchesBorrow = !borrowFilter || (Array.isArray((asset as any).borrows) && (asset as any).borrows.length > 0);
    return matchesSearch && matchesType && matchesStatus && matchesBorrow;
  });

  const { t } = useTranslation();

  const renderAssetsContent = () => (
      <div className="space-y-6">
        {/* ══════════════════════════════════════
            World-Class Hero Header
        ══════════════════════════════════════ */}
        <div className="relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.12),transparent_60%)]" />
          <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-44 h-44 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute top-8 right-40 w-24 h-24 rounded-full bg-violet-400/20" />

          <div className="relative z-10 p-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg ring-1 ring-white/30 flex-shrink-0">
                  <Package className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white tracking-tight">{t('assets_management')}</h1>
                  <p className="text-violet-100/80 text-sm mt-0.5">{t('track_and_manage_enterprise_assets')}</p>
                </div>
              </div>
              {/* Inline stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Assets', value: assets.length, icon: Box },
                  { label: 'Active', value: activeAssets, icon: CheckCircle2 },
                  { label: 'In Transit', value: transitAssets, icon: Truck, warn: transitAssets > 0 },
                  { label: 'Total Value', value: `QAR ${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: Tag },
                ].map(({ label, value, icon: Icon, warn }) => (
                  <div key={label} className={`rounded-xl px-4 py-3 border ${warn ? 'bg-amber-400/20 border-amber-300/30' : 'bg-white/15 border-white/20'} backdrop-blur-sm`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="h-3 w-3 text-white/70" />
                      <p className="text-[10px] uppercase tracking-widest text-white/70 font-semibold">{label}</p>
                    </div>
                    <p className="text-xl font-bold text-white tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2.5">
              <Button
                onClick={() => setHandheldMode(true)}
                className="bg-white/15 hover:bg-white/25 text-white border border-white/25 shadow gap-2 font-semibold backdrop-blur-sm"
                variant="outline"
              >
                <Smartphone className="h-4 w-4" />
                <span className="hidden sm:inline">Handheld scanner</span>
                <span className="sm:hidden">Handheld</span>
              </Button>
              <Button
                onClick={() => setShowUserAssetsPanel(true)}
                className="bg-white/15 hover:bg-white/25 text-white border border-white/25 shadow gap-2 font-semibold backdrop-blur-sm"
                variant="outline"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">User Assignments</span>
                <span className="sm:hidden">By User</span>
              </Button>
              <BarcodeScanner
                onScan={(result) => {
                  if ('id' in result && result.id) {
                    setSelectedAsset(result as Asset);
                    setShowBarcodeDialog(true);
                  } else if ('barcode' in result && result.barcode) {
                    setIsOpen(true);
                  }
                }}
              />
              <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) resetAssignFields(); }}>
                <DialogTrigger asChild>
                  <Button className="bg-white text-indigo-700 hover:bg-indigo-50 border-0 shadow-lg font-semibold gap-2">
                    <PlusCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('register_new_asset')}</span>
                    <span className="sm:hidden">{t('new_asset')}</span>
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('register_new_asset')}</DialogTitle>
                  <DialogDescription>
                    {t('enter_asset_details_below')}
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('name')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('asset_name_placeholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('type')}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('select_asset_type')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="FURNITURE">{t('furniture')}</SelectItem>
                              <SelectItem value="EQUIPMENT">{t('equipment')}</SelectItem>
                              <SelectItem value="ELECTRONICS">{t('electronics')}</SelectItem>
                              <SelectItem value="IT">IT / Technology</SelectItem>
                              <SelectItem value="MEDICAL_EQUIPMENT">Medical Equipment</SelectItem>
                              <SelectItem value="TOOL">Tool</SelectItem>
                              <SelectItem value="OTHER">Other</SelectItem>
                              <SelectItem value="SPARE_PART">🔧 Spare Part</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Department selector — shown ONLY when Spare Part is selected */}
                    {form.watch('type') === 'SPARE_PART' && (
                      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-bold text-amber-800">Spare Part — Department Assignment</span>
                          <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold ml-auto">No person assignment</span>
                        </div>
                        <p className="text-xs text-amber-700">Spare parts are stored in inventory and assigned to a department, not to an individual user.</p>
                        <FormField
                          control={form.control}
                          name="departmentId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-amber-800 font-semibold">Department *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="border-amber-300 bg-white">
                                    <SelectValue placeholder="Select department…" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {departments.length === 0 ? (
                                    <SelectItem value="__none" disabled>No departments — add in Settings → Departments</SelectItem>
                                  ) : departments.map((d: any) => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ''}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="vendorId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('vendor')} <span className="text-muted-foreground text-xs font-normal">(optional)</span></FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={vendors.length > 0 ? t('select_vendor') : "No vendors yet — skip if none"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {vendors.map((vendor) => (
                                <SelectItem key={vendor.id} value={vendor.id}>
                                  {vendor.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="floorNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('floor_number')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('floor_number_placeholder')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="roomNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('room_number')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('room_number_placeholder')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    {/* Barcode & QR code are auto-generated on asset creation */}
                    <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span>Barcode &amp; QR code are <strong>automatically generated</strong> when the asset is created. You can print them from the asset details.</span>
                    </div>
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('description')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('asset_description_placeholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="purchaseAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('purchase_amount')} (QAR)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              min="0" 
                              placeholder={t('enter_purchase_amount')} 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            {t('enter_purchase_amount_in_qar')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="purchaseDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('purchase_date')}</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              placeholder={t('select_purchase_date')} 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            {t('enter_date_when_asset_purchased')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormItem>
                      <FormLabel>{t('location_tracking')}</FormLabel>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                        <div className="flex-1">
                          {latitude && longitude ? (
                            <div className="flex items-center gap-2 text-sm">
                              <div className="h-2 w-2 rounded-full bg-green-500" />
                              <span className="text-green-600 font-medium">{t('location_detected')}</span>
                              <span className="text-muted-foreground">
                                ({latitude.toFixed(6)}, {longitude.toFixed(6)})
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm">
                              <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                              <span className="text-yellow-600 font-medium">{t('detecting_location')}</span>
                            </div>
                          )}
                        </div>
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <FormDescription>
                        {t('location_tracking_required')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>

                    <FormItem>
                      <FormLabel>{t('image')}</FormLabel>
                      <FormControl>
                        <Input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('upload_asset_image')}
                      </FormDescription>
                      {previewImage && (
                        <div className="mt-2 relative h-[200px] w-full">
                          <Image
                            src={previewImage}
                            alt="Preview"
                            fill
                            className="object-contain rounded-md border"
                            sizes="(max-width: 768px) 100vw, 50vw"
                            unoptimized
                          />
                        </div>
                      )}
                    </FormItem>
                    {/* ── Assign to User + Link to Ticket (hidden for Spare Parts) ── */}
                    {form.watch('type') !== 'SPARE_PART' && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <UserCheck className="h-4 w-4 text-indigo-600 shrink-0" />
                        <span className="text-sm font-semibold text-slate-800">Assign to User</span>
                        <span className="text-xs text-slate-400 font-normal">(optional)</span>
                      </div>

                      {/* User selector */}
                      <Select value={assignToUserId || "__none__"} onValueChange={(v) => handleAssignUserSelect(v === "__none__" ? "" : v)}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder={orgUsers.length === 0 ? "Loading users…" : "Select a user to assign this asset to"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— No assignment —</SelectItem>
                          {orgUsers.map((u: any) => (
                            <SelectItem key={u.id} value={u.id}>
                              <span className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                {u.email}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Ticket selector — only shown when a user is selected */}
                      {assignToUserId && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                            <Link2 className="h-3.5 w-3.5 text-indigo-500" />
                            Link to one of their tickets
                            <span className="font-normal text-slate-400">(optional — triggers notification)</span>
                          </div>
                          <Select value={linkedTicketId || "__none__"} onValueChange={(v) => setLinkedTicketId(v === "__none__" ? "" : v)} disabled={loadingUserTickets}>
                            <SelectTrigger className="bg-white">
                              {loadingUserTickets
                                ? <span className="flex items-center gap-2 text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading tickets…</span>
                                : <SelectValue placeholder={userTickets.length === 0 ? "No open tickets found for this user" : "Select a ticket to link (optional)"} />
                              }
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— No ticket link —</SelectItem>
                              {userTickets.map((t: any) => (
                                <SelectItem key={t.id} value={t.id}>
                                  <span className="flex items-center gap-2">
                                    <Ticket className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className="font-mono text-xs text-slate-500">{t.displayId || t.id.slice(0, 8)}</span>
                                    <span className="truncate max-w-[200px]">{t.title}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {linkedTicketId && (
                            <p className="text-[11px] text-indigo-600 flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse inline-block" />
                              A notification will be sent to the user when the asset is created.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    )} {/* end Spare Part conditional */}

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <><svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{t('registering')}</>
                      ) : t('register_asset')}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {/* Bottom strip */}
          <div className="relative z-10 border-t border-white/20 grid grid-cols-3 divide-x divide-white/20">
            {[
              { label: 'Track', icon: MapPin, value: 'Location' },
              { label: 'Monitor', icon: BarChart3, value: 'Analytics' },
              { label: 'Secure', icon: ShieldCheck, value: 'Compliance' },
            ].map(({ label, icon: Icon, value }) => (
              <div key={label} className="px-5 py-3 flex items-center gap-3">
                <Icon className="h-4 w-4 text-violet-200" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-violet-200/70 font-semibold">{label}</p>
                  <p className="text-sm font-semibold text-white">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════
            Premium Stat Cards
        ══════════════════════════════════════ */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          {/* Total Assets */}
          <div className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-700 text-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-default">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_55%)]" />
            <div className="absolute bottom-0 right-0 w-28 h-28 rounded-full bg-white/5 -translate-y-1/4 translate-x-1/4" />
            <div className="absolute top-0 left-0 w-16 h-16 rounded-full bg-white/5 -translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] font-bold text-white/60 mb-0.5">{t('total_assets')}</p>
                  <p className="text-4xl font-black tabular-nums leading-none">{assets.length}</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20 group-hover:bg-white/25 transition-colors">
                  <Box className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-xs text-white/60 mb-3">{t('registered_assets_in_system')}</p>
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  <span className="font-semibold">{activeAssets}</span> active
                </span>
                <span className="flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
                  <span className="font-semibold">{transitAssets}</span> transit
                </span>
              </div>
            </div>
          </div>

          {/* Total Value */}
          <div className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-default">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_55%)]" />
            <div className="absolute bottom-0 right-0 w-28 h-28 rounded-full bg-white/5 -translate-y-1/4 translate-x-1/4" />
            <div className="relative z-10 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] font-bold text-white/60 mb-0.5">{t('total_asset_value')}</p>
                  <p className="text-2xl font-black tabular-nums leading-none truncate">
                    QAR {totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20 group-hover:bg-white/25 transition-colors flex-shrink-0">
                  <Tag className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-xs text-white/60 mb-3">{t('total_value_of_active_assets')}</p>
              <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
                <div className="h-full bg-white/70 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (activeAssets / Math.max(assets.length, 1)) * 100)}%` }} />
              </div>
              <p className="text-[10px] text-white/40 mt-1.5">{activeAssets}/{assets.length} assets active</p>
            </div>
          </div>

          {/* Vendors */}
          <div className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-violet-500 via-violet-600 to-purple-700 text-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-default">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_55%)]" />
            <div className="absolute bottom-0 right-0 w-28 h-28 rounded-full bg-white/5 -translate-y-1/4 translate-x-1/4" />
            <div className="relative z-10 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] font-bold text-white/60 mb-0.5">{t('active_vendors')}</p>
                  <p className="text-4xl font-black tabular-nums leading-none">{vendors.length}</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20 group-hover:bg-white/25 transition-colors">
                  <Truck className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-xs text-white/60 mb-3">{t('connected_suppliers_and_vendors')}</p>
              <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
                <div className="h-full bg-white/70 rounded-full" style={{ width: vendors.length > 0 ? '65%' : '0%' }} />
              </div>
              <p className="text-[10px] text-white/40 mt-1.5">Supplier network active</p>
            </div>
          </div>

          {/* Asset Types breakdown */}
          <div className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-default">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.06),transparent_60%)]" />
            <div className="absolute bottom-0 right-0 w-24 h-24 rounded-full bg-white/3 -translate-y-1/4 translate-x-1/4" />
            <div className="relative z-10 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] font-bold text-white/60 mb-0.5">{t('asset_types')}</p>
                  <p className="text-sm text-white/50 font-medium">Distribution breakdown</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-white/8 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10 group-hover:bg-white/15 transition-colors">
                  <Layers className="h-6 w-6 text-white/80" />
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Furniture', count: assetCounts.FURNITURE, icon: Sofa, color: 'bg-blue-400', dot: 'bg-blue-400' },
                  { label: 'Equipment', count: assetCounts.EQUIPMENT, icon: Package, color: 'bg-emerald-400', dot: 'bg-emerald-400' },
                  { label: 'Electronics', count: assetCounts.ELECTRONICS, icon: Computer, color: 'bg-violet-400', dot: 'bg-violet-400' },
                ].map(({ label, count, icon: Icon, color, dot }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${dot} flex-shrink-0`} />
                    <span className="text-[11px] text-white/60 w-16 flex-shrink-0">{label}</span>
                    <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: assets.length ? `${(count / assets.length) * 100}%` : '0%' }} />
                    </div>
                    <span className="text-xs font-bold text-white/80 w-5 text-right tabular-nums flex-shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════
            Assets List Card
        ══════════════════════════════════════ */}
        <Card className="border-0 ring-1 ring-border/60 shadow-md overflow-hidden">
          {/* Accent top bar */}
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />
          <CardHeader className="border-b border-border/50 pb-4 pt-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                  <Package className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400 h-[18px] w-[18px]" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">{t('assets_list')}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold text-[10px]">
                      {filteredAssets.length}
                    </span>
                    of {assets.length} {t('manage_and_track_all_registered_assets')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2 h-9 rounded-xl border-border/70 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors font-medium"
                  onClick={() => {
                    const exportData = assets.map(a => ({ 'Asset ID': a.assetId, 'Name': a.name, 'Type': a.type, 'Description': a.description || '', 'Floor': a.floorNumber, 'Room': a.roomNumber, 'Status': a.status, 'Vendor': a.vendor?.name || '' }));
                    exportToExcel(exportData, `assets-${new Date().toISOString().split('T')[0]}`);
                  }}>
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('export')}</span>
                </Button>
                <Button variant="outline" size="sm" className="gap-2 h-9 rounded-xl border-border/70 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors font-medium"
                  onClick={() => setViewMode(v => v === 'table' ? 'grid' : 'table')}>
                  {viewMode === 'table' ? <Grid3X3 className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{viewMode === 'table' ? 'Grid' : 'Table'}</span>
                </Button>
              </div>
            </div>

            {/* Search + filter bar */}
            <div className="flex flex-col sm:flex-row gap-2 mt-4 p-3 rounded-xl bg-muted/40 dark:bg-muted/20 border border-border/40">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, ID, vendor…"
                  className="pl-10 h-9 rounded-lg border-border/60 bg-background focus-visible:ring-indigo-400/40 focus-visible:border-indigo-400/60 placeholder:text-muted-foreground/60"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground h-5 w-5 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[145px] h-9 rounded-lg border-border/60 bg-background">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="FURNITURE">Furniture</SelectItem>
                  <SelectItem value="EQUIPMENT">Equipment</SelectItem>
                  <SelectItem value="ELECTRONICS">Electronics</SelectItem>
                  <SelectItem value="SPARE_PART">🔧 Spare Parts</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[145px] h-9 rounded-lg border-border/60 bg-background">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="BORROWED">↗ Borrowed</SelectItem>
                  <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                  <SelectItem value="DISPOSED">Disposed</SelectItem>
                </SelectContent>
              </Select>
              {/* Borrowed filter quick button */}
              <button
                onClick={() => setBorrowFilter(b => !b)}
                className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-semibold transition-all ${
                  borrowFilter ? 'bg-blue-600 text-white border-blue-600' : 'border-border/60 text-muted-foreground hover:border-blue-300 hover:text-blue-600'
                }`}>
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Borrowed
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Mobile view */}
            <div className="md:hidden p-4 grid gap-4">
              {isLoadingAssets ? (
                <div className="space-y-3 animate-pulse">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Package className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="font-semibold mb-1">{t('no_assets_found') || 'No assets found'}</p>
                  <p className="text-sm text-muted-foreground max-w-xs">{t('no_assets_found_description') || 'No assets registered yet.'}</p>
                </div>
              ) : (
                filteredAssets.map((asset) => (
                  <AssetMobileCard key={asset.id} asset={asset}
                    onViewDetails={a => { setSelectedAsset(a); setShowBarcodeDialog(true); }}
                    onEdit={a => { setSelectedAsset(a); setShowEditDialog(true); }}
                    onPrintReport={a => { setSelectedAsset(a); handlePrintReport(a); }}
                  />
                ))
              )}
            </div>

            {/* Desktop: Table or Grid view */}
            <div className="hidden md:block">
              {isLoadingAssets ? (
                <div className="p-6 space-y-3">
                  <div className="h-11 bg-muted/50 animate-pulse rounded-xl" />
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-xl" style={{ opacity: 1 - i * 0.12 }}>
                      <div className="h-4 w-24 bg-muted animate-pulse rounded-lg" />
                      <div className="flex items-center gap-3 flex-1">
                        <div className="h-10 w-10 bg-muted animate-pulse rounded-xl flex-shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3.5 w-40 bg-muted animate-pulse rounded" />
                          <div className="h-2.5 w-24 bg-muted/60 animate-pulse rounded" />
                        </div>
                      </div>
                      <div className="h-4 w-20 bg-muted animate-pulse rounded-lg" />
                      <div className="h-4 w-20 bg-muted animate-pulse rounded-lg" />
                      <div className="h-4 w-16 bg-muted animate-pulse rounded-lg" />
                      <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
                    </div>
                  ))}
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="relative mb-6">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/30 dark:to-violet-900/30 flex items-center justify-center">
                      <Package className="h-10 w-10 text-indigo-400 dark:text-indigo-500" />
                    </div>
                    <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-indigo-500 flex items-center justify-center">
                      <Search className="h-3 w-3 text-white" />
                    </div>
                  </div>
                  <p className="font-bold text-lg mb-1.5 text-foreground">{searchQuery ? 'No matching assets' : (t('no_assets_found') || 'No assets found')}</p>
                  <p className="text-sm text-muted-foreground max-w-sm mb-6">
                    {searchQuery
                      ? `No assets match "${searchQuery}". Try a different search term or clear filters.`
                      : (t('no_assets_found_description') || 'No assets registered yet. Register your first asset to get started.')}
                  </p>
                  {searchQuery ? (
                    <Button variant="outline" onClick={() => { setSearchQuery(''); setTypeFilter('all'); setStatusFilter('all'); }} className="gap-2">
                      <X className="h-4 w-4" /> Clear filters
                    </Button>
                  ) : (
                    <Button onClick={() => setIsOpen(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                      <PlusCircle className="h-4 w-4" /> Register First Asset
                    </Button>
                  )}
                </div>
              ) : viewMode === 'grid' ? (
                /* ── Grid View ── */
                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredAssets.map(asset => {
                    const typeConfig = asset.type === 'FURNITURE'
                      ? { icon: Sofa, bg: 'bg-blue-50 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400', grad: 'from-blue-500 to-indigo-500', badge: 'text-blue-700 dark:text-blue-300', label: 'Furniture' }
                      : asset.type === 'EQUIPMENT'
                        ? { icon: Package, bg: 'bg-emerald-50 dark:bg-emerald-900/30', color: 'text-emerald-600 dark:text-emerald-400', grad: 'from-emerald-500 to-teal-500', badge: 'text-emerald-700 dark:text-emerald-300', label: 'Equipment' }
                        : { icon: Computer, bg: 'bg-violet-50 dark:bg-violet-900/30', color: 'text-violet-600 dark:text-violet-400', grad: 'from-violet-500 to-purple-500', badge: 'text-violet-700 dark:text-violet-300', label: 'Electronics' };
                    const TypeIcon = typeConfig.icon;
                    return (
                      <div key={asset.id}
                        className="group relative rounded-2xl border border-border/70 bg-card hover:shadow-lg hover:-translate-y-1 hover:border-indigo-300/60 dark:hover:border-indigo-700/40 transition-all duration-200 overflow-hidden cursor-pointer"
                        onClick={() => { setSelectedAsset(asset); setShowBarcodeDialog(true); }}>
                        {/* Top accent bar */}
                        <div className={`h-1 w-full bg-gradient-to-r ${typeConfig.grad}`} />
                        <div className="p-4">
                          {/* Header row */}
                          <div className="flex items-start gap-3 mb-4">
                            <div className={`h-12 w-12 rounded-xl ${typeConfig.bg} border border-border/50 flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                              {isValidImageUrl(asset.imageUrl) ? (
                                <Image src={asset.imageUrl} alt={asset.name} width={48} height={48} className="rounded-xl object-cover w-12 h-12" unoptimized />
                              ) : (
                                <TypeIcon className={`h-6 w-6 ${typeConfig.color}`} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-sm truncate group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{asset.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{asset.assetId}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5 ${
                              asset.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700/40'
                                : asset.status === 'DISPOSED'
                                ? 'bg-red-50 text-red-700 border-red-200/70 dark:bg-red-900/20 dark:text-red-400 dark:border-red-700/40'
                                : 'bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700/40'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${asset.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : asset.status === 'DISPOSED' ? 'bg-red-500' : 'bg-amber-500'}`} />
                              {asset.status === 'IN_TRANSIT' ? 'Transit' : (asset.status || '').charAt(0) + (asset.status || '').slice(1).toLowerCase()}
                            </span>
                          </div>

                          {/* Info grid */}
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="flex items-center gap-1.5 text-xs rounded-lg bg-muted/40 px-2 py-1.5">
                              <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-foreground/70 truncate">Floor {asset.floorNumber}, Rm {asset.roomNumber}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs rounded-lg bg-muted/40 px-2 py-1.5">
                              <Truck className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-foreground/70 truncate">{asset.vendor?.name || 'No vendor'}</span>
                            </div>
                            {asset.purchaseAmount ? (
                              <div className="flex items-center gap-1.5 text-xs rounded-lg bg-muted/40 px-2 py-1.5">
                                <Tag className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-foreground/70 font-medium">QAR {Number(asset.purchaseAmount).toLocaleString()}</span>
                              </div>
                            ) : null}
                            <div className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5 ${typeConfig.bg}`}>
                              <TypeIcon className={`h-3 w-3 ${typeConfig.color} flex-shrink-0`} />
                              <span className={`font-semibold ${typeConfig.badge}`}>{typeConfig.label}</span>
                            </div>
                          </div>

                          {/* Action row */}
                          <div className="flex gap-1.5 pt-3 border-t border-border/40" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs gap-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-700 dark:hover:text-indigo-300"
                              onClick={() => { setSelectedAsset(asset); setShowEditDialog(true); }}>
                              <Edit className="h-3.5 w-3.5" /> Edit
                            </Button>
                            <AssetDuplicateButton asset={asset} onDuplicationComplete={loadAssets} />
                            <PrintAssetReportButton asset={asset} variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                            </PrintAssetReportButton>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ── Table View ── */
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 dark:bg-muted/20 hover:bg-muted/50 dark:hover:bg-muted/20 border-b-2 border-border/60">
                      <TableHead className="w-[110px] text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 py-3">{t('asset_id')}</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 py-3">{t('asset_details')}</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 py-3">{t('type')}</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 py-3">{t('location')}</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 py-3">{t('vendor')}</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 py-3">{t('status')}</TableHead>
                      <TableHead className="w-[110px] text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 py-3 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssets.map((asset, idx) => {
                      const activeBorrow = Array.isArray(asset.borrows) ? asset.borrows[0] : null;
                      const remainMs = activeBorrow?.expectedReturnAt ? new Date(activeBorrow.expectedReturnAt).getTime() - Date.now() : null;
                      const remainDays = remainMs != null ? Math.ceil(remainMs / 86_400_000) : null;
                      const borrowOverdue = remainDays != null && remainDays < 0;
                      const borrowUrgent = remainDays != null && remainDays >= 0 && remainDays <= 2;
                      const isSparePart = asset.isSparePart || asset.type === 'SPARE_PART';
                      return (
                      <TableRow key={asset.id}
                        className={`cursor-pointer transition-colors duration-150 group border-border/30 ${
                          isSparePart ? 'bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/70 dark:hover:bg-amber-900/30 border-l-4 border-l-amber-400'
                          : borrowOverdue ? 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30'
                          : borrowUrgent ? 'bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-50'
                          : activeBorrow ? 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/60'
                          : idx % 2 === 0 ? 'hover:bg-indigo-50/60 dark:hover:bg-indigo-950/25' : 'bg-muted/20 dark:bg-muted/10 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/25'
                        }`}
                        onClick={() => { setSelectedAsset(asset); setShowBarcodeDialog(true); }}>
                        <TableCell className="py-3.5">
                          <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 px-2 py-0.5 rounded-lg">{asset.assetId}</span>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 rounded-xl overflow-hidden border border-border/60 bg-muted flex-shrink-0 shadow-sm">
                              {isValidImageUrl(asset.imageUrl) ? (
                                <Image src={asset.imageUrl} alt={asset.name} fill className="object-cover" sizes="40px" unoptimized />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/60">
                                  <Package className="h-4.5 w-4.5 text-muted-foreground/60 h-[18px] w-[18px]" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-bold text-sm text-foreground group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors truncate">{asset.name}</p>
                                {isSparePart && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[9px] font-bold border border-amber-200 flex-shrink-0"><Wrench className="h-2.5 w-2.5" />SPARE</span>}
                              </div>
                              {isSparePart && asset.department?.name && <p className="text-[10px] text-amber-600 font-medium mt-0.5">{asset.department.name}</p>}
                              {!isSparePart && asset.description && <p className="text-[11px] text-muted-foreground truncate max-w-[200px] mt-0.5">{asset.description}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-2">
                            <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              asset.type === 'FURNITURE' ? 'bg-blue-100 dark:bg-blue-900/40'
                              : asset.type === 'EQUIPMENT' ? 'bg-emerald-100 dark:bg-emerald-900/40'
                              : 'bg-violet-100 dark:bg-violet-900/40'
                            }`}>
                              {asset.type === 'FURNITURE' && <Sofa className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                              {asset.type === 'EQUIPMENT' && <Package className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                              {asset.type === 'ELECTRONICS' && <Computer className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />}
                            </div>
                            <span className={`text-[11px] font-semibold capitalize ${
                              asset.type === 'FURNITURE' ? 'text-blue-700 dark:text-blue-400'
                              : asset.type === 'EQUIPMENT' ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-violet-700 dark:text-violet-400'
                            }`}>{(asset.type || '').toLowerCase()}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-1.5">
                            <div className="h-6 w-6 rounded-lg bg-muted/80 flex items-center justify-center flex-shrink-0">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground">Floor {asset.floorNumber}</p>
                              <p className="text-[10px] text-muted-foreground">Room {asset.roomNumber}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5">
                          {asset.vendor?.name ? (
                            <span className="text-xs font-medium text-foreground/80">{asset.vendor.name}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50 italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div className="space-y-1">
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                              asset.status === 'BORROWED'
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400'
                                : asset.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-900/20 dark:text-emerald-400'
                                : asset.status === 'DISPOSED'
                                ? 'bg-red-50 text-red-700 border-red-200/70 dark:bg-red-900/20 dark:text-red-400'
                                : 'bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-900/20 dark:text-amber-400'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                                asset.status === 'BORROWED' ? 'bg-blue-500 animate-pulse'
                                : asset.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse'
                                : asset.status === 'DISPOSED' ? 'bg-red-500'
                                : 'bg-amber-500'
                              }`} />
                              {asset.status === 'IN_TRANSIT' ? 'In Transit' : asset.status === 'BORROWED' ? 'Borrowed' : (asset.status || '').charAt(0) + (asset.status || '').slice(1).toLowerCase()}
                            </span>
                            {activeBorrow && remainDays != null && (
                              <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                borrowOverdue ? 'bg-red-100 text-red-700' : borrowUrgent ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                <Clock className="h-2.5 w-2.5" />
                                {borrowOverdue ? `${Math.abs(remainDays)}d overdue` : remainDays === 0 ? 'Due today!' : `${remainDays}d left`}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1 justify-end">
                            {/* Borrow/Return button */}
                            {!isSparePart && (
                              <Button variant="ghost" size="icon"
                                className={`h-8 w-8 rounded-lg transition-colors ${
                                  activeBorrow ? 'hover:bg-emerald-100 hover:text-emerald-700 text-emerald-600' : 'hover:bg-blue-100 hover:text-blue-700 text-slate-400'
                                }`}
                                title={activeBorrow ? 'Return asset' : 'Borrow asset'}
                                onClick={() => { setBorrowAsset(asset); setShowBorrowDialog(true); }}>
                                <ArrowLeftRight className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                              onClick={() => { setSelectedAsset(asset); setShowEditDialog(true); }}
                              title="Edit asset">
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <AssetDuplicateButton asset={asset} onDuplicationComplete={loadAssets} />
                            <PrintAssetReportButton asset={asset} variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                            </PrintAssetReportButton>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {handheldMode ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Handheld scanner</h2>
              <Button variant="outline" size="sm" onClick={() => setHandheldMode(false)}>
                Exit handheld mode
              </Button>
            </div>
            <HandheldAssetScanner onAssetSelected={(a) => a && setSelectedAsset(a as Asset)} />
          </div>
        ) : (
          renderAssetsContent()
        )}
      </div>
      {/* Borrow / Return Dialog */}
      <BorrowReturnDialog
        open={showBorrowDialog}
        onOpenChange={setShowBorrowDialog}
        asset={borrowAsset}
        onSuccess={() => loadAssets(true)}
      />

      <AssetDetailsDialog
        asset={selectedAsset}
        open={showBarcodeDialog}
        onOpenChange={setShowBarcodeDialog}
        onAssetUpdated={async () => {
          loadAssets(true);
          if (selectedAsset?.id) {
            try {
              const res = await fetch(`/api/assets/${selectedAsset.id}`, {
                headers: { 'Cache-Control': 'no-cache' },
              });
              if (res.ok) {
                const data = await res.json();
                const updated = data?.asset ?? data;
                if (updated?.id) setSelectedAsset(updated as Asset);
              }
            } catch { /* ignore */ }
          }
        }}
      />

      <EditAssetDialog
        asset={selectedAsset}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onAssetUpdated={() => {
          loadAssets(true); // bypass cache so updated imageUrl appears immediately
          if (selectedAsset) {
            fetchHistory(selectedAsset.id);
          }
        }}
      />

      <AssetDisposalDialog
        asset={selectedAsset}
        open={showDisposalDialog}
        onOpenChange={setShowDisposalDialog}
        onAssetDisposed={handleAssetDisposed}
      />

      <UserAssetsPanel
        open={showUserAssetsPanel}
        onOpenChange={setShowUserAssetsPanel}
        onViewAsset={(asset) => {
          setSelectedAsset(asset as any);
          setShowUserAssetsPanel(false);
          setShowBarcodeDialog(true);
        }}
        onClearanceComplete={async () => {
          // Refresh the global asset list so cleared assets show as unassigned
          loadAssets(true);
          // If the asset details dialog is open for a now-cleared asset, re-fetch it
          if (selectedAsset?.id) {
            try {
              const res = await fetch(`/api/assets/${selectedAsset.id}`, {
                headers: { 'Cache-Control': 'no-cache' },
              });
              if (res.ok) {
                const data = await res.json();
                const updated = data?.asset ?? data;
                if (updated?.id) setSelectedAsset(updated as Asset);
              }
            } catch { /* ignore */ }
          }
        }}
      />
    </DashboardLayout>
  );
}
