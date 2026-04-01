// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DoorOpen, Plus, Wifi, Shield, AlertTriangle, CheckCircle,
  Settings, MapPin, RefreshCw, Cpu, Radio, Lock
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const DIRECTION_COLORS: Record<string, string> = {
  ENTRY: 'bg-green-100 text-green-700',
  EXIT:  'bg-red-100 text-red-700',
  BOTH:  'bg-blue-100 text-blue-700',
};

const SITES = ['HQ - Main Building', 'Site A - Warehouse', 'Site B - Operations', 'Site C - Medical', 'Site D - Logistics', 'Site E - Admin', 'Site F - Field Base'];

export default function PassagewaysPage() {
  const { toast } = useToast();
  const [passageways, setPassageways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showStandards, setShowStandards] = useState(false);
  const [showTamper, setShowTamper] = useState(false);
  const [tamperAlerts, setTamperAlerts] = useState<any[]>([]);
  const [form, setForm] = useState({
    siteName: SITES[0], siteCode: '', direction: 'BOTH',
    alertOnUnauthorized: true, readerMacAddress: '', notes: '',
  });

  const fetch_ = async () => {
    setLoading(true);
    const res = await fetch('/api/rfid/passageways').then(r => r.json()).catch(() => []);
    setPassageways(Array.isArray(res) ? res : []);
    setLoading(false);
  };

  const fetchTamperAlerts = async () => {
    const res = await fetch('/api/rfid/alerts?type=TAMPER').then(r => r.json()).catch(() => []);
    setTamperAlerts(Array.isArray(res) ? res : []);
  };

  useEffect(() => { fetch_(); fetchTamperAlerts(); }, []);

  const create = async () => {
    const res = await fetch('/api/rfid/passageways', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (res.ok) { toast({ title: 'Passageway configured' }); setShowNew(false); fetch_(); }
    else toast({ variant: 'destructive', title: 'Failed' });
  };

  const toggle = async (id: string, isActive: boolean) => {
    await fetch('/api/rfid/passageways', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, isActive: !isActive }),
    });
    fetch_();
  };

  const sites = [...new Set([...SITES, ...passageways.map(p => p.siteName)])];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <DoorOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Passageway Access Control</h1>
              <p className="text-sm text-gray-500">Configure RFID readers at all 7 site entrances/exits</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowStandards(p => !p)}>
              <Radio className="w-4 h-4 mr-2" />RFID Standards
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowTamper(p => !p)}>
              <Shield className="w-4 h-4 mr-2" />Tamper Alerts
              {tamperAlerts.length > 0 && <Badge className="ml-1 bg-red-500 text-white text-xs">{tamperAlerts.length}</Badge>}
            </Button>
            <Button size="sm" onClick={() => setShowNew(p => !p)}>
              <Plus className="w-4 h-4 mr-2" />Add Passageway
            </Button>
          </div>
        </div>

        {/* RFID Standards Panel */}
        {showStandards && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Radio className="w-4 h-4" />RFID Compatibility & Standards</CardTitle>
              <CardDescription>Supported standards and tag read/write capabilities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'EPC Gen2 (ISO 18000-6C)', status: 'Supported', icon: CheckCircle, color: 'text-green-600' },
                  { label: 'ISO 18000-6B', status: 'Supported', icon: CheckCircle, color: 'text-green-600' },
                  { label: 'ISO 14443 (NFC)', status: 'Supported', icon: CheckCircle, color: 'text-green-600' },
                  { label: 'ISO 15693 (HF)', status: 'Supported', icon: CheckCircle, color: 'text-green-600' },
                  { label: 'BLE 5.0 (Active Tags)', status: 'Supported', icon: CheckCircle, color: 'text-green-600' },
                  { label: 'Tag Read/Write', status: 'Supported (where hardware permits)', icon: Cpu, color: 'text-blue-600' },
                ].map(({ label, status, icon: Icon, color }) => (
                  <div key={label} className="bg-white border border-blue-100 rounded-xl p-3">
                    <Icon className={`w-4 h-4 ${color} mb-1`} />
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{status}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-white border border-blue-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">Connectivity Support</p>
                <div className="flex gap-2 flex-wrap">
                  {['WiFi 802.11 a/b/g/n/ac', 'Bluetooth 5.0', 'USB 2.0/3.0', 'Ethernet (RJ45)', 'RS232/RS485'].map(c => (
                    <Badge key={c} className="bg-blue-100 text-blue-700 text-xs">{c}</Badge>
                  ))}
                </div>
              </div>
              <div className="mt-3 bg-white border border-blue-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">Configurable Read Ranges</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <span>• Active (BLE): up to 100m</span>
                  <span>• Passive UHF (EPC Gen2): 1–12m</span>
                  <span>• Passive HF (ISO 14443): 0–10cm</span>
                  <span>• Scan modes: continuous, triggered, scheduled</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tamper Alerts Panel */}
        {showTamper && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-red-700">
                <Shield className="w-4 h-4" />Tag Removal (Tamper) Alerts
              </CardTitle>
              <CardDescription>Active RFID tags that have been removed from assets — unauthorized removal triggers an alarm</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-3">
                {tamperAlerts.length === 0 ? (
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                    <CheckCircle className="w-4 h-4" /> No tamper alerts — all tags are properly attached
                  </div>
                ) : tamperAlerts.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-3 bg-white border border-red-200 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-red-800">{a.assetName || 'Unknown Asset'}</p>
                      <p className="text-xs text-red-500">{a.message} · {new Date(a.createdAt).toLocaleString()}</p>
                    </div>
                    <Badge className="bg-red-100 text-red-700 border-red-300">TAMPER</Badge>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-red-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">Tag Removal Prevention Policy</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Tags use tamper-evident adhesive that triggers tamper event when forcibly removed</li>
                  <li>• Active BLE tags broadcast periodic heartbeats; missing heartbeat = alarm within 5 minutes</li>
                  <li>• Authorized removal requires admin override in system before physical removal</li>
                  <li>• All tamper events are logged with timestamp and location in audit trail</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* New Passageway Form */}
        {showNew && (
          <Card className="border-indigo-200">
            <CardHeader><CardTitle className="text-base">Configure New Passageway</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Site</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    value={form.siteName} onChange={e => setForm(f => ({ ...f, siteName: e.target.value }))}>
                    {sites.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Direction</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}>
                    {['BOTH', 'ENTRY', 'EXIT'].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Site Code</label>
                  <Input value={form.siteCode} onChange={e => setForm(f => ({ ...f, siteCode: e.target.value }))} placeholder="e.g. HQ-MAIN-01" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Reader MAC Address</label>
                  <Input value={form.readerMacAddress} onChange={e => setForm(f => ({ ...f, readerMacAddress: e.target.value }))} placeholder="AA:BB:CC:DD:EE:FF" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="alertUnauth" checked={form.alertOnUnauthorized}
                  onChange={e => setForm(f => ({ ...f, alertOnUnauthorized: e.target.checked }))} className="w-4 h-4 accent-indigo-600" />
                <label htmlFor="alertUnauth" className="text-sm">Alert on unauthorized entry/exit</label>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Notes</label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Location details, floor, gate number..." />
              </div>
              <div className="flex gap-2">
                <Button onClick={create}>Save Passageway</Button>
                <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Site Coverage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">7-Site Passageway Coverage</CardTitle>
            <CardDescription>RFID reader deployment status at all QRCS sites</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SITES.map(site => {
                const sitePWs = passageways.filter(p => p.siteName === site);
                const configured = sitePWs.length > 0;
                return (
                  <div key={site} className={`flex items-center gap-3 p-3 rounded-xl border ${configured ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${configured ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <MapPin className={`w-4 h-4 ${configured ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{site}</p>
                      <p className="text-xs text-gray-500">{configured ? `${sitePWs.length} reader(s) configured` : 'Not configured'}</p>
                    </div>
                    {configured ? (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <Badge className="text-xs bg-gray-100 text-gray-500">Pending</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Configured Passageways */}
        {passageways.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Configured Passageways ({passageways.length})</CardTitle>
              <Button variant="ghost" size="sm" onClick={fetch_}><RefreshCw className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {passageways.map(pw => (
                  <div key={pw.id} className="p-4 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <DoorOpen className="w-4 h-4 text-indigo-500" />
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{pw.siteName}</p>
                        <p className="text-xs text-gray-400">{pw.siteCode} {pw.readerMacAddress && `· ${pw.readerMacAddress}`}</p>
                      </div>
                    </div>
                    <Badge className={`text-xs ${DIRECTION_COLORS[pw.direction]}`}>{pw.direction}</Badge>
                    {pw.alertOnUnauthorized && <Badge className="text-xs bg-orange-100 text-orange-700"><Lock className="w-2.5 h-2.5 mr-1" />Alert Unauthorized</Badge>}
                    <Badge className={`text-xs ${pw.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {pw.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    {pw.zone && <span className="text-xs text-gray-400">Zone: {pw.zone.name}</span>}
                    <Button size="sm" variant="outline" className="ml-auto"
                      onClick={() => toggle(pw.id, pw.isActive)}>
                      {pw.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

