// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Database, RefreshCw, CheckCircle, XCircle, AlertTriangle, ExternalLink, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ERPIntegrationPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchStatus = async () => {
    const [s, l] = await Promise.all([
      fetch('/api/dynamics365/status').then(r => r.json()),
      fetch('/api/dynamics365/logs?take=20').then(r => r.json()),
    ]);
    setStatus(s);
    setLogs(Array.isArray(l) ? l : []);
    setLoading(false);
  };

  useEffect(() => { fetchStatus(); }, []);

  const triggerSync = async () => {
    setSyncing(true);
    const res = await fetch('/api/dynamics365/sync', { method: 'POST' });
    const data = await res.json();
    setSyncing(false);
    toast({ title: `Sync complete: ${data.synced} synced, ${data.errors} errors` });
    fetchStatus();
  };

  const statusIcon = status?.status === 'connected' ? CheckCircle
    : status?.status === 'error' ? XCircle
    : AlertTriangle;
  const statusColor = status?.status === 'connected' ? 'text-green-600'
    : status?.status === 'error' ? 'text-red-600'
    : 'text-yellow-600';
  const statusBadge = status?.status === 'connected' ? 'bg-green-100 text-green-700'
    : status?.status === 'error' ? 'bg-red-100 text-red-700'
    : 'bg-yellow-100 text-yellow-700';

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ERP Integration — Microsoft Dynamics 365</h1>
              <p className="text-sm text-gray-500">Sync asset data with your Dynamics 365 Finance & Operations environment</p>
            </div>
          </div>
          <Button onClick={triggerSync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>

        {/* Connection Status */}
        <Card className={status?.status === 'connected' ? 'border-green-200' : status?.status === 'error' ? 'border-red-200' : 'border-yellow-200'}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              {React.createElement(statusIcon, { className: `w-6 h-6 ${statusColor}` })}
              <div className="flex-1">
                <p className="font-semibold text-gray-900">
                  {status?.status === 'connected' ? 'Connected to Dynamics 365' :
                    status?.status === 'error' ? 'Connection Error' :
                      'Running in Mock Mode'}
                </p>
                <p className="text-sm text-gray-500">
                  {status?.message || status?.error || status?.environmentUrl || ''}
                </p>
              </div>
              <Badge className={statusBadge}>{status?.status?.toUpperCase() || 'LOADING'}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Setup Instructions (when not configured) */}
        {!status?.configured && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-base">Setup Required — Configure Environment Variables</CardTitle>
              <CardDescription>Add these variables to your Vercel environment settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(status?.envVarsNeeded || ['D365_TENANT_ID', 'D365_CLIENT_ID', 'D365_CLIENT_SECRET', 'D365_ENVIRONMENT_URL']).map((v: string) => (
                <div key={v} className="flex items-center gap-2">
                  <code className="bg-white border border-blue-200 rounded px-2 py-1 text-sm font-mono text-blue-800">{v}</code>
                </div>
              ))}
              <a href="https://docs.microsoft.com/dynamics365/" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2">
                <ExternalLink className="w-3 h-3" /> D365 API Documentation
              </a>
            </CardContent>
          </Card>
        )}

        {/* Field Mapping */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asset Field Mapping</CardTitle>
            <CardDescription>How Asset AI fields map to Dynamics 365 Fixed Assets</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-semibold text-gray-500">Asset AI Field</th>
                  <th className="text-left py-2 font-semibold text-gray-500">D365 Field</th>
                  <th className="text-left py-2 font-semibold text-gray-500">Direction</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {[
                  ['name', 'msdyn_name', 'PUSH'],
                  ['assetId', 'msdyn_assetid', 'PUSH'],
                  ['status', 'msdyn_status', 'BOTH'],
                  ['type', 'msdyn_assettype', 'PUSH'],
                  ['purchaseAmount', 'msdyn_purchasecost', 'PUSH'],
                  ['purchaseDate', 'msdyn_purchasedate', 'PUSH'],
                  ['disposedAt', 'msdyn_disposaldate', 'PUSH'],
                ].map(([ai, d365, dir]) => (
                  <tr key={ai} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs text-purple-700">{ai}</td>
                    <td className="py-2 font-mono text-xs text-blue-700">{d365}</td>
                    <td className="py-2">
                      <Badge className="text-xs bg-gray-100 text-gray-600">{dir}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Sync Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Recent Sync Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-gray-400 text-sm">Loading...</p> : logs.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No sync activity yet. Click "Sync Now" to start.</p>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                    {log.status === 'SUCCESS' ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      : log.status === 'ERROR' ? <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        : <Clock className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
                    <span className="text-gray-500 font-mono text-xs w-20">{log.entityType}</span>
                    <span className="text-gray-700 flex-1 truncate font-mono text-xs">{log.entityId}</span>
                    <Badge className={`text-xs ${log.status === 'SUCCESS' ? 'bg-green-100 text-green-700' : log.status === 'ERROR' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {log.status}
                    </Badge>
                    <span className="text-gray-400 text-xs">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

