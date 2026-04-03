// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import {
  DoorOpen, Plus, Wifi, Shield, AlertTriangle, CheckCircle2, MapPin, RefreshCw,
  Cpu, Radio, Lock, ChevronDown, ChevronUp, Sparkles, Building2, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const DIRECTION_STYLES: Record<string, string> = {
  ENTRY: 'bg-emerald-500/15 text-emerald-700 border-emerald-300/40 dark:text-emerald-300',
  EXIT: 'bg-rose-500/15 text-rose-700 border-rose-300/40 dark:text-rose-300',
  BOTH: 'bg-sky-500/15 text-sky-700 border-sky-300/40 dark:text-sky-300',
};

export const PASSAGEWAY_SITES = [
  'HQ - Main Building',
  'Site A - Warehouse',
  'Site B - Operations',
  'Site C - Medical',
  'Site D - Logistics',
  'Site E - Admin',
  'Site F - Field Base',
] as const;

type ZoneLite = { id: string; name: string; apMacAddress?: string; building?: string; floorNumber?: string };

export function RfidPassagewaysPanel({ zones = [] }: { zones?: ZoneLite[] }) {
  const [passageways, setPassageways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showStandards, setShowStandards] = useState(false);
  const [showTamper, setShowTamper] = useState(false);
  const [tamperAlerts, setTamperAlerts] = useState<any[]>([]);
  const [form, setForm] = useState({
    siteName: PASSAGEWAY_SITES[0],
    siteCode: '',
    direction: 'BOTH',
    alertOnUnauthorized: true,
    readerMacAddress: '',
    notes: '',
    zoneId: '',
  });

  const fetchPassageways = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rfid/passageways');
      const data = res.ok ? await res.json() : [];
      setPassageways(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTamper = useCallback(async () => {
    const res = await fetch('/api/rfid/alerts?type=TAMPER').then((r) => r.json()).catch(() => []);
    setTamperAlerts(Array.isArray(res) ? res : []);
  }, []);

  useEffect(() => {
    fetchPassageways();
    fetchTamper();
  }, [fetchPassageways, fetchTamper]);

  const create = async () => {
    const res = await fetch('/api/rfid/passageways', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        zoneId: form.zoneId || undefined,
      }),
    });
    if (res.ok) {
      toast({ title: 'Passageway configured', description: `${form.siteName} · ${form.direction}` });
      setShowNew(false);
      setForm({
        siteName: PASSAGEWAY_SITES[0],
        siteCode: '',
        direction: 'BOTH',
        alertOnUnauthorized: true,
        readerMacAddress: '',
        notes: '',
        zoneId: '',
      });
      fetchPassageways();
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ variant: 'destructive', title: 'Could not save', description: err.error || res.statusText });
    }
  };

  const toggle = async (id: string, isActive: boolean) => {
    await fetch('/api/rfid/passageways', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    fetchPassageways();
  };

  const sites = [...new Set([...PASSAGEWAY_SITES, ...passageways.map((p) => p.siteName)])];
  const configuredCount = passageways.filter((p) => p.isActive).length;

  return (
    <div className="space-y-6">
      {/* Workflow hero */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-200/60 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 p-6 md:p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(99,102,241,0.25),transparent_50%)]" />
        <div className="absolute bottom-0 left-0 w-64 h-32 bg-violet-600/10 blur-3xl rounded-full" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 border border-white/15 backdrop-blur">
              <DoorOpen className="h-7 w-7 text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight">Passageway access control</h2>
                <Badge className="bg-white/15 text-white border-white/20 text-[10px] uppercase tracking-widest">7 sites</Badge>
              </div>
              <p className="mt-1.5 text-sm text-indigo-200/80 max-w-xl">
                Align RFID readers at entrances and exits with your BLE zones. Unauthorized movement alerts flow into the same alert engine as tag scans.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Reader MAC', 'Direction', 'Zone link', 'Tamper sync'].map((s, i) => (
                  <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-black/25 border border-white/10 px-3 py-1 text-[11px] font-semibold text-white/85">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/40 text-[10px]">{i + 1}</span>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              onClick={() => setShowStandards((p) => !p)}
            >
              <Radio className="h-4 w-4 mr-2" />
              Standards
              {showStandards ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              onClick={() => setShowTamper((p) => !p)}
            >
              <Shield className="h-4 w-4 mr-2" />
              Tamper
              {tamperAlerts.length > 0 && (
                <Badge className="ml-1.5 bg-red-500 text-white border-0">{tamperAlerts.length}</Badge>
              )}
            </Button>
            <Button size="sm" className="bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-900/40" onClick={() => setShowNew((p) => !p)}>
              <Plus className="h-4 w-4 mr-2" />
              Add passageway
            </Button>
          </div>
        </div>
        <div className="relative z-10 mt-6 flex items-center gap-4 text-sm">
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-indigo-400 transition-all duration-700"
              style={{ width: `${Math.min(100, (configuredCount / 7) * 100)}%` }}
            />
          </div>
          <span className="text-indigo-200/90 font-semibold tabular-nums whitespace-nowrap">{configuredCount}/7 sites with readers</span>
        </div>
      </div>

      {showStandards && (
        <div className="rounded-2xl border border-blue-200/80 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/90 to-indigo-50/50 dark:from-blue-950/40 dark:to-indigo-950/30 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">RFID & BLE compatibility</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'EPC Gen2 (ISO 18000-6C)', ok: true },
              { label: 'ISO 18000-6B', ok: true },
              { label: 'ISO 14443 (NFC)', ok: true },
              { label: 'ISO 15693 (HF)', ok: true },
              { label: 'BLE 5.0 (active tags)', ok: true },
              { label: 'Tag R/W (hardware-dependent)', ok: true },
            ].map(({ label, ok }) => (
              <div key={label} className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-white/80 dark:bg-slate-900/60 p-3 flex items-start gap-2">
                {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> : null}
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5" />
            Readers can push scans to the same webhook configured under Integration — keep MAC addresses consistent with zones.
          </p>
        </div>
      )}

      {showTamper && (
        <div className="rounded-2xl border border-red-200/80 dark:border-red-900/50 bg-gradient-to-br from-red-50/90 to-rose-50/40 dark:from-red-950/30 dark:to-rose-950/20 p-6">
          <h3 className="font-bold text-red-900 dark:text-red-200 flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5" />
            Tag tamper & removal alerts
          </h3>
          {tamperAlerts.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-emerald-800 dark:text-emerald-200 text-sm">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              No tamper events — tags reporting normally.
            </div>
          ) : (
            <ul className="space-y-2">
              {tamperAlerts.map((a: any) => (
                <li key={a.id} className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 p-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{a.assetName || 'Unknown asset'}</p>
                    <p className="text-xs text-muted-foreground">{a.message} · {new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge variant="destructive" className="shrink-0">TAMPER</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showNew && (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-card shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 text-white">
            <h3 className="font-bold">Configure passageway</h3>
            <p className="text-sm text-white/80 mt-0.5">Link a physical gate or corridor reader to a site and optional RFID zone.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Site</label>
                <select
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                  value={form.siteName}
                  onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))}
                >
                  {sites.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Direction</label>
                <select
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                  value={form.direction}
                  onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}
                >
                  {['BOTH', 'ENTRY', 'EXIT'].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Site code</label>
                <Input className="rounded-xl" value={form.siteCode} onChange={(e) => setForm((f) => ({ ...f, siteCode: e.target.value }))} placeholder="e.g. HQ-MAIN-01" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Reader MAC</label>
                <Input className="rounded-xl font-mono text-sm" value={form.readerMacAddress} onChange={(e) => setForm((f) => ({ ...f, readerMacAddress: e.target.value }))} placeholder="AA:BB:CC:DD:EE:FF" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Link to zone (optional)</label>
                <select
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                  value={form.zoneId}
                  onChange={(e) => setForm((f) => ({ ...f, zoneId: e.target.value }))}
                >
                  <option value="">— No zone —</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}{z.apMacAddress ? ` · ${z.apMacAddress}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">Ties passageway events to the same zone model used for live BLE tracking.</p>
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.alertOnUnauthorized}
                onChange={(e) => setForm((f) => ({ ...f, alertOnUnauthorized: e.target.checked }))}
                className="h-4 w-4 rounded border-input accent-indigo-600"
              />
              <span className="text-sm">Alert on unauthorized entry / exit</span>
            </label>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Notes</label>
              <Input className="rounded-xl" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Gate number, floor, contractor contact…" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button className="rounded-xl" onClick={create}>Save passageway</Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-indigo-500" />
              Site coverage
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Seven-site deployment matrix · QRCS footprint</p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => { fetchPassageways(); fetchTamper(); }}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-3">
          {PASSAGEWAY_SITES.map((site) => {
            const sitePWs = passageways.filter((p) => p.siteName === site);
            const active = sitePWs.filter((p) => p.isActive);
            const configured = active.length > 0;
            return (
              <div
                key={site}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-xl border transition-all',
                  configured
                    ? 'bg-emerald-500/5 border-emerald-200 dark:border-emerald-900/50'
                    : 'bg-muted/20 border-dashed border-muted-foreground/25',
                )}
              >
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', configured ? 'bg-emerald-500/15' : 'bg-muted')}>
                  <Building2 className={cn('h-5 w-5', configured ? 'text-emerald-600' : 'text-muted-foreground')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{site}</p>
                  <p className="text-xs text-muted-foreground">
                    {configured ? `${active.length} active reader${active.length !== 1 ? 's' : ''}` : 'Awaiting configuration'}
                  </p>
                </div>
                {configured ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {passageways.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h3 className="font-bold">Configured passageways ({passageways.length})</h3>
          </div>
          <div className="divide-y divide-border">
            {passageways.map((pw) => (
              <div key={pw.id} className="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-200/50 dark:border-indigo-900/50">
                    <DoorOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{pw.siteName}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {[pw.siteCode, pw.readerMacAddress].filter(Boolean).join(' · ') || '—'}
                    </p>
                    {pw.zone?.name && (
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5 flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" /> Zone: {pw.zone.name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <Badge variant="outline" className={cn('text-[10px] font-bold border', DIRECTION_STYLES[pw.direction] || DIRECTION_STYLES.BOTH)}>
                    {pw.direction}
                  </Badge>
                  {pw.alertOnUnauthorized && (
                    <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700 bg-orange-500/10">
                      <Lock className="h-3 w-3 mr-1" />
                      Unauthorized alerts
                    </Badge>
                  )}
                  <Badge className={cn('text-[10px]', pw.isActive ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-slate-500')}>
                    {pw.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => toggle(pw.id, pw.isActive)}>
                    {pw.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
