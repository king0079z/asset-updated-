// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import {
  Wifi, Plus, RefreshCw, Trash2, Tag, MapPin, Building2, Radio,
  Battery, BatteryLow, BatteryCharging, AlertTriangle, CheckCircle2,
  Settings, Copy, X, Search, Zap, Activity, Eye, ChevronDown, ChevronUp,
  Signal, Clock, Package, Link, Unlink, Info, ExternalLink, Layers, Bell,
} from 'lucide-react';

const ZoneMapEditor   = dynamic(() => import('@/components/rfid/ZoneMapEditor'),   { ssr: false });
const LiveTrackingMap = dynamic(() => import('@/components/rfid/LiveTrackingMap'), { ssr: false });
const AlertRulesPanel = dynamic(() => import('@/components/rfid/AlertRulesPanel'), { ssr: false });
const AlertsLog       = dynamic(() => import('@/components/rfid/AlertsLog'),       { ssr: false });
const FloorMap3D      = dynamic(() => import('@/components/rfid/FloorMap3D'),      { ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────────
interface RFIDTag {
  id: string; tagId: string; tagType: string; status: string;
  batteryLevel?: number; lastRssi?: number; lastSeenAt?: string;
  manufacturer?: string; model?: string; notes?: string;
  asset?: { id: string; name: string; type: string; status: string; imageUrl?: string; floorNumber?: string; roomNumber?: string } | null;
  lastZone?: { id: string; name: string; floorNumber?: string; roomNumber?: string } | null;
}
interface RFIDZone {
  id: string; name: string; description?: string; apMacAddress?: string;
  apIpAddress?: string; apSerialNumber?: string;
  floorNumber?: string; roomNumber?: string; building?: string;
  _count?: { tags: number; scans: number };
  tags?: RFIDTag[];
}
interface Stats { totalTags: number; activeTags: number; lowBattery: number; missing: number; unassigned: number; totalZones: number; scans24h: number; }

// ── Visual helpers ─────────────────────────────────────────────────────────────
const TAG_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  ACTIVE:       { label: 'Active',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800', dot: 'bg-emerald-500' },
  LOW_BATTERY:  { label: 'Low Battery',  cls: 'bg-amber-50   text-amber-700   border-amber-200   dark:bg-amber-950   dark:text-amber-300   dark:border-amber-800',   dot: 'bg-amber-500' },
  MISSING:      { label: 'Missing',      cls: 'bg-red-50     text-red-700     border-red-200     dark:bg-red-950     dark:text-red-300     dark:border-red-800',     dot: 'bg-red-500' },
  INACTIVE:     { label: 'Inactive',     cls: 'bg-slate-50   text-slate-600   border-slate-200   dark:bg-slate-800   dark:text-slate-400   dark:border-slate-700',   dot: 'bg-slate-400' },
  UNASSIGNED:   { label: 'Unassigned',   cls: 'bg-violet-50  text-violet-700  border-violet-200  dark:bg-violet-950  dark:text-violet-300  dark:border-violet-800',  dot: 'bg-violet-400' },
};
const getTagStatus = (s: string) => TAG_STATUS[s] ?? TAG_STATUS.INACTIVE;

const BatteryIcon = ({ level }: { level?: number | null }) => {
  if (level == null) return <Battery className="h-4 w-4 text-muted-foreground/40" />;
  if (level <= 20)   return <BatteryLow className="h-4 w-4 text-red-500" />;
  return <BatteryCharging className="h-4 w-4 text-emerald-500" />;
};

const SignalBar = ({ rssi }: { rssi?: number | null }) => {
  if (rssi == null) return <span className="text-muted-foreground/40 text-xs">N/A</span>;
  const quality = rssi >= -60 ? 'Excellent' : rssi >= -75 ? 'Good' : rssi >= -90 ? 'Fair' : 'Weak';
  const color   = rssi >= -60 ? 'text-emerald-500' : rssi >= -75 ? 'text-blue-500' : rssi >= -90 ? 'text-amber-500' : 'text-red-500';
  return <span className={`text-xs font-semibold ${color}`}>{rssi} dBm · {quality}</span>;
};

const timeAgo = (ts?: string | null) => {
  if (!ts) return 'Never';
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// ── Main page ──────────────────────────────────────────────────────────────────
export default function RFIDPage() {
  const [tags,        setTags]        = useState<RFIDTag[]>([]);
  const [zones,       setZones]       = useState<RFIDZone[]>([]);
  const [stats,       setStats]       = useState<Stats | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<'overview' | 'tags' | 'zones' | 'zone-map' | 'alerts' | 'setup'>('overview');
  const [unresolvedAlerts, setUnresolvedAlerts] = useState(0);
  const [zoneMapMode, setZoneMapMode] = useState<'edit' | 'live' | '3d'>('3d');
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [search,      setSearch]      = useState('');
  const [refreshing,  setRefreshing]  = useState(false);

  // Tag form
  const [showTagForm,    setShowTagForm]    = useState(false);
  const [tagFormData,    setTagFormData]    = useState({ tagId: '', tagType: 'BLE', manufacturer: '', model: '', notes: '', assetSearch: '' });
  const [savingTag,      setSavingTag]      = useState(false);
  const [unlinkedAssets, setUnlinkedAssets] = useState<any[]>([]);
  const [selectedAsset,  setSelectedAsset]  = useState<any>(null);

  // Zone form
  const [showZoneForm,  setShowZoneForm]  = useState(false);
  const [zoneFormData,  setZoneFormData]  = useState({ name: '', description: '', apMacAddress: '', apIpAddress: '', apSerialNumber: '', floorNumber: '', roomNumber: '', building: '' });
  const [savingZone,    setSavingZone]    = useState(false);

  const [expandedTagId, setExpandedTagId] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async (force = false) => {
    try {
      const [tagsRes, zonesRes, statsRes] = await Promise.all([
        fetch('/api/rfid/tags'),
        fetch('/api/rfid/zones'),
        fetch('/api/rfid/stats'),
      ]);
      if (tagsRes.ok)  { const d = await tagsRes.json();  setTags(d.tags ?? []); }
      if (zonesRes.ok) { const d = await zonesRes.json(); setZones(d.zones ?? []); }
      if (statsRes.ok) { const d = await statsRes.json(); setStats(d); }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, []);

  // Auto-refresh every 15 seconds when on overview tab
  useEffect(() => {
    if (activeTab !== 'overview') return;
    const t = setInterval(() => loadAll(), 15_000);
    return () => clearInterval(t);
  }, [activeTab, loadAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll(true);
    setRefreshing(false);
  };

  // Load unlinked assets for tag form
  useEffect(() => {
    if (!showTagForm) return;
    fetch('/api/assets')
      .then(r => r.ok ? r.json() : { assets: [] })
      .then(d => {
        const all = d.assets ?? [];
        // Filter to assets not yet linked to a tag
        const linkedIds = new Set(tags.filter(t => t.asset).map(t => t.asset!.id));
        setUnlinkedAssets(all.filter((a: any) => !linkedIds.has(a.id)));
      });
  }, [showTagForm, tags]);

  // ── Create tag ──────────────────────────────────────────────────────────────
  const handleCreateTag = async () => {
    if (!tagFormData.tagId.trim()) {
      toast({ title: 'Tag ID required', variant: 'destructive' }); return;
    }
    setSavingTag(true);
    try {
      const res = await fetch('/api/rfid/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tagFormData, assetId: selectedAsset?.id ?? null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: 'Tag registered', description: `${tagFormData.tagId} is now in the system.` });
      setShowTagForm(false);
      setTagFormData({ tagId: '', tagType: 'BLE', manufacturer: '', model: '', notes: '', assetSearch: '' });
      setSelectedAsset(null);
      loadAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSavingTag(false); }
  };

  // ── Delete tag ──────────────────────────────────────────────────────────────
  const handleDeleteTag = async (id: string) => {
    if (!confirm('Remove this tag from the system?')) return;
    await fetch(`/api/rfid/tags/${id}`, { method: 'DELETE' });
    toast({ title: 'Tag removed' });
    loadAll();
  };

  // ── Create zone ─────────────────────────────────────────────────────────────
  const handleCreateZone = async () => {
    if (!zoneFormData.name.trim()) {
      toast({ title: 'Zone name required', variant: 'destructive' }); return;
    }
    setSavingZone(true);
    try {
      const res = await fetch('/api/rfid/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zoneFormData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: 'Zone created', description: `${zoneFormData.name} is ready to receive tag scans.` });
      setShowZoneForm(false);
      setZoneFormData({ name: '', description: '', apMacAddress: '', apIpAddress: '', apSerialNumber: '', floorNumber: '', roomNumber: '', building: '' });
      loadAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSavingZone(false); }
  };

  // ── Seed demo data ──────────────────────────────────────────────────────────
  const handleSeedDemo = async (clear = true) => {
    if (!confirm(`This will ${clear ? 'CLEAR existing RFID data and ' : ''}load the Apex Medical Center demo dataset.\n\nContinue?`)) return;
    setSeedingDemo(true);
    try {
      const res  = await fetch(`/api/rfid/seed-demo${clear ? '?clear=true' : ''}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Seed failed');
      toast({
        title: '🏥 Demo data loaded!',
        description: `Apex Medical Center · ${data.created.assets} assets · ${data.created.rfidTags} tags · ${data.created.zones} zones · ${data.created.scans} scans`,
      });
      await loadAll(true);
    } catch (e: any) {
      toast({ title: 'Seed failed', description: e.message, variant: 'destructive' });
    } finally {
      setSeedingDemo(false);
    }
  };

  // ── Delete zone ─────────────────────────────────────────────────────────────
  const handleDeleteZone = async (id: string) => {
    if (!confirm('Delete this zone? Tag scans will lose their zone reference.')) return;
    await fetch(`/api/rfid/zones/${id}`, { method: 'DELETE' });
    toast({ title: 'Zone deleted' });
    loadAll();
  };

  // ── Filtered tags ────────────────────────────────────────────────────────────
  const filteredTags = tags.filter(t => {
    const q = search.toLowerCase();
    return !q || t.tagId.toLowerCase().includes(q) || (t.asset?.name ?? '').toLowerCase().includes(q) || (t.lastZone?.name ?? '').toLowerCase().includes(q);
  });

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/rfid/webhook`
    : '/api/rfid/webhook';

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-8">

          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <div className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-zinc-950" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.2),transparent_60%)]" />
            <div className="absolute -top-12 -right-12 w-60 h-60 rounded-full bg-indigo-500/8 blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-72 h-24 rounded-full bg-violet-500/8 blur-2xl" />

            {/* Huawei AP visual */}
            <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:flex flex-col items-center gap-2 opacity-15">
              <div className="w-32 h-32 rounded-full border-2 border-white/20 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border border-white/15 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center">
                    <Wifi className="h-8 w-8 text-white" />
                  </div>
                </div>
              </div>
              {[1,2,3].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30" style={{ animationDelay: `${i * 0.3}s` }} />
              ))}
            </div>

            <div className="relative z-10 px-8 pt-8 pb-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center flex-shrink-0">
                  <Radio className="h-7 w-7 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-3xl font-bold text-white tracking-tight">RFID & BLE Tracking</h1>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-widest">Live</span>
                  </div>
                  <p className="text-slate-400 text-sm">Huawei AirEngine 6776-58TI · BLE 5.0 · Real-time asset location</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  onClick={() => handleSeedDemo(true)}
                  disabled={seedingDemo}
                  className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 gap-2 rounded-xl backdrop-blur"
                >
                  {seedingDemo
                    ? <><RefreshCw className="h-4 w-4 animate-spin" /> Loading Demo…</>
                    : <><Zap className="h-4 w-4" /> Load Demo Data</>
                  }
                </Button>
                <Button onClick={handleRefresh} disabled={refreshing} className="bg-white/10 hover:bg-white/20 text-white border border-white/15 gap-2 rounded-xl backdrop-blur">
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </div>
            </div>

            {/* Stats row */}
            <div className="relative z-10 px-8 pb-8 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-2">
              {loading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/8"><Skeleton className="h-6 w-12 mb-1" /><Skeleton className="h-3 w-16" /></div>
                ))
              ) : stats ? [
                { label: 'Total Tags',   value: stats.totalTags,  color: 'text-white',          icon: Tag },
                { label: 'Active',        value: stats.activeTags, color: 'text-emerald-400',    icon: CheckCircle2 },
                { label: 'Low Battery',   value: stats.lowBattery, color: 'text-amber-400',      icon: BatteryLow },
                { label: 'Missing',       value: stats.missing,    color: 'text-red-400',         icon: AlertTriangle },
                { label: 'Unassigned',    value: stats.unassigned, color: 'text-violet-400',     icon: Tag },
                { label: 'Zones (APs)',   value: stats.totalZones, color: 'text-blue-400',       icon: Building2 },
                { label: 'Scans (24 h)', value: stats.scans24h,  color: 'text-indigo-400',      icon: Activity },
              ].map(s => (
                <div key={s.label} className="bg-white/5 backdrop-blur border border-white/8 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-400 font-medium leading-tight">{s.label}</span>
                    <s.icon className={`h-3 w-3 ${s.color}`} />
                  </div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              )) : null}
            </div>
          </div>

          {/* ── Tabs ──────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl flex-wrap">
            {([
              { id: 'overview',  label: 'Live Overview', icon: Activity },
              { id: 'tags',      label: 'Tags',          icon: Tag },
              { id: 'zones',     label: 'Zones / APs',   icon: Building2 },
              { id: 'zone-map',  label: 'Zone Map',      icon: Layers },
              { id: 'alerts',    label: 'Alerts',        icon: Bell },
              { id: 'setup',     label: 'Integration',   icon: Settings },
            ] as const).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="h-4 w-4" /> {tab.label}
                {tab.id === 'alerts' && unresolvedAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {unresolvedAlerts > 9 ? '9+' : unresolvedAlerts}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ══ OVERVIEW TAB ══════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
                </div>
              ) : tags.filter(t => t.asset).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
                    <Radio className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                  <p className="font-bold text-xl text-muted-foreground">No tagged assets yet</p>
                  <p className="text-muted-foreground text-sm text-center max-w-sm">Register your first RFID / BLE tag and link it to an asset to see live tracking here.</p>
                  <Button onClick={() => { setActiveTab('tags'); setShowTagForm(true); }} className="rounded-xl gap-2">
                    <Plus className="h-4 w-4" /> Register First Tag
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {tags.filter(t => t.asset).map(tag => {
                    const st = getTagStatus(tag.status);
                    const seenRecently = tag.lastSeenAt && (Date.now() - new Date(tag.lastSeenAt).getTime()) < 300_000;
                    return (
                      <div key={tag.id} className={`rounded-2xl border bg-card overflow-hidden transition-all hover:shadow-md ${
                        tag.status === 'MISSING'     ? 'border-red-200 dark:border-red-900' :
                        tag.status === 'LOW_BATTERY' ? 'border-amber-200 dark:border-amber-900' :
                        seenRecently ? 'border-emerald-200 dark:border-emerald-900' : 'border-border'
                      }`}>
                        {/* Status strip */}
                        <div className={`h-1 w-full ${
                          tag.status === 'MISSING' ? 'bg-red-500' :
                          tag.status === 'LOW_BATTERY' ? 'bg-amber-500' :
                          seenRecently ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`} />

                        <div className="p-4 space-y-3">
                          {/* Asset info */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center flex-shrink-0">
                                <Package className="h-5 w-5 text-indigo-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm truncate">{tag.asset?.name ?? '—'}</p>
                                <p className="text-xs text-muted-foreground truncate font-mono">{tag.tagId}</p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${st.cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot} ${seenRecently && tag.status === 'ACTIVE' ? 'animate-pulse' : ''}`} />
                              {st.label}
                            </span>
                          </div>

                          {/* Location */}
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                            <span className="font-semibold">{tag.lastZone?.name ?? 'Location unknown'}</span>
                            {tag.lastZone?.floorNumber && (
                              <span className="text-muted-foreground">· Floor {tag.lastZone.floorNumber}</span>
                            )}
                          </div>

                          {/* Metrics */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-muted/30 rounded-lg p-2 text-center">
                              <div className="flex justify-center mb-1"><BatteryIcon level={tag.batteryLevel} /></div>
                              <p className="text-[10px] text-muted-foreground">Battery</p>
                              <p className="text-xs font-bold">{tag.batteryLevel != null ? `${tag.batteryLevel}%` : '—'}</p>
                            </div>
                            <div className="bg-muted/30 rounded-lg p-2 text-center">
                              <div className="flex justify-center mb-1"><Signal className="h-4 w-4 text-blue-500" /></div>
                              <p className="text-[10px] text-muted-foreground">RSSI</p>
                              <p className="text-[10px] font-bold">{tag.lastRssi != null ? `${tag.lastRssi} dBm` : '—'}</p>
                            </div>
                            <div className="bg-muted/30 rounded-lg p-2 text-center">
                              <div className="flex justify-center mb-1"><Clock className="h-4 w-4 text-muted-foreground" /></div>
                              <p className="text-[10px] text-muted-foreground">Last Seen</p>
                              <p className="text-[10px] font-bold">{timeAgo(tag.lastSeenAt)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ TAGS TAB ══════════════════════════════════════════════════ */}
          {activeTab === 'tags' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by tag ID, asset name or zone…" className="pl-9 rounded-xl"
                    value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Button onClick={() => setShowTagForm(true)} className="rounded-xl gap-2 flex-shrink-0">
                  <Plus className="h-4 w-4" /> Register Tag
                </Button>
              </div>

              {/* Register tag form */}
              {showTagForm && (
                <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2"><Tag className="h-4 w-4 text-indigo-500" /> Register New Tag</h3>
                    <button onClick={() => setShowTagForm(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Tag ID / MAC Address *</label>
                      <Input placeholder="AA:BB:CC:DD:EE:FF" className="rounded-xl font-mono"
                        value={tagFormData.tagId} onChange={e => setTagFormData(p => ({ ...p, tagId: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Tag Type</label>
                      <select className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm"
                        value={tagFormData.tagType} onChange={e => setTagFormData(p => ({ ...p, tagType: e.target.value }))}>
                        <option value="BLE">BLE (Bluetooth Low Energy)</option>
                        <option value="RFID">RFID (EPC Gen2 / UHF)</option>
                        <option value="UHF">UHF RFID</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Link to Asset</label>
                      <div className="relative">
                        <Input placeholder="Search asset…" className="rounded-xl"
                          value={selectedAsset ? selectedAsset.name : tagFormData.assetSearch}
                          onChange={e => {
                            setTagFormData(p => ({ ...p, assetSearch: e.target.value }));
                            setSelectedAsset(null);
                          }} />
                        {!selectedAsset && tagFormData.assetSearch && (
                          <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-popover border border-border rounded-xl shadow-lg max-h-40 overflow-auto">
                            {unlinkedAssets.filter(a => a.name.toLowerCase().includes(tagFormData.assetSearch.toLowerCase())).slice(0, 8).map(a => (
                              <button key={a.id} onClick={() => { setSelectedAsset(a); setTagFormData(p => ({ ...p, assetSearch: '' })); }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center gap-2">
                                <Package className="h-3.5 w-3.5 text-indigo-500" /> {a.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {selectedAsset && (
                        <div className="mt-1 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Linked to: {selectedAsset.name}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Manufacturer</label>
                      <Input placeholder="e.g. Zebra, Impinj, BlueUp" className="rounded-xl"
                        value={tagFormData.manufacturer} onChange={e => setTagFormData(p => ({ ...p, manufacturer: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Model</label>
                      <Input placeholder="e.g. RL6000" className="rounded-xl"
                        value={tagFormData.model} onChange={e => setTagFormData(p => ({ ...p, model: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Notes</label>
                      <Input placeholder="Optional notes…" className="rounded-xl"
                        value={tagFormData.notes} onChange={e => setTagFormData(p => ({ ...p, notes: e.target.value }))} />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowTagForm(false)}>Cancel</Button>
                    <Button size="sm" className="rounded-xl gap-2" onClick={handleCreateTag} disabled={savingTag}>
                      {savingTag ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
                      {savingTag ? 'Registering…' : 'Register Tag'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Tags list */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">{filteredTags.length} tag{filteredTags.length !== 1 ? 's' : ''}</p>
                </div>
                {loading ? (
                  <div className="divide-y divide-border">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="px-5 py-4 flex items-center gap-4">
                        <Skeleton className="w-10 h-10 rounded-xl" />
                        <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/4" /></div>
                      </div>
                    ))}
                  </div>
                ) : filteredTags.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 gap-3">
                    <Tag className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-muted-foreground font-semibold">{search ? 'No tags match your search' : 'No tags registered yet'}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredTags.map(tag => {
                      const st = getTagStatus(tag.status);
                      const isExpanded = expandedTagId === tag.id;
                      return (
                        <div key={tag.id}>
                          <div className="px-5 py-4 flex items-center gap-4 hover:bg-muted/20 transition-colors">
                            {/* Tag type icon */}
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center flex-shrink-0">
                              <Radio className="h-5 w-5 text-indigo-500" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                <span className="font-mono text-sm font-bold">{tag.tagId}</span>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{tag.tagType}</span>
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                {tag.asset && (
                                  <span className="flex items-center gap-1"><Link className="h-3 w-3 text-emerald-500" /> {tag.asset.name}</span>
                                )}
                                {tag.lastZone && (
                                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-blue-500" /> {tag.lastZone.name}</span>
                                )}
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {timeAgo(tag.lastSeenAt)}</span>
                                {tag.batteryLevel != null && (
                                  <span className="flex items-center gap-1"><BatteryIcon level={tag.batteryLevel} /> {tag.batteryLevel}%</span>
                                )}
                                <SignalBar rssi={tag.lastRssi} />
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => setExpandedTagId(isExpanded ? null : tag.id)}
                                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                              <button onClick={() => handleDeleteTag(tag.id)}
                                className="w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-5 py-4 bg-muted/20 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-3">
                              {[
                                { label: 'Manufacturer', value: tag.manufacturer || '—' },
                                { label: 'Model',        value: tag.model        || '—' },
                                { label: 'Tag Type',     value: tag.tagType },
                                { label: 'Last RSSI',    value: tag.lastRssi != null ? `${tag.lastRssi} dBm` : '—' },
                              ].map(f => (
                                <div key={f.label} className="bg-background rounded-xl p-3">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{f.label}</p>
                                  <p className="text-sm font-semibold">{f.value}</p>
                                </div>
                              ))}
                              {tag.notes && (
                                <div className="col-span-2 md:col-span-4 bg-background rounded-xl p-3">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Notes</p>
                                  <p className="text-sm">{tag.notes}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ ZONES TAB ══════════════════════════════════════════════════ */}
          {activeTab === 'zones' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm">Each zone maps to one Huawei AirEngine AP by its MAC address.</p>
                <Button onClick={() => setShowZoneForm(true)} className="rounded-xl gap-2">
                  <Plus className="h-4 w-4" /> Add Zone
                </Button>
              </div>

              {/* Zone form */}
              {showZoneForm && (
                <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2"><Building2 className="h-4 w-4 text-blue-500" /> Add Zone / AP</h3>
                    <button onClick={() => setShowZoneForm(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Zone Name *</label>
                      <Input placeholder="e.g. IT Server Room" className="rounded-xl"
                        value={zoneFormData.name} onChange={e => setZoneFormData(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">AP MAC Address</label>
                      <Input placeholder="AC:CE:8D:12:34:56" className="rounded-xl font-mono"
                        value={zoneFormData.apMacAddress} onChange={e => setZoneFormData(p => ({ ...p, apMacAddress: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">AP IP Address</label>
                      <Input placeholder="192.168.1.100" className="rounded-xl font-mono"
                        value={zoneFormData.apIpAddress} onChange={e => setZoneFormData(p => ({ ...p, apIpAddress: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">AP Serial Number</label>
                      <Input placeholder="e.g. SN2106123456" className="rounded-xl font-mono"
                        value={zoneFormData.apSerialNumber} onChange={e => setZoneFormData(p => ({ ...p, apSerialNumber: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Building</label>
                      <Input placeholder="e.g. HQ Building A" className="rounded-xl"
                        value={zoneFormData.building} onChange={e => setZoneFormData(p => ({ ...p, building: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Floor</label>
                      <Input placeholder="e.g. 3" className="rounded-xl"
                        value={zoneFormData.floorNumber} onChange={e => setZoneFormData(p => ({ ...p, floorNumber: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Room</label>
                      <Input placeholder="e.g. 301" className="rounded-xl"
                        value={zoneFormData.roomNumber} onChange={e => setZoneFormData(p => ({ ...p, roomNumber: e.target.value }))} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Description</label>
                      <Input placeholder="Optional description…" className="rounded-xl"
                        value={zoneFormData.description} onChange={e => setZoneFormData(p => ({ ...p, description: e.target.value }))} />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowZoneForm(false)}>Cancel</Button>
                    <Button size="sm" className="rounded-xl gap-2" onClick={handleCreateZone} disabled={savingZone}>
                      {savingZone ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5" />}
                      {savingZone ? 'Saving…' : 'Save Zone'}
                    </Button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
                </div>
              ) : zones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Building2 className="h-8 w-8 text-muted-foreground/30" />
                  <p className="font-semibold text-muted-foreground">No zones configured yet</p>
                  <p className="text-sm text-muted-foreground">Add a zone for each Huawei AirEngine AP in your building.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {zones.map(zone => (
                    <div key={zone.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                      <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
                      <div className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold">{zone.name}</h3>
                            {zone.description && <p className="text-xs text-muted-foreground">{zone.description}</p>}
                          </div>
                          <button onClick={() => handleDeleteZone(zone.id)}
                            className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 flex items-center justify-center text-muted-foreground hover:text-red-500 flex-shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          {zone.apMacAddress && (
                            <div className="flex items-center gap-2">
                              <Wifi className="h-3.5 w-3.5 text-blue-500" />
                              <span className="font-mono text-muted-foreground">{zone.apMacAddress}</span>
                            </div>
                          )}
                          {zone.apIpAddress && (
                            <div className="flex items-center gap-2">
                              <Signal className="h-3.5 w-3.5 text-indigo-500" />
                              <span className="font-mono text-muted-foreground">{zone.apIpAddress}</span>
                            </div>
                          )}
                          {(zone.building || zone.floorNumber || zone.roomNumber) && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-muted-foreground">
                                {[zone.building, zone.floorNumber && `Floor ${zone.floorNumber}`, zone.roomNumber && `Room ${zone.roomNumber}`].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-muted/30 rounded-xl p-2 text-center">
                            <p className="text-lg font-bold">{zone._count?.tags ?? 0}</p>
                            <p className="text-[10px] text-muted-foreground">Current Tags</p>
                          </div>
                          <div className="bg-muted/30 rounded-xl p-2 text-center">
                            <p className="text-lg font-bold">{zone._count?.scans ?? 0}</p>
                            <p className="text-[10px] text-muted-foreground">Total Scans</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ ZONE MAP TAB ═══════════════════════════════════════════════ */}
          {activeTab === 'zone-map' && (
            <div className="space-y-4">
              {/* Mode toggle */}
              <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl w-fit">
                <button
                  onClick={() => setZoneMapMode('3d')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    zoneMapMode === '3d'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Layers className="h-4 w-4 text-indigo-500" /> 3D Building
                </button>
                <button
                  onClick={() => setZoneMapMode('live')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    zoneMapMode === 'live'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Activity className="h-4 w-4 text-green-500" /> Live 2D Map
                </button>
                <button
                  onClick={() => setZoneMapMode('edit')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    zoneMapMode === 'edit'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Settings className="h-4 w-4 text-blue-500" /> Edit Zones
                </button>
              </div>

              {/* 3D building banner when in 3D mode */}
              {zoneMapMode === '3d' && (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                  <Layers className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    <span className="font-semibold">Apex Medical Center</span> · 3-floor isometric building view · Click floors to focus · Click asset dots for details
                  </p>
                  <button
                    onClick={() => setZoneMapMode('live')}
                    className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 font-semibold"
                  >
                    Switch to 2D →
                  </button>
                </div>
              )}

              <div className="min-h-[600px]">
                {zoneMapMode === '3d'   ? <FloorMap3D /> :
                 zoneMapMode === 'live' ? <LiveTrackingMap /> :
                                          <ZoneMapEditor onZoneUpdated={() => loadAll()} />
                }
              </div>
            </div>
          )}

          {/* ══ ALERTS TAB ════════════════════════════════════════════════ */}
          {activeTab === 'alerts' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[600px]">
              <AlertRulesPanel />
              <AlertsLog onUnresolvedCountChange={setUnresolvedAlerts} />
            </div>
          )}

          {/* ══ INTEGRATION / SETUP TAB ════════════════════════════════════ */}
          {activeTab === 'setup' && (
            <div className="space-y-6 max-w-3xl">

              {/* Device banner */}
              <div className="rounded-2xl border border-border bg-gradient-to-br from-slate-900 to-zinc-950 p-6 text-white space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                    <Wifi className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">Huawei AirEngine 6776-58TI</p>
                    <p className="text-white/50 text-sm">Wi-Fi 6 · BLE 5.0 IoT Radio · Integrated RFID Reader</p>
                  </div>
                  <a href="https://e.huawei.com/en/products/wlan/indoor-access-points/airengine-6776-58ti"
                    target="_blank" rel="noreferrer"
                    className="ml-auto flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200">
                    Datasheet <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {[
                    { label: 'BLE Version',   value: '5.0' },
                    { label: 'IoT Radio',     value: 'Built-in' },
                    { label: 'RFID Support',  value: 'EPC Gen2' },
                  ].map(s => (
                    <div key={s.label} className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="text-white font-bold">{s.value}</p>
                      <p className="text-white/40 text-[10px] mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Webhook URL */}
              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> Step 1 — Configure Webhook URL</h3>
                <p className="text-sm text-muted-foreground">
                  In Huawei <strong>iMaster NCE → IoT Service → BLE Data Push</strong>, set the data push URL to:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-2.5 rounded-xl bg-muted font-mono text-sm break-all">{webhookUrl}</code>
                  <button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast({ title: 'Copied!' }); }}
                    className="w-10 h-10 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center flex-shrink-0">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                  <p className="font-semibold flex items-center gap-2"><Info className="h-4 w-4" /> Optional: Secure the webhook</p>
                  <p>Set environment variable <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">RFID_WEBHOOK_SECRET=your-secret</code> and pass it as <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">?secret=your-secret</code> in the URL above.</p>
                </div>
              </div>

              {/* AP configuration steps */}
              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Settings className="h-4 w-4 text-blue-500" /> Step 2 — Configure AirEngine AP</h3>
                <div className="space-y-3">
                  {[
                    { step: '01', title: 'Log into iMaster NCE', desc: 'Navigate to WLAN → AP Management. Find your AirEngine 6776-58TI AP.' },
                    { step: '02', title: 'Enable IoT / BLE Radio', desc: 'In AP Settings → IoT, enable the BLE radio (Channel: Auto, TX Power: High).' },
                    { step: '03', title: 'Configure BLE Data Push', desc: 'Go to IoT Service → BLE Data Push → Add Server. Set Protocol: HTTPS, URL: (webhook above), Push Interval: 10s.' },
                    { step: '04', title: 'Add Zone per AP', desc: 'Copy the MAC address from each AP (shown in iMaster NCE) and create a matching Zone in the Zones tab above.' },
                    { step: '05', title: 'Attach BLE Tags to Assets', desc: 'Stick BLE beacons on each asset. Register the tag MAC address in the Tags tab and link it to the asset.' },
                    { step: '06', title: 'Verify', desc: 'Wait for the first scan. Live locations will appear automatically in the Overview tab within seconds.' },
                  ].map(s => (
                    <div key={s.step} className="flex gap-4 p-3 rounded-xl hover:bg-muted/30">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">{s.step}</div>
                      <div>
                        <p className="font-semibold text-sm">{s.title}</p>
                        <p className="text-xs text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payload example */}
              <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <h3 className="font-bold flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-500" /> Step 3 — Supported Payload Format</h3>
                <p className="text-sm text-muted-foreground">The webhook accepts Huawei iMaster NCE BLE push format automatically:</p>
                <pre className="bg-muted rounded-xl p-4 text-xs overflow-x-auto text-muted-foreground">{`POST /api/rfid/webhook
Content-Type: application/json

{
  "messageId": "abc123",
  "timestamp": 1704067200000,
  "apMac": "AC:CE:8D:12:34:56",   ← matches your Zone AP MAC
  "apSn": "SN2106123456",
  "scanData": [
    {
      "mac": "AA:BB:CC:DD:EE:FF",  ← matches your registered Tag ID
      "rssi": -65,                 ← signal strength (dBm)
      "battery": 87,               ← battery percent (0-100)
      "payload": "0201060303...",  ← raw BLE advertisement hex
      "timestamp": 1704067200100
    }
  ]
}`}</pre>
              </div>

              {/* Test webhook */}
              <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <h3 className="font-bold flex items-center gap-2"><Zap className="h-4 w-4 text-violet-500" /> Test Scan Simulation</h3>
                <p className="text-sm text-muted-foreground">Simulate a BLE scan from a Huawei AP to verify your setup. Tag ID and AP MAC must already be registered.</p>
                <TestScanPanel webhookUrl={webhookUrl} tags={tags} zones={zones} onComplete={loadAll} />
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

// ── Inline test scanner panel ──────────────────────────────────────────────────
function TestScanPanel({ webhookUrl, tags, zones, onComplete }: { webhookUrl: string; tags: RFIDTag[]; zones: RFIDZone[]; onComplete: () => void }) {
  const [tagMac,  setTagMac]  = useState('');
  const [apMac,   setApMac]   = useState('');
  const [rssi,    setRssi]    = useState('-65');
  const [battery, setBattery] = useState('80');
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState<string | null>(null);
  const { toast: showToast } = { toast: (x: any) => {} }; // placeholder

  const send = async () => {
    if (!tagMac.trim()) { alert('Enter a Tag MAC'); return; }
    setSending(true); setResult(null);
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: `test-${Date.now()}`,
          timestamp: Date.now(),
          apMac: apMac.trim().toUpperCase() || undefined,
          scanData: [{
            mac: tagMac.trim().toUpperCase(),
            rssi: parseInt(rssi) || -65,
            battery: parseInt(battery) || 80,
            timestamp: Date.now(),
          }],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`✓ Processed: ${data.processed} tag(s), skipped: ${data.skipped}`);
        onComplete();
      } else {
        setResult(`✗ Error: ${data.error}`);
      }
    } catch (e: any) {
      setResult(`✗ Network error: ${e.message}`);
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Tag MAC *</label>
          <select className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-mono"
            value={tagMac} onChange={e => setTagMac(e.target.value)}>
            <option value="">Select tag…</option>
            {tags.map(t => <option key={t.id} value={t.tagId}>{t.tagId} {t.asset ? `→ ${t.asset.name}` : '(unlinked)'}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">AP MAC (Zone)</label>
          <select className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-mono"
            value={apMac} onChange={e => setApMac(e.target.value)}>
            <option value="">No zone</option>
            {zones.filter(z => z.apMacAddress).map(z => <option key={z.id} value={z.apMacAddress!}>{z.apMacAddress} → {z.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">RSSI (dBm)</label>
          <Input value={rssi} onChange={e => setRssi(e.target.value)} className="rounded-xl font-mono" placeholder="-65" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Battery %</label>
          <Input value={battery} onChange={e => setBattery(e.target.value)} className="rounded-xl font-mono" placeholder="80" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={send} disabled={sending} className="rounded-xl gap-2">
          {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {sending ? 'Sending…' : 'Send Test Scan'}
        </Button>
        {result && (
          <span className={`text-sm font-semibold ${result.startsWith('✓') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {result}
          </span>
        )}
      </div>
    </div>
  );
}
