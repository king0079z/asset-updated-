// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Smartphone, Battery, BatteryLow, BatteryWarning, AlertTriangle,
  Activity, Scan, Ticket, User, Calendar, RefreshCw, Download
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import * as XLSX from 'xlsx';

export default function HandheldReportsPage() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionStats, setSessionStats] = useState<any>({});
  const [lowBattery, setLowBattery] = useState<any[]>([]);
  const [lowBatteryStats, setLowBatteryStats] = useState<any>({});
  const [batteryThreshold, setBatteryThreshold] = useState(20);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'sessions' | 'battery'>('sessions');

  const fetch_ = async () => {
    setLoading(true);
    const [s, b] = await Promise.all([
      fetch('/api/rfid/handheld-sessions').then(r => r.json()).catch(() => ({ sessions: [], stats: {} })),
      fetch(`/api/rfid/low-battery?threshold=${batteryThreshold}`).then(r => r.json()).catch(() => ({ tags: [], count: 0 })),
    ]);
    setSessions(Array.isArray(s.sessions) ? s.sessions : []);
    setSessionStats(s.stats || {});
    setLowBattery(Array.isArray(b.tags) ? b.tags : []);
    setLowBatteryStats({ count: b.count || 0, threshold: b.threshold || batteryThreshold });
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [batteryThreshold]);

  const exportSessions = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ['Device ID', 'Device Name', 'User', 'Started', 'Ended', 'Scans', 'Tickets', 'Platform'],
      ...sessions.map(s => [s.deviceId, s.deviceName || '', s.user?.email || '', new Date(s.startedAt).toLocaleString(), s.endedAt ? new Date(s.endedAt).toLocaleString() : 'Active', s.scanCount, s.ticketsCreated, s.platform || '']),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Handheld Sessions');
    XLSX.writeFile(wb, `handheld_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const getBatteryColor = (level: number) => {
    if (level <= 10) return 'text-red-600 bg-red-100';
    if (level <= 20) return 'text-orange-600 bg-orange-100';
    return 'text-yellow-600 bg-yellow-100';
  };

  const getBatteryIcon = (level: number) => level <= 10 ? BatteryWarning : BatteryLow;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Handheld & RFID Reports</h1>
              <p className="text-sm text-gray-500">Device activity reports and low battery alerts for active RFID tags</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetch_}>
            <RefreshCw className="w-4 h-4 mr-2" />Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button onClick={() => setTab('sessions')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${tab === 'sessions' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Smartphone className="w-4 h-4 inline mr-2" />Handheld Activity
          </button>
          <button onClick={() => setTab('battery')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${tab === 'battery' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Battery className="w-4 h-4" />Low Battery Alerts
            {lowBattery.length > 0 && <Badge className="bg-red-100 text-red-600 text-xs">{lowBattery.length}</Badge>}
          </button>
        </div>

        {tab === 'sessions' && (
          <>
            {/* Session Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Sessions', value: sessionStats.totalSessions || 0, icon: Activity, color: 'text-gray-700' },
                { label: 'Total Scans', value: sessionStats.totalScans || 0, icon: Scan, color: 'text-blue-600' },
                { label: 'Tickets Created', value: sessionStats.totalTickets || 0, icon: Ticket, color: 'text-purple-600' },
                { label: 'Unique Devices', value: sessionStats.uniqueDevices || 0, icon: Smartphone, color: 'text-teal-600' },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label} className="text-center py-4">
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Handheld Device Sessions</CardTitle>
                <Button variant="outline" size="sm" onClick={exportSessions}>
                  <Download className="w-4 h-4 mr-2" />Export Excel
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? <div className="py-12 text-center text-gray-400">Loading...</div> :
                sessions.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    <Smartphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No handheld sessions recorded yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          {['Device', 'User', 'Started', 'Duration', 'Scans', 'Tickets', 'Platform', 'Status'].map(h => (
                            <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map(s => {
                          const duration = s.endedAt
                            ? Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000) + 'min'
                            : 'Active';
                          return (
                            <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <Smartphone className="w-4 h-4 text-teal-500" />
                                  <div>
                                    <p className="font-medium text-gray-800">{s.deviceName || s.deviceId}</p>
                                    <p className="text-xs text-gray-400 font-mono">{s.deviceId}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-gray-600">{s.user?.email || '—'}</td>
                              <td className="py-3 px-4 text-gray-600 text-xs">{new Date(s.startedAt).toLocaleString()}</td>
                              <td className="py-3 px-4"><Badge className="text-xs bg-gray-100 text-gray-600">{duration}</Badge></td>
                              <td className="py-3 px-4 font-semibold text-blue-600">{s.scanCount || 0}</td>
                              <td className="py-3 px-4 font-semibold text-purple-600">{s.ticketsCreated || 0}</td>
                              <td className="py-3 px-4 text-gray-500 text-xs capitalize">{s.platform || 'web'}</td>
                              <td className="py-3 px-4">
                                <Badge className={`text-xs ${s.endedAt ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                                  {s.endedAt ? 'Ended' : 'Active'}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {tab === 'battery' && (
          <>
            {/* Battery threshold */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Alert threshold:</label>
              <Input type="number" min="5" max="50" value={batteryThreshold}
                onChange={e => setBatteryThreshold(Number(e.target.value))}
                className="w-24" />
              <span className="text-sm text-gray-500">%</span>
            </div>

            {/* Low battery summary */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Critical (≤10%)', count: lowBattery.filter(t => (t.batteryLevel || 0) <= 10).length, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Low (11–20%)', count: lowBattery.filter(t => (t.batteryLevel || 0) > 10 && (t.batteryLevel || 0) <= 20).length, color: 'text-orange-600', bg: 'bg-orange-50' },
                { label: `Low (21–${batteryThreshold}%)`, count: lowBattery.filter(t => (t.batteryLevel || 0) > 20).length, color: 'text-yellow-600', bg: 'bg-yellow-50' },
              ].map(({ label, count, color, bg }) => (
                <Card key={label} className={`${bg} border-0 text-center py-4`}>
                  <BatteryLow className={`w-5 h-5 mx-auto mb-1 ${color}`} />
                  <p className={`text-2xl font-bold ${color}`}>{count}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Low Battery RFID Tags</CardTitle>
                <CardDescription>Active RFID tags with battery level below {batteryThreshold}% — schedule replacement immediately</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? <div className="py-12 text-center text-gray-400">Loading...</div> :
                lowBattery.length === 0 ? (
                  <div className="py-12 text-center text-green-600">
                    <Battery className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">All tags have sufficient battery</p>
                    <p className="text-sm text-gray-400 mt-1">No tags below {batteryThreshold}%</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          {['Tag ID', 'Asset', 'Battery', 'Last Zone', 'Last Seen', 'Action'].map(h => (
                            <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lowBattery.map(tag => {
                          const BIcon = getBatteryIcon(tag.batteryLevel || 0);
                          const bColor = getBatteryColor(tag.batteryLevel || 0);
                          return (
                            <tr key={tag.id} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="py-3 px-4 font-mono text-xs text-gray-600">{tag.tagId}</td>
                              <td className="py-3 px-4">
                                {tag.asset ? (
                                  <div>
                                    <p className="font-medium text-gray-800">{tag.asset.name}</p>
                                    <p className="text-xs text-gray-400">{tag.asset.assetId}</p>
                                  </div>
                                ) : <span className="text-gray-400">Unassigned</span>}
                              </td>
                              <td className="py-3 px-4">
                                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold ${bColor}`}>
                                  <BIcon className="w-3.5 h-3.5" />
                                  {tag.batteryLevel ?? '?'}%
                                </div>
                              </td>
                              <td className="py-3 px-4 text-gray-500 text-xs">{tag.lastZone?.name || '—'}</td>
                              <td className="py-3 px-4 text-gray-500 text-xs">
                                {tag.lastSeenAt ? new Date(tag.lastSeenAt).toLocaleString() : '—'}
                              </td>
                              <td className="py-3 px-4">
                                <Badge className="text-xs bg-red-100 text-red-700 cursor-pointer hover:bg-red-200">
                                  Schedule Replacement
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

