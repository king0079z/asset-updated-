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
  Download
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useGeolocation } from "@/hooks/useGeolocation";
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

const assetFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  type: z.enum(["FURNITURE", "EQUIPMENT", "ELECTRONICS"]),
  vendorId: z.string().optional(),
  floorNumber: z.string().min(1, "Floor number is required"),
  roomNumber: z.string().min(1, "Room number is required"),
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
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { toast } = useToast();
  const { latitude, longitude } = useGeolocation();

  const form = useForm<z.infer<typeof assetFormSchema>>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "FURNITURE",
      vendorId: "",
      floorNumber: "",
      roomNumber: "",
      imageUrl: "",
      latitude: null,
      longitude: null,
    },
  });

  const loadVendors = async () => {
    try {
      const response = await fetch("/api/vendors");
      if (!response.ok) throw new Error(`Failed to load vendors: ${response.status}`);
      const data = await response.json();
      setVendors(data);
    } catch (error) {
      console.error("Error loading vendors:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load vendors",
        variant: "destructive",
      });
    }
  };

  const loadAssets = async (bypassCache = false) => {
    setIsLoadingAssets(true);
    try {
      const url = bypassCache ? "/api/assets?refresh=1" : "/api/assets";
      const response = await fetch(url, bypassCache ? { headers: { 'Cache-Control': 'no-cache' } } : undefined);
      if (!response.ok) throw new Error(`Failed to load assets: ${response.status}`);
      const data = await response.json();
      setAssets(data);
    } catch (error) {
      console.error("Error loading assets:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load assets",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAssets(false);
    }
  };

  useEffect(() => {
    // Load vendors and assets in parallel
    Promise.all([loadVendors(), loadAssets()]);

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
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  // Search / filter / view state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
      const assetData = {
        ...values,
        imageUrl: imageUrl || null,
        latitude: latitude || null,
        longitude: longitude || null,
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
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.assetId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (asset.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (asset.vendor?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || asset.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const { t } = useTranslation();

  return (
    <DashboardLayout>
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
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="relative z-10 p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-semibold text-white/90">{t('total_assets')}</p>
                <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Box className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-4xl font-bold tabular-nums mb-1">{assets.length}</p>
              <p className="text-xs text-white/70">{t('registered_assets_in_system')}</p>
              <div className="mt-4 flex gap-2 text-xs text-white/70">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />{activeAssets} active</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />{transitAssets} transit</span>
              </div>
            </div>
          </div>
          {/* Total Value */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="relative z-10 p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-semibold text-white/90">{t('total_asset_value')}</p>
                <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Tag className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold tabular-nums mb-1 truncate">
                QAR {totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-white/70">{t('total_value_of_active_assets')}</p>
              <div className="mt-4 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/60 rounded-full" style={{ width: '80%' }} />
              </div>
            </div>
          </div>
          {/* Vendors */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="relative z-10 p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-semibold text-white/90">{t('active_vendors')}</p>
                <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Truck className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-4xl font-bold tabular-nums mb-1">{vendors.length}</p>
              <p className="text-xs text-white/70">{t('connected_suppliers_and_vendors')}</p>
              <div className="mt-4 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/60 rounded-full" style={{ width: '65%' }} />
              </div>
            </div>
          </div>
          {/* Asset Types breakdown */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />
            <div className="relative z-10 p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-semibold text-white/90">{t('asset_types')}</p>
                <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <Layers className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'Furniture', count: assetCounts.FURNITURE, icon: Sofa, color: 'bg-blue-400' },
                  { label: 'Equipment', count: assetCounts.EQUIPMENT, icon: Package, color: 'bg-emerald-400' },
                  { label: 'Electronics', count: assetCounts.ELECTRONICS, icon: Computer, color: 'bg-violet-400' },
                ].map(({ label, count, icon: Icon, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-white/60 flex-shrink-0" />
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full`} style={{ width: assets.length ? `${(count / assets.length) * 100}%` : '0%' }} />
                    </div>
                    <span className="text-xs font-bold text-white/90 w-4 text-right tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════
            Assets List Card
        ══════════════════════════════════════ */}
        <Card className="border-0 ring-1 ring-border/60 shadow-sm">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base">{t('assets_list')}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {filteredAssets.length} of {assets.length} {t('manage_and_track_all_registered_assets')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2 h-8 rounded-lg"
                  onClick={() => {
                    const exportData = assets.map(a => ({ 'Asset ID': a.assetId, 'Name': a.name, 'Type': a.type, 'Description': a.description || '', 'Floor': a.floorNumber, 'Room': a.roomNumber, 'Status': a.status, 'Vendor': a.vendor?.name || '' }));
                    exportToExcel(exportData, `assets-${new Date().toISOString().split('T')[0]}`);
                  }}>
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('export')}</span>
                </Button>
                <Button variant="outline" size="sm" className="gap-2 h-8 rounded-lg"
                  onClick={() => setViewMode(v => v === 'table' ? 'grid' : 'table')}>
                  {viewMode === 'table' ? <Grid3X3 className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{viewMode === 'table' ? 'Grid' : 'Table'}</span>
                </Button>
              </div>
            </div>

            {/* Search + filter bar */}
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, ID, vendor…"
                  className="pl-9 h-9 rounded-xl border-border/60 focus-visible:ring-indigo-400/40"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[140px] h-9 rounded-xl border-border/60">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="FURNITURE">Furniture</SelectItem>
                  <SelectItem value="EQUIPMENT">Equipment</SelectItem>
                  <SelectItem value="ELECTRONICS">Electronics</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px] h-9 rounded-xl border-border/60">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                  <SelectItem value="DISPOSED">Disposed</SelectItem>
                </SelectContent>
              </Select>
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
                <div className="p-6 space-y-3 animate-pulse">
                  <div className="h-10 bg-muted rounded-lg" />
                  {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-muted/60 rounded-lg" />)}
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="font-semibold mb-1">{t('no_assets_found') || 'No assets found'}</p>
                  <p className="text-sm text-muted-foreground max-w-sm mb-4">{t('no_assets_found_description') || 'No assets registered. Register your first asset to get started.'}</p>
                  <Button onClick={() => setIsOpen(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                    <PlusCircle className="h-4 w-4" /> Register First Asset
                  </Button>
                </div>
              ) : viewMode === 'grid' ? (
                /* ── Grid View ── */
                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredAssets.map(asset => {
                    const typeConfig = asset.type === 'FURNITURE'
                      ? { icon: Sofa, bg: 'bg-blue-100 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400', grad: 'from-blue-500 to-indigo-500', label: 'Furniture' }
                      : asset.type === 'EQUIPMENT'
                        ? { icon: Package, bg: 'bg-emerald-100 dark:bg-emerald-900/30', color: 'text-emerald-600 dark:text-emerald-400', grad: 'from-emerald-500 to-teal-500', label: 'Equipment' }
                        : { icon: Computer, bg: 'bg-purple-100 dark:bg-purple-900/30', color: 'text-purple-600 dark:text-purple-400', grad: 'from-violet-500 to-purple-500', label: 'Electronics' };
                    const TypeIcon = typeConfig.icon;
                    return (
                      <div key={asset.id}
                        className="group relative rounded-2xl border border-border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden cursor-pointer"
                        onClick={() => { setSelectedAsset(asset); setShowBarcodeDialog(true); }}>
                        <div className={`h-1 w-full bg-gradient-to-r ${typeConfig.grad} opacity-70 group-hover:opacity-100 transition-opacity`} />
                        <div className="p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className={`h-10 w-10 rounded-xl ${typeConfig.bg} flex items-center justify-center flex-shrink-0`}>
                              {isValidImageUrl(asset.imageUrl) ? (
                                <Image src={asset.imageUrl} alt={asset.name} width={40} height={40} className="rounded-xl object-cover w-10 h-10" unoptimized />
                              ) : (
                                <TypeIcon className={`h-5 w-5 ${typeConfig.color}`} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-sm truncate">{asset.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{asset.assetId}</p>
                            </div>
                            <Badge className={`flex-shrink-0 text-[10px] h-5 px-1.5 ${
                              asset.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0'
                              : asset.status === 'DISPOSED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full mr-1 inline-block ${asset.status === 'ACTIVE' ? 'bg-emerald-500' : asset.status === 'DISPOSED' ? 'bg-red-500' : 'bg-amber-500'}`} />
                              {asset.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span>Floor {asset.floorNumber}, Rm {asset.roomNumber}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Truck className="h-3 w-3" />
                              <span className="truncate">{asset.vendor?.name || '—'}</span>
                            </div>
                            {asset.purchaseAmount && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Tag className="h-3 w-3" />
                                <span>QAR {asset.purchaseAmount.toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <TypeIcon className="h-3 w-3" />
                              <span>{typeConfig.label}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2 border-t border-border/50" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs gap-1"
                              onClick={() => { setSelectedAsset(asset); setShowEditDialog(true); }}>
                              <Edit className="h-3 w-3" /> Edit
                            </Button>
                            <AssetDuplicateButton asset={asset} onDuplicationComplete={loadAssets} />
                            <PrintAssetReportButton asset={asset} variant="ghost" size="icon" className="h-7 w-7">
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
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-[110px] text-xs font-semibold uppercase tracking-wide">{t('asset_id')}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">{t('asset_details')}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">{t('type')}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">{t('location')}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">{t('vendor')}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide">{t('status')}</TableHead>
                      <TableHead className="w-[120px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssets.map((asset) => (
                      <TableRow key={asset.id}
                        className="cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors group"
                        onClick={() => { setSelectedAsset(asset); setShowBarcodeDialog(true); }}>
                        <TableCell>
                          <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">{asset.assetId}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative h-9 w-9 rounded-xl overflow-hidden border bg-muted flex-shrink-0">
                              {isValidImageUrl(asset.imageUrl) ? (
                                <Image src={asset.imageUrl} alt={asset.name} fill className="object-cover" sizes="36px" unoptimized />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{asset.name}</p>
                              {asset.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[180px]">{asset.description}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                              asset.type === 'FURNITURE' ? 'bg-blue-100 dark:bg-blue-900/30'
                              : asset.type === 'EQUIPMENT' ? 'bg-emerald-100 dark:bg-emerald-900/30'
                              : 'bg-violet-100 dark:bg-violet-900/30'
                            }`}>
                              {asset.type === 'FURNITURE' && <Sofa className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                              {asset.type === 'EQUIPMENT' && <Package className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                              {asset.type === 'ELECTRONICS' && <Computer className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />}
                            </div>
                            <span className="text-xs font-medium capitalize">{asset.type.toLowerCase()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium">Floor {asset.floorNumber}</p>
                              <p className="text-[10px] text-muted-foreground">Room {asset.roomNumber}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{asset.vendor?.name || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                            asset.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : asset.status === 'DISPOSED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${asset.status === 'ACTIVE' ? 'bg-emerald-500' : asset.status === 'DISPOSED' ? 'bg-red-500' : 'bg-amber-500'}`} />
                            {asset.status}
                          </span>
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => { setSelectedAsset(asset); setShowEditDialog(true); }}>
                              <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <AssetDuplicateButton asset={asset} onDuplicationComplete={loadAssets} />
                            <PrintAssetReportButton asset={asset} variant="ghost" size="icon" className="h-7 w-7">
                              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                            </PrintAssetReportButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
      />
    </DashboardLayout>
  );
}