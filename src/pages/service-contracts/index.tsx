// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  FileText, Plus, AlertTriangle, CheckCircle, Calendar,
  Package, Building, DollarSign, RefreshCw, Clock
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-700 border-green-200',
  EXPIRED:   'bg-red-100 text-red-700 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function ServiceContractsPage() {
  const { toast } = useToast();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    title: '', contractNumber: '', startDate: '', endDate: '',
    cost: 0, autoRenew: false, notifyDaysBefore: 30, coverageDetails: '',
  });

  const fetch_ = async () => {
    setLoading(true);
    const res = await fetch('/api/service-contracts').then(r => r.json()).catch(() => []);
    setContracts(Array.isArray(res) ? res : []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const create = async () => {
    if (!form.title || !form.startDate || !form.endDate) {
      toast({ variant: 'destructive', title: 'Title, start date and end date are required' }); return;
    }
    const res = await fetch('/api/service-contracts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (res.ok) {
      toast({ title: 'Service contract created' });
      setShowNew(false);
      setForm({ title: '', contractNumber: '', startDate: '', endDate: '', cost: 0, autoRenew: false, notifyDaysBefore: 30, coverageDetails: '' });
      fetch_();
    } else toast({ variant: 'destructive', title: 'Failed to create contract' });
  };

  const getDaysRemaining = (endDate: string) => {
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000);
    return days;
  };

  const expiring = contracts.filter(c => {
    const days = getDaysRemaining(c.endDate);
    return days > 0 && days <= (c.notifyDaysBefore || 30);
  });

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Service Contracts</h1>
              <p className="text-sm text-gray-500">Track asset warranties, service agreements, and maintenance contracts</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetch_} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
            <Button onClick={() => setShowNew(p => !p)} size="sm"><Plus className="w-4 h-4 mr-2" />New Contract</Button>
          </div>
        </div>

        {/* Expiring Soon Alert */}
        {expiring.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              <strong>{expiring.length} contract(s)</strong> expiring soon. Review and renew before they lapse.
            </p>
          </div>
        )}

        {/* New Contract Form */}
        {showNew && (
          <Card className="border-blue-200">
            <CardHeader><CardTitle className="text-sm">Create Service Contract</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Contract Title</label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Annual Maintenance Agreement" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Contract Number</label>
                  <Input value={form.contractNumber} onChange={e => setForm(f => ({ ...f, contractNumber: e.target.value }))} placeholder="SVC-2026-001" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Start Date</label>
                  <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">End Date</label>
                  <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Annual Cost ($)</label>
                  <Input type="number" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Notify Days Before Expiry</label>
                  <Input type="number" value={form.notifyDaysBefore} onChange={e => setForm(f => ({ ...f, notifyDaysBefore: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Coverage Details</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={2}
                  value={form.coverageDetails} onChange={e => setForm(f => ({ ...f, coverageDetails: e.target.value }))}
                  placeholder="What is covered under this contract..." />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="autoRenew" checked={form.autoRenew}
                  onChange={e => setForm(f => ({ ...f, autoRenew: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
                <label htmlFor="autoRenew" className="text-sm">Auto-renewal enabled</label>
              </div>
              <div className="flex gap-2">
                <Button onClick={create}>Create Contract</Button>
                <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Contracts', value: contracts.length, color: 'text-gray-700' },
            { label: 'Active', value: contracts.filter(c => c.status === 'ACTIVE').length, color: 'text-green-600' },
            { label: 'Expiring Soon', value: expiring.length, color: 'text-amber-600' },
          ].map(({ label, value, color }) => (
            <Card key={label} className="text-center py-4">
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </Card>
          ))}
        </div>

        {/* Contracts List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-gray-400">Loading contracts...</div>
            ) : contracts.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No service contracts yet. Add one above.</p>
              </div>
            ) : (
              <div className="divide-y">
                {contracts.map(contract => {
                  const daysLeft = getDaysRemaining(contract.endDate);
                  const isExpiringSoon = daysLeft > 0 && daysLeft <= (contract.notifyDaysBefore || 30);
                  const isExpired = daysLeft <= 0;

                  return (
                    <div key={contract.id} className={`p-4 hover:bg-gray-50 ${isExpiringSoon ? 'bg-amber-50/40' : isExpired ? 'bg-red-50/30' : ''}`}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <p className="font-semibold text-gray-900">{contract.title}</p>
                            {contract.contractNumber && (
                              <span className="text-xs text-gray-400 font-mono">#{contract.contractNumber}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                            {contract.asset && (
                              <span className="flex items-center gap-1"><Package className="w-3 h-3" />{contract.asset.name}</span>
                            )}
                            {contract.vendor && (
                              <span className="flex items-center gap-1"><Building className="w-3 h-3" />{contract.vendor.name}</span>
                            )}
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />
                              {new Date(contract.startDate).toLocaleDateString()} → {new Date(contract.endDate).toLocaleDateString()}
                            </span>
                            {contract.cost > 0 && (
                              <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${contract.cost.toLocaleString()}</span>
                            )}
                          </div>
                          {contract.coverageDetails && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-1">{contract.coverageDetails}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isExpired ? (
                            <Badge className="bg-red-100 text-red-700 border-red-200">
                              <AlertTriangle className="w-3 h-3 mr-1" />Expired
                            </Badge>
                          ) : isExpiringSoon ? (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                              <Clock className="w-3 h-3 mr-1" />{daysLeft}d remaining
                            </Badge>
                          ) : (
                            <Badge className={`border ${STATUS_COLORS[contract.status] || STATUS_COLORS.ACTIVE}`}>
                              <CheckCircle className="w-3 h-3 mr-1" />{daysLeft}d remaining
                            </Badge>
                          )}
                          {contract.autoRenew && (
                            <Badge className="text-xs bg-blue-100 text-blue-700">Auto-renew</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
