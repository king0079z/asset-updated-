// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  FileCheck, CheckCircle, Clock, Package, User, MapPin,
  Shield, Download, Calendar, RefreshCw, PenLine
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function AcknowledgmentsPage() {
  const { toast } = useToast();
  const [acks, setAcks] = useState<any[]>([]);
  const [pendingPolicies, setPendingPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [sigForm, setSigForm] = useState({ assetId: '', notes: '' });
  const [showSigForm, setShowSigForm] = useState(false);
  const [signing, setSigning] = useState(false);

  const fetch_ = async () => {
    setLoading(true);
    const [a, p] = await Promise.all([
      fetch('/api/acknowledgments').then(r => r.json()).catch(() => []),
      fetch('/api/policies/pending').then(r => r.json()).catch(() => []),
    ]);
    setAcks(Array.isArray(a) ? a : []);
    setPendingPolicies(Array.isArray(p) ? p : []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const acceptPolicy = async (policyId: string) => {
    setAcceptingId(policyId);
    const res = await fetch(`/api/policies/${policyId}/accept`, { method: 'POST' });
    setAcceptingId(null);
    if (res.ok) { toast({ title: 'Policy accepted', description: 'Thank you for accepting the policy.' }); fetch_(); }
    else toast({ variant: 'destructive', title: 'Failed to accept policy' });
  };

  const signAcknowledgment = async () => {
    if (!sigForm.assetId) { toast({ variant: 'destructive', title: 'Asset ID required' }); return; }
    setSigning(true);
    const res = await fetch('/api/acknowledgments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId: sigForm.assetId,
        notes: sigForm.notes,
        signature: { signed: true, timestamp: new Date().toISOString(), method: 'digital-click-to-sign' },
        policyVersion: '1.0',
      }),
    });
    setSigning(false);
    if (res.ok) {
      toast({ title: 'Asset acknowledged', description: 'Your digital acknowledgment has been recorded.' });
      setShowSigForm(false);
      setSigForm({ assetId: '', notes: '' });
      fetch_();
    } else toast({ variant: 'destructive', title: 'Failed to acknowledge' });
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Asset Acknowledgments & Policies</h1>
              <p className="text-sm text-gray-500">Digital acknowledgment of asset receipt and policy acceptance</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetch_}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
            <Button size="sm" onClick={() => setShowSigForm(p => !p)}>
              <PenLine className="w-4 h-4 mr-2" />Acknowledge Asset
            </Button>
          </div>
        </div>

        {/* Pending Policies */}
        {pendingPolicies.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-orange-700">
                <Shield className="w-4 h-4" />Pending Policy Acceptance ({pendingPolicies.length})
              </CardTitle>
              <CardDescription>You must accept the following policies before accessing assets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingPolicies.map(policy => (
                <div key={policy.id} className="bg-white border border-orange-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{policy.title}</p>
                      <p className="text-xs text-gray-500 mt-1">Version {policy.version} · Effective {new Date(policy.effectiveDate).toLocaleDateString()}</p>
                      {policy.content && (
                        <div className="mt-2 max-h-24 overflow-y-auto text-xs text-gray-600 bg-gray-50 rounded-lg p-2 border">
                          {policy.content.slice(0, 500)}{policy.content.length > 500 ? '...' : ''}
                        </div>
                      )}
                    </div>
                    <Button size="sm" className="bg-orange-600 hover:bg-orange-700"
                      disabled={acceptingId === policy.id}
                      onClick={() => acceptPolicy(policy.id)}>
                      {acceptingId === policy.id ? 'Accepting...' : 'Accept Policy'}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Sign Asset Acknowledgment Form */}
        {showSigForm && (
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="text-base">Digital Asset Acknowledgment</CardTitle>
              <CardDescription>Digitally acknowledge receipt of an asset. Your signature will be recorded with timestamp and IP address.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Asset ID</label>
                <Input value={sigForm.assetId} onChange={e => setSigForm(f => ({ ...f, assetId: e.target.value }))} placeholder="Enter asset ID or scan RFID/barcode" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Notes (optional)</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={2}
                  value={sigForm.notes} onChange={e => setSigForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Condition on receipt, any notes..." />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <Shield className="w-3.5 h-3.5 inline mr-1" />
                By clicking "Sign & Acknowledge", you confirm receipt of this asset in satisfactory condition and agree to abide by the asset usage policies.
              </div>
              <div className="flex gap-2">
                <Button onClick={signAcknowledgment} disabled={signing} className="bg-green-600 hover:bg-green-700">
                  <PenLine className="w-4 h-4 mr-2" />{signing ? 'Signing...' : 'Sign & Acknowledge'}
                </Button>
                <Button variant="outline" onClick={() => setShowSigForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Acknowledgment History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Acknowledgment History ({acks.length})</CardTitle>
              <CardDescription>All asset acknowledgments — read-only audit trail</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-gray-400">Loading...</div>
            ) : acks.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <FileCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No acknowledgment records yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      {['Asset', 'Acknowledged On', 'IP Address', 'Policy Ver.', 'Notes', 'Signed'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {acks.map(ack => (
                      <tr key={ack.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">{ack.asset?.name || ack.assetId}</p>
                              <p className="text-xs text-gray-400">{ack.asset?.assetId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 text-gray-600">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {new Date(ack.acknowledgedAt).toLocaleString()}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-xs font-mono">{ack.ipAddress || '—'}</td>
                        <td className="py-3 px-4"><Badge className="text-xs bg-blue-100 text-blue-700">{ack.policyVersion || '1.0'}</Badge></td>
                        <td className="py-3 px-4 text-gray-500 text-xs">{ack.notes || '—'}</td>
                        <td className="py-3 px-4">
                          {ack.signature ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Clock className="w-4 h-4 text-gray-300" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

